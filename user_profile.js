import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAdKXFPMjYamBbNAG2z1Kj8Cp8HjMFcrYA",
    authDomain: "shiftstock-9ba92.firebaseapp.com",
    projectId: "shiftstock-9ba92",
    storageBucket: "shiftstock-9ba92.appspot.com",
    messagingSenderId: "637859468099",
    appId: "1:637859468099:web:26d7984a3296f6f9bb15f6",
    measurementId: "G-EE5FEY81E6"
};

let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    displayNotification("Error connecting to services. User profile data may not load.", "error");
}

const userGreetingHeader = document.getElementById("user-greeting");
const userProfilePictureHeader = document.getElementById("user-profile-picture");
const logoutButton = document.getElementById("logout-button");
const userProfilePictureDisplay = document.getElementById("user-profile-picture-display");
const userProfileUsernameSpan = document.getElementById("user-profile-username");
const userProfileMemberSinceSpan = document.getElementById("user-profile-member-since");
const userProfilePLSpan = document.getElementById("user-profile-pl");
const userProfilePortfolioCountSpan = document.getElementById("user-profile-portfolio-count");
const userProfileFollowersSpan = document.getElementById("user-profile-followers");
const userProfileTransactionsCountSpan = document.getElementById("user-profile-transactions-count");
const userProfileTotalValueSpan = document.getElementById("user-profile-total-value");
const userProfileTotalPLSummarySpan = document.getElementById("user-profile-total-pl-summary");
const userProfilePortfolioList = document.getElementById("user-profile-portfolio-list");
const userProfileTransactionsList = document.getElementById("user-profile-transactions-list");
const tabButtons = document.querySelectorAll(".content-tabs .tab-button");
const tabContents = document.querySelectorAll(".profile-content-section .tab-content");
const followUserButton = document.getElementById("follow-user-button");
const notificationArea = document.getElementById("notification-area-user-profile");
const userProfileBioTextSpan = document.getElementById("user-profile-bio-text");

let currentUser = null;
let displayedUserId = null;
let displayedUserData = null;
let currentUserFollowing = new Set();

function displayNotification(message, type = 'info', duration = 5000) {
    if (!notificationArea) return;
    const notification = document.createElement('div');
    notification.classList.add('notification-message', type);
    notification.textContent = message;
    notificationArea.appendChild(notification);
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

// Processes transactions for the displayed user to get detailed holdings (qty, cost, avgPrice)
function processDisplayedUserTransactionsAndHoldings(transactions) {
    const tempHoldings = {};
    if (!transactions) return {};

    const sortedTransactions = [...transactions].sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp.getTime() : (typeof a.timestamp?.toDate === 'function' ? a.timestamp.toDate().getTime() : 0);
        const dateB = b.timestamp instanceof Date ? b.timestamp.getTime() : (typeof b.timestamp?.toDate === 'function' ? b.timestamp.toDate().getTime() : 0);
        return dateA - dateB;
    });

    sortedTransactions.forEach(transaction => {
        const { symbol, type, quantity, price } = transaction; // Assuming price is stored with transaction
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


function updateHeaderUI(loggedInUser) {
    const headerGreeting = document.getElementById("user-greeting");
    const headerProfilePic = document.getElementById("user-profile-picture");
    if (loggedInUser && headerGreeting) {
        const usernameToDisplay = loggedInUser.displayName || loggedInUser.email?.split('@')[0] || "User";
        const profilePictureUrl = loggedInUser.photoURL || 'https://placehold.co/30x30/eee/ccc?text=?';
        headerGreeting.textContent = `Hello, ${usernameToDisplay}!`;
         if (headerProfilePic) {
            headerProfilePic.src = profilePictureUrl;
            headerProfilePic.alt = `${usernameToDisplay}'s Profile Picture`;
             headerProfilePic.onerror = () => {
                headerProfilePic.src = 'https://placehold.co/30x30/eee/ccc?text=!';
                headerProfilePic.alt = "Error loading picture";
             };
        }
    } else {
         if (headerGreeting) headerGreeting.textContent = "Guest";
         if (headerProfilePic) headerProfilePic.src = 'https://placehold.co/30x30/eee/ccc?text=?';
    }
}

if (auth) {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            await loadCurrentUserFollowing();
            loadAndDisplayUserProfile(getQueryParameter('userId'));
            updateHeaderUI(user);
        } else {
            updateHeaderUI(null);
            loadAndDisplayUserProfile(getQueryParameter('userId')); // Load profile even if no one is logged in
        }
    });
} else {
    displayNotification("Authentication service not available. Cannot load user profile.", "error");
    const headerGreeting = document.getElementById("user-greeting");
    const headerProfilePic = document.getElementById("user-profile-picture");
    if (headerGreeting) headerGreeting.textContent = "Error";
    if (headerProfilePic) headerProfilePic.src = 'https://placehold.co/30x30/eee/ccc?text=!';
}

async function loadAndDisplayUserProfile(userIdToLoad) {
     if (!db) {
         displayNotification("Database connection error. Cannot load profile.", "error");
         setUserProfileErrorState("Database Error");
         return;
     }
    if (!userIdToLoad) {
        if (currentUser) {
            window.location.href = `profile.html`; // Redirect to own profile if logged in and no specific user requested
        } else {
             displayNotification("No user specified to display.", "error"); // If not logged in and no user in URL
             setUserProfileErrorState("No User Specified");
        }
        return;
    }
    if (currentUser && userIdToLoad === currentUser.uid) {
        window.location.href = `profile.html`; // Redirect to own profile page if trying to view self via user_profile.html
        return;
    }
    displayedUserId = userIdToLoad;
    setUserProfileLoadingState();
    const userDocRef = doc(db, "users", displayedUserId);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            displayedUserData = docSnap.data();
            const usernameToDisplay = displayedUserData.originalUsername || displayedUserData.username || "User";
            if (userProfileUsernameSpan) userProfileUsernameSpan.textContent = usernameToDisplay;
            const profilePictureUrl = displayedUserData.profilePictureUrl || `https://placehold.co/200x200/eee/ccc?text=${usernameToDisplay.charAt(0).toUpperCase()}`;
            if (userProfilePictureDisplay) {
                userProfilePictureDisplay.src = profilePictureUrl;
                userProfilePictureDisplay.alt = `${usernameToDisplay}'s Profile Picture`;
                userProfilePictureDisplay.onerror = () => {
                     userProfilePictureDisplay.src = 'https://placehold.co/200x200/eee/ccc?text=Error';
                     userProfilePictureDisplay.alt = "Error loading picture";
                };
            }
            if (userProfileBioTextSpan) userProfileBioTextSpan.textContent = displayedUserData.bio || "No bio provided.";
            let memberSinceText = "Member Since: Date unavailable";
             if (displayedUserData.createdAt instanceof Date) {
                  memberSinceText = `Member Since: ${displayedUserData.createdAt.toLocaleDateString()}`;
             } else if (typeof displayedUserData.createdAt?.toDate === 'function') {
                  try { memberSinceText = `Member Since: ${displayedUserData.createdAt.toDate().toLocaleDateString()}`; }
                  catch(e) { /* Error formatting date */ }
             }
            if (userProfileMemberSinceSpan) userProfileMemberSinceSpan.textContent = memberSinceText;

            // P/L in bio will be updated by displayUserProfilePortfolio
            const transactionCount = displayedUserData.transactions?.length || 0;
            const followerCount = displayedUserData.followerCount !== undefined ? displayedUserData.followerCount : 0;
            
            const detailedHoldings = processDisplayedUserTransactionsAndHoldings(displayedUserData.transactions);
            const portfolioStockCount = Object.keys(detailedHoldings).length;

            if (userProfilePortfolioCountSpan) userProfilePortfolioCountSpan.textContent = portfolioStockCount;
            if (userProfileFollowersSpan) userProfileFollowersSpan.textContent = followerCount;
            if (userProfileTransactionsCountSpan) userProfileTransactionsCountSpan.textContent = transactionCount;
            
            await displayUserProfilePortfolio(detailedHoldings); // Pass detailed holdings
            displayUserProfileTransactionLog(displayedUserData.transactions);
        } else {
            displayNotification("User profile not found.", "error");
            setUserProfileErrorState("User Not Found");
        }
    } catch (error) {
        displayNotification("Error loading user profile details.", "error");
        setUserProfileErrorState("Error Loading Profile");
    } finally {
         if (currentUser && followUserButton && displayedUserId) {
              followUserButton.dataset.userId = displayedUserId;
              updateFollowButtonState(displayedUserId, currentUserFollowing.has(displayedUserId));
              followUserButton.style.display = 'inline-block';
         } else if (followUserButton) {
             followUserButton.style.display = 'none';
         }
    }
}

function setUserProfileLoadingState() {
     if (userProfileUsernameSpan) userProfileUsernameSpan.textContent = "Loading...";
     if (userProfilePictureDisplay) userProfilePictureDisplay.src = 'https://placehold.co/200x200/eee/ccc?text=Loading';
     if (userProfilePictureDisplay) userProfilePictureDisplay.alt = "Loading...";
     if (userProfileMemberSinceSpan) userProfileMemberSinceSpan.textContent = "Member Since: Loading...";
     if (userProfilePLSpan) { userProfilePLSpan.textContent = "Total P/L: Loading..."; userProfilePLSpan.className = 'profile-bio'; }
     if (userProfilePortfolioCountSpan) userProfilePortfolioCountSpan.textContent = "...";
     if (userProfileFollowersSpan) userProfileFollowersSpan.textContent = "...";
     if (userProfileTransactionsCountSpan) userProfileTransactionsCountSpan.textContent = "...";
     if (userProfileTotalValueSpan) userProfileTotalValueSpan.textContent = "Loading...";
     if (userProfileTotalPLSummarySpan) { userProfileTotalPLSummarySpan.textContent = "Loading..."; userProfileTotalPLSummarySpan.className = 'summary-value'; }
     if (userProfilePortfolioList) userProfilePortfolioList.innerHTML = '<p class="info-message">Loading portfolio details...</p>';
     if (userProfileTransactionsList) userProfileTransactionsList.innerHTML = '<p class="info-message">Loading recent transactions...</p>';
     if (followUserButton) { followUserButton.disabled = true; followUserButton.textContent = "Loading..."; }
}

function setUserProfileErrorState(message = "Could not load profile.") {
     if (userProfileUsernameSpan) userProfileUsernameSpan.textContent = `Error: ${message}`;
     if (userProfilePictureDisplay) userProfilePictureDisplay.src = 'https://placehold.co/200x200/eee/ccc?text=Error';
     if (userProfilePictureDisplay) userProfilePictureDisplay.alt = "Error";
     if (userProfileMemberSinceSpan) userProfileMemberSinceSpan.textContent = "Member Since: Error";
     if (userProfilePLSpan) { userProfilePLSpan.textContent = "Total P/L: Error"; userProfilePLSpan.className = 'profile-bio negative'; }
     if (userProfilePortfolioCountSpan) userProfilePortfolioCountSpan.textContent = "-";
     if (userProfileFollowersSpan) userProfileFollowersSpan.textContent = "-";
     if (userProfileTransactionsCountSpan) userProfileTransactionsCountSpan.textContent = "-";
     if (userProfileTotalValueSpan) userProfileTotalValueSpan.textContent = "Error";
     if (userProfileTotalPLSummarySpan) { userProfileTotalPLSummarySpan.textContent = "Error"; userProfileTotalPLSummarySpan.className = 'summary-value negative'; }
     if (userProfilePortfolioList) userProfilePortfolioList.innerHTML = `<p class="error-message">${message}</p>`;
     if (userProfileTransactionsList) userProfileTransactionsList.innerHTML = `<p class="error-message">${message}</p>`;
     if (followUserButton) { followUserButton.disabled = true; followUserButton.textContent = "Error"; }
}

function getQueryParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

async function displayUserProfilePortfolio(detailedHoldings) { // Renamed parameter for clarity
    if (!userProfilePortfolioList || !userProfileTotalValueSpan || !userProfileTotalPLSummarySpan) return;
    userProfilePortfolioList.innerHTML = '';

    const symbols = Object.keys(detailedHoldings);
    if (symbols.length === 0) {
        userProfilePortfolioList.innerHTML = '<p class="info-message">This user\'s portfolio is empty or private.</p>';
        if (userProfileTotalValueSpan) userProfileTotalValueSpan.textContent = formatCurrency(0);
        if (userProfileTotalPLSummarySpan) {
            userProfileTotalPLSummarySpan.textContent = `${formatCurrency(0)} (${formatPercentage(0)})`;
            userProfileTotalPLSummarySpan.className = 'summary-value positive';
        }
        if (userProfilePLSpan) { // Also update bio P/L
            userProfilePLSpan.textContent = `Total P/L: ${formatCurrency(0)} (${formatPercentage(0)})`;
            userProfilePLSpan.className = 'profile-bio positive';
        }
        return;
    }

    const fetchPromises = symbols.map(symbol => fetchStockData(symbol));
    const results = await Promise.allSettled(fetchPromises);

    let overallTotalPortfolioValue = 0;
    let overallTotalCostBasis = 0;
    let hasAddedItem = false;

    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value?.ticker) {
            const stockData = result.value;
            const symbol = stockData.ticker;
            const holdingDetails = detailedHoldings[symbol]; // Get qty, totalCost, avgPrice

            if (holdingDetails && holdingDetails.quantity > 0) {
                const portfolioItem = document.createElement('div');
                portfolioItem.classList.add('portfolio-item');

                const logoUrl = stockData.logo || `https://placehold.co/48x48/eee/ccc?text=${symbol[0]}`;
                const companyName = stockData.name || symbol;
                const currentPrice = typeof stockData.c === 'number' ? stockData.c : NaN;
                
                const quantityOwned = holdingDetails.quantity;
                const averageBuyPrice = holdingDetails.averagePrice;
                const itemCostBasis = holdingDetails.totalCost;

                const itemCurrentValue = (!isNaN(currentPrice)) ? currentPrice * quantityOwned : NaN;
                const itemProfitLoss = (!isNaN(itemCurrentValue) && !isNaN(itemCostBasis)) ? itemCurrentValue - itemCostBasis : NaN;
                const itemProfitLossPercent = (!isNaN(itemProfitLoss) && itemCostBasis > 0) ? (itemProfitLoss / itemCostBasis) * 100 : NaN;
                const itemPlClass = getChangeClass(itemProfitLoss);

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
                         <div class="portfolio-item-stat">Value: <strong>${formatCurrency(itemCurrentValue)}</strong></div>
                         <div class="portfolio-item-stat portfolio-item-pl ${itemPlClass}">P/L: <span>${formatCurrency(itemProfitLoss)} (${formatPercentage(itemProfitLossPercent)})</span></div>
                     </div>
                `;
                userProfilePortfolioList.appendChild(portfolioItem);
                hasAddedItem = true;

                if (!isNaN(itemCurrentValue)) overallTotalPortfolioValue += itemCurrentValue;
                if (!isNaN(itemCostBasis)) overallTotalCostBasis += itemCostBasis;
            }
        } else {
             const symbolWithError = symbols.find(sym => result.reason?.message?.includes(sym) || result.reason?.detail?.includes(sym));
             if(symbolWithError && detailedHoldings[symbolWithError]?.quantity > 0) {
                 const errorItem = document.createElement('div');
                 errorItem.classList.add('portfolio-item', 'error-message');
                 errorItem.textContent = `Could not load market data for ${symbolWithError}.`;
                 userProfilePortfolioList.appendChild(errorItem);
                 hasAddedItem = true; // Still count it as an attempt to display
                 // Add its cost basis if available, current value will be NaN or 0
                 if (detailedHoldings[symbolWithError] && !isNaN(detailedHoldings[symbolWithError].totalCost)) {
                    overallTotalCostBasis += detailedHoldings[symbolWithError].totalCost;
                 }
             }
        }
    });

    const overallTotalPLAmount = overallTotalPortfolioValue - overallTotalCostBasis;
    const overallTotalPLPercent = overallTotalCostBasis > 0 ? (overallTotalPLAmount / overallTotalCostBasis) * 100 : 0;

    if (userProfileTotalValueSpan) userProfileTotalValueSpan.textContent = formatCurrency(overallTotalPortfolioValue);
    if (userProfileTotalPLSummarySpan) {
        userProfileTotalPLSummarySpan.textContent = `${formatCurrency(overallTotalPLAmount)} (${formatPercentage(overallTotalPLPercent)})`;
        userProfileTotalPLSummarySpan.className = `summary-value ${getChangeClass(overallTotalPLAmount)}`;
    }
    if (userProfilePLSpan) { // Update P/L in bio section
        userProfilePLSpan.textContent = `Total P/L: ${formatCurrency(overallTotalPLAmount)} (${formatPercentage(overallTotalPLPercent)})`;
        userProfilePLSpan.className = `profile-bio ${getChangeClass(overallTotalPLAmount)}`;
    }

     if (!hasAddedItem && symbols.length > 0) {
         userProfilePortfolioList.innerHTML = '<p class="error-message">Could not load data for this user\'s portfolio holdings.</p>';
     } else if (!hasAddedItem) { // This implies symbols.length was 0
          userProfilePortfolioList.innerHTML = '<p class="info-message">This user\'s portfolio is empty or private.</p>';
     }
}

function displayUserProfileTransactionLog(transactions) {
    if (!userProfileTransactionsList) return;
    userProfileTransactionsList.innerHTML = '';
    if (!transactions || transactions.length === 0) {
        userProfileTransactionsList.innerHTML = '<p class="info-message">No transactions recorded yet or transactions are private.</p>';
        return;
    }
    const sortedTransactions = [...transactions].sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp.getTime() : (typeof a.timestamp?.toDate === 'function' ? a.timestamp.toDate().getTime() : 0);
        const dateB = b.timestamp instanceof Date ? b.timestamp.getTime() : (typeof b.timestamp?.toDate === 'function' ? b.timestamp.toDate().getTime() : 0);
        return dateB - dateA;
    });
    const recentTransactions = sortedTransactions.slice(0, 10);
    recentTransactions.forEach(transaction => {
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
        userProfileTransactionsList.appendChild(transactionItem);
    });
    if (userProfileTransactionsList.children.length === 0 && transactions.length > 0) {
         userProfileTransactionsList.innerHTML = '<p class="info-message">Transaction history is private or could not be loaded.</p>';
    } else if (userProfileTransactionsList.children.length === 0) {
         userProfileTransactionsList.innerHTML = '<p class="info-message">No transactions recorded yet or transactions are private.</p>';
    } else if (transactions.length > recentTransactions.length) {
        const moreMessage = document.createElement('p');
        moreMessage.classList.add('info-message');
        moreMessage.textContent = `Showing ${recentTransactions.length} most recent trades.`;
        userProfileTransactionsList.appendChild(moreMessage);
    }
}

async function loadCurrentUserFollowing() {
    if (!currentUser || !db) {
        currentUserFollowing.clear();
        return;
    }
    const userDocRef = doc(db, "users", currentUser.uid);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentUserFollowing = new Set(data.following || []);
        } else {
            currentUserFollowing.clear();
        }
    } catch (error) {
        currentUserFollowing.clear();
    }
}

function updateFollowButtonState(targetUserId, isFollowing) {
    if (!followUserButton || followUserButton.dataset.userId !== targetUserId) return;
    followUserButton.textContent = isFollowing ? 'Following' : 'Follow';
    followUserButton.classList.toggle('following', isFollowing);
    followUserButton.disabled = false;
}

if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        if (auth) {
            signOut(auth).catch((error) => {
                displayNotification("Error signing out.", "error");
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

if (followUserButton) {
    followUserButton.addEventListener('click', async () => {
        if (!currentUser) {
            displayNotification("You must be logged in to follow users.", "info");
            return;
        }
        if (!displayedUserId || displayedUserId === currentUser.uid) {
             return;
        }
        followUserButton.disabled = true;
        const isCurrentlyFollowing = currentUserFollowing.has(displayedUserId);
        try {
            const currentUserDocRef = doc(db, "users", currentUser.uid);
            const targetUserDocRef = doc(db, "users", displayedUserId);
            if (isCurrentlyFollowing) {
                await updateDoc(currentUserDocRef, { following: arrayRemove(displayedUserId) });
                await updateDoc(targetUserDocRef, { followerCount: increment(-1) });
                currentUserFollowing.delete(displayedUserId);
                displayNotification("User unfollowed.", "info", 1500);
            } else {
                await updateDoc(currentUserDocRef, { following: arrayUnion(displayedUserId) });
                 await updateDoc(targetUserDocRef, { followerCount: increment(1) });
                currentUserFollowing.add(displayedUserId);
                displayNotification("User followed.", "success", 1500);
            }
             if (userProfileFollowersSpan) {
                 const currentCount = parseInt(userProfileFollowersSpan.textContent, 10);
                 if (!isNaN(currentCount)) {
                     userProfileFollowersSpan.textContent = isCurrentlyFollowing ? currentCount - 1 : currentCount + 1;
                 } else {
                     loadAndDisplayUserProfile(displayedUserId); // Fallback to reload if current count is not a number
                 }
             }
        } catch (error) {
            displayNotification(`Failed to ${isCurrentlyFollowing ? 'unfollow' : 'follow'} user.`, "error");
            await loadCurrentUserFollowing(); // Resync following state on error
            await loadAndDisplayUserProfile(displayedUserId); // Resync full profile data on error
        } finally {
            updateFollowButtonState(displayedUserId, currentUserFollowing.has(displayedUserId));
        }
    });
}

async function fetchStockData(symbol) {
     try {
         const response = await fetch(`http://127.0.0.1:8000/get-company-data?symbol=${symbol}`);
         if (!response.ok) {
             // const errorDetail = await response.text(); // Potentially remove for production
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
