import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Calendar, Save, Trash2, Plus, Eraser, Edit3, MapPin, Clock, Users, X } from 'lucide-react';

const formatLocalDate = (dateInput) => {
    if (!dateInput) return '';
    if (typeof dateInput === 'string' && dateInput.includes('-') && !dateInput.includes('T')) {
        const parts = dateInput.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    try {
        const d = new Date(dateInput);
        if(isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch(e) { return ''; }
};

const formatWithDay = (dateStr) => {
    if (!dateStr || dateStr === '--') return '--';
    try {
        let parts = dateStr.split('/');
        let dateObj;
        if (parts.length === 3) {
            dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
        } else {
            parts = dateStr.split('-');
            if (parts.length === 3) dateObj = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00`);
            else return dateStr;
        }
        if (isNaN(dateObj.getTime())) return dateStr;
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return `${days[dateObj.getDay()]} ${dateStr}`;
    } catch(e) { return dateStr; }
};

const formatTurnosVisually = (turnosStr) => {
    if (!turnosStr || turnosStr === 'Ninguno') return 'Ninguno';
    return turnosStr.split('-').map(t => formatWithDay(t.trim())).join(' - ');
};

// 🚀 AHORA RECIBE 'transportistas' y 'sucursales' COMO PROPS DINÁMICAS DESDE APP.JSX
export default function AgendaAdmin({ sucursales = [], transportistas = [] }) {
    const [agendaData, setAgendaData] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [form, setForm] = useState({ horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
    const [tempDate, setTempDate] = useState('');
    const [tempPunto, setTempPunto] = useState('');

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "agenda_flota"), (snap) => {
            setAgendaData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const handleAddUser = (e) => {
        const val = e.target.value;
        if (val === 'TODOS') {
            setSelectedUsers(transportistas);
        } else if (val && !selectedUsers.includes(val)) {
            setSelectedUsers([...selectedUsers, val]);
        }
    };

    const removeUser = (user) => {
        setSelectedUsers(selectedUsers.filter(u => u !== user));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (selectedUsers.length === 0) return alert("Selecciona al menos un transportista para asignar.");
        
        try {
            const updateData = {};
            if (form.horario) updateData.horario = form.horario;
            if (form.zona) updateData.zona = form.zona;
            if (form.puntos) updateData.puntos = form.puntos;
            if (form.turnos) updateData.turnos = form.turnos;
            if (form.mantenimiento) updateData.mantenimiento = form.mantenimiento;

            if (Object.keys(updateData).length === 0) {
                return alert("No has llenado ningún campo para actualizar.");
            }

            await Promise.all(
                selectedUsers.map(id => setDoc(doc(db, "agenda_flota", id), updateData, { merge: true }))
            );

            alert(`¡Agenda actualizada para ${selectedUsers.length} transportista(s)!`);
            setForm({ horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
            setSelectedUsers([]);
        } catch (error) {
            console.error("Error saving agenda:", error);
            alert("Error al guardar en la base de datos.");
        }
    };

    const handleDelete = async (id) => {
        if(window.confirm(`¿Eliminar completamente la agenda de ${id}?`)) {
            await deleteDoc(doc(db, "agenda_flota", id));
        }
    };

    const handleEdit = (item) => {
        setSelectedUsers([item.id]);
        setForm({
            horario: item.horario || '',
            zona: item.zona || '',
            puntos: item.puntos || '',
            turnos: item.turnos || '',
            mantenimiento: item.mantenimiento || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

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
                <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2"><Calendar className="text-blue-500"/> Asignación y Actualización de Horarios</h3>
                
                <form onSubmit={handleSave} className="space-y-6">
                    
                    <div className="bg-[#0B1120] p-5 rounded-2xl border border-blue-900/50 shadow-inner">
                        <label className="text-[10px] font-bold text-blue-400 uppercase mb-2 flex items-center gap-1"><Users size={14}/> Transportistas a Actualizar</label>
                        <select onChange={handleAddUser} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold cursor-pointer mb-3" value="">
                            <option value="">-- SELECCIONAR PARA AGREGAR AL GRUPO --</option>
                            <option value="TODOS" className="font-black text-blue-400">AGREGAR A TODA LA FLOTA</option>
                            {/* LEE LOS TRANSPORTISTAS DESDE LA BASE DE DATOS EN VIVO */}
                            {transportistas.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>

                        <div className="flex flex-wrap gap-2">
                            {selectedUsers.length === 0 ? (
                                <p className="text-xs text-slate-600 italic">No has seleccionado a nadie.</p>
                            ) : (
                                selectedUsers.map(u => (
                                    <span key={u} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 shadow-md">
                                        {u} <X size={14} className="cursor-pointer hover:text-red-300" onClick={() => removeUser(u)}/>
                                    </span>
                                ))
                            )}
                            {selectedUsers.length > 1 && (
                                <button type="button" onClick={()=>setSelectedUsers([])} className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2">Limpiar Grupo</button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Horario Base</label>
                            <input value={form.horario} onChange={e=>setForm({...form, horario: e.target.value})} placeholder="Ej. 06:00 am - 03:00 pm (Dejar en blanco para no modificar)" className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Zona Asignada</label>
                            <input value={form.zona} onChange={e=>setForm({...form, zona: e.target.value})} placeholder="Ej. San Salvador Centro (Dejar en blanco para no modificar)" className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
                            <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2"><MapPin size={14} className="text-indigo-400"/> Puntos / Sucursales</h4>
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Catálogo Oficial</label>
                                    <select value={tempPunto} onChange={e => setTempPunto(e.target.value)} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold cursor-pointer">
                                        <option value="">-- ELEGIR SUCURSAL --</option>
                                        {/* LEE LAS SUCURSALES DESDE LA BASE DE DATOS EN VIVO */}
                                        {sucursales.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <button type="button" onClick={addPunto} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold flex items-center shadow-md transition-all h-[46px] mt-auto">
                                    <Plus size={18}/>
                                </button>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Ruta Armada</label>
                                    {form.puntos && <button type="button" onClick={clearPuntos} className="text-[9px] text-red-400 flex items-center gap-1 hover:text-red-300"><Eraser size={12}/> Limpiar</button>}
                                </div>
                                <textarea value={form.puntos} onChange={e=>setForm({...form, puntos: e.target.value})} placeholder="Agrega sucursales usando el selector de arriba..." className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold resize-none h-16"/>
                            </div>
                        </div>

                        <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
                            <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2"><Clock size={14} className="text-purple-400"/> Programación de Turnos</h4>
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Calendario</label>
                                    <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} style={{ colorScheme: 'dark' }} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold cursor-pointer"/>
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

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Próx. Mantenimiento</label>
                        <input type="date" value={form.mantenimiento} onChange={e=>setForm({...form, mantenimiento: e.target.value})} style={{ colorScheme: 'dark' }} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold cursor-pointer max-w-xs"/>
                    </div>

                    <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black uppercase shadow-lg flex items-center justify-center gap-2 transition-all">
                        <Save size={18} /> Actualizar Información para el Grupo ({selectedUsers.length})
                    </button>
                </form>
            </div>

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
                                <td className="px-4 py-3 truncate max-w-[150px]" title={item.turnos}>{formatTurnosVisually(item.turnos)}</td>
                                <td className="px-4 py-3 text-yellow-500">{formatWithDay(formatLocalDate(item.mantenimiento))}</td>
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
