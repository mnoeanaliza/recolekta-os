// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { auth } from '../config/firebase'; // Importamos del archivo que acabamos de crear
import { ADMIN_EMAILS, SUPERVISOR_EMAILS } from '../utils/constants';

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        const normalizedEmail = user.email?.toLowerCase().trim();
        const tokenResult = await getIdTokenResult(user).catch(() => null);
        const claimedRole = tokenResult?.claims?.role;

        if (claimedRole) {
            setUserRole(claimedRole);
        } else if (ADMIN_EMAILS.includes(normalizedEmail)) {
            setUserRole('admin');
        } else if (SUPERVISOR_EMAILS.includes(normalizedEmail)) {
            setUserRole('supervisor');
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
