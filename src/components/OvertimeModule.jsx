import React, { useState } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Clock, CheckCircle2, Loader2, FileText } from 'lucide-react';

// --- ESCUDO ANTI ZONA HORARIA ---
const formatLocalDate = (dateStr) => {
    if (!dateStr) return '--';
    // Si viene en formato AAAA-MM-DD, lo forzamos a DD/MM/AAAA sin usar 'new Date()' para evitar que reste 6 horas
    if (dateStr.includes('-') && !dateStr.includes('T')) {
        const [y, m, d] = dateStr.split('-');
        if (y && m && d) return `${d}/${m}/${y}`;
    }
    try { return new Date(dateStr).toLocaleDateString('es-ES'); } catch(e) { return dateStr; }
};

export default function OvertimeModule({ currentUser, history }) {
    const [isUploading, setIsUploading] = useState(false);
    const [form, setForm] = useState({
        fecha: new Date().toISOString().split('T')[0], // Pone la fecha de hoy por defecto
        horaInicio: '17:00',
        horaFin: '19:00',
        motivo: ''
    });

    const calcularHoras = () => {
        if (!form.horaInicio || !form.horaFin) return 0;
        const [h1, m1] = form.horaInicio.split(':').map(Number);
        const [h2, m2] = form.horaFin.split(':').map(Number);
        let minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (minutos < 0) minutos += 24 * 60; // Por si el turno cruza la medianoche
        return (minutos / 60).toFixed(1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if(!form.fecha || !form.motivo) return alert("Completa los campos obligatorios");
        setIsUploading(true);
        try {
            await addDoc(collection(db, "registros_horas_extras"), {
                ...form,
                horasCalculadas: calcularHoras(),
                usuario: currentUser.email,
                createdAt: new Date().toISOString()
            });
            alert("¡Horas extras enviadas a RRHH correctamente!");
            setForm({ ...form, motivo: '' }); // Limpia solo el motivo para el siguiente registro
        } catch (error) {
            console.error(error);
            alert("Error al registrar las horas.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300 pb-20">
            {/* FORMULARIO DE INGRESO */}
            <div className="bg-[#151F32] p-6 md:p-10 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 to-fuchsia-500"></div>
                <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-white"><Clock className="text-purple-500"/> Reporte de Horas Extra</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Fecha del Turno</label>
                        <input type="date" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-purple-500" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} required />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Hora Inicio</label>
                            <input type="time" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-purple-500" value={form.horaInicio} onChange={e => setForm({...form, horaInicio: e.target.value})} required />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Hora Fin</label>
                            <input type="time" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-purple-500" value={form.horaFin} onChange={e => setForm({...form, horaFin: e.target.value})} required />
                        </div>
                    </div>

                    <div className="bg-[#0B1120] p-4 rounded-xl text-center border border-slate-800">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total a Pagar</p>
                        <h4 className="text-3xl font-black text-purple-400">{calcularHoras()} <span className="text-sm">hrs</span></h4>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Motivo / Justificación</label>
                        <textarea placeholder="Ej. Retraso en ruta 5, turno doble asignado por supervisor..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-purple-500 resize-none h-24" value={form.motivo} onChange={e => setForm({...form, motivo: e.target.value})} required />
                    </div>

                    <button type="submit" disabled={isUploading} className="w-full py-4 bg-purple-600 rounded-2xl font-black text-sm text-white shadow-lg hover:bg-purple-500 transition-all uppercase flex items-center justify-center gap-2">
                        {isUploading ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}
                        {isUploading ? 'Procesando...' : 'Enviar Reporte a RRHH'}
                    </button>
                </form>
            </div>

            {/* TABLA DE HISTORIAL (AHORA CON LA FECHA CORRECTA) */}
            <div className="bg-[#151F32] rounded-[2.5rem] shadow-xl border border-slate-800 p-6">
                <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest mb-6 flex items-center gap-2"><FileText className="text-purple-500" size={18}/> Mis Horas Extra (Quincena)</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Fecha</th>
                                <th className="px-4 py-3">Inicio</th>
                                <th className="px-4 py-3">Fin</th>
                                <th className="px-4 py-3">Total</th>
                                <th className="px-4 py-3 rounded-r-lg">Motivo</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                            {history && history.length > 0 ? history.map((r) => (
                                <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                                    {/* Aplicamos la función formatLocalDate para forzar el día correcto */}
                                    <td className="px-4 py-3 text-white font-black">{formatLocalDate(r.fecha)}</td>
                                    <td className="px-4 py-3 text-slate-500">{r.horaInicio}</td>
                                    <td className="px-4 py-3 text-slate-500">{r.horaFin}</td>
                                    <td className="px-4 py-3 text-purple-400 font-bold">{r.horasCalculadas}h</td>
                                    <td className="px-4 py-3 text-[10px] italic max-w-[150px] truncate" title={r.motivo}>{r.motivo}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan="5" className="px-4 py-6 text-center text-slate-600 italic text-xs">No tienes horas extras registradas recientemente.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
