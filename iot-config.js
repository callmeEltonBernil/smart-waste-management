// Setup: Include this file before firebase-init.js
// Reads from window.ENV or falls back to placeholders
// Never commit real secrets to source control
window.ENV = window.ENV || {
  FIREBASE: {
    apiKey: "AIzaSyDLuMpdsTrO3av0C38bzCq21MmwcodXJkk",
    authDomain: "smart-bin-app-d9ef0.firebaseapp.com",
    projectId: "smart-bin-app-d9ef0",
    storageBucket: "smart-bin-app-d9ef0.firebasestorage.app",
    messagingSenderId: "732593148346",
    appId: "1:732593148346:web:abf693c7de788f03104d83",
    measurementId: "G-44Q1G78R2G"
  }
};

export const firebaseConfig = window.ENV.FIREBASE;

/*window.ENV = window.ENV || {
  FIREBASE: {
    apiKey: 'fake-api-key',
    authDomain: 'localhost',
    projectId: 'demo-project', 
    storageBucket: 'demo-project.appspot.com',
    messagingSenderId: '000000000000',
    appId: 'fake-app-id',
    measurementId: 'G-FAKE'
  },
  USE_EMULATORS: true
};

export const firebaseConfig = window.ENV.FIREBASE;*/