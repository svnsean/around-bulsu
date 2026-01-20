import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBgtYcktJtpX1gQ_TCVLn3u3Mo3PRqMr0U",
  authDomain: "around-bulsu-backend.firebaseapp.com",
  projectId: "around-bulsu-backend",
  storageBucket: "around-bulsu-backend.firebasestorage.app",
  messagingSenderId: "649098234000",
  appId: "1:649098234000:web:6b719f5f12eea5b7413015"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app); 

export { db };

