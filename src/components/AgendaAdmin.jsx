import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Calendar, Save, Clock, MapPin, Wrench, Loader2, Plus, Eraser, AlertTriangle } from 'lucide-react';

export default function AgendaAdmin({ sucursales = [] }) {
  const TRANSPORTISTAS = [
    "ANTONIO RIVAS", "GIOVANNI CALLEJAS", "TEODORO PÉREZ", "FLOR CARDOZA", "WALTER RIVAS", 
    "JAIRO GIL", "FELIX VASQUEZ", "DAVID ALVARADO", "EDWIN FLORES", "ROGELIO MAZARIEGO", 
    "CARLOS SOSA", "JASON BARRERA", "BRAYAN REYES", "HILDEBRANDO MENJIVAR", "USUARIO PRUEBA", "CHOFER PRUEBA"
  ];

  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    horario: '',
    zona: '',
    puntos: '',
    turnos: '', 
    mantenimiento: ''
  });

  useEffect(() => {
    if (!selectedUser) {
        setData({ horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
        return;
    }
    const loadData = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, "agenda_flota", selectedUser);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setData(docSnap.data());
            } else {
                setData({ horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
            }
        } catch (error) {
            console.error("Error cargando agenda:", error);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, [selectedUser]);

  const addSucursal = (e) => {
      const val = e.target.value;
      if (!val) return;
      setData(prev => ({
          ...prev,
          puntos: prev.puntos ? `${prev.puntos} / ${val}` : val
      }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedUser) return alert("Selecciona un transportista primero.");

    // --- CANDADO DE SEGURIDAD: NO TURNO + MANTENIMIENTO EL MISMO DÍA ---
    if (data.mantenimiento && data.turnos) {
        // 1. Extraer día y mes del mantenimiento (YYYY-MM-DD -> DD/MM)
        const [year, month, day] = data.mantenimiento.split('-');
        const maintDateShort = `${day}/${month}`; // Ej: "16/02"

        // 2. Buscar si esa fecha existe en el texto de turnos
        if (data.turnos.includes(maintDateShort)) {
            return alert(`⚠️ CONFLICTO DE AGENDA:\n\nEl usuario tiene Mantenimiento el día ${maintDateShort}.\nNo puedes asignarle un Turno Extra ese mismo día.\n\nPor favor, corrige la fecha.`);
        }
    }
    
    setLoading(true);
    try {
        await setDoc(doc(db, "agenda_flota", selectedUser), {
            ...data,
            updatedAt: new Date().toISOString()
        });
        alert(`✅ Agenda actualizada correctamente para ${selectedUser}`);
        
        setData({ horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
        setSelectedUser(''); 
        
    } catch (error) {
        console.error(error);
        alert("Error al guardar. Revisa tu conexión.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 animate-in fade-in">
        <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
            <Calendar className="text-blue-500"/> Asignación de Horarios
        </h3>

        <div className="space-y-6">
            <div>
                <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Seleccionar Transportista</label>
                <div className="flex gap-2">
                    <select className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-blue-500"
                        value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                        <option value="">-- SELECCIONAR --</option>
                        {TRANSPORTISTAS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {selectedUser && (
                        <button onClick={() => { setSelectedUser(''); setData({ horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' }); }} className="bg-slate-800 p-4 rounded-2xl text-slate-400 hover:text-white" title="Limpiar">
                            <Eraser size={20}/>
                        </button>
                    )}
                </div>
            </div>

            {selectedUser && (
                <form onSubmit={handleSave} className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Horario Base</label>
                            <div className="relative">
                                <input type="text" placeholder="Ej: 6:30 AM - 4:30 PM" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl text-white font-bold outline-none focus:border-blue-500 pl-10"
                                    value={data.horario} onChange={e => setData({...data, horario: e.target.value})} required/>
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Zona / Región</label>
                            <input type="text" placeholder="Ej: San Salvador Centro" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl text-white font-bold outline-none focus:border-blue-500"
                                value={data.zona} onChange={e => setData({...data, zona: e.target.value})} required/>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Puntos Específicos</label>
                        <div className="flex gap-2 mb-2">
                            <select onChange={addSucursal} className="w-full p-2 bg-[#0B1120] border border-slate-700 rounded-xl text-xs text-slate-300 outline-none">
                                <option value="">+ Agregar Sucursal Rápida</option>
                                {sucursales.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="relative">
                            <input type="text" placeholder="Escribe o selecciona arriba..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl text-white font-bold outline-none focus:border-blue-500 pl-10"
                                value={data.puntos} onChange={e => setData({...data, puntos: e.target.value})} required/>
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-green-400 ml-4 block uppercase mb-1">Días Turno Extra (Texto)</label>
                            <input type="text" placeholder="Ej: 07/02, 21/02" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl text-white font-bold outline-none focus:border-green-500"
                                value={data.turnos} onChange={e => setData({...data, turnos: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-yellow-400 ml-4 block uppercase mb-1">Próximo Mantenimiento</label>
                            <div className="relative">
                                <input type="date" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl text-white font-bold outline-none focus:border-yellow-500 pl-10"
                                    value={data.mantenimiento} onChange={e => setData({...data, mantenimiento: e.target.value})} />
                                <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-500" size={18}/>
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg hover:bg-blue-500 transition-all flex justify-center items-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : <Save size={18}/>}
                        {loading ? "Guardando..." : "Guardar y Limpiar"}
                    </button>
                </form>
            )}
        </div>
    </div>
  );
}