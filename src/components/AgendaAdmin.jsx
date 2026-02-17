import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Calendar, Save, Trash2, Plus, Eraser, Edit3 } from 'lucide-react';

const TRANSPORTISTAS = [
    "BRAYAN REYES", "EDWIN FLORES", "TEODORO PÉREZ", "GIOVANNI CALLEJAS", "JAIRO GIL", "JASON BARRERA", 
    "ANTONIO RIVAS", "WALTER RIVAS", "ROGELIO MAZARIEGO", "DAVID ALVARADO", "CARLOS SOSA", "FELIX VASQUEZ", 
    "FLOR CARDOZA", "HILDEBRANDO MENJIVAR", "USUARIO PRUEBA", "CHOFER PRUEBA"
];

export default function AgendaAdmin() {
    const [agendaData, setAgendaData] = useState([]);
    const [form, setForm] = useState({ id: '', horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
    const [tempDate, setTempDate] = useState('');

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

    // EL MAGO DE LAS FECHAS MULTIPLES
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

    const clearTurnos = () => {
        setForm({ ...form, turnos: '' });
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#151F32] p-8 rounded-[2rem] border border-slate-800 shadow-xl">
                <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2"><Calendar className="text-blue-500"/> Gestionar Horarios y Turnos</h3>
                
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Transportista</label>
                            <select value={form.id} onChange={e=>setForm({...form, id: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold" required>
                                <option value="">-- SELECCIONAR --</option>
                                {TRANSPORTISTAS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Horario Base</label>
                            <input value={form.horario} onChange={e=>setForm({...form, horario: e.target.value})} placeholder="Ej. 06:00 am - 03:00 pm" className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Zona Asignada</label>
                            <input value={form.zona} onChange={e=>setForm({...form, zona: e.target.value})} placeholder="Ej. San Salvador Centro" className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Puntos / Sucursales</label>
                            <input value={form.puntos} onChange={e=>setForm({...form, puntos: e.target.value})} placeholder="Ej. La Unión / San Martín / Casco" className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/>
                        </div>
                    </div>

                    {/* SECCIÓN ESPECIAL DE FECHAS */}
                    <div className="bg-[#0B1120] p-4 rounded-xl border border-slate-800 space-y-4">
                        <h4 className="text-xs font-bold text-slate-300 uppercase">Programación de Turnos Extras</h4>
                        
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Seleccionar Día en Calendario</label>
                                <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold"/>
                            </div>
                            <button type="button" onClick={addTurnoDate} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl font-bold flex items-center gap-1 shadow-md transition-all h-[46px]">
                                <Plus size={18}/> Agregar
                            </button>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Lista de Turnos (Separados por guion)</label>
                                {form.turnos && <button type="button" onClick={clearTurnos} className="text-[9px] text-red-400 flex items-center gap-1 hover:text-red-300"><Eraser size={12}/> Limpiar Lista</button>}
                            </div>
                            <textarea value={form.turnos} onChange={e=>setForm({...form, turnos: e.target.value})} placeholder="01/02/2026 - 04/02/2026..." className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold resize-none h-16"/>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Próx. Mantenimiento</label>
                        <input type="date" value={form.mantenimiento} onChange={e=>setForm({...form, mantenimiento: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/>
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
                        <tr><th className="px-4 py-3 rounded-l-lg">Transportista</th><th className="px-4 py-3">Horario</th><th className="px-4 py-3">Zona</th><th className="px-4 py-3 max-w-[200px]">Turnos</th><th className="px-4 py-3">Mantenimiento</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr>
                    </thead>
                    <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                        {agendaData.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-800/50">
                                <td className="px-4 py-3 text-white">{item.id}</td>
                                <td className="px-4 py-3 text-blue-400">{item.horario}</td>
                                <td className="px-4 py-3">{item.zona}</td>
                                <td className="px-4 py-3 truncate max-w-[200px]" title={item.turnos}>{item.turnos || '--'}</td>
                                <td className="px-4 py-3 text-yellow-500">{item.mantenimiento || '--'}</td>
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
}