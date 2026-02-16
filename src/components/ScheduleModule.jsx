import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Calendar, Clock, MapPin, Wrench, AlertCircle } from 'lucide-react';

export default function ScheduleModule({ currentUser, userName }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "agenda_flota", userName);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            setSchedule(docSnap.data());
        } else {
            setSchedule(null);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [userName]);

  if (loading) return <div className="p-10 text-center text-slate-500">Cargando agenda...</div>;

  if (!schedule) return (
    <div className="bg-[#151F32] p-8 rounded-[2rem] border border-slate-800 text-center">
        <Calendar className="mx-auto text-slate-600 mb-4" size={40}/>
        <h3 className="text-white font-bold">Sin asignación</h3>
        <p className="text-slate-500 text-xs mt-2">Aún no se ha cargado tu horario de este mes.</p>
    </div>
  );

  // Lógica Blindada Anti-Errores
  const todayDate = new Date();
  const day = String(todayDate.getDate()).padStart(2, '0');
  const month = String(todayDate.getMonth() + 1).padStart(2, '0');
  const year = todayDate.getFullYear();

  const todayShortSlash = `${day}/${month}`;
  const todayShortDash = `${day}-${month}`;
  const todayFullSlash = `${day}/${month}/${year}`;
  const todayFullDash = `${day}-${month}-${year}`;

  const monthUnpadded = todayDate.getMonth() + 1;
  const dayUnpadded = todayDate.getDate();
  const todayShortSlashUnp = `${dayUnpadded}/${monthUnpadded}`;
  const todayFullSlashUnp = `${dayUnpadded}/${monthUnpadded}/${year}`;

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayName = days[todayDate.getDay()];

  const turnosTxt = (schedule.turnos || '').toLowerCase();
  const isTurnoHoy =
      turnosTxt.includes(todayName.toLowerCase()) ||
      turnosTxt.includes(todayShortSlash) ||
      turnosTxt.includes(todayShortDash) ||
      turnosTxt.includes(todayFullSlash) ||
      turnosTxt.includes(todayFullDash) ||
      turnosTxt.includes(todayShortSlashUnp) ||
      turnosTxt.includes(todayFullSlashUnp);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300 pb-20">
        
        {/* ENCABEZADO */}
        <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h2 className="text-xl font-black mb-1 flex items-center gap-3 text-white">
                <Calendar className="text-blue-500"/> Mi Agenda
            </h2>
            <p className="text-slate-400 text-xs">Hola, {userName.split(' ')[0]}. Esta es tu programación.</p>
        </div>

        {/* TARJETA 1: RUTA BASE */}
        <div className="bg-[#0B1120] p-6 rounded-[2rem] border border-slate-800 shadow-inner">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">MI RUTA MENSUAL</h3>
            <div className="space-y-4">
                <div className="flex items-start gap-4">
                    <div className="bg-blue-900/30 p-3 rounded-xl text-blue-400"><Clock size={20}/></div>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Horario Base</p>
                        <p className="text-lg font-black text-white">{schedule.horario || "--"}</p>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <div className="bg-indigo-900/30 p-3 rounded-xl text-indigo-400"><MapPin size={20}/></div>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Puntos Asignados</p>
                        <p className="text-sm font-bold text-white">{schedule.puntos || "--"}</p>
                        <p className="text-xs text-slate-500 mt-1">{schedule.zona || ""}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* TARJETA 2: ALERTAS DE HOY */}
        {isTurnoHoy && (
            <div className="bg-orange-900/20 p-6 rounded-[2rem] border border-orange-900/50 flex items-center gap-4 animate-pulse">
                <AlertCircle className="text-orange-500" size={32}/>
                <div>
                    <h4 className="text-white font-black text-sm">¡TIENES TURNO EXTRA HOY!</h4>
                    <p className="text-slate-400 text-xs">Verifica tu asignación.</p>
                </div>
            </div>
        )}

        {/* TARJETA 3: PRÓXIMOS TURNOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">TURNOS ASIGNADOS</h3>
                {schedule.turnos ? (
                    <div className="flex flex-wrap gap-2">
                        {schedule.turnos.split(',').map((date, i) => (
                            <span key={i} className="bg-[#0B1120] px-3 py-2 rounded-lg text-white font-bold text-xs border border-slate-700">{date.trim()}</span>
                        ))}
                    </div>
                ) : (
                    <p className="text-slate-500 text-xs italic">Sin turnos extra.</p>
                )}
            </div>

            <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">MANTENIMIENTO</h3>
                {schedule.mantenimiento ? (
                    <div className="flex items-center gap-3 bg-[#0B1120] p-4 rounded-xl border border-yellow-900/30">
                        <Wrench className="text-yellow-500" size={20}/>
                        <div>
                            <p className="text-white font-black text-sm">
                                {(() => {
                                    const partes = schedule.mantenimiento.split('-');
                                    if (partes.length === 3) {
                                        return `${partes[2]}/${partes[1]}/${partes[0]}`;
                                    }
                                    return schedule.mantenimiento;
                                })()}
                            </p>
                            <p className="text-slate-500 text-[10px] uppercase">Revisión Programada</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-slate-500 text-xs italic">Sin fecha asignada.</p>
                )}
            </div>
        </div>
    </div>
  );
}