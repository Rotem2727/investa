import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAdKXFPMjYamBbNAG2z1Kj8Cp8HjMFcrYA",
    authDomain: "shiftstock-9ba92.firebaseapp.com",
    projectId: "shiftstock-9ba92",
    storageBucket: "shiftstock-9ba92.appspot.com",
    messagingSenderId: "637859468099",
    appId: "1:637859468099:web:26d7984a3296f6b9bb15f6",
    measurementId: "G-EE5FEY81E6"
};

let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    displayProfileNotification("Error connecting to services. Profile data may not load.", "error");
}

const userGreetingHeader = document.getElementById("user-greeting");
const userProfilePictureHeader = document.getElementById("user-profile-picture");
const logoutButton = document.getElementById("logout-button");

const profilePictureDisplay = document.getElementById("profile-picture-display");
const profileUsernameSpan = document.getElementById("profile-username");
const profileEmailSpan = document.getElementById("profile-email");
const profileMemberSinceSpan = document.getElementById("profile-member-since");
const profileBioTextSpan = document.getElementById("profile-bio-text"); // Added bio display element

const profilePortfolioCountSpan = document.getElementById("profile-portfolio-count");
const profileFollowersSpan = document.getElementById("profile-followers");
const profileTransactionsCountSpan = document.getElementById("profile-transactions-count");

const profileTotalValueSpan = document.getElementById("profile-total-value");
const profileTotalPLSpan = document.getElementById("profile-total-pl");

const profilePortfolioList = document.getElementById("profile-portfolio-list");
const profileTransactionsList = document.getElementById("profile-transactions-list");

const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

const notificationAreaProfile = document.getElementById("notification-area-profile");

let currentUser = null;
let currentUserData = null;
let userHoldings = {};

function displayProfileNotification(message, type = 'info', duration = 5000) {
    if (!notificationAreaProfile) return;
    const notification = document.createElement('div');
    notification.classList.add('notification-message', type);
    notification.textContent = message;
    notificationAreaProfile.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.addEventListener('transitionend', () => {
             if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, { once: true });
    }, duration);
}

function formatCurrency(value) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof num !== 'number' || isNaN(num)) return 'N/A';
    return `$${num.toFixed(2)}`;
}

function formatPercentage(value) {
     const num = typeof value === 'string' ? parseFloat(value) : value;
     if (typeof num !== 'number' || isNaN(num)) return 'N/A';
     const sign = num > 0 ? '+' : '';
     return `${sign}${num.toFixed(2)}%`;
}

function getChangeClass(value) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof num !== 'number' || isNaN(num)) return '';
    return num >= 0 ? 'positive' : 'negative';
}

function processTransactions(transactions) {
    const tempHoldings = {};
    if (!transactions) return {};
    const sortedTransactions = [...transactions].sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp.getTime() : (typeof a.timestamp?.toDate === 'function' ? a.timestamp.toDate().getTime() : 0);
        const dateB = b.timestamp instanceof Date ? b.timestamp.getTime() : (typeof b.timestamp?.toDate === 'function' ? b.timestamp.toDate().getTime() : 0);
        return dateA - dateB;
    });
    sortedTransactions.forEach(transaction => {
        const { symbol, type, quantity, price } = transaction;
        if (!symbol || (type !== 'buy' && type !== 'sell') || !(quantity > 0) || !(price > 0)) return;
        const s = symbol.toUpperCase();
        if (!tempHoldings[s]) tempHoldings[s] = { quantity: 0, totalCost: 0 };
        if (type === 'buy') {
            tempHoldings[s].quantity += quantity;
            tempHoldings[s].totalCost += quantity * price;
        } else if (type === 'sell') {
             const quantityToSell = quantity;
             const currentQuantity = tempHoldings[s].quantity;
             const currentTotalCost = tempHoldings[s].totalCost;
             if (currentQuantity >= quantityToSell) {
                 const proportionSold = quantityToSell / currentQuantity;
                 tempHoldings[s].totalCost -= currentTotalCost * proportionSold;
                 tempHoldings[s].quantity -= quantityToSell;
                 if (tempHoldings[s].quantity < 1e-9) {
                     tempHoldings[s].quantity = 0;
                     tempHoldings[s].totalCost = 0;
                 }
             } else {
                 tempHoldings[s].quantity = 0;
                 tempHoldings[s].totalCost = 0;
             }
        }
    });
    const processedHoldings = {};
    for (const symbol in tempHoldings) {
        if (tempHoldings[symbol].quantity > 0) {
            processedHoldings[symbol] = {
                quantity: tempHoldings[symbol].quantity,
                totalCost: tempHoldings[symbol].totalCost,
                averagePrice: tempHoldings[symbol].quantity > 0 ? tempHoldings[symbol].totalCost / tempHoldings[symbol].quantity : 0
            };
        }
    }
    return processedHoldings;
}

async function loadAndDisplayUserProfile() {
    if (!currentUser || !db) {
         if (profileUsernameSpan) profileUsernameSpan.textContent = "N/A";
         if (profileEmailSpan) profileEmailSpan.textContent = "N/A";
         if (profileBioTextSpan) profileBioTextSpan.textContent = "Bio not available.";
         if (profilePictureDisplay) profilePictureDisplay.src = 'https://placehold.co/150x150/eee/ccc?text=?';
         if (profileMemberSinceSpan) profileMemberSinceSpan.textContent = "N/A";
         if (profileTotalValueSpan) profileTotalValueSpan.textContent = "N/A";
         if (profileTotalPLSpan) { profileTotalPLSpan.textContent = "N/A"; profileTotalPLSpan.className = 'summary-value'; }
         if (profileFollowersSpan) profileFollowersSpan.textContent = "0";
         if (profilePortfolioCountSpan) profilePortfolioCountSpan.textContent = "0";
         if (profileTransactionsCountSpan) profileTransactionsCountSpan.textContent = "0";
         if (profilePortfolioList) profilePortfolioList.innerHTML = '<p class="info-message">Please log in to see your portfolio.</p>';
         if (profileTransactionsList) profileTransactionsList.innerHTML = '<p class="info-message">Please log in to see your transactions.</p>';
        return;
    }

    const userDocRef = doc(db, "users", currentUser.uid);

    if (profileUsernameSpan) profileUsernameSpan.textContent = "Loading...";
    if (profileEmailSpan) profileEmailSpan.textContent = `Email: Loading... (Private)`;
    if (profileBioTextSpan) profileBioTextSpan.textContent = "Loading bio...";
    if (profilePictureDisplay) profilePictureDisplay.src = currentUser.photoURL || 'https://placehold.co/150x150/eee/ccc?text=Loading';
    if (profileMemberSinceSpan) profileMemberSinceSpan.textContent = "Member Since: Loading...";
    if (profileTotalValueSpan) profileTotalValueSpan.textContent = "Loading...";
    if (profileTotalPLSpan) { profileTotalPLSpan.textContent = "Loading..."; profileTotalPLSpan.className = 'summary-value'; }
    if (profileFollowersSpan) profileFollowersSpan.textContent = "Loading...";
    if (profilePortfolioCountSpan) profilePortfolioCountSpan.textContent = "Loading...";
    if (profileTransactionsCountSpan) profileTransactionsCountSpan.textContent = "Loading...";
    if (profilePortfolioList) profilePortfolioList.innerHTML = '<p class="info-message">Loading portfolio details...</p>';
    if (profileTransactionsList) profileTransactionsList.innerHTML = '<p class="info-message">Loading transaction history...</p>';

    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            userHoldings = processTransactions(currentUserData.transactions);

            const usernameToDisplay = currentUserData.originalUsername || currentUserData.username || "User";
            if (profileUsernameSpan) profileUsernameSpan.textContent = usernameToDisplay;
            if (profileEmailSpan) profileEmailSpan.textContent = `Email: ${currentUserData.email || "N/A"} (Private)`;
            if (profileBioTextSpan) profileBioTextSpan.textContent = currentUserData.bio || "No bio provided.";


            if (profilePictureDisplay) {
                profilePictureDisplay.src = currentUserData.profilePictureUrl || currentUser.photoURL || 'https://placehold.co/150x150/eee/ccc?text=?';
                profilePictureDisplay.alt = `${usernameToDisplay}'s Profile Picture`;
            }
            profilePictureDisplay.onerror = () => {
                 profilePictureDisplay.src = 'https://placehold.co/150x150/eee/ccc?text=Error';
                 profilePictureDisplay.alt = "Error loading picture";
            };

            if (profileMemberSinceSpan && currentUser.metadata?.creationTime) {
                 try {
                     const creationDate = new Date(currentUser.metadata.creationTime);
                     profileMemberSinceSpan.textContent = `Member Since: ${creationDate.toLocaleDateString()}`;
                 } catch (e) {
                     profileMemberSinceSpan.textContent = "Member Since: Date unavailable";
                 }
            } else if (profileMemberSinceSpan) {
                 profileMemberSinceSpan.textContent = "Member Since: Date unavailable";
            }

            const portfolioSymbols = Object.keys(userHoldings);
            const transactionCount = currentUserData.transactions?.length || 0;
            const followerCount = currentUserData.followerCount !== undefined ? currentUserData.followerCount : 0;

            if (profilePortfolioCountSpan) profilePortfolioCountSpan.textContent = portfolioSymbols.length;
            if (profileFollowersSpan) profileFollowersSpan.textContent = followerCount;
            if (profileTransactionsCountSpan) profileTransactionsCountSpan.textContent = transactionCount;

            if (portfolioSymbols.length > 0) {
                 await displayProfilePortfolio(userHoldings);
            } else {
                 if (profileTotalValueSpan) profileTotalValueSpan.textContent = formatCurrency(0);
                 if (profileTotalPLSpan) { profileTotalPLSpan.textContent = `${formatCurrency(0)} (${formatPercentage(0)})`; profileTotalPLSpan.className = 'summary-value positive'; }
                 if (profilePortfolioList) profilePortfolioList.innerHTML = '<p class="info-message">Your portfolio is empty.</p>';
            }

            if (transactionCount > 0) {
                 displayTransactionLog(currentUserData.transactions);
            } else {
                 if (profileTransactionsList) profileTransactionsList.innerHTML = '<p class="info-message">No transactions recorded yet.</p>';
            }
        } else {
            displayProfileNotification("Could not load all profile details from database.", "error");
             const usernameToDisplay = currentUser.displayName || currentUser.email?.split('@')[0] || "User";
             if (profileUsernameSpan) profileUsernameSpan.textContent = usernameToDisplay;
             if (profileEmailSpan) profileEmailSpan.textContent = `Email: ${currentUser.email || "N/A"} (Private)`;
             if (profileBioTextSpan) profileBioTextSpan.textContent = "Bio not found.";
             if (profilePictureDisplay) profilePictureDisplay.src = currentUser.photoURL || 'https://placehold.co/150x150/eee/ccc?text=?';
             profilePictureDisplay.alt = `${usernameToDisplay}'s Profile Picture`;
             profilePictureDisplay.onerror = () => {
                 profilePictureDisplay.src = 'https://placehold.co/150x150/eee/ccc?text=Error';
                 profilePictureDisplay.alt = "Error loading picture";
             };
             if (profileMemberSinceSpan && currentUser.metadata?.creationTime) {
                 try {
                     const creationDate = new Date(currentUser.metadata.creationTime);
                     profileMemberSinceSpan.textContent = `Member Since: ${creationDate.toLocaleDateString()}`;
                 } catch (e) {
                     profileMemberSinceSpan.textContent = "Member Since: Date unavailable";
                 }
             } else if (profileMemberSinceSpan) {
                 profileMemberSinceSpan.textContent = "Member Since: Date unavailable";
             }
             if (profilePortfolioCountSpan) profilePortfolioCountSpan.textContent = "0";
             if (profileFollowersSpan) profileFollowersSpan.textContent = "0";
             if (profileTransactionsCountSpan) profileTransactionsCountSpan.textContent = "0";
             if (profileTotalValueSpan) profileTotalValueSpan.textContent = formatCurrency(0);
             if (profileTotalPLSpan) { profileTotalPLSpan.textContent = `${formatCurrency(0)} (${formatPercentage(0)})`; profileTotalPLSpan.className = 'summary-value positive'; }
             if (profilePortfolioList) profilePortfolioList.innerHTML = '<p class="info-message">Could not load portfolio details.</p>';
             if (profileTransactionsList) profileTransactionsList.innerHTML = '<p class="info-message">Could not load transaction history.</p>';
        }
    } catch (error) {
        displayProfileNotification("Error loading profile details.", "error");
         if (profileUsernameSpan) profileUsernameSpan.textContent = "Error";
         if (profileEmailSpan) profileEmailSpan.textContent = `Email: Error`;
         if (profileBioTextSpan) profileBioTextSpan.textContent = "Error loading bio.";
         if (profilePictureDisplay) { profilePictureDisplay.src = 'https://placehold.co/150x150/eee/ccc?text=Error'; profilePictureDisplay.alt = "Error loading picture"; }
         if (profileMemberSinceSpan) profileMemberSinceSpan.textContent = "Member Since: Error";
         if (profilePortfolioCountSpan) profilePortfolioCountSpan.textContent = "Error";
         if (profileFollowersSpan) profileFollowersSpan.textContent = "Error";
         if (profileTransactionsCountSpan) profileTransactionsCountSpan.textContent = "Error";
         if (profileTotalValueSpan) profileTotalValueSpan.textContent = "Error";
         if (profileTotalPLSpan) { profileTotalPLSpan.textContent = "Error"; profileTotalPLSpan.className = 'summary-value negative'; }
         if (profilePortfolioList) profilePortfolioList.innerHTML = '<p class="error-message">Error loading portfolio details.</p>';
         if (profileTransactionsList) profileTransactionsList.innerHTML = '<p class="error-message">Error loading transaction history.</p>';
    }
    updateHeaderUI();
}

async function displayProfilePortfolio(holdings) {
    if (!profilePortfolioList || !profileTotalValueSpan || !profileTotalPLSpan) return;
    profilePortfolioList.innerHTML = '';
    const symbols = Object.keys(holdings);
    if (symbols.length === 0) {
        profilePortfolioList.innerHTML = '<p class="info-message">Your portfolio is empty.</p>';
         if (profileTotalValueSpan) profileTotalValueSpan.textContent = formatCurrency(0);
         if (profileTotalPLSpan) { profileTotalPLSpan.textContent = `${formatCurrency(0)} (${formatPercentage(0)})`; profileTotalPLSpan.className = 'summary-value positive'; }
        return;
    }
    const fetchPromises = symbols.map(symbol => fetchStockData(symbol));
    const results = await Promise.allSettled(fetchPromises);
    let totalPortfolioValue = 0;
    let totalCostBasis = 0;
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value?.ticker) {
            const data = result.value;
            const symbol = data.ticker;
            const holding = holdings[symbol];
            if (holding?.quantity > 0) {
                const portfolioItem = document.createElement('div');
                portfolioItem.classList.add('portfolio-item');
                const logoUrl = data.logo || `https://placehold.co/48x48/eee/ccc?text=${symbol[0]}`;
                const companyName = data.name || symbol;
                const currentPrice = typeof data.c === 'number' ? data.c : NaN;
                const quantityOwned = holding.quantity;
                const averageBuyPrice = holding.averagePrice;
                const currentValue = (typeof currentPrice === 'number') ? currentPrice * quantityOwned : NaN;
                const costBasis = holding.totalCost;
                const profitLoss = (!isNaN(currentValue) && !isNaN(costBasis)) ? currentValue - costBasis : NaN;
                const profitLossPercent = (!isNaN(profitLoss) && costBasis > 0) ? (profitLoss / costBasis) * 100 : NaN;
                const plClass = getChangeClass(profitLoss);
                 if (!isNaN(currentValue)) totalPortfolioValue += currentValue;
                 if (!isNaN(costBasis)) totalCostBasis += costBasis;
                portfolioItem.innerHTML = `
                    <div class="portfolio-item-header">
                        <img class="portfolio-stock-logo" src="${logoUrl}" alt="${companyName} logo" onerror="this.src='https://placehold.co/48x48/eee/ccc?text=${symbol[0]}'; this.onerror=null;">
                        <div class="portfolio-stock-details">
                            <span class="portfolio-symbol">${symbol}</span>
                            <span class="portfolio-company-name">${companyName}</span>
                        </div>
                    </div>
                    <div class="portfolio-item-stats">
                        <div class="portfolio-item-stat">Qty: <strong>${quantityOwned.toFixed(quantityOwned % 1 === 0 ? 0 : 2)}</strong></div>
                        <div class="portfolio-item-stat">Avg Cost: <strong>${formatCurrency(averageBuyPrice)}</strong></div>
                        <div class="portfolio-item-stat">Current Price: <strong>${formatCurrency(currentPrice)}</strong></div>
                    </div>
                     <div class="portfolio-item-stats">
                         <div class="portfolio-item-stat">Value: <strong>${formatCurrency(currentValue)}</strong></div>
                         <div class="portfolio-item-stat portfolio-item-pl ${plClass}">P/L: <span>${formatCurrency(profitLoss)} (${formatPercentage(profitLossPercent)})</span></div>
                     </div>
                `;
                profilePortfolioList.appendChild(portfolioItem);
            }
        } else {
             const symbolWithError = symbols.find(sym => result.reason?.message?.includes(sym) || result.reason?.detail?.includes(sym));
             if(symbolWithError && holdings[symbolWithError]?.quantity > 0) {
                 const errorItem = document.createElement('div');
                 errorItem.classList.add('portfolio-item', 'error-message');
                 errorItem.textContent = `Could not load data for ${symbolWithError} (${holdings[symbolWithError].quantity.toFixed(holdings[symbolWithError].quantity % 1 === 0 ? 0 : 2)} shares).`;
                 profilePortfolioList.appendChild(errorItem);
                 if (!isNaN(holdings[symbolWithError].totalCost)) totalCostBasis += holdings[symbolWithError].totalCost;
             }
        }
    });
     const totalProfitLoss = totalPortfolioValue - totalCostBasis;
     const totalProfitLossPercent = totalCostBasis > 0 ? (totalProfitLoss / totalCostBasis) * 100 : 0;
     if (profileTotalValueSpan) profileTotalValueSpan.textContent = formatCurrency(totalPortfolioValue);
     if (profileTotalPLSpan) {
         profileTotalPLSpan.textContent = `${formatCurrency(totalProfitLoss)} (${formatPercentage(totalProfitLossPercent)})`;
         profileTotalPLSpan.className = `summary-value ${getChangeClass(totalProfitLoss)}`;
     }
     if (profilePortfolioList.children.length === 0 && symbols.length > 0) {
         profilePortfolioList.innerHTML = '<p class="error-message">Could not load data for your portfolio holdings.</p>';
     } else if (profilePortfolioList.children.length === 0) {
          profilePortfolioList.innerHTML = '<p class="info-message">Your portfolio is empty.</p>';
     }
}

function displayTransactionLog(transactions) {
    if (!profileTransactionsList) return;
    profileTransactionsList.innerHTML = '';
    if (!transactions || transactions.length === 0) {
        profileTransactionsList.innerHTML = '<p class="info-message">No transactions recorded yet.</p>';
        return;
    }
    const sortedTransactions = [...transactions].sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp.getTime() : (typeof a.timestamp?.toDate === 'function' ? a.timestamp.toDate().getTime() : 0);
        const dateB = b.timestamp instanceof Date ? b.timestamp.getTime() : (typeof b.timestamp?.toDate === 'function' ? b.timestamp.toDate().getTime() : 0);
        return dateB - dateA;
    });
    sortedTransactions.forEach(transaction => {
        const { symbol, type, quantity, price, timestamp } = transaction;
        if (!symbol || !type || !(quantity > 0) || !(price > 0)) return;
        const transactionItem = document.createElement('div');
        transactionItem.classList.add('transaction-item');
        const typeClass = type === 'buy' ? 'buy' : 'sell';
        let formattedDate = 'Date unavailable';
        if (timestamp instanceof Date) {
             formattedDate = timestamp.toLocaleString();
        } else if (typeof timestamp?.toDate === 'function') {
             try { formattedDate = timestamp.toDate().toLocaleString(); } catch(e) { /* Error formatting date */ }
        } else if (typeof timestamp === 'number') {
             try { formattedDate = new Date(timestamp * 1000).toLocaleString(); } catch(e) { /* Error formatting date */ }
        }
        transactionItem.innerHTML = `
            <div class="transaction-details">
                <div class="transaction-type-symbol">
                    <span class="${typeClass}">${type.toUpperCase()}</span> ${symbol.toUpperCase()}
                </div>
                <div class="transaction-info">
                    Qty: <strong>${quantity.toFixed(quantity % 1 === 0 ? 0 : 2)}</strong> at <strong>${formatCurrency(price)}</strong>
                </div>
            </div>
            <div class="transaction-date">${formattedDate}</div>
        `;
        profileTransactionsList.appendChild(transactionItem);
    });
    if (profileTransactionsList.children.length === 0 && transactions.length > 0) {
         profileTransactionsList.innerHTML = '<p class="error-message">Could not display transaction history.</p>';
    } else if (profileTransactionsList.children.length === 0) {
         profileTransactionsList.innerHTML = '<p class="info-message">No transactions recorded yet.</p>';
    }
}

function updateHeaderUI() {
    const usernameToDisplay = currentUserData?.originalUsername || currentUserData?.username || currentUser?.displayName || currentUser?.email?.split('@')[0] || "User";
    const profilePictureUrl = currentUserData?.profilePictureUrl || currentUser?.photoURL || 'https://placehold.co/30x30/eee/ccc?text=?';
    const headerGreeting = document.getElementById("user-greeting");
    const headerProfilePic = document.getElementById("user-profile-picture");
    if (headerGreeting) {
        headerGreeting.textContent = `Hello, ${usernameToDisplay}!`;
    }
    if (headerProfilePic) {
        headerProfilePic.src = profilePictureUrl;
        headerProfilePic.alt = `${usernameToDisplay}'s Profile Picture`;
         headerProfilePic.onerror = () => {
            headerProfilePic.src = 'https://placehold.co/30x30/eee/ccc?text=!';
            headerProfilePic.alt = "Error loading picture";
         };
    }
}

if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadAndDisplayUserProfile();
        } else {
            currentUser = null;
            currentUserData = null;
            userHoldings = {};
            loadAndDisplayUserProfile(); // This will set N/A states
            window.location.href = 'login.html';
        }
    });
} else {
    displayProfileNotification("Authentication service not available.", "error");
    if (userGreetingHeader) userGreetingHeader.textContent = "Error";
    if (userProfilePictureHeader) userProfilePictureHeader.src = 'https://placehold.co/30x30/eee/ccc?text=!';
     loadAndDisplayUserProfile();
}

if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        if (auth) {
            signOut(auth).catch((error) => {
                displayProfileNotification("Error signing out.", "error");
            });
        }
    });
}

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
});

async function fetchStockData(symbol) {
     try {
         const response = await fetch(`http://127.0.0.1:8000/get-company-data?symbol=${symbol}`);
         if (!response.ok) {
             // const errorDetail = await response.text();
             return { ticker: symbol, error: true, message: `Could not load data (${response.status})` };
         }
         const data = await response.json();
          if (!data || typeof data !== 'object' || !data.ticker) {
               return { ticker: symbol, error: true, message: `Invalid data format` };
          }
         return data;
     } catch (error) {
         return { ticker: symbol, error: true, message: `Network error` };
     }
}
