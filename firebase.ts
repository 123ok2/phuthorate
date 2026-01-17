
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAZSCt10l8506EehLfFbA-Q05WKPU6Tgpw",
  authDomain: "danhgiacanbo-9ad0f.firebaseapp.com",
  projectId: "danhgiacanbo-9ad0f",
  storageBucket: "danhgiacanbo-9ad0f.firebasestorage.app",
  messagingSenderId: "358438230879",
  appId: "1:358438230879:web:7600fc4757643810a2f4ea",
  measurementId: "G-P5D9VYRMEL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
