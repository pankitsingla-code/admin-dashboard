// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';  // ✅ Import this

const firebaseConfig = {
  apiKey: "AIzaSyASzxv_ObHMaQ5oizUDbfxuI0fzzn_zWFg",
  authDomain: "grm-app-3d8ab.firebaseapp.com",
  databaseURL: "https://grm-app-3d8ab-default-rtdb.firebaseio.com",
  projectId: "grm-app-3d8ab",
  storageBucket: "grm-app-3d8ab.firebasestorage.app",
  messagingSenderId: "710488018410",
  appId: "1:710488018410:web:47414a5b6971985b7ab693",
  measurementId: "G-CN28CKPKS2"
};

const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);
const db = getDatabase(firebaseApp);  // ✅ Initialize Realtime Database

export { firebaseApp, storage, db };  // ✅ Export it
