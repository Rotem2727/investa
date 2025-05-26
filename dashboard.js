import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc,
    arrayUnion, arrayRemove, Timestamp,
    collection, getDocs, query, where, limit, orderBy,
    increment
} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAdKXFPMjYamBbNAG2z1Kj8Cp8HjMFcrYA",
    authDomain: "shiftstock-9ba92.firebaseapp.com",
    projectId: "shiftstock-9ba92",
    storageBucket: "shiftstock-9ba92.appspot.com",
    messagingSenderId: "637859468099",
    appId: "1:637859468099:web:26d7984a3296f6f9bb15f6",
    measurementId: "G-EE5FEY81E6"
};

const MAIN_API_BASE_URL = "http://127.0.0.1:8000";

let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase Initialized Successfully (Dashboard)");
} catch (error) {
    console.error("Firebase Initialization Error:", error);
    showNotification("Error connecting to services.", "error");
    const greetingEl = document.getElementById("user-greeting");
    if (greetingEl) greetingEl.textContent = "Error";
    const profilePicEl = document.getElementById("user-profile-picture");
    if (profilePicEl) profilePicEl.src = 'https://placehold.co/30x30/eee/ccc?text=!Error';
}

const stockListContainer = document.getElementById("stock-list");
const savedStockListContainer = document.getElementById("saved-stock-list");
const userGreetingSpan = document.getElementById("user-greeting");
const userProfilePictureImg = document.getElementById("user-profile-picture");
const logoutButton = document.getElementById("logout-button");
const stockSearchInput = document.getElementById("stock-search-input");
const searchButton = document.getElementById("search-button");
const searchResultDisplay = document.getElementById("search-result-display");
const portfolioListContainer = document.getElementById("portfolio-list");
const totalPortfolioValueElement = document.getElementById('total-portfolio-value')?.querySelector('span');
const totalCostBasisElement = document.getElementById('total-cost-basis')?.querySelector('span');
const totalProfitLossElement = document.getElementById('total-profit-loss')?.querySelector('.value');
const marketStatusIndicator = document.getElementById("market-status-indicator");
const marketStatusDot = document.getElementById("market-status-dot");
const marketStatusText = document.getElementById("market-status-text");
const notificationArea = document.getElementById("notification-area");
const newsListContainer = document.getElementById("news-list");
const refreshWatchlistBtn = document.getElementById("refresh-watchlist-btn");
const refreshMoversBtn = document.getElementById("refresh-movers-btn");
const refreshPortfolioBtn = document.getElementById("refresh-portfolio-btn");
const refreshNewsBtn = document.getElementById("refresh-news-btn");

const usersDirectoryContainer = document.getElementById("users-directory-container");
const usersListContainer = document.getElementById("users-list");
const userSearchInput = document.getElementById("user-search-input");
const userSearchButton = document.getElementById("user-search-button");
const userSearchResultsDisplay = document.getElementById("user-search-results-display");
const conversationsTab = document.getElementById("conversations-tab");
const toggleConversationsButton = document.getElementById("toggle-conversations");
const conversationsTabContent = document.querySelector("#conversations-tab .tab-content");

let currentUser = null;
let userSavedStocks = new Set();
let userTransactions = [];
let userHoldings = {};
let stockDataCache = {};
const CACHE_DURATION = 5 * 60 * 1000;
let currentDisplayedSymbol = null;
const baseStockSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM"];
let currentUserFollowing = new Set();

function showNotification(message, type = 'info', duration = 3000) {
    if (!notificationArea) return;
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.textContent = message;
    notificationArea.appendChild(notification);
    requestAnimationFrame(() => { notification.classList.add('show'); });
    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => notification.remove(), { once: true });
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

function formatPriceChange(changeValue, changePercent) {
    const val = typeof changeValue === 'string' ? parseFloat(changeValue) : changeValue;
    const pct = typeof changePercent === 'string' ? parseFloat(changePercent) : changePercent;
    if (typeof val !== 'number' || isNaN(val) || typeof pct !== 'number' || isNaN(pct)) return 'N/A';
    const valueSign = val >= 0 ? '+' : '';
    const percentSign = pct >= 0 ? '+' : '';
    return `${valueSign}${val.toFixed(2)} (${percentSign}${pct.toFixed(2)}%)`;
}

function getChangeClass(value) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof num !== 'number' || isNaN(num)) return '';
    return num >= 0 ? 'positive' : 'negative';
}

function formatMarketCap(value) {
     const num = typeof value === 'string' ? parseFloat(value) : value;
     if (typeof num !== 'number' || isNaN(num)) return 'N/A';
     if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
     if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
     if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
     return `$${num.toFixed(0)}`;
}

function timeAgo(timestamp) {
    let past;
    if (typeof timestamp === 'number') {
        past = new Date(timestamp * 1000);
    } else if (typeof timestamp === 'string') {
        try {
            const year = parseInt(timestamp.substring(0, 4), 10);
            const month = parseInt(timestamp.substring(4, 6), 10) - 1;
            const day = parseInt(timestamp.substring(6, 8), 10);
            const hour = parseInt(timestamp.substring(9, 11), 10);
            const minute = parseInt(timestamp.substring(11, 13), 10);
            const second = parseInt(timestamp.substring(13, 15), 10);
            past = new Date(year, month, day, hour, minute, second);
        } catch (e) {
             console.error("Error parsing timestamp string:", timestamp, e);
             return 'Invalid date format';
        }
    } else {
         return 'Invalid timestamp type';
    }

    if (isNaN(past.getTime())) return 'Invalid date';

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 0) return 'in the future';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function setLoadingState(container, message = "Loading...") {
     if(container) container.innerHTML = `<p class="info-message">${message}</p>`;
}
function setErrorState(container, message = "An error occurred.") {
     if(container) container.innerHTML = `<p class="error-message">${message}</p>`;
}
 function setEmptyState(container, message = "Nothing to display.") {
     if(container) container.innerHTML = `<p class="empty-list-message">${message}</p>`;
}

if (auth) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log("Dashboard: User logged in:", currentUser.uid);
            await displayUserProfile(user.uid);
            initializeDashboard();
        } else {
            currentUser = null;
            console.log("Dashboard: User not logged in, redirecting...");
            userSavedStocks.clear();
            userTransactions = [];
            userHoldings = {};
            stockDataCache = {};
            currentUserFollowing.clear();
            if(userGreetingSpan) userGreetingSpan.textContent = "Guest";
            if(userProfilePictureImg) userProfilePictureImg.src = "https://placehold.co/30x30/eee/ccc?text=?";
            window.location.href = 'login.html';
        }
    });
} else {
     if(userGreetingSpan) userGreetingSpan.textContent = "Error";
     if(userProfilePictureImg) userProfilePictureImg.src = 'https://placehold.co/30x30/eee/ccc?text=!Error';
     showNotification("Authentication service unavailable.", "error");
}

async function initializeDashboard() {
    if (!currentUser) return;

    updateMarketStatus();
    setLoadingState(savedStockListContainer, "Loading watchlist...");
    setLoadingState(stockListContainer, "Loading market data...");
    setLoadingState(portfolioListContainer, "Loading portfolio...");
    setLoadingState(newsListContainer, "Loading news...");
    setLoadingState(usersListContainer, "Loading users...");
    if (userSearchResultsDisplay) setEmptyState(userSearchResultsDisplay, "Search for a user by username.");
    setLoadingState(searchResultDisplay, "Search for a stock or select one from the lists.");

    try {
        const dataPromises = [
             loadUserData(),
             displayStocks(baseStockSymbols),
             displayMarketNews(),
             displayUsersDirectory(),
             loadConversations()
        ];
        const results = await Promise.allSettled(dataPromises);
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Initial data load failed for promise index ${index}:`, result.reason);
            }
        });

         try { await displayPortfolio(); } catch(e) { console.error("Error displaying portfolio after load:", e); setErrorState(portfolioListContainer, "Could not display portfolio."); }
         try { await displaySavedStocks(); } catch(e) { console.error("Error displaying watchlist after load:", e); setErrorState(savedStockListContainer, "Could not display watchlist."); }

        const initialSymbol = userSavedStocks.size > 0 ? Array.from(userSavedStocks)[0] : baseStockSymbols[0];
        if (initialSymbol) await handleSearch(initialSymbol);

    } catch (error) {
         console.error("Error during initializeDashboard sequence:", error);
         setErrorState(savedStockListContainer, "Could not load watchlist.");
         setErrorState(stockListContainer, "Could not load market data.");
         setErrorState(portfolioListContainer, "Could not load portfolio.");
         setErrorState(newsListContainer, "Could not load news.");
         setErrorState(usersListContainer, "Could not load users.");
         setErrorState(conversationsTabContent, "Could not load conversations.");
         showNotification("Failed to load some dashboard data.", "error");
    }
}

async function displayUserProfile(userId) {
    if (!db || !userGreetingSpan || !userProfilePictureImg) return;
    try {
        const userDocRef = doc(db, "users", userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const userData = docSnap.data();
            const usernameToDisplay = userData.originalUsername || userData.username || "User";
            const profilePictureUrl = userData.profilePictureUrl;
            userGreetingSpan.textContent = `Hello, ${usernameToDisplay}!`;
            if(userProfilePictureImg && profilePictureUrl) {
                 userProfilePictureImg.src = profilePictureUrl;
                 userProfilePictureImg.alt = `${usernameToDisplay}'s Profile Picture`;
            } else {
                 userProfilePictureImg.src = 'https://placehold.co/30x30/eee/ccc?text=?';
                 userProfilePictureImg.alt = "Profile Picture";
            }
            currentUserFollowing = new Set(userData.following || []);
        } else {
            console.warn("User profile document not found for UID:", userId);
            userGreetingSpan.textContent = "Hello, User!";
            userProfilePictureImg.src = 'https://placehold.co/30x30/eee/ccc?text=?';
            userProfilePictureImg.alt = "Profile Picture";
            currentUserFollowing = new Set();
        }
    } catch (error) {
        console.error("Error fetching user profile data:", error);
        userGreetingSpan.textContent = "Hello, User!";
        userProfilePictureImg.src = 'https://placehold.co/30x30/eee/ccc?text=!Error';
        userProfilePictureImg.alt = "Error loading picture";
        currentUserFollowing = new Set();
        showNotification("Failed to load user profile data.", "error");
    }
}

async function fetchStockData(symbol, forceRefresh = false) {
    symbol = symbol.toUpperCase();
    const cachedItem = stockDataCache[symbol];
    if (!forceRefresh && cachedItem && (Date.now() - cachedItem.timestamp < CACHE_DURATION)) {
        console.log(`Cache hit for ${symbol}`);
        return cachedItem.data;
    }
    console.log(`Fetching data for ${symbol} from main API...`);
    try {
        if (!MAIN_API_BASE_URL) throw new Error("Main API base URL is not configured.");
        const response = await fetch(`${MAIN_API_BASE_URL}/get-company-data?symbol=${symbol}`);
        if (!response.ok) {
            if (response.status === 404) { console.warn(`Stock ${symbol} not found.`); return null; }
            let errorDetail = `HTTP error! status: ${response.status}`;
            try { const errorData = await response.json(); if (errorData?.detail) errorDetail = errorData.detail; } catch (e) { }
            throw new Error(errorDetail);
        }
        const data = await response.json();
        if (!data || typeof data !== 'object' || !data.ticker) { console.warn(`Invalid data for ${symbol}.`); return null; }
        stockDataCache[symbol] = { data: data, timestamp: Date.now() };
        return data;
    } catch (error) {
        console.error(`Error fetching data for ${symbol} (main API):`, error);
        return null;
    }
}

async function fetchMarketNews() {
     console.log("Fetching market news from main API...");
     try {
         if (!MAIN_API_BASE_URL) throw new Error("Main API base URL is not configured.");
         const response = await fetch(`${MAIN_API_BASE_URL}/get-market-news?category=general`);
         if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
         const newsData = await response.json();
         return Array.isArray(newsData) ? newsData : [];
     } catch (error) {
         console.error("Error fetching market news (main API):", error);
         return null;
     }
}

async function loadUserData() {
    if (!currentUser || !db) return;
    const userDocRef = doc(db, "users", currentUser.uid);
    console.log("Loading user data from Firestore...");
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            userSavedStocks = new Set(data.savedStocks || []);
            userTransactions = (data.transactions || []).map(tx => ({ ...tx, timestamp: tx.timestamp?.toDate ? tx.timestamp.toDate() : (tx.timestamp || null) }));
            currentUserFollowing = new Set(data.following || []);
        } else {
            console.warn("User document not found, creating a basic one...");
            const fallbackUsername = currentUser.email || "User";
            const fallbackProfilePictureUrl = `https://placehold.co/30x30/eee/ccc?text=${fallbackUsername.charAt(0).toUpperCase()}`;
            await setDoc(userDocRef, {
                 username: fallbackUsername.toLowerCase(), originalUsername: fallbackUsername, email: currentUser.email,
                 profilePictureUrl: fallbackProfilePictureUrl, createdAt: new Date(),
                 savedStocks: [], transactions: [], following: [],
                 profitLossAmount: 0, profitLossPercentage: 0, followerCount: 0
            });
            userSavedStocks = new Set(); userTransactions = []; currentUserFollowing = new Set();
        }
    } catch (error) {
        console.error("Error loading user data:", error);
        showNotification("Failed to load your saved data.", "error");
        userSavedStocks = new Set(); userTransactions = []; currentUserFollowing = new Set();
    }
    processTransactions();
}

function processTransactions() {
    const tempHoldings = {};
    userTransactions.sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0));
    userTransactions.forEach(transaction => {
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
                 if (tempHoldings[s].quantity < 1e-9) { tempHoldings[s].quantity = 0; tempHoldings[s].totalCost = 0; }
             } else {
                 console.warn(`Attempt to sell ${quantityToSell} of ${s}, but only ${currentQuantity} owned. Zeroing out.`);
                 tempHoldings[s].quantity = 0; tempHoldings[s].totalCost = 0;
             }
        }
    });
    userHoldings = {};
    for (const symbol in tempHoldings) {
        if (tempHoldings[symbol].quantity > 0) {
            userHoldings[symbol] = {
                quantity: tempHoldings[symbol].quantity,
                totalCost: tempHoldings[symbol].totalCost,
                averagePrice: tempHoldings[symbol].totalCost / tempHoldings[symbol].quantity
            };
        }
    }
    console.log("Processed user holdings:", userHoldings);
}

async function saveStockToFirebase(symbol) {
    if (!currentUser || !db || userSavedStocks.has(symbol)) return;
    const userDocRef = doc(db, "users", currentUser.uid);
    try {
        await updateDoc(userDocRef, { savedStocks: arrayUnion(symbol) });
        userSavedStocks.add(symbol);
        showNotification(`${symbol} added to watchlist.`, "success");
        updateSaveButtonState(symbol, true);
        displaySavedStocks();
    } catch (error) { console.error(`Error saving stock ${symbol}:`, error); showNotification(`Failed to save ${symbol}.`, "error"); }
}

async function removeStockFromFirebase(symbol) {
    if (!currentUser || !db || !userSavedStocks.has(symbol)) return;
    const userDocRef = doc(db, "users", currentUser.uid);
    try {
        await updateDoc(userDocRef, { savedStocks: arrayRemove(symbol) });
        userSavedStocks.delete(symbol);
        showNotification(`${symbol} removed from watchlist.`, "info");
        updateSaveButtonState(symbol, false);
        displaySavedStocks();
        if (currentDisplayedSymbol === symbol) {
             setLoadingState(searchResultDisplay, "Select a stock to view details.");
             currentDisplayedSymbol = null;
        }
    } catch (error) { console.error(`Error removing stock ${symbol}:`, error); showNotification(`Failed to remove ${symbol}.`, "error"); }
}

 async function recordTransactionFirebase(symbol, type, quantity, price) {
     if (!currentUser || !db) { showNotification("You must be logged in to trade.", "error"); return false; }
     if (!symbol || (type !== 'buy' && type !== 'sell') || !(quantity > 0) || !(price > 0)) { showNotification("Invalid transaction data.", "error"); return false; }
     const userDocRef = doc(db, "users", currentUser.uid);
     const transaction = { symbol: symbol.toUpperCase(), type, quantity, price, timestamp: Timestamp.fromDate(new Date()) };
     try {
         await updateDoc(userDocRef, { transactions: arrayUnion(transaction) });
         showNotification(`${type === 'buy' ? 'Purchase' : 'Sale'} of ${quantity} ${symbol} recorded.`, "success");
         userTransactions.push({ ...transaction, timestamp: transaction.timestamp.toDate() });
         processTransactions();
         await displayPortfolio();
         if (symbol === currentDisplayedSymbol) updateBuySellButtonStates(symbol);
         return true;
     } catch (error) { console.error(`Firestore error recording ${type} transaction:`, error); showNotification(`Failed to record ${type} of ${symbol}.`, "error"); return false; }
 }

async function followUser(targetUserId) {
    if (!currentUser || !db || !targetUserId || currentUser.uid === targetUserId || currentUserFollowing.has(targetUserId)) return;
    const currentUserDocRef = doc(db, "users", currentUser.uid);
    const targetUserDocRef = doc(db, "users", targetUserId);
    try {
        await updateDoc(currentUserDocRef, { following: arrayUnion(targetUserId) });
        await updateDoc(targetUserDocRef, { followerCount: increment(1) });
        currentUserFollowing.add(targetUserId);
        showNotification("User followed.", "success", 1500);
        updateFollowButtonState(targetUserId, true);
        displayUsersDirectory();
    } catch (error) { console.error(`Error following user ${targetUserId}:`, error); showNotification("Failed to follow user.", "error"); }
}

async function unfollowUser(targetUserId) {
    if (!currentUser || !db || !targetUserId || !currentUserFollowing.has(targetUserId)) return;
    const currentUserDocRef = doc(db, "users", currentUser.uid);
    const targetUserDocRef = doc(db, "users", targetUserId);
    try {
        await updateDoc(currentUserDocRef, { following: arrayRemove(targetUserId) });
        await updateDoc(targetUserDocRef, { followerCount: increment(-1) });
        currentUserFollowing.delete(targetUserId);
        showNotification("User unfollowed.", "info", 1500);
        updateFollowButtonState(targetUserId, false);
        displayUsersDirectory();
    } catch (error) { console.error(`Error unfollowing user ${targetUserId}:`, error); showNotification("Failed to unfollow user.", "error"); }
}

async function updateCurrentUserPLInFirestore(amount, percent) {
    if (!currentUser || !db) return;
    const plAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
    const plPercent = (typeof percent === 'number' && !isNaN(percent)) ? percent : 0;
    const userDocRef = doc(db, "users", currentUser.uid);
    try {
        await updateDoc(userDocRef, { profitLossAmount: plAmount, profitLossPercentage: plPercent });
        console.log(`Updated P/L for ${currentUser.uid} in Firestore.`);
    } catch (error) { console.error(`Error updating P/L for ${currentUser.uid} in Firestore:`, error); }
}

function createStockRowElement(data) {
    if (!data || !data.ticker) return null;
    const stockRow = document.createElement("div");
    stockRow.classList.add("stock-row");
    stockRow.dataset.symbol = data.ticker;
    const isSaved = userSavedStocks.has(data.ticker);
    const logoUrl = data.logo || `https://placehold.co/48x48/eee/ccc?text=${data.ticker[0]}`;
    const companyName = data.name || data.ticker;
    stockRow.innerHTML = `
        <div class="stock-info">
            <img class="stock-logo" src="${logoUrl}" alt="${companyName} Logo" onerror="this.src='https://placehold.co/48x48/eee/ccc?text=${data.ticker[0]}'; this.onerror=null;">
            <div class="stock-details">
                <div class="symbol-container">
                     <span class="symbol">${data.ticker}</span>
                     <button class="save-remove-button ${isSaved ? 'saved' : ''}" data-symbol="${data.ticker}" title="${isSaved ? 'Remove from watchlist' : 'Add to watchlist'}"></button>
                </div>
                <span class="company-name">${companyName}</span>
            </div>
        </div>
        <div class="stock-price-info">
            <span class="stock-price">${formatCurrency(data.c)}</span>
            <span class="stock-change ${getChangeClass(data.dp)}">${formatPercentage(data.dp)}</span>
        </div>`;
    stockRow.addEventListener("click", (event) => { if (!event.target.closest('.save-remove-button')) handleSearch(data.ticker); });
    stockRow.querySelector('.save-remove-button').addEventListener("click", (event) => {
        event.stopPropagation();
        const symbol = event.target.dataset.symbol;
        if (userSavedStocks.has(symbol)) removeStockFromFirebase(symbol); else saveStockToFirebase(symbol);
    });
    return stockRow;
}

function createPortfolioRowElement(data, holding) {
     if (!data || !data.ticker || !holding || holding.quantity <= 0) return null;
     const portfolioRow = document.createElement("div");
     portfolioRow.classList.add("portfolio-item");
     portfolioRow.dataset.symbol = data.ticker;
     const logoUrl = data.logo || `https://placehold.co/48x48/eee/ccc?text=${data.ticker[0]}`;
     const companyName = data.name || data.ticker;
     const symbol = data.ticker;
     const currentPrice = data.c;
     const quantityOwned = holding.quantity;
     const averageBuyPrice = holding.averagePrice;
     const currentValue = (typeof currentPrice === 'number') ? currentPrice * quantityOwned : NaN;
     const costBasis = holding.totalCost;
     const profitLoss = (!isNaN(currentValue) && !isNaN(costBasis)) ? currentValue - costBasis : NaN;
     const profitLossPercent = (!isNaN(profitLoss) && costBasis > 0) ? (profitLoss / costBasis) * 100 : NaN;
     const plClass = getChangeClass(profitLoss);
     portfolioRow.innerHTML = `
         <div class="portfolio-stock-info">
            <img class="portfolio-stock-logo" src="${logoUrl}" alt="${companyName} logo" onerror="this.src='https://placehold.co/48x48/eee/ccc?text=${data.ticker[0]}'; this.onerror=null;">
            <div class="portfolio-stock-details">
                 <span class="portfolio-symbol">${quantityOwned.toFixed(quantityOwned % 1 === 0 ? 0 : 2)} shares of ${symbol}</span>
                 <span class="portfolio-company-name">${companyName}</span>
            </div>
         </div>
         <div class="portfolio-value-info">
             <div class="portfolio-current-value">Value: <strong>${formatCurrency(currentValue)}</strong></div>
             <div class="portfolio-profit-loss ${plClass}">
                 P/L: <span class="${plClass}">${formatCurrency(profitLoss)} (${formatPercentage(profitLossPercent)})</span>
             </div>
             <div class="portfolio-average-price">Avg Buy: <strong>${formatCurrency(averageBuyPrice)}</strong></div>
         </div>`;
     portfolioRow.addEventListener("click", () => handleSearch(data.ticker));
     return portfolioRow;
}

function createNewsItemElement(newsItem) {
    if (!newsItem || !newsItem.title || !newsItem.url) return null;
    const item = document.createElement('div');
    item.classList.add('news-item');
    const imageUrl = newsItem.image || `https://placehold.co/160x120/eee/ccc?text=News`;
    const summary = newsItem.summary ? (newsItem.summary.length > 150 ? newsItem.summary.substring(0, 150) + '...' : newsItem.summary) : 'Read more...';
    item.innerHTML = `
        <img src="${imageUrl}" alt="News Image" class="news-image" loading="lazy" onerror="this.style.display='none';">
        <div class="news-content">
            <a href="${newsItem.url}" target="_blank" rel="noopener noreferrer" class="news-headline">${newsItem.title}</a>
            <p class="news-summary">${summary}</p>
            <p class="news-source-time">${newsItem.source} - ${timeAgo(newsItem.datetime)}</p>
        </div>`;
    return item;
}

function createUserRowElement(userData, userId) {
    if (!userData || !userId) return null;
    const userRow = document.createElement("div");
    userRow.classList.add("user-directory-item");
    userRow.dataset.userId = userId;
    const username = userData.originalUsername || userData.username || 'Unknown User';
    const pfpUrl = userData.profilePictureUrl || `https://placehold.co/64x64/eee/ccc?text=${username.charAt(0).toUpperCase()}`;
    const isFollowing = currentUserFollowing.has(userId);
    const userPLAmount = userData.profitLossAmount !== undefined ? userData.profitLossAmount : null;
    const userPLPercent = userData.profitLossPercentage !== undefined ? userData.profitLossPercentage : null;
    const plClass = getChangeClass(userPLAmount);
    const followerCount = userData.followerCount !== undefined ? userData.followerCount : 'N/A';
    let plDisplay = 'N/A';
    if (userPLAmount !== null) {
        plDisplay = `${formatCurrency(userPLAmount)}`;
        if (userPLPercent !== null) plDisplay += ` (${formatPercentage(userPLPercent)})`;
    }
    userRow.innerHTML = `
        <div class="user-directory-info">
            <img class="user-directory-pfp" src="${pfpUrl}" alt="${username}'s Profile Picture" onerror="this.src='https://placehold.co/64x64/eee/ccc?text=?'; this.onerror=null;">
            <div class="user-directory-details">
                <span class="user-directory-username">${username}</span>
                <div class="user-directory-stats">
                     <span class="user-pl ${plClass}">P/L: ${plDisplay}</span>
                     <span>Followers: ${followerCount}</span>
                </div>
            </div>
        </div>
        <div class="user-directory-actions">
            <button class="follow-button ${isFollowing ? 'following' : ''}" data-user-id="${userId}">${isFollowing ? 'Following' : 'Follow'}</button>
            <button class="message-button" data-user-id="${userId}" title="Message ${username}">Message</button>
        </div>`;

    // Add click listener to navigate to user profile page
    userRow.addEventListener('click', () => {
        window.location.href = `user_profile.html?userId=${userId}`;
    });

    const followButton = userRow.querySelector('.follow-button');
    if (followButton) {
        followButton.addEventListener('click', (event) => {
            event.stopPropagation(); event.target.disabled = true;
            if (currentUserFollowing.has(userId)) unfollowUser(userId).finally(() => updateFollowButtonState(userId, false));
            else followUser(userId).finally(() => updateFollowButtonState(userId, true));
        });
    }
    const messageButton = userRow.querySelector('.message-button');
    if (messageButton) {
        messageButton.addEventListener('click', (event) => {
            event.stopPropagation();
            showNotification(`Messaging feature for ${username} is not yet implemented.`, "info", 2000);
        });
    }
    return userRow;
}

function updateSaveButtonState(symbol, isSaved) {
    document.querySelectorAll(`.save-remove-button[data-symbol="${symbol}"]`).forEach(button => {
        button.classList.toggle('saved', isSaved);
        button.title = isSaved ? 'Remove from watchlist' : 'Add to watchlist';
    });
}

function updateBuySellButtonStates(symbol) {
    const sellButton = searchResultDisplay.querySelector(`.sell-button-large[data-symbol="${symbol}"]`);
    const buyButton = searchResultDisplay.querySelector(`.buy-button-large[data-symbol="${symbol}"]`);
    if (sellButton) {
        const quantityOwned = userHoldings[symbol]?.quantity || 0;
        sellButton.disabled = quantityOwned <= 0;
        sellButton.title = quantityOwned <= 0 ? "You don't own shares to sell" : `Sell ${symbol}`;
    }
    if (buyButton) {
        const price = buyButton.dataset.price;
        const isPriceValid = price && !isNaN(parseFloat(price));
        buyButton.disabled = !isPriceValid;
        buyButton.title = buyButton.disabled ? "Cannot buy (price unavailable)" : `Buy ${symbol}`;
    }
}

async function displayStockList(container, symbols, emptyMessage = "No stocks to display.", forceRefresh = false) {
     if (!container) return; setLoadingState(container);
     if (!symbols || symbols.length === 0) { setEmptyState(container, emptyMessage); return; }
     const fetchPromises = symbols.map(symbol => fetchStockData(symbol, forceRefresh));
     const results = await Promise.allSettled(fetchPromises);
     container.innerHTML = ''; let hasAddedStock = false;
     results.forEach(result => {
          if (result.status === 'fulfilled' && result.value?.ticker) {
             const stockRowElement = createStockRowElement(result.value);
             if (stockRowElement) { container.appendChild(stockRowElement); hasAddedStock = true; }
         } else {
              const symbolWithError = symbols.find(sym => result.reason?.message?.includes(sym));
              if(symbolWithError) {
                  const errorRow = document.createElement('div');
                  errorRow.classList.add('stock-row', 'error-message');
                  errorRow.textContent = `Could not load data for ${symbolWithError}.`;
                  container.appendChild(errorRow); hasAddedStock = true;
              }
         }
     });
     if (!hasAddedStock) setEmptyState(container, "Could not load data for stocks.");
}

async function displayStocks(symbolsToDisplay = baseStockSymbols, forceRefresh = false) {
     await displayStockList(stockListContainer, symbolsToDisplay, "No market data available.", forceRefresh);
}
async function displaySavedStocks(forceRefresh = false) {
     await displayStockList(savedStockListContainer, Array.from(userSavedStocks), "Your watchlist is empty.", forceRefresh);
}

async function displayPortfolio(forceRefresh = false) {
     if (!portfolioListContainer || !totalPortfolioValueElement || !totalCostBasisElement || !totalProfitLossElement) return;
     const portfolioSymbols = Object.keys(userHoldings);
     if (portfolioSymbols.length === 0) {
         setEmptyState(portfolioListContainer, "Your portfolio is empty.");
         totalPortfolioValueElement.textContent = '$0.00'; totalCostBasisElement.textContent = '$0.00';
         totalProfitLossElement.textContent = '$0.00 (0.00%)'; totalProfitLossElement.className = 'value';
         await updateCurrentUserPLInFirestore(0, 0); return;
     }
     setLoadingState(portfolioListContainer, "Updating portfolio...");
     const fetchPromises = portfolioSymbols.map(symbol => fetchStockData(symbol, forceRefresh));
     const results = await Promise.allSettled(fetchPromises);
     portfolioListContainer.innerHTML = ''; let totalValue = 0, totalCost = 0, hasAddedItem = false;
     results.forEach(result => {
         if (result.status === 'fulfilled' && result.value?.ticker) {
             const data = result.value; const symbol = data.ticker; const holding = userHoldings[symbol];
             if (holding?.quantity > 0) {
                 const portfolioRowElement = createPortfolioRowElement(data, holding);
                 if (portfolioRowElement) { portfolioListContainer.appendChild(portfolioRowElement); hasAddedItem = true; }
                 if (typeof data.c === 'number' && !isNaN(data.c)) totalValue += data.c * holding.quantity;
                 if (typeof holding.totalCost === 'number' && !isNaN(holding.totalCost)) totalCost += holding.totalCost;
             }
         } else {
              const symbolWithError = portfolioSymbols.find(sym => result.reason?.message?.includes(sym));
              if(symbolWithError && userHoldings[symbolWithError]) {
                  const errorRow = document.createElement('div');
                  errorRow.classList.add('portfolio-item', 'error-message');
                  errorRow.textContent = `Could not load data for ${symbolWithError} (${userHoldings[symbolWithError].quantity.toFixed(userHoldings[symbolWithError].quantity % 1 === 0 ? 0 : 2)} shares).`;
                  portfolioListContainer.appendChild(errorRow); hasAddedItem = true;
                  if (typeof userHoldings[symbolWithError].totalCost === 'number' && !isNaN(userHoldings[symbolWithError].totalCost)) totalCost += userHoldings[symbolWithError].totalCost;
              }
         }
     });
     const totalPLAmount = totalValue - totalCost;
     const totalPLPercent = totalCost > 0 ? (totalPLAmount / totalCost) * 100 : 0;
     if (!hasAddedItem && portfolioSymbols.length > 0) {
         setErrorState(portfolioListContainer, "Could not load portfolio data.");
         totalPortfolioValueElement.textContent = 'Error'; totalCostBasisElement.textContent = 'Error'; totalProfitLossElement.textContent = 'Error';
         await updateCurrentUserPLInFirestore(0,0);
     } else if (!hasAddedItem) { }
     else {
          totalPortfolioValueElement.textContent = formatCurrency(totalValue);
          totalCostBasisElement.textContent = formatCurrency(totalCost);
          totalProfitLossElement.textContent = `${formatCurrency(totalPLAmount)} (${formatPercentage(totalPLPercent)})`;
          totalProfitLossElement.className = `value ${getChangeClass(totalPLAmount)}`;
          await updateCurrentUserPLInFirestore(totalPLAmount, totalPLPercent);
     }
}

async function displayMarketNews() {
     if (!newsListContainer) return; setLoadingState(newsListContainer, "Loading news...");
     const newsData = await fetchMarketNews();
     if (newsData && newsData.length > 0) {
         newsListContainer.innerHTML = '';
         newsData.forEach(newsItem => { const newsElement = createNewsItemElement(newsItem); if (newsElement) newsListContainer.appendChild(newsElement); });
         if (newsListContainer.children.length === 0) setEmptyState(newsListContainer, "No recent market news found that could be displayed.");
     } else if (newsData) { setEmptyState(newsListContainer, "No recent market news found."); }
     else { setErrorState(newsListContainer, "Could not load market news."); }
}

async function updateMarketStatus() {
     if (!marketStatusIndicator || !marketStatusDot || !marketStatusText) return;
     marketStatusText.textContent = "Checking Status..."; marketStatusIndicator.className = 'market-status-indicator market-unknown';
     try {
         if (!MAIN_API_BASE_URL) throw new Error("Main API base URL is not configured.");
         const response = await fetch(`${MAIN_API_BASE_URL}/get-market-status`);
         if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
         const data = await response.json();
         if (data && typeof data.isOpen === 'boolean') {
              let sessionText = data.session && typeof data.session === 'string' ? ` (${data.session})` : "";
             marketStatusText.textContent = `Market ${data.isOpen ? "Open" : "Closed"}${sessionText}`;
             marketStatusIndicator.className = `market-status-indicator market-${data.isOpen ? "open" : "closed"}`;
         } else { marketStatusText.textContent = "Status Unknown"; marketStatusIndicator.className = 'market-status-indicator market-unknown'; }
     } catch (error) { console.error("Error fetching market status:", error); marketStatusText.textContent = "Status Unknown"; marketStatusIndicator.className = 'market-status-indicator market-unknown'; }
}

function updateFollowButtonState(targetUserId, isFollowing) {
    document.querySelectorAll(`#users-list .follow-button[data-user-id="${targetUserId}"], #user-search-results-display .follow-button[data-user-id="${targetUserId}"]`)
    .forEach(button => {
        button.textContent = isFollowing ? 'Following' : 'Follow';
        button.classList.toggle('following', isFollowing);
        button.disabled = false;
    });
}

async function displayUsersDirectory() {
    if (!usersListContainer || !db || !currentUser) return; setLoadingState(usersListContainer, "Loading users...");
    try {
        const q = query(collection(db, "users"), where("__name__", "!=", currentUser.uid), orderBy("username"), limit(20));
        const querySnapshot = await getDocs(q);
        usersListContainer.innerHTML = ''; let userCount = 0;
        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            if (userData.originalUsername || userData.username) {
                 const userRowElement = createUserRowElement(userData, docSnap.id);
                 if (userRowElement) { usersListContainer.appendChild(userRowElement); userCount++; }
            } else { console.warn("Skipping user document with missing username:", docSnap.id); }
        });
        if (userCount === 0) setEmptyState(usersListContainer, "No other users found.");
    } catch (error) { console.error("Error fetching users directory:", error); setErrorState(usersListContainer, "Could not load users."); }
}

async function handleUserSearch() {
    const searchTerm = (userSearchInput?.value || "").trim();
    if (!searchTerm) { showNotification("Please enter a username to search.", "info"); setEmptyState(userSearchResultsDisplay, "Search for a user by username."); return; }
    setLoadingState(userSearchResultsDisplay, `Searching for "${searchTerm}"...`);
    try {
        const q = query(collection(db, "users"), where("username", "==", searchTerm.toLowerCase()), limit(10));
        const querySnapshot = await getDocs(q);
        userSearchResultsDisplay.innerHTML = '';
        if (querySnapshot.empty) { setEmptyState(userSearchResultsDisplay, `No users found matching "${searchTerm}".`); return; }
        let userCount = 0;
        querySnapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            if (docSnap.id !== currentUser?.uid && (userData.originalUsername || userData.username)) {
                 const userRowElement = createUserRowElement(userData, docSnap.id);
                 if (userRowElement) { userSearchResultsDisplay.appendChild(userRowElement); userCount++; }
            }
        });
        if (userCount === 0) setEmptyState(userSearchResultsDisplay, `No other users found matching "${searchTerm}".`);
    } catch (error) { console.error("Error during user search:", error); setErrorState(userSearchResultsDisplay, `An error occurred while searching for users.`); }
}

async function loadConversations() {
    if (!conversationsTabContent) return;
    setLoadingState(conversationsTabContent, "Loading conversations...");
    // Placeholder for loading actual conversation data
    // Replace this with your actual data fetching logic
    setTimeout(() => {
        // Example: Add dummy conversation items or just show empty state
        conversationsTabContent.innerHTML = ''; // Clear loading state
        setEmptyState(conversationsTabContent, "No recent conversations.");
    }, 1000); // Simulate loading time
}


async function handleSearch(symbolToSearch = null) {
    const searchTerm = (symbolToSearch || stockSearchInput?.value || "").trim().toUpperCase();
    if (!searchTerm) { showNotification("Please enter a stock symbol.", "info"); return; }

    currentDisplayedSymbol = searchTerm;
    searchResultDisplay.innerHTML = `<p class="info-message">Searching for ${searchTerm}...</p>`;
    if(stockSearchInput) stockSearchInput.value = searchTerm;

    try {
        const stockData = await fetchStockData(searchTerm, true);

        if (stockData) {
            displaySearchResult(stockData);
        } else {
             searchResultDisplay.innerHTML = `<p class="error-message">Could not find data for symbol: ${searchTerm}. Please check the symbol.</p>`;
             currentDisplayedSymbol = null;
        }
    } catch (error) {
        console.error("Error during search execution:", error);
        searchResultDisplay.innerHTML = `<p class="error-message">An error occurred while searching for ${searchTerm}.</p>`;
        currentDisplayedSymbol = null;
    }
}

function displaySearchResult(data) {
     if (!searchResultDisplay || !data?.ticker || typeof data !== 'object') {
         setErrorState(searchResultDisplay, "Invalid data received for display.");
         currentDisplayedSymbol = null; return;
     }
     const symbol = data.ticker;
     const isSaved = userSavedStocks.has(symbol);
     const logoUrl = data.logo || `https://placehold.co/100x100/eee/ccc?text=${symbol[0]}`;
     const companyName = data.name && typeof data.name === 'string' ? data.name : symbol;
     let websiteDisplay = '';
     if (data.weburl && typeof data.weburl === 'string' && (data.weburl.startsWith('http://') || data.weburl.startsWith('https://'))) {
        try {
            const urlObject = new URL(data.weburl);
            websiteDisplay = `<a href="${data.weburl}" target="_blank" rel="noopener noreferrer" class="company-website">${urlObject.hostname}</a>`;
        } catch(e){ console.warn("Invalid website URL:", data.weburl); }
     }
     const currentPrice = typeof data.c === 'number' ? data.c : 'N/A';
     const priceChange = typeof data.d === 'number' ? data.d : 'N/A';
     const percentChange = typeof data.dp === 'number' ? data.dp : 'N/A';
     const highPrice = typeof data.h === 'number' ? data.h : 'N/A';
     const lowPrice = typeof data.l === 'number' ? data.l : 'N/A';
     const openPrice = typeof data.o === 'number' ? data.o : 'N/A';
     const previousClose = typeof data.pc === 'number' ? data.pc : 'N/A';
     const marketCapUSD = typeof data.marketCapitalization === 'number' ? data.marketCapitalization : 'N/A';
     const priceChangeClass = getChangeClass(percentChange);

     searchResultDisplay.innerHTML = `
         <div class="large-stock-display">
             <div class="company-header">
                 <img class="large-stock-logo" src="${logoUrl}" alt="${companyName} Logo" onerror="this.src='https://placehold.co/100x100/eee/ccc?text=${symbol[0]}'; this.onerror=null;">
                 <div class="company-title">
                      <div class="title-line-1">
                         <span class="large-symbol">${symbol}</span>
                         <button class="save-remove-button ${isSaved ? 'saved' : ''}" data-symbol="${symbol}" title="${isSaved ? 'Remove from watchlist' : 'Add to watchlist'}"></button>
                      </div>
                     <h2 class="large-company-name">${companyName}</h2>
                     ${websiteDisplay}
                 </div>
             </div>
             <div class="price-info">
                 <span class="large-price">${formatCurrency(currentPrice)}</span>
                 <span class="large-price-change ${priceChangeClass}">
                     ${formatPriceChange(priceChange, percentChange)}
                 </span>
             </div>
             <div class="key-metrics">
                 <div class="metric-item"><span>High:</span> <strong>${formatCurrency(highPrice)}</strong></div>
                 <div class="metric-item"><span>Low:</span> <strong>${formatCurrency(lowPrice)}</strong></div>
                 <div class="metric-item"><span>Open:</span> <strong>${formatCurrency(openPrice)}</strong></div>
                 <div class="metric-item"><span>Prev. Close:</span> <strong>${formatCurrency(previousClose)}</strong></div>
                 <div class="metric-item"><span>Market Cap:</span> <strong>${formatMarketCap(marketCapUSD)}</strong></div>
             </div>
             <div class="stock-actions-large">
                 <button class="action-button buy-button-large" data-symbol="${symbol}" data-price="${currentPrice}">Buy</button>
                 <button class="action-button sell-button-large" data-symbol="${symbol}" data-price="${currentPrice}">Sell</button>
             </div>
            </div>`;

      const buyButton = searchResultDisplay.querySelector('.buy-button-large');
      const sellButton = searchResultDisplay.querySelector('.sell-button-large');
      const saveButton = searchResultDisplay.querySelector('.company-title .save-remove-button');

      if (buyButton) buyButton.addEventListener('click', handleBuyClick);
      if (sellButton) sellButton.addEventListener('click', handleSellClick);
      if (saveButton) {
           saveButton.addEventListener('click', (event) => {
              const clickedSymbol = event.target.dataset.symbol;
              if (userSavedStocks.has(clickedSymbol)) removeStockFromFirebase(clickedSymbol);
              else saveStockToFirebase(clickedSymbol);
          });
      }
      updateBuySellButtonStates(symbol);
}

function handleBuyClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const symbol = button.dataset.symbol;
    const priceString = button.dataset.price;
    const price = parseFloat(priceString);

    if (isNaN(price) || price <= 0) {
         showNotification(`Cannot buy ${symbol}: Price unavailable or invalid.`, "error"); return;
    }

    const quantityString = prompt(`Enter quantity of ${symbol} to buy at ~${formatCurrency(price)}:`);
    if (quantityString === null) return;

    const quantity = parseInt(quantityString.trim(), 10);
    if (isNaN(quantity) || quantity <= 0) {
        showNotification("Invalid quantity. Please enter a positive whole number.", "error"); return;
    }

    button.disabled = true;
    recordTransactionFirebase(symbol, 'buy', quantity, price)
         .finally(() => {
             const currentBuyButton = searchResultDisplay.querySelector(`.buy-button-large[data-symbol="${symbol}"]`);
             if (currentBuyButton) currentBuyButton.disabled = false;
             updateBuySellButtonStates(symbol);
         });
}

function handleSellClick(event) {
    const button = event.target.closest('button');
     if (!button) return;
    const symbol = button.dataset.symbol;
    const priceString = button.dataset.price;
    const price = parseFloat(priceString);

     if (isNaN(price) || price <= 0) {
         showNotification(`Cannot sell ${symbol}: Price unavailable or invalid.`, "error"); return;
     }

    const quantityOwned = userHoldings[symbol]?.quantity || 0;
     if (quantityOwned <= 0) {
         showNotification(`You do not own any shares of ${symbol}.`, "info"); return;
     }

    const quantityString = prompt(`Enter quantity of ${symbol} to sell at ~${formatCurrency(price)} (You own ${quantityOwned.toFixed(quantityOwned % 1 === 0 ? 0 : 2)}):`);
    if (quantityString === null) return;

    const quantityToSell = parseInt(quantityString.trim(), 10);
    if (isNaN(quantityToSell) || quantityToSell <= 0) {
        showNotification("Invalid quantity. Please enter a positive whole number.", "error"); return;
    }
     if (quantityToSell > quantityOwned) {
         showNotification(`You cannot sell more ${symbol} than you own (${quantityOwned.toFixed(quantityOwned % 1 === 0 ? 0 : 2)}).`, "error"); return;
     }

     button.disabled = true;
     recordTransactionFirebase(symbol, 'sell', quantityToSell, price)
          .finally(() => {
             const currentSellButton = searchResultDisplay.querySelector(`.sell-button-large[data-symbol="${symbol}"]`);
             if (currentSellButton) currentSellButton.disabled = false;
             updateBuySellButtonStates(symbol);
          });
}

 async function handleRefresh(button, refreshFunction) {
     if (!button) return;
     button.disabled = true;
     const icon = button.querySelector('.icon');
     if (icon) icon.classList.add('spin');

     try {
         await refreshFunction(true);
         showNotification("Data refreshed.", "info", 1500);
     } catch (error) {
         console.error("Error during refresh:", error);
         showNotification("Failed to refresh data.", "error");
     } finally {
         button.disabled = false;
         if (icon) icon.classList.remove('spin');
     }
 }

if (logoutButton && auth) {
    logoutButton.addEventListener("click", () => {
        signOut(auth).catch((error) => {
            console.error("Error signing out:", error);
            showNotification("Error signing out.", "error");
        });
    });
}

if (searchButton) {
    searchButton.addEventListener('click', () => handleSearch());
}

if (stockSearchInput) {
    stockSearchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSearch();
        }
    });
}

if (userSearchButton) {
    userSearchButton.addEventListener('click', () => handleUserSearch());
}

if (userSearchInput) {
    userSearchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleUserSearch();
        }
    });
}

if (toggleConversationsButton && conversationsTab) {
    toggleConversationsButton.addEventListener('click', () => {
        conversationsTab.classList.toggle('collapsed');
        toggleConversationsButton.textContent = conversationsTab.classList.contains('collapsed') ? '▼' : '▲';
    });
}

if (refreshWatchlistBtn) { refreshWatchlistBtn.addEventListener('click', () => handleRefresh(refreshWatchlistBtn, displaySavedStocks)); }
if (refreshMoversBtn) { refreshMoversBtn.addEventListener('click', () => handleRefresh(refreshMoversBtn, displayStocks)); }
if (refreshPortfolioBtn) { refreshPortfolioBtn.addEventListener('click', () => handleRefresh(refreshPortfolioBtn, displayPortfolio)); }
if (refreshNewsBtn) { refreshNewsBtn.addEventListener('click', () => handleRefresh(refreshNewsBtn, displayMarketNews)); }

(function ensureSpinAnimation() {
    if (document.getElementById('spin-animation-style')) return;

    let spinAnimationDefined = false;
    for (const sheet of document.styleSheets) {
        try {
            if (sheet.cssRules) {
                for (const rule of sheet.cssRules) {
                    if (rule instanceof CSSKeyframesRule && rule.name === 'spin') {
                        spinAnimationDefined = true;
                        break;
                    }
                }
            }
        } catch (e) {
            console.warn("Could not access CSS rules from stylesheet (potentially external):", sheet.href, e.message);
        }
        if (spinAnimationDefined) break;
    }

    if (!spinAnimationDefined) {
        const styleSheet = document.createElement("style");
        styleSheet.id = 'spin-animation-style';
        styleSheet.type = "text/css";
        styleSheet.innerText = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .spin {
                animation: spin 1s linear infinite;
            }
        `;
        document.head.appendChild(styleSheet);
        console.log("Spin animation CSS rule added programmatically.");
    }
})();
