// src/components/LoginModule.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bike, Loader2, AlertTriangle } from 'lucide-react';

export default function LoginModule() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      // Al tener éxito, el AuthContext actualizará el estado y App.jsx cambiará de vista automáticamente
    } catch (err) {
      setError('Credenciales incorrectas. Intente nuevamente.');
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
      <div className="bg-[#151F32] max-w-md w-full rounded-[3rem] p-10 text-center shadow-2xl border border-slate-800">
        <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-green-500/20">
          <Bike size={32}/>
        </div>
        
        <h2 className="text-2xl font-black uppercase mb-2 tracking-tighter text-white">Recolekta OS</h2>
        <p className="text-slate-400 text-xs mb-8 uppercase tracking-widest font-bold">Acceso Corporativo v2.0</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-6 text-xs font-bold flex items-center gap-2 justify-center">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-left">
            <label className="text-[10px] font-bold text-slate-500 ml-4 block uppercase mb-1">Correo Institucional</label>
            <input 
              type="email" 
              required 
              className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-green-500 transition-all placeholder-slate-700"
              placeholder="usuario@analiza.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="text-left">
            <label className="text-[10px] font-bold text-slate-500 ml-4 block uppercase mb-1">Contraseña</label>
            <input 
              type="password" 
              required 
              className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-green-500 transition-all placeholder-slate-700"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-white text-[#0B1120] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={16}/> : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}