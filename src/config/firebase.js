import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY || "AIzaSyDwb_iRqVAPh7PI7TLVaThvBX6VPXgHbLM",
  authDomain: import.meta.env.VITE_AUTH_DOMAIN || "recolekta-app.firebaseapp.com",
  projectId: import.meta.env.VITE_PROJECT_ID || "recolekta-app",
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET || "recolekta-app.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID || "367430492614",
  appId: import.meta.env.VITE_APP_ID || "1:367430492614:web:de8a74da7db328114dd2c7",
  measurementId: import.meta.env.VITE_MEASUREMENT_ID || "G-KB7BXRZ1QX"
};

// Inicializar la aplicación
const app = initializeApp(firebaseConfig);

// Exportar los servicios para que el resto de la app los pueda usar
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const cloudFunctions = getFunctions(app);
