// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase'; // Importamos del archivo que acabamos de crear

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'admin' o 'user'
  const [loading, setLoading] = useState(true);

  // Función para iniciar sesión (Emails reales)
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Función para cerrar sesión
  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      // Lógica simple de roles basada en el email (esto se puede mejorar luego con base de datos)
      if (user) {
        if (user.email === 'admin@recolekta.com') { // Email maestro que crearás
            setUserRole('admin');
        } else {
            setUserRole('user');
        }
      } else {
        setUserRole(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}