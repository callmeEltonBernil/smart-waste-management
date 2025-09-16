// Setup: Replace localStorage auth with Firebase Auth. Keep UI effects.
import { auth, signInWithEmailAndPassword, signOut, setPersistence, 
         browserLocalPersistence, browserSessionPersistence } from './firebase-init.js';

document.getElementById('loginForm').addEventListener('submit', async function(e) {
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

// Logout function - define it properly
async function logout() {
  try {
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

