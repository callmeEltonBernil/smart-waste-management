/*import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, 
         setPersistence, browserLocalPersistence, browserSessionPersistence } 
         from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, query, where, orderBy, limit, 
         onSnapshot, doc, updateDoc, serverTimestamp, getDocs } 
         from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';
import { firebaseConfig } from './iot-config.js';

let app, auth, db, analytics;
let initialized = false;

function initializeFirebase() {
  if (initialized) {
    return { app, auth, db, analytics };
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    analytics = getAnalytics(app);
    initialized = true;
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    throw error;
  }

  return { app, auth, db, analytics };
}

const firebase = initializeFirebase();

export const { auth, db } = firebase;
export { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs
};*/

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, 
         setPersistence, browserLocalPersistence, browserSessionPersistence,
         connectAuthEmulator } 
         from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, query, where, orderBy, limit, 
         onSnapshot, doc, updateDoc, serverTimestamp, getDocs,
         connectFirestoreEmulator } 
         from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { firebaseConfig } from './iot-config.js';

let app, firebaseAuth, firebaseDb;
let initialized = false;

function initializeFirebase() {
  if (initialized) {
    return { app, auth: firebaseAuth, db: firebaseDb };
  }

  try {
    app = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(app);
    firebaseDb = getFirestore(app);

    if (window.location.hostname === 'localhost') {
      try {
        connectAuthEmulator(firebaseAuth, 'http://localhost:9099', { disableWarnings: true });
        connectFirestoreEmulator(firebaseDb, 'localhost', 8080);
        console.log('Connected to Firebase emulators');
      } catch (emulatorError) {
        console.log('Emulator connection error:', emulatorError.message);
      }
    }

    initialized = true;
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    throw error;
  }

  return { app, auth: firebaseAuth, db: firebaseDb };
}

const firebase = initializeFirebase();

export const auth = firebase.auth;
export const db = firebase.db;
export { 
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, serverTimestamp, getDocs
};