import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
// ¡AQUÍ ESTABA EL ERROR! Faltaba agregar "Clock" a esta lista 👇
import { Calendar, Save, Trash2, Plus, Eraser, Edit3, MapPin, Clock } from 'lucide-react';

const TRANSPORTISTAS = [
    "BRAYAN REYES", "EDWIN FLORES", "TEODORO PÉREZ", "GIOVANNI CALLEJAS", "JAIRO GIL", "JASON BARRERA", 
    "ANTONIO RIVAS", "WALTER RIVAS", "ROGELIO MAZARIEGO", "DAVID ALVARADO", "CARLOS SOSA", "FELIX VASQUEZ", 
    "FLOR CARDOZA", "HILDEBRANDO MENJIVAR", "USUARIO PRUEBA", "CHOFER PRUEBA"
];

// Recibimos las sucursales desde el App.jsx principal
export default function AgendaAdmin({ sucursales = [] }) {
    const [agendaData, setAgendaData] = useState([]);
    const [form, setForm] = useState({ id: '', horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
    const [tempDate, setTempDate] = useState('');
    const [tempPunto, setTempPunto] = useState('');

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "agenda_flota"), (snap) => {
            setAgendaData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.id) return alert("Selecciona un transportista");
        try {
            await setDoc(doc(db, "agenda_flota", form.id), form);
            alert("Agenda actualizada correctamente.");
            setForm({ id: '', horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
        } catch (error) {
            console.error("Error saving agenda:", error);
            alert("Error al guardar en la base de datos.");
        }
    };

    const handleDelete = async (id) => {
        if(window.confirm(`¿Eliminar la agenda de ${id}?`)) {
            await deleteDoc(doc(db, "agenda_flota", id));
        }
    };

    const handleEdit = (item) => {
        setForm(item);
    };

    // EL MAGO DE LAS FECHAS MÚLTIPLES
    const addTurnoDate = () => {
        if (!tempDate) return;
        const [y, m, d] = tempDate.split('-');
        const formattedDate = `${d}/${m}/${y}`;
        
        let currentTurnos = form.turnos ? form.turnos.split(' - ').map(t => t.trim()).filter(t => t) : [];
        if (!currentTurnos.includes(formattedDate)) {
            currentTurnos.push(formattedDate);
            setForm({ ...form, turnos: currentTurnos.join(' - ') });
        }
        setTempDate('');
    };

    const clearTurnos = () => setForm({ ...form, turnos: '' });

    // EL MAGO DE LAS SUCURSALES MÚLTIPLES
    const addPunto = () => {
        if (!tempPunto) return;
        let currentPuntos = form.puntos ? form.puntos.split(' / ').map(p => p.trim()).filter(p => p) : [];
        if (!currentPuntos.includes(tempPunto)) {
            currentPuntos.push(tempPunto);
            setForm({ ...form, puntos: currentPuntos.join(' / ') });
        }
        setTempPunto('');
    };

    const clearPuntos = () => setForm({ ...form, puntos: '' });

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-xl">
                <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2"><Calendar className="text-blue-500"/> Gestionar Horarios y Turnos</h3>
                
                <form onSubmit={handleSave} className="space-y-6">
                    {/* FILA 1: Transportista y Horario */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Transportista</label>
                            <select value={form.id} onChange={e=>setForm({...form, id: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold cursor-pointer" required>
                                <option value="">-- SELECCIONAR --</option>
                                {TRANSPORTISTAS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Horario Base</label>
                            <input value={form.horario} onChange={e=>setForm({...form, horario: e.target.value})} placeholder="Ej. 06:00 am - 03:00 pm" className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/>
                        </div>
                    </div>

                    {/* FILA 2: Zona y Mantenimiento */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Zona Asignada</label>
                            <input value={form.zona} onChange={e=>setForm({...form, zona: e.target.value})} placeholder="Ej. San Salvador Centro" className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Próx. Mantenimiento</label>
                            <input type="date" value={form.mantenimiento} onChange={e=>setForm({...form, mantenimiento: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold cursor-pointer"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* MÓDULO SUCURSALES */}
                        <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
                            <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2"><MapPin size={14} className="text-indigo-400"/> Puntos / Sucursales</h4>
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Catálogo Oficial</label>
                                    <select value={tempPunto} onChange={e => setTempPunto(e.target.value)} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold cursor-pointer">
                                        <option value="">-- ELEGIR SUCURSAL --</option>
                                        {sucursales.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <button type="button" onClick={addPunto} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold flex items-center shadow-md transition-all h-[46px] mt-auto">
                                    <Plus size={18}/>
                                </button>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Ruta Armanda</label>
                                    {form.puntos && <button type="button" onClick={clearPuntos} className="text-[9px] text-red-400 flex items-center gap-1 hover:text-red-300"><Eraser size={12}/> Limpiar</button>}
                                </div>
                                <textarea value={form.puntos} onChange={e=>setForm({...form, puntos: e.target.value})} placeholder="Agrega sucursales usando el selector de arriba..." className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold resize-none h-16"/>
                            </div>
                        </div>

                        {/* MÓDULO TURNOS */}
                        <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
                            <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2"><Clock size={14} className="text-purple-400"/> Programación de Turnos</h4>
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Calendario</label>
                                    <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold cursor-pointer"/>
                                </div>
                                <button type="button" onClick={addTurnoDate} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold flex items-center shadow-md transition-all h-[46px] mt-auto">
                                    <Plus size={18}/>
                                </button>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Fechas Asignadas</label>
                                    {form.turnos && <button type="button" onClick={clearTurnos} className="text-[9px] text-red-400 flex items-center gap-1 hover:text-red-300"><Eraser size={12}/> Limpiar</button>}
                                </div>
                                <textarea value={form.turnos} onChange={e=>setForm({...form, turnos: e.target.value})} placeholder="Agrega fechas usando el calendario de arriba..." className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold resize-none h-16"/>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black uppercase shadow-lg flex items-center justify-center gap-2 transition-all">
                        <Save size={18} /> {form.id && agendaData.some(a=>a.id === form.id) ? 'Actualizar Agenda' : 'Guardar Nueva Agenda'}
                    </button>
                </form>
            </div>

            {/* TABLA DE AGENDA */}
            <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg">
                        <tr><th className="px-4 py-3 rounded-l-lg">Transportista</th><th className="px-4 py-3">Horario</th><th className="px-4 py-3">Zona</th><th className="px-4 py-3 max-w-[200px]">Ruta Asignada</th><th className="px-4 py-3 max-w-[150px]">Turnos</th><th className="px-4 py-3">Mantenimiento</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr>
                    </thead>
                    <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                        {agendaData.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-800/50">
                                <td className="px-4 py-3 text-white">{item.id}</td>
                                <td className="px-4 py-3 text-blue-400">{item.horario}</td>
                                <td className="px-4 py-3">{item.zona}</td>
                                <td className="px-4 py-3 truncate max-w-[200px]" title={item.puntos}>{item.puntos || '--'}</td>
                                <td className="px-4 py-3 truncate max-w-[150px]" title={item.turnos}>{item.turnos || '--'}</td>
                                <td className="px-4 py-3 text-yellow-500">{item.mantenimiento ? formatLocalDate(item.mantenimiento) : '--'}</td>
                                <td className="px-4 py-3 flex justify-center gap-2">
                                    <button onClick={() => handleEdit(item)} className="bg-slate-800 p-2 rounded-lg text-blue-400 hover:text-white transition-all"><Edit3 size={14}/></button>
                                    <button onClick={() => handleDelete(item.id)} className="bg-slate-800 p-2 rounded-lg text-red-500 hover:text-white transition-all"><Trash2 size={14}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    function formatLocalDate(dateStr) {
        if (!dateStr) return '';
        if (dateStr.includes('-') && !dateStr.includes('T')) {
            const [y, m, d] = dateStr.split('-');
            if (y && m && d) return `${d}/${m}/${y}`;
        }
        try { return new Date(dateStr).toLocaleDateString('es-ES'); } catch(e) { return dateStr; }
    }
}