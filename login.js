import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDocs,
    collection,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAdKXFPMjYamBbNAG2z1Kj8Cp8HjMFcrYA",
    authDomain: "shiftstock-9ba92.firebaseapp.com",
    projectId: "shiftstock-9ba92",
    storageBucket: "shiftstock-9ba92.appspot.com",
    messagingSenderId: "637859468099",
    appId: "1:637859468099:web:26d7984a3296f6b9bb15f6",
    measurementId: "G-EE5FEY81E6"
};

let isProcessingAuth = false;

let app;
let auth;
let db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    try { displayMessage("Could not connect to authentication service.", 'error'); } catch (e) {}
}

let loginForm, signupForm, loginBtn, signupBtn, formTitle, switchLink, forgotPasswordLink, messageArea, loader;

function initializeDOMElements() {
    loginForm = document.getElementById('login-form');
    signupForm = document.getElementById('signup-form');
    loginBtn = document.getElementById('login-btn');
    signupBtn = document.getElementById('signup-btn');
    formTitle = document.getElementById('form-title');
    switchLink = document.getElementById('switch-link');
    forgotPasswordLink = document.getElementById('forgot-password-link');
    messageArea = document.getElementById("message-area");
    loader = document.getElementById('loader');
}

function showLoader() {
    if (loader) loader.style.display = 'block';
    if (loginBtn) loginBtn.disabled = true;
    if (signupBtn) signupBtn.disabled = true;
}

function hideLoader() {
    if (loader) loader.style.display = 'none';
    if (loginBtn) loginBtn.disabled = false;
    if (signupBtn) signupBtn.disabled = false;
}

function displayMessage(message, type = 'info') {
    if (messageArea) {
        messageArea.textContent = message;
        messageArea.className = 'message-area';
        if (type === 'error' || type === 'success') {
            messageArea.classList.add(type);
        }
        messageArea.classList.add('visible');
    }
}

function clearMessages() {
    if (messageArea) messageArea.classList.remove('visible');
}

function getFirebaseErrorMessage(errorCode) {
    switch (errorCode) {
        case "auth/invalid-email": return "Invalid email format.";
        case "auth/user-disabled": return "This account has been disabled.";
        case "auth/invalid-credential": return "Incorrect email or password.";
        case "auth/user-not-found": return "No account found with this email.";
        case "auth/wrong-password": return "Incorrect password.";
        case "auth/email-already-in-use": return "This email is already registered. Please log in or use a different email.";
        case "auth/weak-password": return "Password is too weak (min. 6 characters).";
        case "auth/operation-not-allowed": return "Email/password accounts are not enabled.";
        case "auth/missing-password": return "Please enter your password.";
        case "auth/network-request-failed": return "Network error. Please check your connection.";
        case "auth/missing-email": return "Please enter your email address.";
        default:
            return "An unexpected error occurred. Please try again.";
    }
}

async function isUsernameUnique(username) {
    if (!db) return false;
    const lowerCaseUsername = username.toLowerCase();
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", lowerCaseUsername));
        const querySnapshot = await getDocs(q);
        return querySnapshot.empty;
    } catch (error) {
        displayMessage("Error checking username availability. Please try again.", 'error');
        return false;
    }
}

function generateProfilePictureUrl(username) {
    const initial = username ? username.charAt(0).toUpperCase() : '?';
    const size = 30;
    const bgColor = 'eee';
    const textColor = '333';
    return `https://placehold.co/${size}x${size}/${bgColor}/${textColor}?text=${initial}`;
}

function looksLikeEmail(text) {
    return /\S+@\S+\.\S+/.test(text);
}

function setupAuthObserver() {
    if (auth) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                if (!isProcessingAuth && !window.location.pathname.includes('dashboard.html')) {
                    window.location.href = "dashboard.html";
                }
            } else {
                isProcessingAuth = false;
                if (!window.location.pathname.includes('dashboard.html')) {
                    showLoginForm();
                }
                hideLoader();
            }
        });
    } else {
        hideLoader();
    }
}

function showLoginForm() {
    if (loginForm && signupForm && formTitle && forgotPasswordLink && switchLink) {
        loginForm.style.display = "block";
        signupForm.style.display = "none";
        formTitle.textContent = "Login";
        forgotPasswordLink.style.display = "block";
        switchLink.innerHTML = '<a href="javascript:void(0);" onclick="toggleForm()">Don\'t have an account? Sign Up</a>';
    }
}

function showSignupForm() {
     if (loginForm && signupForm && formTitle && forgotPasswordLink && switchLink) {
        loginForm.style.display = "none";
        signupForm.style.display = "block";
        formTitle.textContent = "Sign Up";
        forgotPasswordLink.style.display = "none";
        switchLink.innerHTML = '<a href="javascript:void(0);" onclick="toggleForm()">Already have an account? Log in</a>';
     }
}

function setupEventListeners() {
    if (!loginForm || !signupForm) {
        return;
    }

    if (auth) {
        loginForm.addEventListener("submit", (event) => {
            event.preventDefault();
            clearMessages();
            showLoader();
            isProcessingAuth = true;

            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;

            if (!email || !password) {
                displayMessage("Please enter both email and password.", 'error');
                hideLoader();
                isProcessingAuth = false;
                return;
            }

            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    window.location.href = "dashboard.html";
                })
                .catch((error) => {
                    const friendlyMessage = getFirebaseErrorMessage(error.code);
                    displayMessage(friendlyMessage, 'error');
                    hideLoader();
                    isProcessingAuth = false;
                });
        });
    } else {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            displayMessage("Authentication service not available.", 'error');
        });
    }

    if (auth && db) {
        signupForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearMessages();
            showLoader();
            isProcessingAuth = true;

            const usernameInput = document.getElementById("signup-username");
            const username = usernameInput.value.trim();
            const email = document.getElementById("signup-email").value.trim();
            const password = document.getElementById("signup-password").value;
            const passwordConfirmation = document.getElementById("signup-confirm-password").value;

            if (!username || !email || !password || !passwordConfirmation || password !== passwordConfirmation || password.length < 6 || looksLikeEmail(username)) {
                 if (!username || !email || !password || !passwordConfirmation) displayMessage("Please fill in all required fields.", 'error');
                 else if (password !== passwordConfirmation) displayMessage("Passwords do not match.", 'error');
                 else if (password.length < 6) displayMessage("Password must be at least 6 characters long.", 'error');
                 else if (looksLikeEmail(username)) displayMessage("Please enter a valid username, not an email address.", 'error');
                 hideLoader();
                 isProcessingAuth = false;
                 return;
            }

            try {
                const isUnique = await isUsernameUnique(username);
                if (!isUnique) {
                    displayMessage(`Username "${username}" is already taken. Please choose another.`, 'error');
                    hideLoader();
                    isProcessingAuth = false;
                    return;
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                const profilePictureUrl = generateProfilePictureUrl(username);

                const userData = {
                    username: username.toLowerCase(),
                    originalUsername: username,
                    email: user.email,
                    profilePictureUrl: profilePictureUrl,
                    createdAt: new Date(),
                    savedStocks: [],
                    transactions: [],
                    following: [],
                    profitLossAmount: 0,
                    profitLossPercentage: 0,
                    followerCount: 0
                };

                const userDocRef = doc(db, "users", user.uid);
                await setDoc(userDocRef, userData);

                isProcessingAuth = false;
                window.location.href = "dashboard.html";

            } catch (error) {
                const friendlyMessage = getFirebaseErrorMessage(error.code);
                displayMessage(friendlyMessage || `Sign-up failed: ${error.message}`, 'error');
                hideLoader();
                isProcessingAuth = false;
            }
        });
    } else {
        signupForm.addEventListener("submit", (event) => {
            event.preventDefault();
            displayMessage("Authentication or database service unavailable. Cannot sign up.", 'error');
        });
    }
}

window.toggleForm = () => {
    clearMessages();
    hideLoader();
    if (!loginForm || !signupForm) {
        return;
    }
    if (loginForm.style.display === "none") {
        showLoginForm();
    } else {
        showSignupForm();
    }
};

window.handleForgotPassword = () => {
    clearMessages();
    const emailInput = document.getElementById("email");
    let email = emailInput ? emailInput.value.trim() : '';

    if (!email) {
         email = prompt("Please enter your email address to reset your password:");
         if (email === null) return;
         email = email.trim();
    }

    if (!email) { displayMessage("Please enter your email address.", 'error'); return; }
    if (!looksLikeEmail(email)) { displayMessage("Please enter a valid email address format.", 'error'); return; }

    if (auth) {
        showLoader();
        sendPasswordResetEmail(auth, email)
            .then(() => {
                hideLoader();
                displayMessage("Password reset email sent! Please check your inbox (and spam folder).", 'success');
                if (loginForm && loginForm.style.display === "none") { toggleForm(); }
            })
            .catch((error) => {
                hideLoader();
                const friendlyMessage = getFirebaseErrorMessage(error.code);
                displayMessage(`Could not send reset email: ${friendlyMessage}`, 'error');
            });
    } else {
         displayMessage("Authentication service not available.", "error");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeDOMElements();
    setupEventListeners();
    setupAuthObserver();

    const header = document.getElementById('mainHeader');
    if (header) {
        header.style.top = '0';
    }
});