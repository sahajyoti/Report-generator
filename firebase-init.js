import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updatePassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB8Y6sGCA9C-vyabaHHvBA5yZJ9LmtGvGY",
  authDomain: "report-generator-c0557.firebaseapp.com",
  projectId: "report-generator-c0557",
  storageBucket: "report-generator-c0557.firebasestorage.app",
  messagingSenderId: "283468422490",
  appId: "1:283468422490:web:6678087a0c625302506763",
  measurementId: "G-81TCZZ2XBX"
};

const googleClientId = '856325958266-2jiavp8cc3v8jielps2vkt2ciohc42mo.apps.googleusercontent.com';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence).catch(() => {});

// Analytics is only enabled when supported by the current browser environment.
isSupported()
  .then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  })
  .catch(() => {
    // Ignore analytics setup failures to avoid impacting app load.
  });

window.firebaseConfig = firebaseConfig;
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseGoogleProvider = googleProvider;
window.firebaseSignInWithGoogle = () => signInWithPopup(auth, googleProvider);
window.firebaseCreateUser = (email, password) => createUserWithEmailAndPassword(auth, email, password);
window.firebaseSignInWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
window.firebaseSendPasswordResetEmail = (email) => sendPasswordResetEmail(auth, email);
window.firebaseUpdatePassword = (newPassword) => auth.currentUser ? updatePassword(auth.currentUser, newPassword) : Promise.reject(new Error('No signed-in user'));
window.firebaseOnAuthStateChanged = (callback) => onAuthStateChanged(auth, callback);
window.firebaseSignOut = () => auth.signOut();

function decodeJwtCredential(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map((char) => {
      return `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`;
    }).join(''));
    return JSON.parse(json);
  } catch (_err) {
    return null;
  }
}

function renderGoogleButton() {
  const container = document.getElementById('google-login-container');
  if (!container || !window.google?.accounts?.id) return;

  container.innerHTML = '';
  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: (response) => {
      const payload = decodeJwtCredential(response.credential);
      if (payload?.email) {
        window.onGoogleCredential?.({
          email: payload.email,
          displayName: payload.name || payload.given_name || '',
          localId: payload.sub || '',
          idToken: response.credential,
          refreshToken: ''
        });
      }
    }
  });

  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: 280
  });
}

window.renderGoogleLoginButton = renderGoogleButton;

window.addEventListener('load', () => {
  setTimeout(renderGoogleButton, 250);
});
