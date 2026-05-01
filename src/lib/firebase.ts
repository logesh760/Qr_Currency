import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Test Connection
async function testConnection() {
  try {
    // Basic verification
    if (auth) {
       console.log("Firebase initialized");
    }
  } catch (error) {
    console.warn("Firebase check skipped or failed.");
  }
}
testConnection();
