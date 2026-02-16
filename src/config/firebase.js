import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Tus credenciales de producción de Recolekta OS
const firebaseConfig = {
  apiKey: "AIzaSyDwb_iRqVAPh7PI7TLVaThvBX6VPXgHbLM",
  authDomain: "recolekta-app.firebaseapp.com",
  projectId: "recolekta-app",
  storageBucket: "recolekta-app.firebasestorage.app",
  messagingSenderId: "367430492614",
  appId: "1:367430492614:web:de8a74da7db328114dd2c7",
  measurementId: "G-KB7BXRZ1QX"
};

// Inicializar la aplicación
const app = initializeApp(firebaseConfig);

// Exportar los servicios para que el resto de la app los pueda usar
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);