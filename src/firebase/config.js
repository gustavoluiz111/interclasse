import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCwO4cSeKqL0gdSALDfqPcGRx5tw8onQpk",
  authDomain: "interclasse-250b0.firebaseapp.com",
  databaseURL: "https://interclasse-250b0-default-rtdb.firebaseio.com",
  projectId: "interclasse-250b0",
  storageBucket: "interclasse-250b0.firebasestorage.app",
  messagingSenderId: "734914711818",
  appId: "1:734914711818:web:06a6e5268aa16570c42af3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
