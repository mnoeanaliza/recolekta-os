import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Edit3, Eraser, MapPin, Plus, Printer, Save, Trash2, Users, Wrench, X } from 'lucide-react';
import { deleteFleetAgendaEntry, saveFleetAgendaAssignments, subscribeFleetAgenda } from '../services/agendaService';
import { cn, formatLocalDate, formatTurnosVisually, formatWithDay, USUARIOS_EMAIL } from '../utils/constants';

function FleetAgenda({ sucursalesObj = {}, transportistasObj = {}, countryContext = "El Salvador", readOnly = false, perfilesUsuarios = {}, filtroZona = 'all' }) {
    const [agendaData, setAgendaData] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [form, setForm] = useState({ horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
    const [tempDate, setTempDate] = useState('');
    const [tempPunto, setTempPunto] = useState('');
    
    const [appendMode, setAppendMode] = useState(true);
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const sucursales = sucursalesObj[countryContext] || [];

    // 🔥 EL MOTOR DE FILTRADO DINÁMICO (A PRUEBA DE FALLOS)
    const transportistasFiltrados = useMemo(() => {
        const transportistasBase = transportistasObj[countryContext] || [];
        if (filtroZona === 'all') return transportistasBase;
        
        return transportistasBase.filter(nombre => {
            const email = Object.keys(perfilesUsuarios).find(key => perfilesUsuarios[key]?.nombre === nombre) || Object.keys(USUARIOS_EMAIL).find(key => USUARIOS_EMAIL[key] === nombre);
            const zonaTransportista = (email && perfilesUsuarios[email]) ? perfilesUsuarios[email].zona : 'Sin Asignar';
            if (['El Salvador', 'Guatemala', 'Honduras', 'Costa Rica'].includes(filtroZona)) return zonaTransportista.startsWith(filtroZona);
            return zonaTransportista === filtroZona;
        });
    }, [transportistasObj, countryContext, filtroZona, perfilesUsuarios]);
    
    // 🟢 CLON DE SEGURIDAD: Evita el colapso de "not defined" en el código viejo
    const transportistas = transportistasFiltrados;

    useEffect(() => {
        const unsub = subscribeFleetAgenda(setAgendaData);
        return () => unsub();
    }, []);

    const handleAddUser = (e) => {
        const val = e.target.value;
        if (val === 'TODOS') setSelectedUsers(transportistas);
        else if (val && !selectedUsers.includes(val)) setSelectedUsers([...selectedUsers, val]);
    };
    const removeUser = (user) => setSelectedUsers(selectedUsers.filter(u => u !== user));
    const handleSave = async (e) => {
        e.preventDefault();
        if (selectedUsers.length === 0) return alert("Selecciona al menos un transportista para asignar.");
        try {
            await saveFleetAgendaAssignments({ agendaData, selectedUsers, form, appendMode });
            alert(`¡Asignación guardada con éxito para ${selectedUsers.length} transportista(s)!`);
            setForm({ horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
            setSelectedUsers([]);
        } catch (error) { alert("Error al guardar en la base de datos."); }
    };
    const handleDelete = async (id) => { if(window.confirm(`¿Eliminar completamente la agenda de ${id}?`)) await deleteFleetAgendaEntry(id); };
    const handleEdit = (item) => { setSelectedUsers([item.id]); setForm({ horario: item.horario || '', zona: item.zona || '', puntos: item.puntos || '', turnos: item.turnos || '', mantenimiento: item.mantenimiento || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const addTurnoDate = () => {
        if (!tempDate) return;
        const [y, m, d] = tempDate.split('-');
        const formattedDate = `${d}/${m}/${y}`;
        let currentTurnos = form.turnos && form.turnos !== 'Ninguno' ? form.turnos.split(' - ').map(t => t.trim()).filter(t => t) : [];
        if (!currentTurnos.includes(formattedDate)) { currentTurnos.push(formattedDate); setForm({ ...form, turnos: currentTurnos.join(' - ') }); }
        setTempDate('');
    };
    const addPunto = () => {
        if (!tempPunto) return;
        let currentPuntos = form.puntos && form.puntos !== 'Ninguno' ? form.puntos.split(' / ').map(p => p.trim()).filter(p => p) : [];
        if (!currentPuntos.includes(tempPunto)) { currentPuntos.push(tempPunto); setForm({ ...form, puntos: currentPuntos.join(' / ') }); }
        setTempPunto('');
    };
    const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else { setCalMonth(calMonth - 1); } };
    const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else { setCalMonth(calMonth + 1); } };
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDay = new Date(calYear, calMonth, 1).getDay(); 
    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const normalizeDateStr = (str) => { const parts = str.split('/'); if (parts.length === 3) return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`; return str; };
    const getTurnosForDay = (day) => {
        const targetDate = `${String(day).padStart(2, '0')}/${String(calMonth + 1).padStart(2, '0')}/${calYear}`; 
        let scheduled = [];
        agendaData.forEach(user => { if (transportistasFiltrados.includes(user.id) && user.turnos && user.turnos !== 'Ninguno') { const dates = user.turnos.split('-').map(t => normalizeDateStr(t.trim())); if (dates.includes(targetDate)) scheduled.push(user.id.split(' ')[0]); } });
        return scheduled;
    };
    const getMaintForDay = (day) => {
        const targetDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; 
        let scheduled = [];
        agendaData.forEach(user => { if (transportistasFiltrados.includes(user.id) && user.mantenimiento === targetDate) scheduled.push(user.id.split(' ')[0]); });
        return scheduled;
    };
    const handlePrint = () => { window.print(); };
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* 1. OCULTAMOS EL FORMULARIO SI ES SOLO LECTURA (SUPERVISOR) */}
            {!readOnly && (
                <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-xl print-hide">
                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2"><Calendar className="text-blue-500"/> Asignación y Actualización de Horarios</h3>
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="bg-[#0B1120] p-5 rounded-2xl border border-blue-900/50 shadow-inner">
                            <label className="text-[10px] font-bold text-blue-400 uppercase mb-2 flex items-center gap-1"><Users size={14}/> Transportistas de {countryContext}</label>
                            <select onChange={handleAddUser} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold cursor-pointer mb-3" value="">
                                <option value="">-- SELECCIONAR PARA AGREGAR AL GRUPO --</option>
                                <option value="TODOS" className="font-black text-blue-400">AGREGAR A TODOS ({countryContext})</option>
                                {transportistasFiltrados.map(t => (<option key={t} value={t}>{t}</option>))}
                            </select>
                            <div className="flex flex-wrap gap-2">
                                {selectedUsers.length === 0 ? (<p className="text-xs text-slate-600 italic">No has seleccionado a nadie.</p>) : (selectedUsers.map(u => (<span key={u} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 shadow-md">{u} <X size={14} className="cursor-pointer hover:text-red-300" onClick={() => removeUser(u)}/></span>)))}
                                {selectedUsers.length > 1 && (<button type="button" onClick={()=>setSelectedUsers([])} className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2">Limpiar Grupo</button>)}
                            </div>
                        </div>
                        <div className="bg-blue-900/10 border border-blue-800/40 p-3 rounded-xl flex items-center gap-3"><input type="checkbox" checked={appendMode} onChange={e => setAppendMode(e.target.checked)} className="w-5 h-5 accent-blue-600 cursor-pointer" id="appendModeToggle" /><label htmlFor="appendModeToggle" className="text-[10px] font-bold text-blue-300 cursor-pointer uppercase">MODO ACUMULATIVO: Sumar los días a las asignaciones existentes</label></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-400 uppercase">Horario Base</label><input value={form.horario} onChange={e=>setForm({...form, horario: e.target.value})} placeholder="Ej. 06:00 am - 03:00 pm" className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Zona Asignada</label><input value={form.zona} onChange={e=>setForm({...form, zona: e.target.value})} placeholder="Ej. San Salvador Centro" className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div></div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
                                <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2"><MapPin size={14} className="text-indigo-400"/> Puntos / Sucursales ({countryContext})</h4>
                                <div className="flex items-end gap-2"><div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Catálogo Oficial</label><select value={tempPunto} onChange={e => setTempPunto(e.target.value)} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold cursor-pointer"><option value="">-- ELEGIR SUCURSAL --</option>{sucursales.map(s => <option key={s} value={s}>{s}</option>)}</select></div><button type="button" onClick={addPunto} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold flex items-center shadow-md transition-all h-[46px] mt-auto"><Plus size={18}/></button></div>
                                <div><div className="flex justify-between items-center mb-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Ruta Armada</label>{form.puntos && <button type="button" onClick={() => setForm({ ...form, puntos: '' })} className="text-[9px] text-red-400 flex items-center gap-1 hover:text-red-300"><Eraser size={12}/> Limpiar</button>}</div><textarea value={form.puntos} onChange={e=>setForm({...form, puntos: e.target.value})} placeholder="Escribe 'Ninguno' para borrar la ruta a todos..." className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold resize-none h-16"/></div>
                            </div>
                            <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
                                <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-2"><Clock size={14} className="text-purple-400"/> Programación de Turnos</h4>
                                <div className="flex items-end gap-2"><div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Calendario</label><input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} style={{ colorScheme: 'dark' }} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold cursor-pointer"/></div><button type="button" onClick={addTurnoDate} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold flex items-center shadow-md transition-all h-[46px] mt-auto"><Plus size={18}/></button></div>
                                <div><div className="flex justify-between items-center mb-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Fechas Asignadas</label>{form.turnos && <button type="button" onClick={() => setForm({ ...form, turnos: '' })} className="text-[9px] text-red-400 flex items-center gap-1 hover:text-red-300"><Eraser size={12}/> Limpiar</button>}</div><textarea value={form.turnos} onChange={e=>setForm({...form, turnos: e.target.value})} placeholder="Escribe 'Ninguno' para borrar los turnos a todos..." className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold resize-none h-16"/></div>
                            </div>
                        </div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Próx. Mantenimiento</label><input type="date" value={form.mantenimiento} onChange={e=>setForm({...form, mantenimiento: e.target.value})} style={{ colorScheme: 'dark' }} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold cursor-pointer max-w-xs"/></div>
                        <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black uppercase shadow-lg flex items-center justify-center gap-2 transition-all"><Save size={18} /> Actualizar Información para el Grupo ({selectedUsers.length})</button>
                    </form>
                </div>
            )}
            {/* 2. 🔥 OCULTAMOS EL CALENDARIO VISUAL SI ES SOLO LECTURA (SUPERVISOR) 🔥 */}
            {!readOnly && (
                <div id="printable-calendar" className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl overflow-hidden mt-6 mb-6 print-bg-white print-border-gray print-text-black">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h3 className="text-xl font-black text-white flex items-center gap-2 print-text-black"><Calendar className="text-purple-500 print-hide"/> Calendario de Flota ({countryContext})</h3>
                            <p className="text-xs text-slate-400 mt-1 print-text-black">Turnos Extras (Morado) y Mantenimientos (Amarillo)</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handlePrint} className="print-hide bg-white text-black px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-slate-200 transition-all flex items-center gap-2 shadow-md"><Printer size={14}/> Imprimir</button>
                            <div className="flex items-center gap-2 bg-[#0B1120] p-1.5 rounded-xl border border-slate-700 print-hide"><button type="button" onClick={prevMonth} className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors"><ChevronLeft size={18}/></button><span className="font-black text-white uppercase w-32 text-center text-sm">{monthNames[calMonth]} {calYear}</span><button type="button" onClick={nextMonth} className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors"><ChevronRight size={18}/></button></div>
                            <div className="hidden print:block text-2xl font-black uppercase tracking-widest">{monthNames[calMonth]} {calYear}</div>
                        </div>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar pb-2">
                        <div className="min-w-[700px] w-full">
                            <div className="grid grid-cols-7 gap-1 mb-2">{['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(d => (<div key={d} className="text-center font-black text-[10px] text-slate-500 uppercase py-2 bg-[#0B1120] rounded-t-lg border-b border-slate-700 print-bg-gray print-text-black print-border-gray">{d}</div>))}</div>
                            <div className="grid grid-cols-7 gap-1">
                                {blanks.map(b => <div key={`blank-${b}`} className="min-h-[100px] bg-[#0B1120]/30 rounded-xl border border-slate-800/30 print-bg-gray print-border-gray"></div>)}
                                {calendarDays.map(d => {
                                    const turnosForDay = getTurnosForDay(d); const maintForDay = getMaintForDay(d); const isToday = new Date().getDate() === d && new Date().getMonth() === calMonth && new Date().getFullYear() === calYear;
                                    return (
                                        <div key={d} className={cn("min-h-[100px] p-2 rounded-xl border flex flex-col gap-1 transition-colors hover:border-slate-600 print-bg-white print-border-gray", isToday ? "bg-blue-900/10 border-blue-500/50" : "bg-[#0B1120] border-slate-800")}>
                                            <span className={cn("text-[10px] font-black self-end px-1.5 rounded-sm", isToday ? "bg-blue-500 text-white" : "text-slate-500 print-text-black")}>{d}</span>
                                            <div className="flex flex-col gap-1 overflow-y-auto max-h-[80px] custom-scrollbar print:max-h-none print:overflow-visible">
                                                {turnosForDay.map((name, i) => (<span key={`t-${i}`} className="text-[9px] font-bold bg-purple-900/40 border border-purple-800/50 text-purple-300 px-1.5 py-0.5 rounded truncate print-badge-purple" title={`Turno: ${name}`}>{name}</span>))}
                                                {maintForDay.map((name, i) => (<span key={`m-${i}`} className="text-[9px] font-bold bg-yellow-900/40 border border-yellow-800/50 text-yellow-500 px-1.5 py-0.5 rounded truncate flex items-center gap-1 print-badge-yellow" title={`Mantenimiento: ${name}`}><Wrench size={8}/> {name}</span>))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* TABLA GLOBAL DE HORARIOS (ESTO SÍ LO VERÁ EL SUPERVISOR) */}
            <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl overflow-x-auto print-hide">
                <h3 className="font-bold text-white mb-4">HORARIO GLOBAL DE FLOTA ({countryContext})</h3>
                <table className="w-full text-left">
                    <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg">
                        <tr>
                            <th className="px-4 py-3 rounded-l-lg">Transportista</th>
                            <th className="px-4 py-3">Horario Base</th>
                            <th className="px-4 py-3">Zona / Ruta</th>
                            <th className="px-4 py-3 max-w-[200px]">Ruta Asignada</th>
                            <th className="px-4 py-3 max-w-[150px]">Turnos</th>
                            <th className="px-4 py-3">Mantenimiento</th>
                            {/* 3. OCULTAMOS COLUMNA DE ACCIONES SI ES SUPERVISOR */}
                            {!readOnly && <th className="px-4 py-3 text-center rounded-r-lg">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                       {agendaData.filter(item => transportistasFiltrados.includes(item.id)).map((item) => (
                            <tr key={item.id} className="hover:bg-slate-800/50">
                                <td className="px-4 py-3 text-white">{item.id}</td>
                                <td className="px-4 py-3 text-blue-400">{item.horario || '--'}</td>
                                <td className="px-4 py-3">{item.zona || '--'}</td>
                                <td className="px-4 py-3 truncate max-w-[200px]" title={item.puntos}>{item.puntos || '--'}</td>
                                <td className="px-4 py-3 truncate max-w-[150px]" title={item.turnos}>{formatTurnosVisually(item.turnos)}</td>
                                <td className="px-4 py-3 text-yellow-500">{formatWithDay(formatLocalDate(item.mantenimiento))}</td>
                                {/* 4. OCULTAMOS BOTONES SI ES SUPERVISOR */}
                                {!readOnly && (
                                    <td className="px-4 py-3 flex justify-center gap-2">
                                        <button onClick={() => handleEdit(item)} className="bg-slate-800 p-2 rounded-lg text-blue-400 hover:text-white transition-all"><Edit3 size={14}/></button>
                                        <button onClick={() => handleDelete(item.id)} className="bg-slate-800 p-2 rounded-lg text-red-500 hover:text-white transition-all"><Trash2 size={14}/></button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// =========================================================================
// 🚀 APP PRINCIPAL 🚀
// =========================================================================

export default FleetAgenda;
