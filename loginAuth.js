
// Setup: Consolidated authentication handler for all pages
import { auth, signInWithEmailAndPassword, signOut, setPersistence, 
         browserLocalPersistence, browserSessionPersistence, onAuthStateChanged } from './firebase-init.js';

// ========================
// LOGIN FORM HANDLER
// ========================
function initLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    const card = document.querySelector('.login-container');
    const errorMsg = document.getElementById('errorMessage');

    // Clear previous errors
    errorMsg.classList.add('hidden');

    try {
      // Set persistence based on "Remember me" checkbox
      const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Store login state and user info
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userEmail', userCredential.user.email);
      
      // Redirect to dashboard
      window.location.href = 'index.html';
      
    } catch (error) {
      let errorText = 'Login failed. Please try again.';
      
      // Handle specific Firebase Auth errors
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          errorText = 'Invalid email or password.';
          break;
        case 'auth/too-many-requests':
          errorText = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/user-disabled':
          errorText = 'This account has been disabled.';
          break;
        case 'auth/invalid-email':
          errorText = 'Please enter a valid email address.';
          break;
        default:
          console.error('Login error:', error);
      }

      // Show error message
      errorMsg.textContent = errorText;
      errorMsg.classList.remove('hidden');

      // Shake animation
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 300);
    }
  });
}

// ========================
// LOGOUT FUNCTION
// ========================
async function logout() {
  try {
    console.log('Logging out...');
    await signOut(auth);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    window.location.href = 'Capstone1Login.html';
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect even if signOut fails
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    window.location.href = 'Capstone1Login.html';
  }
}

// ========================
// LOGOUT BUTTON HANDLER
// ========================
function initLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    console.log('Logout button found, attaching event listener');
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Logout button clicked');
      try {
        await logout();
      } catch (error) {
        console.error('Logout handler error:', error);
        // Force logout even if there's an error
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userEmail');
        window.location.href = 'Capstone1Login.html';
      }
    });
  } else {
    console.log('Logout button not found');
  }
}

// ========================
// AUTH STATE MANAGEMENT
// ========================
function initAuthStateListener() {
  onAuthStateChanged(auth, (user) => {
    const isIndexPage = window.location.pathname.includes('index.html') || 
                       window.location.pathname === '/' || 
                       window.location.pathname.endsWith('/');
    
    if (isIndexPage) {
      if (!user) {
        // Not logged in, redirect to login
        console.log('User not authenticated, redirecting to login');
        window.location.href = 'Capstone1Login.html';
      } else {
        // User is logged in, set local storage and continue
        console.log('User authenticated:', user.email);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', user.email);
      }
    }
  });
}

// ========================
// PAGE DETECTION AND INITIALIZATION
// ========================
function initializePage() {
  const isLoginPage = window.location.pathname.includes('Capstone1Login.html');
  const isIndexPage = window.location.pathname.includes('index.html') || 
                     window.location.pathname === '/' || 
                     window.location.pathname.endsWith('/');

  console.log('Initializing page:', { isLoginPage, isIndexPage });

  if (isLoginPage) {
    // Initialize login form
    initLoginForm();
  } else if (isIndexPage) {
    // Initialize auth state listener and logout button
    initAuthStateListener();
    
    // Wait for DOM to be fully loaded before attaching logout button
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initLogoutButton);
    } else {
      initLogoutButton();
    }
  }
}

// ========================
// GLOBAL EXPORTS
// ========================
// Make logout available globally for any other scripts that need it
window.logout = logout;

// Export for module use
export { logout };

// ========================
// AUTO-INITIALIZATION
// ========================
// Initialize based on current page
initializePage();