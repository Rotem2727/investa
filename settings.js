import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    updateProfile,
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs
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

let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    displaySettingsNotification("Error connecting to services. Some features may not work.", "error");
}

const userGreetingHeader = document.getElementById("user-greeting");
const userProfilePictureHeader = document.getElementById("user-profile-picture");
const logoutButton = document.getElementById("logout-button");

const profileSettingsForm = document.getElementById("profile-settings-form");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const profilePictureUrlInput = document.getElementById("profilePictureUrl");
const profilePicturePreview = document.getElementById("profile-picture-preview");
const bioTextarea = document.getElementById("bio"); // Added bio textarea
const saveProfileButton = document.getElementById("save-profile-button");

const passwordChangeForm = document.getElementById("password-change-form");
const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const changePasswordButton = document.getElementById("change-password-button");

const deleteAccountButton = document.getElementById("delete-account-button");
const notificationAreaSettings = document.getElementById("notification-area-settings");

let currentUser = null;
let currentUserData = null;

function displaySettingsNotification(message, type = 'info', duration = 5000) {
    if (!notificationAreaSettings) return;
    const notification = document.createElement('div');
    notification.classList.add('notification-message', type);
    notification.textContent = message;
    notificationAreaSettings.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.addEventListener('transitionend', () => {
             if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, { once: true });
    }, duration);
}

function setButtonLoading(button, loadingText = "Saving...") {
    if (button) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
    }
}

function resetButtonLoading(button) {
    if (button && button.dataset.originalText) {
        button.disabled = false;
        button.textContent = button.dataset.originalText;
    }
}

async function isUsernameUnique(username) {
    if (!db) {
        return false;
    }
    const lowerCaseUsername = username.toLowerCase();
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", lowerCaseUsername));
        const querySnapshot = await getDocs(q);
        return querySnapshot.empty;
    } catch (error) {
        displaySettingsNotification("Error checking username availability. Please try again.", 'error');
        return false;
    }
}

if (auth) {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadUserProfile();
            updateHeaderUI();
        } else {
            currentUser = null;
            currentUserData = null;
            window.location.href = 'login.html';
        }
    });
} else {
    displaySettingsNotification("Authentication service not available.", "error");
    if (userGreetingHeader) userGreetingHeader.textContent = "Error";
    if (userProfilePictureHeader) userProfilePictureHeader.src = 'https://placehold.co/30x30/eee/ccc?text=!';
}

async function loadUserProfile() {
    if (!currentUser || !db) return;
    if (emailInput) emailInput.value = currentUser.email || "";
    const userDocRef = doc(db, "users", currentUser.uid);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            if (usernameInput) usernameInput.value = currentUserData.originalUsername || currentUserData.username || "";
            if (profilePictureUrlInput) profilePictureUrlInput.value = currentUserData.profilePictureUrl || "";
            if (profilePicturePreview) profilePicturePreview.src = currentUserData.profilePictureUrl || 'https://placehold.co/100x100/eee/ccc?text=?';
            if (bioTextarea) bioTextarea.value = currentUserData.bio || ""; // Load bio
        } else {
            displaySettingsNotification("Could not load all profile details.", "error");
            if (usernameInput) usernameInput.value = currentUser.displayName || "";
            if (profilePicturePreview) profilePicturePreview.src = 'https://placehold.co/100x100/eee/ccc?text=?';
            if (bioTextarea) bioTextarea.value = "";
        }
    } catch (error) {
        displaySettingsNotification("Error loading profile details.", "error");
        if (usernameInput) usernameInput.value = currentUser.displayName || "";
        if (profilePicturePreview) profilePicturePreview.src = 'https://placehold.co/100x100/eee/ccc?text=?';
        if (bioTextarea) bioTextarea.value = "";
    }
}

function updateHeaderUI() {
    if (currentUserData && userGreetingHeader) {
        userGreetingHeader.textContent = `Hello, ${currentUserData.originalUsername || currentUserData.username || "User"}!`;
    } else if (currentUser && userGreetingHeader) {
        userGreetingHeader.textContent = `Hello, ${currentUser.displayName || currentUser.email.split('@')[0]}!`;
    }
    if (currentUserData && userProfilePictureHeader) {
        userProfilePictureHeader.src = currentUserData.profilePictureUrl || 'https://placehold.co/30x30/eee/ccc?text=?';
    } else if (currentUser && userProfilePictureHeader) {
         userProfilePictureHeader.src = currentUser.photoURL || 'https://placehold.co/30x30/eee/ccc?text=?';
    }
}

if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        if (auth) {
            signOut(auth).catch((error) => {
                displaySettingsNotification("Error signing out.", "error");
            });
        }
    });
}

if (profilePictureUrlInput && profilePicturePreview) {
    profilePictureUrlInput.addEventListener('input', () => {
        const newUrl = profilePictureUrlInput.value.trim();
        if (newUrl) {
            profilePicturePreview.src = newUrl;
        } else {
            profilePicturePreview.src = currentUserData?.profilePictureUrl || 'https://placehold.co/100x100/eee/ccc?text=?';
        }
    });
    profilePicturePreview.onerror = () => {
        profilePicturePreview.src = 'https://placehold.co/100x100/eee/ccc?text=Invalid';
    };
}

if (profileSettingsForm) {
    profileSettingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!currentUser || !db) {
            displaySettingsNotification("Not connected. Please try again.", "error");
            return;
        }

        const newUsername = usernameInput.value.trim();
        const newProfilePictureUrl = profilePictureUrlInput.value.trim();
        const newBio = bioTextarea.value.trim(); // Get bio content
        const currentUsername = currentUserData?.originalUsername || currentUserData?.username || '';

        if (!newUsername) {
            displaySettingsNotification("Username cannot be empty.", "error");
            return;
        }

        if (newUsername.toLowerCase() !== currentUsername.toLowerCase()) {
             setButtonLoading(saveProfileButton, "Checking username...");
             const isUnique = await isUsernameUnique(newUsername);
             if (!isUnique) {
                 displaySettingsNotification(`Username "${newUsername}" is already taken. Please choose another.`, 'error');
                 resetButtonLoading(saveProfileButton);
                 return;
             }
        }

        setButtonLoading(saveProfileButton, "Saving...");
        try {
            await updateProfile(currentUser, {
                displayName: newUsername, // Auth profile only stores displayName and photoURL
                photoURL: newProfilePictureUrl
            });
            const userDocRef = doc(db, "users", currentUser.uid);
            const updates = {
                originalUsername: newUsername,
                username: newUsername.toLowerCase(),
                profilePictureUrl: newProfilePictureUrl,
                bio: newBio // Add bio to Firestore updates
            };
            await updateDoc(userDocRef, updates);
            await loadUserProfile(); // Reload data to reflect changes, including the new bio
            updateHeaderUI();
            displaySettingsNotification("Profile updated successfully!", "success");
        } catch (error) {
            displaySettingsNotification(`Error updating profile: ${error.message}`, "error");
        } finally {
            resetButtonLoading(saveProfileButton);
        }
    });
}

if (passwordChangeForm) {
    passwordChangeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!currentUser) {
            displaySettingsNotification("Not authenticated.", "error");
            return;
        }
        const currentPass = currentPasswordInput.value;
        const newPass = newPasswordInput.value;
        const confirmNewPass = confirmNewPasswordInput.value;
        if (newPass.length < 6) {
            displaySettingsNotification("New password must be at least 6 characters long.", "error");
            return;
        }
        if (newPass !== confirmNewPass) {
            displaySettingsNotification("New passwords do not match.", "error");
            return;
        }
        setButtonLoading(changePasswordButton, "Changing...");
        try {
            const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, newPass);
            displaySettingsNotification("Password changed successfully!", "success");
            passwordChangeForm.reset();
        } catch (error) {
            let friendlyMessage = "Error changing password.";
            if (error.code === 'auth/wrong-password') {
                friendlyMessage = "Incorrect current password. Please try again.";
            } else if (error.code === 'auth/too-many-requests') {
                friendlyMessage = "Too many attempts. Please try again later.";
            } else if (error.code === 'auth/requires-recent-login') {
                friendlyMessage = "This operation is sensitive and requires recent authentication. Please log out and log back in before trying again.";
            } else {
                friendlyMessage = `Error: ${error.message}`;
            }
            displaySettingsNotification(friendlyMessage, "error");
        } finally {
            resetButtonLoading(changePasswordButton);
        }
    });
}

if (deleteAccountButton) {
    deleteAccountButton.addEventListener("click", async () => {
        if (!currentUser) {
            displaySettingsNotification("Not authenticated.", "error");
            return;
        }
        const confirmation = prompt("This action is irreversible. You will lose all your data.\nType your email address to confirm account deletion:");
        if (confirmation === null) {
            return;
        }
        if (confirmation.toLowerCase() !== currentUser.email.toLowerCase()) {
            displaySettingsNotification("Email confirmation does not match. Account deletion cancelled.", "info");
            return;
        }
        const reauthPassword = prompt("For security, please re-enter your password to delete your account:");
        if (reauthPassword === null) {
             displaySettingsNotification("Password not provided. Account deletion cancelled.", "info");
            return;
        }
        setButtonLoading(deleteAccountButton, "Deleting...");
        try {
            const credential = EmailAuthProvider.credential(currentUser.email, reauthPassword);
            await reauthenticateWithCredential(currentUser, credential);
            await deleteUser(currentUser);
            // Note: Deleting Firestore document for the user might be desired here too.
            // await deleteDoc(doc(db, "users", currentUser.uid));
            displaySettingsNotification("Account deleted successfully. You will be logged out.", "success", 7000);
            setTimeout(() => {
                window.location.href = "login.html";
            }, 7000);
        } catch (error) {
             let friendlyMessage = "Error deleting account.";
            if (error.code === 'auth/wrong-password') {
                friendlyMessage = "Incorrect password. Account deletion failed.";
            } else if (error.code === 'auth/too-many-requests') {
                friendlyMessage = "Too many attempts. Please try again later.";
            } else if (error.code === 'auth/requires-recent-login') {
                friendlyMessage = "This operation is sensitive and requires recent authentication. Please log out and log back in before trying again.";
            } else {
                friendlyMessage = `Error: ${error.message}`;
            }
            displaySettingsNotification(friendlyMessage, "error");
            resetButtonLoading(deleteAccountButton);
        }
    });
}
