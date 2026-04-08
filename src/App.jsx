import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
// --- 1. IMPORTACIONES ---
import { useAuth } from './context/AuthContext';
import LoginModule from './components/LoginModule';
import { db, storage } from './config/firebase'; 
import FuelModule from './components/FuelModule'; 
import ScheduleModule from './components/ScheduleModule';
import MaintenanceModule from './components/MaintenanceModule';
import OvertimeModule from './components/OvertimeModule';

import { collection, addDoc, query, onSnapshot, orderBy, limit, getDocs, doc, deleteDoc, updateDoc, where, arrayUnion, setDoc } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- ICONOS ---
import { 
  Bike, ClipboardList, TrendingUp, Clock, CheckCircle2, Database, Download, Camera, 
  ExternalLink, MessageSquare, BarChart3, FileSpreadsheet, User, Fuel, DollarSign, 
  Calendar, Wrench, Briefcase, Eye, Search, Filter, MapPin, Layers, ShieldCheck, 
  Loader2, Image as ImageIcon, Eraser, Edit, Trash2, X, Edit3, Save, RefreshCw, PieChart as PieChartIcon,
  Bell, Send, XCircle, Check, Settings, Smartphone, ListChecks, Plus, ChevronLeft, ChevronRight, Users, Printer,
  Award, Star, Target, UploadCloud, ChevronDown, Globe, Trophy, Map
} from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import Papa from 'papaparse';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const GITHUB_CSV_URL = "https://raw.githubusercontent.com/mnoeanaliza/recolekta-os/refs/heads/main/Datos.csv";
// Carga diferida del Mapa
const RutaOptimizada = lazy(() => import('./components/RutaOptimizada.jsx'));

// MAPEO DE CORREOS
export const USUARIOS_EMAIL = {
  "brayan@recolekta.com": "BRAYAN REYES", "edwin@recolekta.com": "EDWIN FLORES", "teodoro@recolekta.com": "TEODORO PÉREZ",
  "giovanni@recolekta.com": "GIOVANNI CALLEJAS", "jairo@recolekta.com": "JAIRO GIL", "jason@recolekta.com": "JASON BARRERA",
  "antonio@recolekta.com": "ANTONIO RIVAS", "walter@recolekta.com": "WALTER RIVAS", "rogelio@recolekta.com": "ROGELIO MAZARIEGO",
  "david@recolekta.com": "DAVID ALVARADO", "carlos@recolekta.com": "CARLOS SOSA", "felix@recolekta.com": "FELIX VASQUEZ",
  "flor@recolekta.com": "FLOR CARDOZA", "hildebrando@recolekta.com": "HILDEBRANDO MENJIVAR", "test@admin.com": "USUARIO PRUEBA",
  "chofer@recolekta.com": "TRANSPORTISTA PRUEBA", "admin@recolekta.com": "ADMINISTRADOR", "supervision@recolekta.com": "SUPERVISOR",
  "supervisor@recolekta.com": "SUPERVISOR", "nuevo_admin@recolekta.com": "NUEVO ADMIN", "ing.admin@recolekta.com": "INGENIERÍA ADMIN"
};

// 🌍 CATÁLOGOS BASE INTERNACIONALES (Diccionarios por País) 🌍
const DEFAULT_CATALOGS = {
  paises: ["El Salvador", "Guatemala", "Honduras", "Costa Rica"],
  zonas: {
      "El Salvador": ["El Salvador - Metropolitana Centro", "El Salvador - Oriente", "El Salvador - Occidente"],
      "Guatemala": ["Guatemala - Capital"],
      "Honduras": ["Honduras - Tegucigalpa"],
      "Costa Rica": ["Costa Rica - San José"]
  },
  transportistas: { "El Salvador": [ "BRAYAN REYES", "EDWIN FLORES", "TEODORO PÉREZ", "GIOVANNI CALLEJAS", "JAIRO GIL", "JASON BARRERA", "ANTONIO RIVAS", "WALTER RIVAS", "ROGELIO MAZARIEGO", "DAVID ALVARADO", "CARLOS SOSA", "FELIX VASQUEZ", "FLOR CARDOZA", "HILDEBRANDO MENJIVAR", "USUARIO PRUEBA", "TRANSPORTISTA PRUEBA" ] },
  sucursales: { "El Salvador": [ "Constitución", "Soyapango", "San Miguel", "Lourdes", "Valle Dulce", "Venecia", "San Miguel 2", "Sonsonate 1", "Puerto", "San Martín", "San Miguel 3", "Sonsonate 2", "San Gabriel", "Casco", "La Unión", "Sonsonate 3", "Cojutepeque", "Zacatecoluca", "Santa Ana 1", "Merliot 1", "Santa Ana 2", "Merliot 2", "Ramblas", "Escalón 1", "Metapán", "Escalón 2", "Marsella", "Medica 1", "Opico", "Medica 2", "Medica 3", "Medica 4", "Santa Tecla", "Plaza Soma", "Plaza Sur", "Santa Elena", "Chalatenango", "Aguilares" ] },
  areas: { "El Salvador": ["LABORATORIO / PROCESAMIENTO", "TUVET", "Imágenes Escalón", "Centro de Distribución", "LAB. Externo", "Contabilidad", "RRHH", "Contac Center", "Empresas", "Fisioterapia", "Cuentas por cobrar", "Mercadeo", "Fidelizacion", "IT", "LOGÍSTICA / RUTA"] },
  diligencias: { "El Salvador": ["Recolección de muestras", "Entrega de Muestras", "Traslado de toallas", "Traslado de reactivo", "Traslado de insumos", "Traslado de cortes", "Traslado de documentos", "Pago de aseguradora", "Pago o tramite bancario", "Tramite o diligencia extraordinaria", "INCIDENCIA EN RUTA"] }
};

const PRINCIPAL_KEYWORDS = ["muestras", "entrega", "recepción", "recolección", "recoleccion"];
const isPrincipalData = (d) => { if (d.categoria === "Principal") return true; const txt = (d.tipo || d.originalTipo || '').toLowerCase(); return PRINCIPAL_KEYWORDS.some(k => txt.includes(k)); };

// --- 🛡️ ESCUDO Y FORMATEADORES DE FECHA ---
const getStrictDateString = (dateInput) => {
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

const formatLocalDate = (dateStr) => getStrictDateString(dateStr);

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

function SmallGauge({ value, size = 60 }) {
    const ef = parseFloat(value) || 0;
    const color = ef >= 95 ? '#10b981' : ef >= 80 ? '#f59e0b' : '#ef4444'; 

    return (
        <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size * 0.7 }}>
            <div className="absolute inset-0 flex justify-center mt-1">
                <PieChart width={size} height={size}>
                    <Pie
                        data={[ { value: ef, fill: color }, { value: 100 - ef, fill: '#1f2937' } ]}
                        cx={size / 2} cy={size / 2} startAngle={180} endAngle={0} innerRadius={size * 0.35} outerRadius={size * 0.48} dataKey="value" stroke="none"
                    />
                </PieChart>
            </div>
            <div className="text-center z-10 -mt-1">
                <span className="text-xl font-black text-white" style={{ fontSize: size * 0.28 }}>
                    {ef.toFixed(0)}%
                </span>
            </div>
        </div>
    );
}

// =========================================================================
// 🧩 COMPONENTE DE AGENDA
// =========================================================================
function AgendaAdmin({ sucursalesObj = {}, transportistasObj = {}, countryContext = "El Salvador", readOnly = false }) {
    const [agendaData, setAgendaData] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [form, setForm] = useState({ horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
    const [tempDate, setTempDate] = useState('');
    const [tempPunto, setTempPunto] = useState('');
    
    const [appendMode, setAppendMode] = useState(true);
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const transportistas = transportistasObj[countryContext] || [];
    const sucursales = sucursalesObj[countryContext] || [];

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "agenda_flota"), (snap) => {
            setAgendaData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
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
            await Promise.all(
                selectedUsers.map(async (id) => {
                    const currentUserData = agendaData.find(u => u.id === id) || {};
                    const updateData = {};
                    if (form.horario) updateData.horario = form.horario;
                    if (form.zona) updateData.zona = form.zona;
                    if (form.mantenimiento) updateData.mantenimiento = form.mantenimiento;

                    if (form.puntos) {
                        if (form.puntos.toUpperCase() === 'NINGUNO') updateData.puntos = '';
                        else if (appendMode && currentUserData.puntos && currentUserData.puntos !== 'Ninguno') {
                            const existing = currentUserData.puntos.split('/').map(s=>s.trim()).filter(Boolean);
                            const incoming = form.puntos.split('/').map(s=>s.trim()).filter(Boolean);
                            updateData.puntos = [...new Set([...existing, ...incoming])].join(' / ');
                        } else updateData.puntos = form.puntos;
                    }

                    if (form.turnos) {
                        if (form.turnos.toUpperCase() === 'NINGUNO') updateData.turnos = 'Ninguno';
                        else if (appendMode && currentUserData.turnos && currentUserData.turnos !== 'Ninguno') {
                            const existing = currentUserData.turnos.split('-').map(s=>s.trim()).filter(Boolean);
                            const incoming = form.turnos.split('-').map(s=>s.trim()).filter(Boolean);
                            const merged = [...new Set([...existing, ...incoming])].sort((a,b) => {
                                const [da, ma, ya] = a.split('/');
                                const [db, mb, yb] = b.split('/');
                                return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
                            });
                            updateData.turnos = merged.join(' - ');
                        } else updateData.turnos = form.turnos;
                    }
                    if (Object.keys(updateData).length > 0) await setDoc(doc(db, "agenda_flota", id), updateData, { merge: true });
                })
            );
            alert(`¡Asignación guardada con éxito para ${selectedUsers.length} transportista(s)!`);
            setForm({ horario: '', zona: '', puntos: '', turnos: '', mantenimiento: '' });
            setSelectedUsers([]);
        } catch (error) { alert("Error al guardar en la base de datos."); }
    };

    const handleDelete = async (id) => { if(window.confirm(`¿Eliminar completamente la agenda de ${id}?`)) await deleteDoc(doc(db, "agenda_flota", id)); };
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
        agendaData.forEach(user => { if (transportistas.includes(user.id) && user.turnos && user.turnos !== 'Ninguno') { const dates = user.turnos.split('-').map(t => normalizeDateStr(t.trim())); if (dates.includes(targetDate)) scheduled.push(user.id.split(' ')[0]); } });
        return scheduled;
    };

    const getMaintForDay = (day) => {
        const targetDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; 
        let scheduled = [];
        agendaData.forEach(user => { if (transportistas.includes(user.id) && user.mantenimiento === targetDate) scheduled.push(user.id.split(' ')[0]); });
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
                                {transportistas.map(t => <option key={t} value={t}>{t}</option>)}
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
                        {agendaData.filter(item => transportistas.includes(item.id)).map((item) => (
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
export default function App() {
  const { currentUser } = useAuth();
  if (!currentUser) return <LoginModule />;
  
  return (
    <>
      <style>{`
        @media print {
            @page { size: landscape; margin: 10mm; } body * { visibility: hidden; } #printable-calendar, #printable-calendar * { visibility: visible; } #printable-calendar { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; margin: 0; padding: 20px; background: white !important; color: black !important; } .print-hide { display: none !important; } .print-text-black { color: black !important; } .print-border-gray { border-color: #cbd5e1 !important; border-width: 1px !important; border-style: solid !important; } .print-bg-gray { background-color: #f1f5f9 !important; } .print-bg-white { background-color: #ffffff !important; } .print-badge-purple { background-color: #f3e8ff !important; color: #6b21a8 !important; border: 1px solid #d8b4fe !important; } .print-badge-yellow { background-color: #fef9c3 !important; color: #a16207 !important; border: 1px solid #fde047 !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
      <Dashboard />
    </>
  );
}

function Dashboard() {
  const { currentUser, logout } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [appMode, setAppMode] = useState('user'); 
  const [userView, setUserView] = useState('ruta'); 
  const [adminSection, setAdminSection] = useState('ops'); 
  const [supervisorSection, setSupervisorSection] = useState('bitacora'); 
  const [dataSource, setDataSource] = useState('live'); 
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [liveData, setLiveData] = useState([]);
  const [resumenesMensualesNube, setResumenesMensualesNube] = useState({});
  // 🔥 CONTROL DE PAGINACIÓN REAL
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // 🔥 BOTÓN MÁGICO: FUERZA A LA NUBE A RECALCULAR TODO EL MES HISTÓRICO
const handleSyncToCloud = async () => {
      if(!window.confirm("🚀 ¿Forzar actualización de velocímetros? La PC subirá los cálculos exactos a la base de datos.")) return;
      
      try {
          let count = 0;
          // 1. Obtenemos a todos los transportistas de tu catálogo
          const transportistas = Object.values(catalogs.transportistas || {}).flat();

          // 2. Calculamos los datos de los 5,443 viajes que ya tienes en pantalla
          for (const nombre of transportistas) {
              const email = Object.keys(USUARIOS_EMAIL).find(key => USUARIOS_EMAIL[key] === nombre);
              if (!email) continue;

              const profile = perfilesUsuarios[email] || {};
              const miMeta = getMetaEspera(profile.zona);

              // Filtramos los viajes específicos de este transportista
              const userDocs = liveData.filter(d => d.recolector === nombre);

              let vitalesTotal = 0;
              let vitalesA_Tiempo = 0;
              let secundariasTotal = 0;

              userDocs.forEach(viaje => {
                  if (isPrincipalData(viaje)) {
                      vitalesTotal++;
                      if ((viaje.tiempo || 0) <= miMeta) vitalesA_Tiempo++;
                  } else {
                      secundariasTotal++;
                  }
              });

              let eficiencia = 100;
              if (vitalesTotal > 0) eficiencia = parseFloat(((vitalesA_Tiempo / vitalesTotal) * 100).toFixed(1));

              // 3. Subimos la respuesta correcta directamente al perfil del usuario
              await setDoc(doc(db, "usuarios_perfiles", email), {
                  eficienciaNube: eficiencia,
                  vitalesNube: vitalesTotal,
                  secundariasNube: secundariasTotal,
                  ultimaAuditoria: new Date().toISOString()
              }, { merge: true });

              count++;
          }
          
          alert(`¡Sincronización Perfecta! ✅ Se actualizaron los velocímetros de ${count} transportistas al instante.`);
      } catch(e) { 
          console.error(e);
          alert("Error al sincronizar. Revisa la consola."); 
      }
  };
  const [queryLimit, setQueryLimit] = useState(50); // 🔥 Control de Paginación Serverless
  const [fuelData, setFuelData] = useState([]); 
  const [maintData, setMaintData] = useState([]); 
  const [otData, setOtData] = useState([]); 
  const [csvData, setCsvData] = useState([]); 
  const [agendaData, setAgendaData] = useState([]); 
  const [alertasData, setAlertasData] = useState([]);
  const [userProfile, setUserProfile] = useState({ foto: null, categoria: 'Operador', zona: 'Sin Asignar' });
  const [perfilesUsuarios, setPerfilesUsuarios] = useState({}); 
  const [selectedAdminProfile, setSelectedAdminProfile] = useState(null);
  const [catalogs, setCatalogs] = useState(DEFAULT_CATALOGS);
  const [catalogCountry, setCatalogCountry] = useState("El Salvador");
  const [newCatalogItems, setNewCatalogItems] = useState({ transportistas: '', sucursales: '', areas: '', diligencias: '', zonas: '' });
  const [sysConfig, setSysConfig] = useState({ heInicio: '', heFin: '', flotaInicio: '', flotaFin: '' });

  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterSpecificDate, setFilterSpecificDate] = useState(''); 
  const [filterSucursal, setFilterSucursal] = useState('all'); 
  const [filterZona, setFilterZona] = useState('all'); 
  const [filterUserTableZone, setFilterUserTableZone] = useState('all'); 

  const availableYears = useMemo(() => { const current = new Date().getFullYear(); const years = []; for(let y = 2025; y <= current + 1; y++) { years.push(y.toString()); } return years; }, []);

  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [editingItem, setEditingItem] = useState(null); 
  const [editFormData, setEditFormData] = useState({}); 
  const [showAvisoModal, setShowAvisoModal] = useState(false);
  const [avisoForm, setAvisoForm] = useState({ mensaje: '', para: 'Todos', tipo: 'info' }); 
  const [hiddenAlerts, setHiddenAlerts] = useState([]); 
  const [imagePreview, setImagePreview] = useState(null); 
  const [imageFile, setImageFile] = useState(null); 
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const [form, setForm] = useState({ recolector: '', sucursal: '', area: '', tipo: '', hLlegada: '08', mLlegada: '00', pLlegada: 'AM', hSalida: '08', mSalida: '05', pSalida: 'AM', observaciones: '' });
  const [activeInput, setActiveInput] = useState(null);

  // --- MOTORES FASE 3: GPS Y CRONÓMETRO ---
  const [isOperating, setIsOperating] = useState(false);
  const [operationStartTime, setOperationStartTime] = useState(null);
  const [liveWaitMins, setLiveWaitMins] = useState(0);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [transitTimeMins, setTransitTimeMins] = useState(0); 
  const [previousGps, setPreviousGps] = useState(null);
  const [mapaModalData, setMapaModalData] = useState(null);

  const abrirMapaDeRuta = () => {
      if (filterUser === 'all' || !filterSpecificDate) {
          return alert("⚠️ Selecciona un Transportista específico y un Día Exacto en los filtros superiores para ver su ruta trazada.");
      }
      
      const targetDate = getStrictDateString(filterSpecificDate);
      const userTrips = liveData.filter(d => d.recolector === filterUser && getStrictDateString(d.createdAt) === targetDate && d.ubicacion && d.ubicacion !== 'Sin GPS');
      
      if (userTrips.length === 0) return alert("El transportista no registró coordenadas GPS ese día.");

      userTrips.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const points = userTrips.map(t => {
          const [lat, lng] = t.ubicacion.split(',').map(Number);
          return { lat, lng, name: t.sucursal, time: `${t.hLlegada}:${t.mLlegada} ${t.pLlegada}` };
      });

      setMapaModalData({ transportista: filterUser, fecha: targetDate, points });
  };

  useEffect(() => {
      let interval;
      if (isOperating && operationStartTime) {
          interval = setInterval(() => {
              const now = new Date();
              const diffMs = now - operationStartTime;
              setLiveWaitMins(Math.floor(diffMs / 60000));
          }, 1000); 
      }
      return () => clearInterval(interval);
  }, [isOperating, operationStartTime]);

  const handleStartOperation = () => {
      if (!form.sucursal) return alert("⚠️ Selecciona primero la Sucursal a la que llegaste.");
      
      // 🟢 CANDADO 1: Verificar que la sucursal escrita exista en el catálogo del país
      const sucursalesValidas = catalogs.sucursales[activeUserCountry] || [];
      if (!sucursalesValidas.includes(form.sucursal)) {
          return alert("⚠️ SUCURSAL INVÁLIDA: Por favor, selecciona una sucursal oficial de la lista desplegable. No se permite texto libre.");
      }

      if (!form.tipo || !form.area) return alert("⚠️ Selecciona la Diligencia y Área.");
      
      setIsGettingGps(true);
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
              (position) => {
                  const lat = position.coords.latitude;
                  const lng = position.coords.longitude;
                  setGpsLocation(`${lat},${lng}`);
                  
                  const now = new Date();
                  setOperationStartTime(now);
                  setIsOperating(true);
                  setIsGettingGps(false);

                  // 🔥 AUTO-ESTATUS: Si inicia operación, lo pasamos a "En Ruta" automáticamente
                  if (currentUser?.email) {
                      setDoc(doc(db, "usuarios_perfiles", currentUser.email), { estatus: 'En Ruta' }, { merge: true }).catch(e=>{});
                  }

                  // 🏍️ LÓGICA DE CHECKPOINT Y FILTRO DE ALMUERZO
                  const todayStr = getStrictDateString(now);
                  const userTripsToday = liveData.filter(d => d.recolector === form.recolector && getStrictDateString(d.createdAt) === todayStr);
                  userTripsToday.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); 
                  
                  if (userTripsToday.length > 0) {
                      const lastTrip = userTripsToday[0];
                      const lastTripTime = new Date(lastTrip.createdAt);
                      const diffMins = Math.floor((now.getTime() - lastTripTime.getTime()) / 60000);
                      
                      if (diffMins > 60) {
                          setTransitTimeMins(0);
                          setPreviousGps(null);
                      } else {
                          setTransitTimeMins(diffMins);
                          setPreviousGps(lastTrip.ubicacion);
                      }
                  } else {
                      setTransitTimeMins(0);
                      setPreviousGps(null);
                  }

                  let h = now.getHours(); let m = String(now.getMinutes()).padStart(2, '0'); let p = h >= 12 ? 'PM' : 'AM';
                  h = h % 12; h = h ? h : 12; h = String(h).padStart(2, '0');
                  setForm(prev => ({ ...prev, hLlegada: h, mLlegada: m, pLlegada: p }));
              },
              (error) => {
                  setIsGettingGps(false);
                  alert("❌ Error obteniendo GPS. Debes darle permisos de ubicación al navegador para trabajar.");
              },
              { enableHighAccuracy: true, timeout: 10000 }
          );
      } else {
          setIsGettingGps(false);
          alert("Tu dispositivo no soporta GPS.");
      }
  };

  const transportistaOtData = useMemo(() => {
      if (!otData) return [];
      return otData.filter(d => { if (!sysConfig?.heInicio || !sysConfig?.heFin) return true; return d.fecha >= sysConfig.heInicio && d.fecha <= sysConfig.heFin; });
  }, [otData, sysConfig]);

  useEffect(() => {
    if (!currentUser) return;
    if (!currentUser.email) { if (typeof logout === 'function') logout(); return; }
    const email = currentUser.email.toLowerCase().trim();
    const adminEmails = ['admin@recolekta.com', 'nuevo_admin@recolekta.com', 'gerencia@recolekta.com', 'ing.admin@recolekta.com'];
    
    if (adminEmails.includes(email)) setAppMode('admin'); 
    else if (email === 'supervision@recolekta.com' || email === 'supervisor@recolekta.com') setAppMode('supervisor'); 
    else { setAppMode('user'); const nombreReal = USUARIOS_EMAIL[currentUser.email]; if (nombreReal) setForm(prev => ({ ...prev, recolector: nombreReal })); }

    const savedHiddenAlerts = localStorage.getItem(`recolekta_hidden_alerts_${email}`);
    if (savedHiddenAlerts) { try { setHiddenAlerts(JSON.parse(savedHiddenAlerts)); } catch (e) {} }

    const unsubProfile = onSnapshot(doc(db, "usuarios_perfiles", email), (docSnap) => { if (docSnap.exists()) setUserProfile(prev => ({ ...prev, ...docSnap.data() })); });
    return () => unsubProfile();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && !currentUser.email) return;
    if (!localStorage.getItem('recolekta_tutorial_v98')) setShowWelcome(true);

    Papa.parse(GITHUB_CSV_URL, { download: true, header: true, complete: (res) => {
            const mapped = (res.data || []).map(row => {
                const tipoRaw = String(row['Diligencia realizada:']||''); const isP = PRINCIPAL_KEYWORDS.some(k => tipoRaw.toLowerCase().includes(k)); let tiempoClean = 0; const matches = String(row['Minutos de espera'] || '0').match(/\d+/); if (matches) tiempoClean = parseInt(matches[0]);
                return { recolector: String(row['Nombre de Transportista']||'').toUpperCase().trim(), tiempo: tiempoClean, sucursal: row['Sucursal '] || 'Ruta Externa', tipo: tipoRaw, categoria: isP ? "Principal" : "Secundaria", originalTipo: tipoRaw, fotoData: row['Fotografía de bitácora:'] || null, observaciones: row['Observaciones'] || '', month: parseInt(String(row['Marca temporal']||'').split(/[\s\/]+/)[1])||1, createdAt: row['Marca temporal'], hLlegada: '--', mLlegada: '--', pLlegada: '', hSalida: '--', mSalida: '--', pSalida: '' };
            }).filter(r => r.recolector !== ''); setCsvData(mapped); }
    });

    let unsubOps, unsubFuel, unsubMaint, unsubOt, unsubAlertas, unsubAgenda, unsubConfig, unsubCatalogs, unsubAllProfiles, unsubSummaries;
    unsubConfig = onSnapshot(doc(db, "configuraciones", "general"), (snap) => { if(snap.exists()) setSysConfig(snap.data()); });

    unsubCatalogs = onSnapshot(doc(db, "configuraciones", "catalogos"), (snap) => {
        const data = snap.exists() ? snap.data() : {};
        const migrate = (field, defaultObj) => { if (!data[field]) return defaultObj; if (Array.isArray(data[field])) return { "El Salvador": data[field] }; return data[field]; };
        setCatalogs({
            paises: data.paises || DEFAULT_CATALOGS.paises, zonas: data.zonas || DEFAULT_CATALOGS.zonas,
            transportistas: migrate('transportistas', DEFAULT_CATALOGS.transportistas), sucursales: migrate('sucursales', DEFAULT_CATALOGS.sucursales),
            areas: migrate('areas', DEFAULT_CATALOGS.areas), diligencias: migrate('diligencias', DEFAULT_CATALOGS.diligencias)
        });
    });

    unsubAgenda = onSnapshot(collection(db, "agenda_flota"), (snap) => setAgendaData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    // 🌨️ ESCUCHA LOS RESÚMENES DE LA NUBE PARA LA GRÁFICA ANUAL GLOBAL
    unsubSummaries = onSnapshot(collection(db, "resumenes_operativos"), (snap) => {
        let res = {}; snap.forEach(doc => { res[doc.id] = doc.data(); });
        setResumenesMensualesNube(res);
    });

    if (appMode === 'admin' || appMode === 'supervisor') {
        unsubAllProfiles = onSnapshot(collection(db, "usuarios_perfiles"), (snap) => { const profilesMap = {}; snap.docs.forEach(doc => { profilesMap[doc.id] = doc.data(); }); setPerfilesUsuarios(profilesMap); });

 const currentMonthNum = new Date().getMonth() + 1;
        const currentYearStr = new Date().getFullYear().toString();
        
        const isHistorical = filterYear !== currentYearStr || (filterMonth !== 'all' && parseInt(filterMonth) !== currentMonthNum);

        if (!isHistorical) {
            // MODO EN VIVO (Mes actual)
            const today = new Date(); 
            const startOfMonthISO = new Date(today.getFullYear(), today.getMonth(), 1).toISOString(); 
            const startOfMonthStr = startOfMonthISO.substring(0, 10);
            
            // 🟢 CINTURÓN ADMIN 1: Límite de seguridad para que nunca descargue miles de golpe
            unsubOps = onSnapshot(query(collection(db, "registros_produccion"), where("createdAt", ">=", startOfMonthISO), orderBy("createdAt", "desc"), limit(800)), (snap) => setLiveData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            unsubFuel = onSnapshot(query(collection(db, "registros_combustible"), where("fecha", ">=", startOfMonthStr)), (snap) => setFuelData(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.fecha.localeCompare(a.fecha))));
            unsubMaint = onSnapshot(query(collection(db, "registros_mantenimiento"), where("fecha", ">=", startOfMonthStr)), (snap) => setMaintData(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.fecha.localeCompare(a.fecha))));
            unsubAlertas = onSnapshot(query(collection(db, "alertas_flota"), orderBy("createdAt", "desc"), limit(20)), (snap) => setAlertasData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            const inicioCorteAdmin = sysConfig?.heInicio ? sysConfig.heInicio : startOfMonthStr;
            unsubOt = onSnapshot(query(collection(db, "registros_horas_extras"), where("fecha", ">=", inicioCorteAdmin)), (snap) => setOtData(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.fecha.localeCompare(a.fecha))));
        } else {
            // MODO HISTÓRICO AUTOMÁTICO (Tu jefe seleccionó un mes pasado o el Año)
            const fetchHistory = async () => {
                setIsFetchingHistory(true);
                try {
                    if (filterMonth === 'all') { 
                        // 🟢 CINTURÓN ADMIN 2: Si es "AÑO", vaciamos la memoria local.
                        // La gráfica de BI usará automáticamente los resúmenes gratuitos de la nube.
                        setLiveData([]);
                        setFuelData([]);
                        setMaintData([]);
                        setOtData([]);
                    } else { 
                        const m = String(filterMonth).padStart(2, '0'); 
                        const sStr = `${filterYear}-${m}-01`; 
                        const nextM = filterMonth == 12 ? 1 : parseInt(filterMonth) + 1; 
                        const nextY = filterMonth == 12 ? parseInt(filterYear) + 1 : filterYear; 
                        const eStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`; 
                        
                        const snapOps = await getDocs(query(collection(db, "registros_produccion"), where("createdAt", ">=", sStr), where("createdAt", "<", eStr))); setLiveData(snapOps.docs.map(d => ({ id: d.id, ...d.data() })));
                        const sStrShort = sStr.substring(0, 10); const eStrShort = eStr.substring(0, 10);
                        const snapFuel = await getDocs(query(collection(db, "registros_combustible"), where("fecha", ">=", sStrShort), where("fecha", "<", eStrShort))); setFuelData(snapFuel.docs.map(d => ({ id: d.id, ...d.data() })));
                        const snapMaint = await getDocs(query(collection(db, "registros_mantenimiento"), where("fecha", ">=", sStrShort), where("fecha", "<", eStrShort))); setMaintData(snapMaint.docs.map(d => ({ id: d.id, ...d.data() })));
                        const snapOt = await getDocs(query(collection(db, "registros_horas_extras"), where("fecha", ">=", sStrShort), where("fecha", "<", eStrShort))); setOtData(snapOt.docs.map(d => ({ id: d.id, ...d.data() })));
                    }
                } catch (error) { console.error(error); } finally { setIsFetchingHistory(false); }
            }; 
            fetchHistory();
        }
   } else if (appMode === 'user' && currentUser?.email) {
        const today = new Date(); 
        const startOfMonthISO = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
        
        // 🟢 CINTURÓN 1: Pedimos solo la data del transportista (destraba el caché y no requiere índices)
        unsubOps = onSnapshot(query(collection(db, "registros_produccion"), where("recolector", "==", form.recolector)), (snap) => {
            setLiveData(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.createdAt >= startOfMonthISO).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
        });
        
        // 🟢 CINTURÓN 2: Lo mismo para las horas extras
        const inicioCorteUser = sysConfig?.heInicio ? sysConfig.heInicio : startOfMonthISO;
        unsubOt = onSnapshot(query(collection(db, "registros_horas_extras"), where("usuario", "==", currentUser.email)), (snap) => {
            setOtData(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.fecha >= inicioCorteUser).sort((a,b) => (b.fecha || '').localeCompare(a.fecha || '')));
        });
        
        unsubMaint = onSnapshot(query(collection(db, "registros_mantenimiento"), where("usuario", "==", currentUser.email)), (snap) => setMaintData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        unsubAlertas = onSnapshot(query(collection(db, "alertas_flota"), orderBy("createdAt", "desc"), limit(10)), (snap) => setAlertasData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    return () => { if(unsubOps) unsubOps(); if(unsubFuel) unsubFuel(); if(unsubMaint) unsubMaint(); if(unsubOt) unsubOt(); if(unsubAlertas) unsubAlertas(); if(unsubAgenda) unsubAgenda(); if(unsubConfig) unsubConfig(); if(unsubCatalogs) unsubCatalogs(); if(unsubAllProfiles) unsubAllProfiles(); if(unsubSummaries) unsubSummaries(); };
  }, [dataSource, filterYear, filterMonth, appMode, currentUser, form.recolector, sysConfig?.heInicio]);

  const getUserZone = (emailOrName) => { let email = emailOrName; if (email && !email.includes('@')) email = Object.keys(USUARIOS_EMAIL).find(key => USUARIOS_EMAIL[key] === emailOrName); return perfilesUsuarios[email]?.zona || 'Sin Asignar'; };
  
  // ⏱️ EL CEREBRO: LÍMITES DE TIEMPO DINÁMICOS POR ZONA (VINCULADO AL PANEL ADMIN)
  const getMetaEspera = (zonaStr) => {
      const metaMetro = Number(sysConfig.metaMetro || 5);
      const metaInterior = Number(sysConfig.metaInterior || 10);
      const metaFrontera = Number(sysConfig.metaFrontera || 20);

      if (!zonaStr) return metaMetro;
      const z = zonaStr.toLowerCase();
      if (z.includes('oriente') || z.includes('occidente')) return metaInterior;
      if (z.includes('guatemala') || z.includes('honduras') || z.includes('costa rica')) return metaFrontera;
      return metaMetro;
  };

  const isUserInFilterZone = (emailOrName, filterVal) => { if (filterVal === 'all') return true; const userZone = getUserZone(emailOrName); if (filterVal === 'El Salvador') return userZone.startsWith('El Salvador'); return userZone === filterVal; };
  const getUserCountry = () => { if (!userProfile.zona || userProfile.zona === 'Sin Asignar') return 'El Salvador'; return userProfile.zona.split('-')[0].trim(); };
  const activeUserCountry = getUserCountry();

  const extractDateInfo = (dateStr) => { const strictStr = getStrictDateString(dateStr); if (!strictStr) return { year: null, month: null }; const [d, m, y] = strictStr.split('/'); return { year: y, month: parseInt(m, 10) }; };
  const checkDate = (dateStr) => { const { year, month } = extractDateInfo(dateStr); return year === filterYear && (filterMonth === 'all' || month === parseInt(filterMonth)); };

  const handleDelete = async (collectionName, id) => { if(window.confirm("⚠️ ¿Eliminar registro permanentemente?")) { try { await deleteDoc(doc(db, collectionName, id)); } catch(e) { alert("Error al eliminar"); } } };
  const openEditModal = (item, collectionName) => { setEditingItem({...item, collectionName}); setEditFormData(item); };
  const handleUpdate = async () => { if(!editingItem) return; try { const { id, collectionName, ...rest } = editingItem; await updateDoc(doc(db, collectionName, id), editFormData); setEditingItem(null); } catch(e) { alert("Error al actualizar"); } };
  
  const handleEditFormChange = (e) => { 
      const { name, value } = e.target; 
      setEditFormData(prev => {
          const newData = { ...prev, [name]: value };
          if (name === 'horaInicio' || name === 'horaFin') {
              if (newData.horaInicio && newData.horaFin) {
                  const [h1, m1] = newData.horaInicio.split(':').map(Number);
                  const [h2, m2] = newData.horaFin.split(':').map(Number);
                  let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
                  if (diffMins < 0) diffMins += 24 * 60; 
                  newData.horasCalculadas = parseFloat((diffMins / 60).toFixed(2));
              }
          }
          return newData;
      }); 
  };

  const handleSaveConfig = async () => { try { await setDoc(doc(db, "configuraciones", "general"), sysConfig); alert("¡Configuración guardada! Toda la flota verá estos periodos activos."); } catch (e) { alert("Error guardando configuración"); } };

  const handleAddCatalogItem = async (catalogName) => {
      const item = newCatalogItems[catalogName]?.trim(); if (!item) return; let newCatalogs = { ...catalogs };
      if (catalogName === 'zonas') {
          const parts = item.split('-'); const countryKey = parts.length > 1 ? parts[0].trim() : "El Salvador"; const currentList = catalogs.zonas[countryKey] || [];
          if (currentList.includes(item)) return alert("El elemento ya existe."); newCatalogs.zonas = { ...catalogs.zonas, [countryKey]: [...currentList, item].sort() };
      } else {
          const currentList = catalogs[catalogName]?.[catalogCountry] || []; if (currentList.includes(item)) return alert("El elemento ya existe en " + catalogCountry + "."); newCatalogs[catalogName] = { ...catalogs[catalogName], [catalogCountry]: [...currentList, item].sort() };
      }
      try { await setDoc(doc(db, "configuraciones", "catalogos"), newCatalogs, { merge: true }); setNewCatalogItems(prev => ({ ...prev, [catalogName]: '' })); } catch (e) { alert("Error al guardar en el catálogo."); }
  };

  const handleRemoveCatalogItem = async (catalogName, itemToRemove, countryKeyForZone = null) => {
      if (!window.confirm(`¿Eliminar "${itemToRemove}" del catálogo?`)) return; let newCatalogs = { ...catalogs };
      if (catalogName === 'zonas') { const currentList = catalogs.zonas[countryKeyForZone] || []; newCatalogs.zonas = { ...catalogs.zonas, [countryKeyForZone]: currentList.filter(item => item !== itemToRemove) }; } 
      else { const currentList = catalogs[catalogName]?.[catalogCountry] || []; newCatalogs[catalogName] = { ...catalogs[catalogName], [catalogCountry]: currentList.filter(item => item !== itemToRemove) }; }
      try { await setDoc(doc(db, "configuraciones", "catalogos"), newCatalogs, { merge: true }); } catch (e) { alert("Error al eliminar del catálogo."); }
  };

  const convertToMinutes = (h, m, p) => { let hour = parseInt(h); if (p === 'AM' && hour === 12) hour = 0; if (p === 'PM' && hour !== 12) hour += 12; return hour * 60 + parseInt(m); };
  const getWait = () => { const startMins = convertToMinutes(form.hLlegada, form.mLlegada, form.pLlegada); const endMins = convertToMinutes(form.hSalida, form.mSalida, form.pSalida); return Math.max(0, endMins - startMins); };
  const handleInput = (field, value) => { setForm(prev => ({ ...prev, [field]: field === 'recolector' ? value.toUpperCase() : value })); setActiveInput(field); };
  
  const compressImage = (file) => { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (event) => { const img = new Image(); img.src = event.target.result; img.onload = () => { try { const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; const scaleSize = MAX_WIDTH / img.width; canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); canvas.toBlob((blob) => { if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })); else resolve(file); }, 'image/jpeg', 0.7); } catch(e) { resolve(file); } }; img.onerror = () => resolve(file); }; reader.onerror = () => resolve(file); }); };
  const handleFile = async (e) => { const file = e.target.files[0]; if (file) { setIsCompressing(true); try { const compressedFile = await compressImage(file); setImageFile(compressedFile); const reader = new FileReader(); reader.onloadend = () => setImagePreview(reader.result); reader.readAsDataURL(compressedFile); } catch (e) { alert("Error al procesar la imagen"); } finally { setIsCompressing(false); } } };

  const handleProfilePhotoUpload = async (e) => { const file = e.target.files[0]; if (!file) return; try { const compressed = await compressImage(file); const storageRef = ref(storage, `perfiles/${currentUser.email}`); await uploadBytes(storageRef, compressed); const url = await getDownloadURL(storageRef); await setDoc(doc(db, "usuarios_perfiles", currentUser.email), { foto: url }, { merge: true }); alert("¡Foto de perfil actualizada con éxito!"); } catch (err) { alert("Error subiendo foto de perfil."); } };
  const handleMotoPhotoUpload = async (e) => { const file = e.target.files[0]; if (!file) return; try { const compressed = await compressImage(file); const storageRef = ref(storage, `motos/${currentUser.email}`); await uploadBytes(storageRef, compressed); const url = await getDownloadURL(storageRef); await setDoc(doc(db, "usuarios_perfiles", currentUser.email), { fotoMoto: url }, { merge: true }); alert("¡Foto de la herramienta de trabajo actualizada!"); } catch (err) { alert("Error subiendo foto de la moto."); } };
  const handleAssignCategory = async (email, newCategory) => { if (!email) return; try { await setDoc(doc(db, "usuarios_perfiles", email), { categoria: newCategory }, { merge: true }); } catch (e) {} };
  const handleAssignZone = async (email, newZone) => { if (!email) return; try { await setDoc(doc(db, "usuarios_perfiles", email), { zona: newZone }, { merge: true }); } catch (e) {} };
const gamificationStats = useMemo(() => {
      const currentMonth = new Date().getMonth() + 1; const currentYear = new Date().getFullYear().toString();
      
      // 🔥 CORRECCIÓN: Ahora el perfil SOLO lee la Base de Datos en Vivo (Firebase) igual que el Admin.
      // Le quitamos el "...csvData"
      const allUserOps = liveData.filter(d => { const dateInfo = extractDateInfo(d.createdAt); return dateInfo.month === currentMonth && dateInfo.year === currentYear && d.recolector === form.recolector; });
      
      const recs = allUserOps.filter(d => isPrincipalData(d)); 
      const secundarias = allUserOps.filter(d => !isPrincipalData(d));
      
      const miMeta = getMetaEspera(userProfile.zona);
      const ef = recs.length > 0 ? ((recs.filter(x => (x.tiempo||0) <= miMeta).length / recs.length) * 100).toFixed(1) : 100;
      
      const userOt = otData.filter(d => { 
          if (sysConfig?.heInicio && sysConfig?.heFin) {
              return d.fecha >= sysConfig.heInicio && d.fecha <= sysConfig.heFin && (USUARIOS_EMAIL[d.usuario] || d.usuario) === form.recolector;
          }
          const dateInfo = extractDateInfo(d.fecha); return dateInfo.month === currentMonth && dateInfo.year === currentYear && (USUARIOS_EMAIL[d.usuario] || d.usuario) === form.recolector; 
      });
      const totalOT = userOt.reduce((acc, curr) => acc + parseFloat(String(curr.horasCalculadas).replace(',','.') || 0), 0);
      
      return { 
          eficiencia: parseFloat(ef), 
          totalOps: allUserOps.length, 
          totalOT: totalOT.toFixed(1),
          totalSecundarias: secundarias.length 
      };
  }, [liveData, otData, form.recolector, userProfile.zona, sysConfig]);
const cycleCategory = async () => { const categories = ['Operador', 'Técnico', 'Coordinador']; const currentIndex = categories.indexOf(userProfile.categoria || 'Operador'); const nextCategory = categories[(currentIndex + 1) % categories.length]; try { await setDoc(doc(db, "usuarios_perfiles", currentUser.email), { categoria: nextCategory }, { merge: true }); } catch(e) {} };
 const hrMetrics = useMemo(() => {
    let filteredOt = otData.filter(d => { if (!sysConfig.heInicio || !sysConfig.heFin) return true; return d.fecha >= sysConfig.heInicio && d.fecha <= sysConfig.heFin; });
    if (filterZona !== 'all') filteredOt = filteredOt.filter(d => isUserInFilterZone(d.usuario, filterZona)); if (filterUser !== 'all') filteredOt = filteredOt.filter(d => (USUARIOS_EMAIL[d.usuario] || '') === filterUser);
    const totalHoras = filteredOt.reduce((acc, curr) => { const hrs = parseFloat(String(curr.horasCalculadas).replace(',', '.')) || 0; return acc + hrs; }, 0);
    const userOtStats = filteredOt.reduce((acc, curr) => { const rawName = curr.usuario || 'Desconocido'; const name = USUARIOS_EMAIL[rawName] || rawName; const hrs = parseFloat(String(curr.horasCalculadas).replace(',', '.')) || 0; acc[name] = (acc[name] || 0) + hrs; return acc; }, {});
    const rankingOt = Object.entries(userOtStats).map(([name, hours]) => ({ name, hours: parseFloat(hours.toFixed(2)) })).sort((a,b) => b.hours - a.hours); return { totalHoras: totalHoras.toFixed(2), totalRegistros: filteredOt.length, rankingOt, rawData: filteredOt };
  }, [otData, filterUser, filterZona, sysConfig, perfilesUsuarios]);

  const fleetMetrics = useMemo(() => {
    let filteredFuel = fuelData.filter(d => checkDate(d.fecha)); let filteredMaint = maintData.filter(d => checkDate(d.fecha));
    if (filterZona !== 'all') { filteredFuel = filteredFuel.filter(d => isUserInFilterZone(d.usuario, filterZona)); filteredMaint = filteredMaint.filter(d => isUserInFilterZone(d.usuario, filterZona)); }
    if (filterUser !== 'all') { filteredFuel = filteredFuel.filter(d => (USUARIOS_EMAIL[d.usuario] || '') === filterUser); filteredMaint = filteredMaint.filter(d => (USUARIOS_EMAIL[d.usuario] || '') === filterUser); }
    const totalFuelCost = filteredFuel.reduce((acc, curr) => acc + parseFloat(curr.costo || 0), 0); const totalGalones = filteredFuel.reduce((acc, curr) => acc + parseFloat(curr.galones || 0), 0); const totalMaintCost = filteredMaint.reduce((acc, curr) => acc + parseFloat(curr.costo || 0), 0);
    const userStats = {}; const process = (i, k) => { const rawName = i.usuario || 'Desconocido'; const name = (USUARIOS_EMAIL[rawName] || rawName).split(' ')[0]; userStats[name] = userStats[name] || { fuel: 0, maint: 0 }; userStats[name][k] += parseFloat(i.costo || 0); };
    filteredFuel.forEach(i => process(i, 'fuel')); filteredMaint.forEach(i => process(i, 'maint'));
    const chartData = Object.entries(userStats).map(([name, stats]) => ({ name, fuel: parseFloat(stats.fuel.toFixed(2)), maint: parseFloat(stats.maint.toFixed(2)), total: parseFloat((stats.fuel + stats.maint).toFixed(2)) })).sort((a,b) => b.total - a.total);
    return { totalFuelCost: totalFuelCost.toFixed(2), totalGalones: totalGalones.toFixed(2), totalMaintCost: totalMaintCost.toFixed(2), chartData };
  }, [fuelData, maintData, filterMonth, filterUser, filterYear, filterZona, perfilesUsuarios]);

const metrics = useMemo(() => {
    const data = filterYear === '2025' ? csvData : liveData;
    let filtered = data.filter(d => checkDate(d.createdAt));
    if (filterZona !== 'all') filtered = filtered.filter(d => isUserInFilterZone(d.recolector, filterZona));
    if (filterUser !== 'all') filtered = filtered.filter(d => d.recolector === filterUser);
    if (filterSucursal !== 'all') filtered = filtered.filter(d => d.sucursal === filterSucursal);
    if (filterSpecificDate) { const targetDate = getStrictDateString(filterSpecificDate); filtered = filtered.filter(d => getStrictDateString(d.createdAt) === targetDate); }
    const pItems = filtered.filter(d => isPrincipalData(d)); const sItems = filtered.filter(d => !isPrincipalData(d));   
    const calcEf = (arr) => arr.length > 0 ? ((arr.filter(x => (x.tiempo||0) <= getMetaEspera(getUserZone(x.recolector))).length / arr.length) * 100).toFixed(1) : 0;
    const calcAvg = (arr) => arr.length > 0 ? (arr.reduce((a,b)=>a+(b.tiempo||0),0)/arr.length).toFixed(1) : 0;
    const currYear = new Date().getFullYear().toString();
    const currMonth = new Date().getMonth() + 1;
    const monthlyData = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => { 
            const mNum = i + 1;
            const mesIndexStr = mNum.toString().padStart(2, '0');
            const documentId = `${filterYear}-${mesIndexStr}`; // Ej: "2026-02"
            const isFuture = (filterYear === currYear && mNum > currMonth) || (parseInt(filterYear) > parseInt(currYear));
            
            // 1. Si seleccionó un mes específico, aplanamos visualmente los demás
            if (filterMonth !== 'all' && mNum !== parseInt(filterMonth)) {
                return { name: m, ef: 0, count: 0 };
            }
            // 2. Extraemos los datos locales de la memoria de la PC
            const mDocs = data.filter(d => { const { year, month } = extractDateInfo(d.createdAt); return year === filterYear && month === mNum; }); 
            const finalDocs = filterUser === 'all' ? mDocs : mDocs.filter(d => d.recolector === filterUser); 
            const mRecs = finalDocs.filter(d => isPrincipalData(d)); 

            let efVal = 0;
            let countVal = 0;

            // 🔥 EL MOTOR HÍBRIDO PERFECTO 🔥
            if (finalDocs.length > 0) {
                // A) Si la PC sí descargó los registros de este mes (Ej. al seleccionar "Mes 2")
                efVal = isFuture ? null : parseFloat(calcEf(mRecs));
                countVal = finalDocs.length;
            } else if (filterUser === 'all') {
                // B) Si la PC NO tiene los datos (Ej. al seleccionar "Año" en Vivo), lee de la Nube
                const resumen = resumenesMensualesNube[documentId];
                efVal = isFuture ? null : (resumen ? parseFloat(resumen.eficienciaGlobal) : 0);
                countVal = resumen ? resumen.totalViajesMes : 0;
            } else {
                efVal = isFuture ? null : 0;
            }

            return { name: m, ef: efVal, count: countVal }; 
        });
    
    const sucursalStats = filtered.reduce((acc, curr) => { if(!curr.sucursal || curr.sucursal === 'N/A' || curr.sucursal === 'Ruta Externa') return acc; acc[curr.sucursal] = acc[curr.sucursal] || { totalTime: 0, count: 0 }; acc[curr.sucursal].totalTime += (curr.tiempo || 0); acc[curr.sucursal].count += 1; return acc; }, {});
    const topSucursales = Object.entries(sucursalStats).map(([name, stats]) => ({ name, avgWait: parseFloat((stats.totalTime / stats.count).toFixed(1)) })).sort((a,b) => b.avgWait - a.avgWait).slice(0, 5);
    
    return { total: filtered.length, efP: calcEf(pItems), avgP: calcAvg(pItems), countP: pItems.length, efS: calcEf(sItems), avgS: calcAvg(sItems), countS: sItems.length, monthlyData, topSucursales, rows: filtered };
  // 🔥 EL CANDADO CORREGIDO: Faltaba incluir resumenesMensualesNube en la lista de aquí abajo 👇
  }, [liveData, csvData, filterMonth, filterUser, filterYear, filterSpecificDate, filterSucursal, filterZona, perfilesUsuarios, resumenesMensualesNube]);

  const regionalMetrics = useMemo(() => {
      const data = filterYear === '2025' ? csvData : liveData; const filteredData = data.filter(d => checkDate(d.createdAt)); const stats = {};
      filteredData.forEach(d => {
          const zonaCompleta = getUserZone(d.recolector); let pais = zonaCompleta.includes('-') ? zonaCompleta.split('-')[0].trim() : zonaCompleta; if(pais === 'Sin Asignar') pais = 'Sin Asignar';
          if (!stats[pais]) stats[pais] = { nombre: pais, tipo: 'pais', vitales: 0, onTime: 0, secundarias: 0, total: 0 };
          if (!stats[zonaCompleta] && zonaCompleta !== pais) stats[zonaCompleta] = { nombre: zonaCompleta, tipo: 'zona', vitales: 0, onTime: 0, secundarias: 0, total: 0 };
          
          const isP = isPrincipalData(d); 
          const miMeta = getMetaEspera(zonaCompleta);
          const isOnTime = isP && (d.tiempo || 0) <= miMeta;

          stats[pais].total += 1; if (isP) { stats[pais].vitales += 1; if(isOnTime) stats[pais].onTime += 1; } else { stats[pais].secundarias += 1; }
          if (zonaCompleta !== pais) { stats[zonaCompleta].total += 1; if (isP) { stats[zonaCompleta].vitales += 1; if(isOnTime) stats[zonaCompleta].onTime += 1; } else { stats[zonaCompleta].secundarias += 1; } }
      });
      const results = Object.values(stats).map(s => ({ ...s, eficiencia: s.vitales > 0 ? parseFloat(((s.onTime / s.vitales) * 100).toFixed(1)) : 0 }));
      
      // 🔥 FILTRO BI: Ocultamos el "limbo" de Sin Asignar para que la gerencia solo vea países reales
      return { 
          paises: results.filter(r => r.tipo === 'pais' && r.nombre !== 'Sin Asignar').sort((a,b) => b.eficiencia - a.eficiencia), 
          zonas: results.filter(r => r.tipo === 'zona' && r.nombre !== 'Sin Asignar').sort((a,b) => b.eficiencia - a.eficiencia) 
      }; 
  }, [liveData, csvData, filterYear, filterMonth, perfilesUsuarios]);

const biMetrics = useMemo(() => {
      const y1 = filterYear; const y2 = (parseInt(filterYear) - 1).toString(); const allOps = [...liveData, ...csvData]; const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const currYear = new Date().getFullYear().toString(); const currMonth = new Date().getMonth() + 1;

      const dataYoY = months.map((m, i) => {
          const mNum = i + 1; 
          const mesIndexStr = mNum.toString().padStart(2, '0');
          const docIdY1 = `${y1}-${mesIndexStr}`;
          const docIdY2 = `${y2}-${mesIndexStr}`;

          const isFutureY1 = (y1 === currYear && mNum > currMonth) || (parseInt(y1) > parseInt(currYear)); 
          const isFutureY2 = (y2 === currYear && mNum > currMonth) || (parseInt(y2) > parseInt(currYear));
          
          const getOps = (y) => { let docs = allOps.filter(d => { const info = extractDateInfo(d.createdAt); return info.year === y && info.month === mNum; }); if (filterZona !== 'all') docs = docs.filter(x => isUserInFilterZone(x.recolector, filterZona)); if (filterUser !== 'all') docs = docs.filter(x => x.recolector === filterUser); return docs; };
          const ops1 = getOps(y1); const ops2 = getOps(y2); 
          const calcEf = (docs) => { const recs = docs.filter(d => isPrincipalData(d)); if(recs.length === 0) return 0; return parseFloat(((recs.filter(x => (x.tiempo||0) <= getMetaEspera(getUserZone(x.recolector))).length / recs.length) * 100).toFixed(1)); };
          
          const getFuel = (y) => { let docs = fuelData.filter(d => { const info = extractDateInfo(d.fecha); return info.year === y && info.month === mNum; }); if (filterZona !== 'all') docs = docs.filter(x => isUserInFilterZone(x.usuario, filterZona)); if (filterUser !== 'all') docs = docs.filter(x => (USUARIOS_EMAIL[x.usuario]||'') === filterUser); return docs.reduce((sum, d) => sum + parseFloat(d.costo||0), 0); };
          const getMaint = (y) => { let docs = maintData.filter(d => { const info = extractDateInfo(d.fecha); return info.year === y && info.month === mNum; }); if (filterZona !== 'all') docs = docs.filter(x => isUserInFilterZone(x.usuario, filterZona)); if (filterUser !== 'all') docs = docs.filter(x => (USUARIOS_EMAIL[x.usuario]||'') === filterUser); return docs.reduce((sum, d) => sum + parseFloat(d.costo||0), 0); };
          
          // 🔥 EL SÚPER MOTOR HÍBRIDO (Eficiencia + Finanzas + CSV Local) 🔥
          let efY1 = 0; let efY2 = 0;
          let fuelY1 = 0; let fuelY2 = 0;
          let maintY1 = 0; let maintY2 = 0;

          if (filterUser === 'all' && filterZona === 'all') {
              const resY1 = resumenesMensualesNube[docIdY1] || {};
              const resY2 = resumenesMensualesNube[docIdY2] || {};
              
              // Si el resumen de la Nube tiene el dato, lo usa. Si no, lo calcula localmente.
              efY1 = isFutureY1 ? null : (resY1.eficienciaGlobal !== undefined ? parseFloat(resY1.eficienciaGlobal) : calcEf(ops1));
              efY2 = isFutureY2 ? null : (resY2.eficienciaGlobal !== undefined ? parseFloat(resY2.eficienciaGlobal) : calcEf(ops2));
              
              fuelY1 = isFutureY1 ? null : (resY1.gastoCombustible !== undefined ? parseFloat(resY1.gastoCombustible) : getFuel(y1));
              fuelY2 = isFutureY2 ? null : (resY2.gastoCombustible !== undefined ? parseFloat(resY2.gastoCombustible) : getFuel(y2));
              
              maintY1 = isFutureY1 ? null : (resY1.gastoMantenimiento !== undefined ? parseFloat(resY1.gastoMantenimiento) : getMaint(y1));
              maintY2 = isFutureY2 ? null : (resY2.gastoMantenimiento !== undefined ? parseFloat(resY2.gastoMantenimiento) : getMaint(y2));
          } else {
              // Si se filtra por usuario o zona específica, SIEMPRE calcula localmente con precisión quirúrgica
              efY1 = isFutureY1 ? null : calcEf(ops1);
              efY2 = isFutureY2 ? null : calcEf(ops2);
              fuelY1 = isFutureY1 ? null : getFuel(y1);
              fuelY2 = isFutureY2 ? null : getFuel(y2);
              maintY1 = isFutureY1 ? null : getMaint(y1);
              maintY2 = isFutureY2 ? null : getMaint(y2);
          }
          
          return { 
              name: m, 
              [`ef${y1}`]: efY1, 
              [`ef${y2}`]: efY2, 
              [`fuel${y1}`]: fuelY1 !== null ? parseFloat(fuelY1.toFixed(2)) : null, 
              [`fuel${y2}`]: fuelY2 !== null ? parseFloat(fuelY2.toFixed(2)) : null, 
              [`maint${y1}`]: maintY1 !== null ? parseFloat(maintY1.toFixed(2)) : null, 
              [`maint${y2}`]: maintY2 !== null ? parseFloat(maintY2.toFixed(2)) : null 
          }
      }); return { dataYoY, yCurrent: y1, yPrev: y2 };
  }, [liveData, csvData, fuelData, maintData, filterYear, filterUser, filterZona, perfilesUsuarios, resumenesMensualesNube]);

  const userMetrics = useMemo(() => {
    const data = filterYear === '2025' ? csvData : liveData;
    const targetUser = form.recolector;
    let userDocs = targetUser && targetUser.length > 2 ? data.filter(d => d.recolector === targetUser) : data;
    const todayStr = getStrictDateString(new Date()); 
    userDocs = userDocs.filter(d => getStrictDateString(d.createdAt) === todayStr);
    const recs = userDocs.filter(d => isPrincipalData(d));
    const ef = recs.length > 0 ? ((recs.filter(x => (x.tiempo||0) <= getMetaEspera(userProfile.zona)).length / recs.length) * 100).toFixed(1) : 0;
    return { ef: ef, count: userDocs.length, label: targetUser && targetUser.length > 2 ? targetUser.split(' ')[0] : 'HOY' };
  }, [liveData, csvData, form.recolector, filterYear, userProfile.zona]);
const adminDashboardMetrics = useMemo(() => {
    if (appMode !== 'admin' && appMode !== 'supervisor') return { transportistasStats: [] };
    const data = filterYear === '2025' ? csvData : liveData; 
    const filteredData = data.filter(d => checkDate(d.createdAt));
    const todayStr = getStrictDateString(new Date());
    let activeTransportistas = []; Object.values(catalogs.transportistas || {}).forEach(list => activeTransportistas.push(...list));
    const transportistasInZone = activeTransportistas.filter(name => isUserInFilterZone(name, filterZona));

    const stats = transportistasInZone.map(name => {
        const userDocs = filteredData.filter(d => d.recolector === name); 
        const recs = userDocs.filter(d => isPrincipalData(d));
        const sItems = userDocs.filter(d => !isPrincipalData(d));
        const email = Object.keys(USUARIOS_EMAIL).find(key => USUARIOS_EMAIL[key] === name); 
        const profile = perfilesUsuarios[email] || {};
        
        const miMeta = getMetaEspera(profile.zona);
        const onTime = recs.filter(x => (x.tiempo||0) <= miMeta).length; 
        const delayed = recs.length - onTime; 
        const ef = recs.length > 0 ? ((onTime / recs.length) * 100).toFixed(1) : 100;

        // 🔥 JOYAS DE LA CORONA: CÁLCULO DE ESTATUS Y CHISMOSO EN VIVO 🔥
// ⏱️ CÁLCULO DEL CHISMOSO ANTI-TRAMPAS
        const userDocsToday = userDocs.filter(d => getStrictDateString(d.createdAt) === todayStr).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        let minutosInactivo = null;
        if (userDocsToday.length > 0) {
            const ultimoRegistro = new Date(userDocsToday[0].createdAt);
            minutosInactivo = Math.floor((new Date() - ultimoRegistro) / 60000);
        }

        return { 
            name, email, eficiencia: parseFloat(ef), totalTrips: userDocs.length, 
            totalMuestras: recs.length, secundarias: sItems.length,
            onTime, delayed, foto: profile.foto || null, fotoMoto: profile.fotoMoto || null, 
            categoria: profile.categoria || 'Operador', zona: profile.zona || 'Sin Asignar', 
            estatus: profile.estatus || 'Inactivo', minutosInactivo 
        };
    }).sort((a,b) => {
        // Ordenamos para que los inactivos/peligro aparezcan de primeros en la pantalla
        if (b.isDanger !== a.isDanger) return b.isDanger ? 1 : -1;
        return b.eficiencia - a.eficiencia;
    }); 
    return { transportistasStats: stats };
  }, [liveData, csvData, filterYear, filterMonth, catalogs.transportistas, perfilesUsuarios, appMode, filterZona]);

  const userAlerts = useMemo(() => {
      const alerts = []; if (appMode !== 'user') return alerts;
      const miAgenda = agendaData.find(a => a.id === form.recolector);
      if (miAgenda) {
          const todayDate = new Date(); const day = String(todayDate.getDate()).padStart(2, '0'); const month = String(todayDate.getMonth() + 1).padStart(2, '0'); const year = todayDate.getFullYear();
          const localTodayStr = `${year}-${month}-${day}`; const todayShortSlash = `${day}/${month}`; const todayShortDash = `${day}-${month}`; const todayFullSlash = `${day}/${month}/${year}`; const todayFullDash = `${day}-${month}-${year}`; 
          const monthUnpadded = todayDate.getMonth() + 1; const dayUnpadded = todayDate.getDate(); const todayShortSlashUnp = `${dayUnpadded}/${monthUnpadded}`; const todayFullSlashUnp = `${dayUnpadded}/${monthUnpadded}/${year}`; 
          const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']; const todayName = days[todayDate.getDay()];
          const isMaintToday = miAgenda.mantenimiento === localTodayStr; const isMaintPast = miAgenda.mantenimiento && miAgenda.mantenimiento < localTodayStr;
          const hasRegisteredMaint = maintData.some(m => m.fecha >= miAgenda.mantenimiento);
          
          if (!hasRegisteredMaint) {
              if (isMaintPast && !hiddenAlerts.includes('kpi_maint_past')) alerts.push({ id: 'kpi_maint_past', type: 'kpi_danger', title: '🔴 ALERTA DE KPI: Mantenimiento Vencido', msg: `Tu fecha de taller (${formatWithDay(formatLocalDate(miAgenda.mantenimiento))}) ya pasó. ¡Repórtalo ya o afectará tu evaluación mensual!`, tipo: 'info' });
              const maintId = `auto_maint_${localTodayStr}_${miAgenda.mantenimiento || ''}`;
              if (isMaintToday && !hiddenAlerts.includes(maintId)) alerts.push({ id: maintId, type: 'maint', title: '¡Mantenimiento Hoy!', msg: 'Lleva la unidad al taller asignado y registra el comprobante.' });
          }
          const turnosTxt = (miAgenda.turnos || '').toLowerCase();
          const hasTurnoToday = turnosTxt.includes(todayName.toLowerCase()) || turnosTxt.includes(todayShortSlash) || turnosTxt.includes(todayShortDash) || turnosTxt.includes(todayFullSlash) || turnosTxt.includes(todayFullDash) || turnosTxt.includes(todayShortSlashUnp) || turnosTxt.includes(todayFullSlashUnp);
          const turnoId = `auto_turno_${localTodayStr}_${miAgenda.turnos || ''}`;
          if (hasTurnoToday && !hiddenAlerts.includes(turnoId)) alerts.push({ id: turnoId, type: 'turno', title: '¡Turno Extra Hoy!', msg: 'Registra tus horas al finalizar.' });
      }
      alertasData.forEach(alerta => { if (hiddenAlerts.includes(alerta.id)) return; if (alerta.para === 'Todos' || alerta.para === form.recolector) alerts.push({ ...alerta, type: 'admin_msg', title: alerta.tipo === 'confirm' ? 'Requiere Confirmación' : (alerta.para === 'Todos' ? 'Aviso Global' : 'Mensaje Directo'), msg: alerta.mensaje }); });
      return alerts;
  }, [agendaData, form.recolector, alertasData, appMode, hiddenAlerts, maintData]);

  const dismissAlert = async (alerta, replyText = '') => {
      if (alerta.tipo === 'confirm' && replyText) { try { await updateDoc(doc(db, "alertas_flota", alerta.id), { respuestas: arrayUnion({ usuario: form.recolector, respuesta: replyText, fecha: new Date().toISOString() }) }); } catch(e) {} } 
      else if (alerta.tipo === 'info' && alerta.para !== 'Todos') { try { await deleteDoc(doc(db, "alertas_flota", alerta.id)); } catch(e) {} }
      const newHidden = [...hiddenAlerts, alerta.id]; setHiddenAlerts(newHidden);
      if (currentUser && currentUser.email) localStorage.setItem(`recolekta_hidden_alerts_${currentUser.email}`, JSON.stringify(newHidden));
  };
  
  const exportToCSV = () => { 
    if (!metrics.rows || metrics.rows.length === 0) return alert("No hay datos"); 
    const csvRows = metrics.rows.map(r => ({ Fecha: getStrictDateString(r.createdAt), Transportista: r.recolector, Sucursal: r.sucursal, Diligencia: r.tipo, Area: r.area || 'N/A', Categoria: r.categoria, Entrada: r.hLlegada && r.mLlegada ? `${r.hLlegada}:${r.mLlegada} ${r.pLlegada}` : '', Salida: r.hSalida && r.mSalida ? `${r.hSalida}:${r.mSalida} ${r.pSalida}` : '', Espera_Minutos: r.tiempo, Observaciones: r.observaciones || '', Foto_URL: r.fotoData || '' })); 
    const csv = Papa.unparse(csvRows, { delimiter: ";" }); const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Respaldo_Recolekta_${filterYear}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); 
  };
  
 const exportPayrollCSV = () => { 
    // 💡 El filtro de la quincena se aplica EXCLUSIVAMENTE al exportar el Excel
    let exportData = otData.filter(d => { if (!sysConfig.heInicio || !sysConfig.heFin) return true; return d.fecha >= sysConfig.heInicio && d.fecha <= sysConfig.heFin; });
    
    if (exportData.length === 0) return alert("No hay datos de horas extras en este rango de quincena."); 
    const formatTime12 = (time24) => { if(!time24) return ''; const [h, m] = time24.split(':'); let hours = parseInt(h, 10); const ampm = hours >= 12 ? 'p.m.' : 'a.m.'; hours = hours % 12; hours = hours ? hours : 12; return `${hours}:${m} ${ampm}`; }; 
    const splitSchedule = (scheduleStr) => { if (!scheduleStr || !scheduleStr.includes('-')) return { start: '', end: '' }; const parts = scheduleStr.split('-'); return { start: parts[0].trim(), end: parts[1].trim() }; }; 
    const csvRows = exportData.map((r, index) => { 
        const workHours = splitSchedule(r.horarioTurno || ''); const heStart = formatTime12(r.horaInicio); const heEnd = formatTime12(r.horaFin); 
        return { 'ID': index + 1, 'Marca temporal': getStrictDateString(r.createdAt || r.fecha), 'Nombre del Transportista': USUARIOS_EMAIL[r.usuario] || r.usuario, 'Fecha': getStrictDateString(r.fecha), 'Hora de trabajo Inicio': workHours.start, 'Hora de trabajo Fin': workHours.end, 'Horario de Horas extras Inicio': heStart, 'Horario de Horas extras Fin': heEnd, 'Horas extras': r.horasCalculadas, 'Actividad Realizada / Observaciones': r.motivo || '', 'HorarioTrabajo': r.horarioTurno || '', 'HorarioHE': `${heStart} - ${heEnd}` }; 
    }); 
    const csv = Papa.unparse(csvRows, { delimiter: ";", header: true }); const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Consolidado_HE_${sysConfig.heInicio}_al_${sysConfig.heFin}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); 
  };
  
  const downloadReport = () => {
    try {
        const doc = new jsPDF(); const slate900 = [15, 23, 42]; const green500 = [34, 197, 94]; const dateStr = new Date().toLocaleDateString();
        const drawHeader = (title, subtitle) => { doc.setFillColor(...slate900); doc.rect(0,0,210,40,'F'); doc.setFillColor(...green500); doc.circle(20, 20, 10, 'F'); doc.setTextColor(255); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("R", 17.5, 22); doc.setFontSize(22); doc.text("RECOLEKTA OS", 35, 18); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("SISTEMA DE GESTIÓN LOGÍSTICA", 35, 24); doc.setTextColor(40); doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text(title, 15, 55); doc.setFontSize(10); doc.setTextColor(100); doc.text(subtitle, 15, 61); };
        
        if (appMode === 'user') {
            const todayStr = getStrictDateString(new Date());
            const reportData = liveData.filter(d => d.recolector === form.recolector && getStrictDateString(d.createdAt) === todayStr);
            if (reportData.length === 0) return alert("No hay datos para generar el reporte de hoy.");
            drawHeader(`REPORTE DIARIO DE RUTA: ${form.recolector}`, `Generado: ${dateStr} | Registros: ${reportData.length}`);
            
            const pItems = reportData.filter(d => isPrincipalData(d)); 
            const sItems = reportData.filter(d => !isPrincipalData(d));
            const meta = getMetaEspera(userProfile.zona);
            const efP = pItems.length > 0 ? ((pItems.filter(x => (x.tiempo||0) <= meta).length / pItems.length) * 100).toFixed(1) : 0;
            const avgP = pItems.length > 0 ? (pItems.reduce((a,b)=>a+(b.tiempo||0),0)/pItems.length).toFixed(1) : 0;
            const avgS = sItems.length > 0 ? (sItems.reduce((a,b)=>a+(b.tiempo||0),0)/sItems.length).toFixed(1) : 0;

            doc.setTextColor(0);
            doc.text(`Eficiencia Muestras: ${efP}% (Meta ${meta} min)`, 20, 75);
            doc.text(`Promedio Espera (Muestras): ${avgP} min`, 20, 81);
            doc.text(`Total Otras Diligencias: ${sItems.length}`, 120, 75);
            doc.text(`Promedio Espera (Otras): ${avgS} min`, 120, 81);

            const rows = reportData.map(r => [ getStrictDateString(r.createdAt), r.sucursal, r.tipo, `${r.hLlegada}:${r.mLlegada} ${r.pLlegada}`, `${r.hSalida}:${r.mSalida} ${r.pSalida}`, `${r.tiempo}m`, r.categoria ]);
            autoTable(doc, { startY: 95, head: [['Fecha', 'Sucursal', 'Diligencia', 'Llegada', 'Salida', 'Espera', 'Tipo']], body: rows, headStyles: { fillColor: slate900 }, styles: { fontSize: 8 }, theme: 'striped' });
            doc.save(`Recolekta_Reporte_Ruta_${form.recolector.replace(/\s+/g, '_')}.pdf`);
            return;
        }

        const currentSection = appMode === 'supervisor' ? supervisorSection : adminSection;
        if (currentSection === 'agenda') {
            if (agendaData.length === 0) return alert("No hay horarios registrados.");
            drawHeader("AGENDA GLOBAL DE FLOTA", `Generado: ${dateStr}`);
            const rows = agendaData.map(a => [a.id, a.horario || '--', a.zona || '--', a.puntos || '--', formatTurnosVisually(a.turnos) || 'Ninguno', formatWithDay(formatLocalDate(a.mantenimiento))]);
            autoTable(doc, { startY: 65, head: [['Transportista', 'Horario Base', 'Zona/Ruta', 'Puntos/Sucursales', 'Turnos Extra', 'Prox. Mantenimiento']], body: rows, headStyles: { fillColor: slate900 }, theme: 'grid', styles: { fontSize: 8 } });
            doc.save("Recolekta_Agenda_Horarios.pdf"); return;
        }
        if (currentSection === 'combustible' || currentSection === 'fleet') {
            let dataToExport = fuelData.filter(d => checkDate(d.fecha)); if (filterUser !== 'all') dataToExport = dataToExport.filter(d => (USUARIOS_EMAIL[d.usuario]||'') === filterUser);
            if (dataToExport.length === 0) return alert("No hay datos de combustible.");
            drawHeader("CONTROL DE COMBUSTIBLE", `Generado: ${dateStr} | Filtro: ${filterUser !== 'all' ? filterUser : 'GLOBAL'}`);
            const rows = dataToExport.map(r => [formatLocalDate(r.fecha), USUARIOS_EMAIL[r.usuario] || r.usuario, r.galones, `$${r.costo}`, r.kilometraje]);
            autoTable(doc, { startY: 65, head: [['Fecha', 'Usuario', 'Galones', 'Costo Total', 'Km']], body: rows, headStyles: { fillColor: slate900 }, theme: 'striped' }); doc.save("Recolekta_Combustible.pdf"); return;
        }
        if (currentSection === 'taller') {
            let dataToExport = maintData.filter(d => checkDate(d.fecha)); if (filterUser !== 'all') dataToExport = dataToExport.filter(d => (USUARIOS_EMAIL[d.usuario]||'') === filterUser);
            if (dataToExport.length === 0) return alert("No hay datos de taller.");
            drawHeader("CONTROL DE TALLER Y MANTENIMIENTO", `Generado: ${dateStr} | Filtro: ${filterUser !== 'all' ? filterUser : 'GLOBAL'}`);
            const rows = dataToExport.map(r => [formatLocalDate(r.fecha), USUARIOS_EMAIL[r.usuario] || r.usuario, r.tipo, r.taller, r.descripcion || '--', `$${r.costo}`]);
            autoTable(doc, { startY: 65, head: [['Fecha', 'Usuario', 'Tipo', 'Taller', 'Detalle', 'Costo']], body: rows, headStyles: { fillColor: slate900 }, theme: 'striped' }); doc.save("Recolekta_Mantenimiento.pdf"); return;
        }
        if (currentSection === 'hr') {
            if (hrMetrics.rawData.length === 0) return alert("No hay horas extras.");
            drawHeader("NÓMINA DE HORAS EXTRAS", `Generado: ${dateStr} | ${formatLocalDate(sysConfig.heInicio)} al ${formatLocalDate(sysConfig.heFin)}`);
            const rows = hrMetrics.rawData.map(r => [getStrictDateString(r.fecha), USUARIOS_EMAIL[r.usuario] || r.usuario, r.horaInicio, r.horaFin, `${r.horasCalculadas}h`, r.motivo]);
            autoTable(doc, { startY: 65, head: [['Fecha', 'Colaborador', 'Inicio', 'Fin', 'Total Hrs', 'Motivo']], body: rows, headStyles: { fillColor: slate900 }, theme: 'striped' }); doc.save("Recolekta_Horas_Extras.pdf"); return;
        }
        const reportData = metrics.rows; if (reportData.length === 0) return alert("No hay datos para generar reporte.");
        let titleParts = []; if (filterZona !== 'all') titleParts.push(`ZONA: ${filterZona}`); if (filterUser !== 'all') titleParts.push(`USUARIO: ${filterUser}`); if (filterSucursal !== 'all') titleParts.push(`SUCURSAL: ${filterSucursal}`); if (filterSpecificDate) titleParts.push(`FECHA: ${getStrictDateString(filterSpecificDate)}`);
        const reportTitle = titleParts.length > 0 ? titleParts.join(" | ") : "REPORTE CONSOLIDADO GLOBAL";
        drawHeader(reportTitle, `Generado: ${dateStr} | Registros: ${reportData.length}`);
        
        const pItems = reportData.filter(d => isPrincipalData(d)); const sItems = reportData.filter(d => !isPrincipalData(d));
        const efP = pItems.length > 0 ? ((pItems.filter(x => (x.tiempo||0) <= getMetaEspera(getUserZone(x.recolector))).length / pItems.length) * 100).toFixed(1) : 0; 
        const avgP = pItems.length > 0 ? (pItems.reduce((a,b)=>a+(b.tiempo||0),0)/pItems.length).toFixed(1) : 0; 
        const avgS = sItems.length > 0 ? (sItems.reduce((a,b)=>a+(b.tiempo||0),0)/sItems.length).toFixed(1) : 0;
        
        doc.setTextColor(0); doc.text(`Eficiencia Muestras: ${efP}%`, 20, 75); doc.text(`Promedio Espera (Muestras): ${avgP} min`, 20, 81); doc.text(`Total Otras Diligencias: ${sItems.length}`, 120, 75); doc.text(`Promedio Espera (Otras): ${avgS} min`, 120, 81);
        if (filterSpecificDate) {
            const rows = reportData.map(r => [ getStrictDateString(r.createdAt), r.sucursal, r.tipo, `${r.hLlegada}:${r.mLlegada} ${r.pLlegada}`, `${r.hSalida}:${r.mSalida} ${r.pSalida}`, `${r.tiempo}m`, r.categoria ]);
            autoTable(doc, { startY: 95, head: [['Fecha', 'Sucursal', 'Diligencia', 'Llegada', 'Salida', 'Espera', 'Tipo']], body: rows, headStyles: { fillColor: slate900 }, styles: { fontSize: 8 }, theme: 'striped' });
        } else {
            const monthlyTableRows = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => { 
                const mDocs = reportData.filter(d => extractDateInfo(d.createdAt).month === i + 1); const mRecs = mDocs.filter(d => isPrincipalData(d)); const mDils = mDocs.filter(d => !isPrincipalData(d)); 
                const mEf = mRecs.length > 0 ? ((mRecs.filter(x => (x.tiempo||0) <= getMetaEspera(getUserZone(x.recolector))).length / mRecs.length) * 100).toFixed(1) : 0; 
                const mAvgR = mRecs.length > 0 ? (mRecs.reduce((a,b)=>a+(b.tiempo||0),0)/mRecs.length).toFixed(1) : 0; const mAvgD = mDils.length > 0 ? (mDils.reduce((a,b)=>a+(b.tiempo||0),0)/mDils.length).toFixed(1) : 0; 
                return [m, mRecs.length, `${mEf}%`, `${mAvgR}m`, mDils.length, `${mAvgD}m`]; 
            }).filter(r => r[1] > 0 || r[4] > 0);
            autoTable(doc, { startY: 95, head: [['Mes', 'Recolecciones', 'Eficiencia %', 'T. Prom (Rec)', 'Diligencias', 'T. Prom (Dil)']], body: monthlyTableRows, headStyles: { fillColor: slate900, halign: 'center' }, theme: 'striped' });
        }
        doc.save(`Recolekta_Reporte_Operaciones.pdf`);
    } catch (error) { alert("Error al generar el reporte."); }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans pb-24 print-bg-white" onClick={() => setActiveInput(null)}>
      {viewingPhoto && <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 print-hide" onClick={() => setViewingPhoto(null)}><div className="relative max-w-4xl w-full flex flex-col items-center"><img src={viewingPhoto} className="max-h-[80vh] rounded-lg border border-white/20" alt="Evidencia" /><button className="mt-6 bg-white text-black px-6 py-3 rounded-full font-bold uppercase text-xs">Cerrar</button></div></div>}


     {/* MODAL DEL MAPA DE RUTAS (LAZY LOADED) */}
      {mapaModalData && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4 print-hide backdrop-blur-sm" onClick={() => setMapaModalData(null)}>
            <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-700 w-full max-w-5xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-white flex items-center gap-2"><Map className="text-blue-500"/> Trazado Óptimo de Ruta Real</h3>
                        <p className="text-slate-400 text-sm">Transportista: <span className="text-white font-bold">{mapaModalData.transportista}</span> | Fecha: <span className="text-white font-bold">{mapaModalData.fecha}</span></p>
                    </div>
                    <button onClick={() => setMapaModalData(null)} className="bg-slate-800 text-slate-400 hover:text-white p-2 rounded-full transition-colors"><X size={24}/></button>
                </div>
                
<Suspense fallback={<div className="h-[500px] flex items-center justify-center text-blue-400 bg-[#0B1120] rounded-2xl"><Loader2 className="animate-spin" size={48}/></div>}>
    <RutaOptimizada puntos={mapaModalData.points} />
</Suspense>

                <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-[#0B1120] p-3 rounded-xl border border-slate-800">
                    <span className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> Polilínea (Calle Real)</span>
                    <span className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-300 rounded-sm"></div> Checkpoints (Sucursal)</span>
                </div>
            </div>
        </div>
      )}

     {/* MODAL ADMIN */}
      {selectedAdminProfile && (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm print-hide" onClick={() => setSelectedAdminProfile(null)}>
            <div className="bg-[#151F32] p-8 rounded-[2rem] border border-slate-700 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                
                {/* ENCABEZADO DEL MODAL */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-4">
                            <div className="w-16 h-16 rounded-full border-2 border-slate-600 bg-black flex items-center justify-center overflow-hidden shadow-lg z-10">
                                {selectedAdminProfile.foto ? (
                                    <img 
                                        src={selectedAdminProfile.foto} 
                                        onClick={() => setViewingPhoto(selectedAdminProfile.foto)} 
                                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                                        title="Ver foto de perfil"
                                    />
                                ) : (
                                    <User size={24} className="text-slate-600"/>
                                )}
                            </div>
                            <div className="w-16 h-16 rounded-full border-2 border-slate-700 bg-slate-900 flex items-center justify-center overflow-hidden shadow-lg relative">
                                {selectedAdminProfile.fotoMoto ? (
                                    <img 
                                        src={selectedAdminProfile.fotoMoto} 
                                        onClick={() => setViewingPhoto(selectedAdminProfile.fotoMoto)} 
                                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                                        title="Ver herramienta de trabajo"
                                    />
                                ) : (
                                    <Bike size={20} className="text-slate-600"/>
                                )}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase leading-tight">{selectedAdminProfile.name}</h3>
                            <p className="text-[10px] text-slate-400 font-mono mb-2">{selectedAdminProfile.email || 'Sin correo vinculado'}</p>
                            <div className="flex gap-2">
                                {/* SOLUCIÓN ASIMETRÍA: inline-flex, items-center y leading-none aplicados */}
                                <span className={cn("inline-flex items-center justify-center text-[9px] font-black px-2.5 py-1.5 rounded-full uppercase tracking-widest leading-none", selectedAdminProfile.categoria === 'Coordinador' ? "bg-yellow-900/50 text-yellow-400 border border-yellow-500" : selectedAdminProfile.categoria === 'Técnico' ? "bg-slate-700 text-slate-300 border border-slate-400" : "bg-orange-900/50 text-orange-400 border border-orange-500")}>
                                    {selectedAdminProfile.categoria}
                                </span>
                                <span className="bg-indigo-900/50 text-indigo-400 border border-indigo-500 text-[9px] font-black px-2.5 py-1.5 rounded-full uppercase tracking-widest inline-flex items-center justify-center gap-1 leading-none">
                                    <Globe size={10}/> {selectedAdminProfile.zona}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setSelectedAdminProfile(null)} className="text-slate-500 hover:text-white bg-slate-800 rounded-full p-1">
                        <X size={20}/>
                    </button>
                </div>
                
                {/* GRAFICA DE EFICIENCIA */}
                <div className="bg-[#0B1120] rounded-[2rem] p-6 border border-slate-700 shadow-inner flex flex-col items-center justify-center relative mb-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest absolute top-4">Eficiencia Vital (Periodo Filtrado)</h4>
                    <div className="mt-8 -mb-4 w-full flex justify-center">
                        <PieChart width={200} height={100}>
                            <Pie data={[{ value: selectedAdminProfile.eficiencia, fill: selectedAdminProfile.eficiencia >= 95 ? '#10b981' : selectedAdminProfile.eficiencia >= 80 ? '#f59e0b' : '#ef4444' },{ value: 100 - selectedAdminProfile.eficiencia, fill: '#1f2937' }]} cx={100} cy={100} startAngle={180} endAngle={0} innerRadius={70} outerRadius={95} dataKey="value" stroke="none" />
                        </PieChart>
                    </div>
                    <div className="text-center z-10">
                        <span className={cn("text-4xl font-black", selectedAdminProfile.eficiencia >= 95 ? "text-green-400" : selectedAdminProfile.eficiencia >= 80 ? "text-yellow-400" : "text-red-400")}>
                            {selectedAdminProfile.eficiencia}%
                        </span>
                    </div>
                </div>
                
                {/* ESTADÍSTICAS */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center shadow-sm">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Muestras a Tiempo</p>
                        <span className="text-2xl font-black text-green-400">{selectedAdminProfile.onTime}</span>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center shadow-sm">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Muestras con Demora</p>
                        <span className={cn("text-2xl font-black", selectedAdminProfile.delayed > 0 ? "text-red-400" : "text-slate-300")}>{selectedAdminProfile.delayed}</span>
                    </div>
                    <div className="col-span-2 bg-indigo-900/20 p-4 rounded-xl border border-indigo-800/40 flex justify-between items-center shadow-sm">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Total Diligencias (Todo tipo)</span>
                        <span className="text-xl font-black text-white">{selectedAdminProfile.totalTrips}</span>
                    </div>
                </div>
                
            </div>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm print-hide">
            <div className="bg-[#151F32] p-8 rounded-[2rem] border border-slate-700 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-white flex items-center gap-2"><Edit3 size={20} className="text-blue-500"/> Editar Registro</h3><button onClick={() => setEditingItem(null)}><X className="text-slate-500 hover:text-white" size={24}/></button></div>
                <div className="space-y-4">
                    {editingItem.collectionName === 'registros_produccion' && (<><div><label className="text-[10px] font-bold text-slate-400 uppercase">Sucursal</label><input name="sucursal" value={editFormData.sucursal || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] font-bold text-slate-400 uppercase">H. Llegada (01-12)</label><input name="hLlegada" value={editFormData.hLlegada || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">M. Llegada (00-59)</label><input name="mLlegada" value={editFormData.mLlegada || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] font-bold text-slate-400 uppercase">H. Salida (01-12)</label><input name="hSalida" value={editFormData.hSalida || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">M. Salida (00-59)</label><input name="mSalida" value={editFormData.mSalida || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Observaciones</label><textarea name="observaciones" value={editFormData.observaciones || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold h-20 resize-none"/></div></>)}
                    {editingItem.collectionName === 'registros_combustible' && (<><div><label className="text-[10px] font-bold text-slate-400 uppercase">Galones</label><input name="galones" type="number" step="0.1" value={editFormData.galones || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Costo ($)</label><input name="costo" type="number" step="0.01" value={editFormData.costo || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Kilometraje</label><input name="kilometraje" type="number" value={editFormData.kilometraje || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div></>)}
                    {editingItem.collectionName === 'registros_mantenimiento' && (<><div><label className="text-[10px] font-bold text-slate-400 uppercase">Taller</label><input name="taller" value={editFormData.taller || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Costo ($)</label><input name="costo" type="number" step="0.01" value={editFormData.costo || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Detalle</label><textarea name="descripcion" value={editFormData.descripcion || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold h-24 resize-none"/></div></>)}
                    {editingItem.collectionName === 'registros_horas_extras' && (<><div><label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Real</label><input name="fecha" type="date" value={editFormData.fecha || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] font-bold text-slate-400 uppercase">Hora Inicio</label><input name="horaInicio" type="time" value={editFormData.horaInicio || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Hora Fin</label><input name="horaFin" type="time" value={editFormData.horaFin || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] font-bold text-slate-400 uppercase">Total Horas</label><input name="horasCalculadas" type="number" step="0.1" value={editFormData.horasCalculadas || ''} onChange={handleEditFormChange} className="w-full p-3 bg-purple-900/30 border border-purple-500 rounded-xl text-purple-400 font-black outline-none focus:border-purple-400 transition-all"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Motivo</label><input name="motivo" value={editFormData.motivo || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div></div></>)}
                    <button onClick={handleUpdate} className="w-full py-4 bg-green-600 rounded-xl font-black uppercase text-sm shadow-lg hover:bg-green-500 flex justify-center items-center gap-2"><CheckCircle2 size={18}/> Guardar Cambios</button>
                </div>
            </div>
        </div>
      )}

      {showAvisoModal && (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm print-hide">
            <div className="bg-[#151F32] p-8 rounded-[2rem] border border-slate-700 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-white flex items-center gap-2"><Send size={20} className="text-blue-500"/> Enviar Aviso a Equipo</h3><button onClick={() => setShowAvisoModal(false)}><XCircle className="text-slate-500 hover:text-white" size={24}/></button></div>
                <div className="space-y-4">
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Aviso</label><select value={avisoForm.tipo} onChange={e=>setAvisoForm({...avisoForm, tipo: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"><option value="info">ℹ️ Informativo (Solo lectura)</option><option value="confirm">✅ Requiere Confirmación</option></select></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Destinatario</label><select value={avisoForm.para} onChange={e=>setAvisoForm({...avisoForm, para: e.target.value})} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold"><option value="Todos">Toda la Flota (Global)</option>{(catalogs.transportistas[catalogCountry] || []).map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Mensaje Corto</label><textarea value={avisoForm.mensaje} onChange={e=>setAvisoForm({...avisoForm, mensaje: e.target.value})} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold h-24 resize-none" placeholder="Escribe el recordatorio o alerta aquí..."/></div>
                    <button onClick={async () => { if(!avisoForm.mensaje) return; await addDoc(collection(db, 'alertas_flota'), {...avisoForm, createdAt: new Date().toISOString()}); setAvisoForm({mensaje: '', para: 'Todos', tipo: 'info'}); alert("Aviso enviado a la plataforma."); }} className="w-full py-4 bg-blue-600 rounded-xl font-black uppercase text-sm shadow-lg hover:bg-blue-500 flex items-center justify-center gap-2"><Send size={16}/> Enviar Mensaje</button>
                </div>
                <div className="mt-8 border-t border-slate-700 pt-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 flex items-center gap-2"><MessageSquare size={14}/> Avisos Activos y Respuestas</h4>
                    <div className="space-y-3">
                        {alertasData.length === 0 ? <p className="text-xs text-slate-600 italic">No hay avisos activos en la calle.</p> : null}
                        {alertasData.map(a => (
                            <div key={a.id} className="p-3 bg-[#0B1120] rounded-xl border border-slate-700">
                                <div className="flex justify-between items-start text-slate-400 mb-2"><span className={cn("text-[9px] font-black px-2 py-0.5 rounded-md", a.tipo==='confirm'?"bg-red-900/30 text-red-400":"bg-blue-900/30 text-blue-400")}>{a.para} ({a.tipo==='confirm'?'Con Respuesta':'Info'})</span><button onClick={()=>handleDelete('alertas_flota', a.id)} className="text-slate-600 hover:text-red-500 transition-colors" title="Borrar Aviso de la calle"><Trash2 size={14}/></button></div>
                                <p className="text-xs text-white font-bold mb-3">{a.mensaje}</p>
                                {a.respuestas && a.respuestas.length > 0 && (<div className="space-y-1.5 bg-[#151F32] p-2 rounded-lg border border-slate-800"><p className="text-[8px] font-bold text-slate-500 uppercase">Confirmaciones recibidas:</p>{a.respuestas.map((r, i) => (<div key={i} className="text-[10px] flex items-center gap-2"><span className="font-black text-white">{r.usuario.split(' ')[0]}:</span><span className={cn("font-bold px-1.5 py-0.5 rounded", r.respuesta==='Enterado'?"bg-blue-900/50 text-blue-400":r.respuesta==='En camino'?"bg-orange-900/50 text-orange-400":"bg-green-900/50 text-green-400")}>{r.respuesta}</span></div>))}</div>)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}
      <nav className="bg-[#151F32] border-b border-slate-800 px-4 md:px-8 py-4 sticky top-0 z-50 flex justify-between items-center shadow-lg print-hide">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white border border-slate-700"><Bike size={18}/></div><h1 className="text-lg font-black tracking-tighter text-white">Recolekta <span className="text-green-500">OS</span></h1></div>
        <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end"><span className="text-white text-[10px] font-bold uppercase tracking-widest">{currentUser.email}</span><span className="text-slate-500 text-[8px] uppercase">{appMode.toUpperCase()}</span></div>
            <button onClick={logout} className="bg-red-900/20 text-red-400 border border-red-900/50 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all">Salir</button>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto p-4 md:p-6 print-p-0">
        {appMode === 'user' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
              <div className="lg:col-span-2">
              {userAlerts.length > 0 && (
                  <div className="mb-6 space-y-3 animate-in slide-in-from-top-4">
                      {userAlerts.map((alerta, idx) => (
                          <div key={idx} className={cn("p-4 rounded-xl flex flex-col gap-3 shadow-lg border", alerta.type === 'kpi_danger' ? "bg-red-900/50 border-red-500 text-white" : alerta.type === 'turno' ? "bg-purple-900/30 border-purple-500 text-purple-200" : alerta.type === 'maint' ? "bg-yellow-900/30 border-yellow-500 text-yellow-200" : alerta.tipo === 'confirm' ? "bg-red-900/30 border-red-500 text-red-200" : "bg-blue-900/30 border-blue-500 text-blue-200")}>
                              <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className={cn("p-2 rounded-lg shrink-0", alerta.type==='kpi_danger'?"bg-red-600 text-white":"bg-black/30")}>{alerta.type === 'turno' ? <Clock size={20} className="text-purple-400"/> : (alerta.type === 'maint' || alerta.type === 'kpi_danger') ? <Wrench size={20} className={alerta.type==='kpi_danger'?"":"text-yellow-400"}/> : <Bell size={20} className={alerta.tipo === 'confirm' ? "text-red-400" : "text-blue-400"}/>}</div><div><h4 className="font-black uppercase text-xs opacity-80 mb-0.5">{alerta.title}</h4><p className="text-sm font-bold leading-tight">{alerta.msg}</p></div></div>{alerta.tipo !== 'confirm' && (<button onClick={(e) => { e.preventDefault(); dismissAlert(alerta); }} className="text-slate-400 hover:text-white shrink-0"><X size={18}/></button>)}</div>
                              {alerta.tipo === 'confirm' && (<div className="flex gap-2 justify-end mt-1 border-t border-white/10 pt-3"><button onClick={(e) => { e.preventDefault(); dismissAlert(alerta, 'Enterado'); }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-[10px] shadow-md uppercase transition-all">Enterado</button><button onClick={(e) => { e.preventDefault(); dismissAlert(alerta, 'En camino'); }} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-[10px] shadow-md uppercase transition-all">En camino</button><button onClick={(e) => { e.preventDefault(); dismissAlert(alerta, 'Listo'); }} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-[10px] shadow-md uppercase transition-all flex items-center gap-1"><Check size={12}/> Listo</button></div>)}
                          </div>
                      ))}
                  </div>
              )}
              <div className="flex gap-2 mb-6 p-1 bg-[#151F32] rounded-xl w-full border border-slate-800 overflow-x-auto md:flex-wrap md:overflow-visible custom-scrollbar">
                 <button onClick={() => setUserView('ruta')} className={cn("shrink-0 px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", userView === 'ruta' ? "bg-green-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Bike size={16}/> Ruta</button>
                 <button onClick={() => setUserView('combustible')} className={cn("shrink-0 px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", userView === 'combustible' ? "bg-orange-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Fuel size={16}/> Combustible</button>
                 <button onClick={() => setUserView('agenda')} className={cn("shrink-0 px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", userView === 'agenda' || userView === 'mantenimiento' ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Calendar size={16}/> Horarios</button>
                 <button onClick={() => setUserView('extras')} className={cn("shrink-0 px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", userView === 'extras' ? "bg-purple-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Clock size={16}/> H. Extra</button>
                 <button onClick={() => setUserView('perfil')} className={cn("shrink-0 px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", userView === 'perfil' ? "bg-pink-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Award size={16}/> Mi Perfil</button>
              </div>

              {userView === 'ruta' ? (
                 <div className="bg-[#151F32] p-6 md:p-10 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-500 to-emerald-400"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-slate-800 pb-4">
                        <h2 className="text-xl font-black flex items-center gap-3 text-white"><ClipboardList className="text-green-500"/> Registro de Ruta</h2>
                        {/* 🔥 SELECTOR INTELIGENTE DE ESTATUS */}
                        <div className="flex items-center gap-2 bg-[#0B1120] p-1.5 rounded-xl border border-slate-700 shadow-inner">
                            <div className={cn("w-2.5 h-2.5 rounded-full ml-2", (userProfile.estatus === 'Standby') ? "bg-green-500 animate-pulse" : (userProfile.estatus === 'En Ruta') ? "bg-blue-500" : "bg-slate-500")}></div>
                            <select 
                                value={userProfile.estatus || 'Inactivo'} 
                                onChange={async (e) => await setDoc(doc(db, "usuarios_perfiles", currentUser.email), { estatus: e.target.value }, { merge: true })}
                                className={cn("bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer pr-2", (userProfile.estatus === 'Standby') ? "text-green-400" : (userProfile.estatus === 'En Ruta') ? "text-blue-400" : "text-slate-500")}
                            >
                                <option value="Inactivo" className="bg-slate-900 text-slate-400">⚫ OFFLINE / FIN DE TURNO</option>
                                <option value="Esperando Asignacion de Ruta" className="bg-slate-900 text-green-400">🟢 DISPONIBLE (SEDE)</option>
                                <option value="En Ruta" className="bg-slate-900 text-blue-400">🔵 EN RUTA</option>
                                <option value="Almuerzo" className="bg-slate-900 text-yellow-400">🟡 HORA DE ALMUERZO</option>
                            </select>
                        </div>
                    </div>
                    <form onSubmit={async (e) => { 
                        e.preventDefault(); 
                        if(!isOperating) return alert("Debes INICIAR LA OPERACIÓN primero.");
                        if(!imageFile) return alert("FOTO REQUERIDA PARA FINALIZAR"); 
                        if (!(catalogs.transportistas[activeUserCountry] || catalogs.transportistas || []).includes(form.recolector)) return alert("TRANSPORTISTA NO VÁLIDO"); 
                        
                        // 🟢 CANDADO 2: Doble verificación antes de guardar en la base de datos
                        const sucursalesValidas = catalogs.sucursales[activeUserCountry] || [];
                        if (!sucursalesValidas.includes(form.sucursal)) {
                            return alert("⚠️ ERROR: La sucursal fue alterada y no es válida. Selecciona una de la lista.");
                        }
                        setIsUploading(true); 
                        try { 
                            const now = new Date();
                            let h = now.getHours(); let m = String(now.getMinutes()).padStart(2, '0'); let p = h >= 12 ? 'PM' : 'AM';
                            h = h % 12; h = h ? h : 12; h = String(h).padStart(2, '0');
                            const finalForm = { ...form, hSalida: h, mSalida: m, pSalida: p };
                            const storageRef = ref(storage, `evidencias/${Date.now()}_${form.recolector.replace(/\s+/g, '_')}`); 
                            await uploadBytes(storageRef, imageFile); 
                            const photoURL = await getDownloadURL(storageRef); 
                            const isP = PRINCIPAL_KEYWORDS.some(k=>form.tipo.toLowerCase().includes(k)); 
                            const safeTransit = isNaN(Number(transitTimeMins)) || transitTimeMins === null ? 0 : Number(transitTimeMins);
                            const safeWait = isNaN(Number(liveWaitMins)) || liveWaitMins === null ? 0 : Number(liveWaitMins);
                            await addDoc(collection(db, "registros_produccion"), { 
                                ...finalForm, 
                                tiempo: safeWait, 
                                tiempoTransito: safeTransit, 
                                createdAt: new Date().toISOString(), 
                                categoria: isP ? "Principal" : "Secundaria", 
                                fotoData: photoURL || '', 
                                month: new Date().getMonth() + 1, 
                                usuarioEmail: currentUser.email || '',
                                ubicacion: gpsLocation || 'Sin GPS',
                                ubicacionAnterior: previousGps || null
                            }); 
                            alert("¡Operación y Recorrido Registrados Exitosamente! ✅"); 
                           //await setDoc(doc(db, "usuarios_perfiles", currentUser.email), { estatusLive: "DISPONIBLE", ultimaActividad: new Date().toISOString() }, { merge: true }).catch(()=>{});
                            setForm(prev => ({...prev, sucursal: '', observaciones: ''})); 
                            setImagePreview(null); setImageFile(null); setIsOperating(false); setOperationStartTime(null); setLiveWaitMins(0); setGpsLocation(null); setTransitTimeMins(0); setPreviousGps(null);
                        } catch(e) { console.error(e); alert("Error de conexión al enviar."); } finally { setIsUploading(false); } 
                    }} className="space-y-5">
                      <div className="relative"><label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Responsable</label><div className="relative"><input type="text" className={cn("w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase text-slate-400 cursor-not-allowed")} value={form.recolector} disabled /><User size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500"/></div></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><select className="p-4 bg-[#0B1120] rounded-2xl font-bold outline-none border-2 border-slate-800 focus:border-blue-500 text-slate-300" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} disabled={isOperating} required><option value="">-- DILIGENCIA --</option>{(catalogs.diligencias[activeUserCountry] || catalogs.diligencias || []).map(d => <option key={d} value={d}>{d}</option>)}</select><select className="p-4 bg-[#0B1120] rounded-2xl font-bold outline-none border-2 border-slate-800 focus:border-indigo-500 text-slate-300" value={form.area} onChange={e => setForm({...form, area: e.target.value})} disabled={isOperating} required><option value="">-- ÁREA --</option>{(catalogs.areas[activeUserCountry] || catalogs.areas || []).map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                      <div className="relative" onClick={e => e.stopPropagation()}><input type="text" placeholder="SUCURSAL A LA QUE LLEGASTE..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase focus:border-blue-500 outline-none text-white placeholder-slate-600" value={form.sucursal} onChange={e => handleInput('sucursal', e.target.value)} onFocus={() => setActiveInput('sucursal')} disabled={isOperating} required />{activeInput === 'sucursal' && form.sucursal.length > 0 && !isOperating && (<div className="absolute z-30 w-full mt-2 bg-[#1F2937] shadow-xl rounded-xl border border-slate-700 max-h-40 overflow-y-auto">{(catalogs.sucursales[activeUserCountry] || catalogs.sucursales || []).filter(t=>t && typeof t === 'string' && t.toUpperCase().includes(form.sucursal.toUpperCase())).map(s => (<div key={s} onClick={() => { setForm({...form, sucursal: s}); setActiveInput(null); }} className="p-3 hover:bg-slate-700 cursor-pointer text-xs font-bold border-b border-slate-800 text-slate-300">{s}</div>))}</div>)}</div>
                      <div className="bg-[#0B1120] p-6 rounded-[2rem] text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-inner border border-slate-800">
                          {!isOperating ? (
                              <button type="button" onClick={handleStartOperation} disabled={isGettingGps} className="w-full sm:w-auto flex-1 py-4 bg-green-600 hover:bg-green-500 rounded-xl font-black uppercase text-sm shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2">
                                  {isGettingGps ? <Loader2 className="animate-spin" size={20}/> : <MapPin size={20}/>}
                                  {isGettingGps ? 'OBTENIENDO GPS...' : 'INICIAR OPERACIÓN'}
                              </button>
                          ) : (
                              <div className="w-full sm:w-auto flex-1 py-4 bg-blue-900/20 border border-blue-500/50 rounded-xl font-black uppercase text-sm text-blue-400 flex items-center justify-center gap-2">
                                  <Clock className="animate-pulse" size={20}/> OPERACIÓN EN CURSO...
                              </div>
                          )}
                          <div className="text-center sm:border-l border-slate-800 sm:pl-6 flex flex-col justify-center min-w-[120px]">
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Minutos de Espera</p>
                              <h4 className={cn("text-5xl font-black tabular-nums transition-colors duration-500", liveWaitMins > 5 ? "text-orange-400" : "text-green-400")}>
                                  {Math.floor(liveWaitMins)}m
                              </h4>
                          </div>
                      </div>
                      <textarea placeholder="OBSERVACIONES..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600 resize-none h-24" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} disabled={!isOperating && form.recolector !== ''}/>
                      <div className="grid grid-cols-2 gap-4">
                          <label className={cn("col-span-1 p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all font-bold uppercase text-[9px]", isOperating ? "bg-[#151F32] border-blue-500 text-blue-400 cursor-pointer hover:bg-blue-900/20" : "bg-[#0B1120] border-slate-700 text-slate-600 cursor-not-allowed")}>
                              <Camera size={24}/><p>{imageFile ? 'FOTO LISTA' : 'TOMA FOTO TESTIGO'}</p><input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFile} disabled={!isOperating} />
                          </label>
                          <button type="button" onClick={() => downloadReport()} className="col-span-1 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-xs text-slate-300 uppercase flex flex-col items-center justify-center gap-2 hover:bg-slate-700 transition-all"><Download size={24}/>Mi Reporte Hoy</button>
                      </div>
                      <button type="submit" disabled={!isOperating || !imagePreview || isUploading || isCompressing} className={cn("w-full py-5 rounded-2xl font-black text-sm shadow-xl transition-all uppercase flex items-center justify-center gap-2", isOperating && imagePreview && !isUploading && !isCompressing ? "bg-red-600 text-white hover:bg-red-500 hover:shadow-red-900/30 hover:-translate-y-1" : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700")}>
                          {isCompressing ? <Loader2 className="animate-spin" size={20}/> : (isUploading ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>)}
                          {isCompressing ? 'PROCESANDO FOTO...' : (isUploading ? 'ENVIANDO...' : 'FINALIZAR Y ENVIAR')}
                      </button>
                    </form>
                 </div>
              ) : userView === 'combustible' ? (<FuelModule currentUser={currentUser} sysConfig={sysConfig} />) : userView === 'extras' ? (<OvertimeModule currentUser={currentUser} history={transportistaOtData} sysConfig={sysConfig} />) : userView === 'mantenimiento' ? (<MaintenanceModule currentUser={currentUser} onBack={() => setUserView('agenda')} sysConfig={sysConfig} />) : userView === 'perfil' ? (
                 <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-rose-400"></div>
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8 border-b border-slate-800 pb-8">
                        <div className="flex gap-4">
                            <div className="relative group"><div className="w-28 h-28 rounded-full border-4 border-slate-700 overflow-hidden bg-[#0B1120] flex items-center justify-center shadow-2xl">{userProfile.foto ? <img src={userProfile.foto} alt="Perfil" className="w-full h-full object-cover" /> : <User size={48} className="text-slate-500" />}</div><label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><UploadCloud size={20} className="text-white mb-1"/><span className="text-[8px] font-black uppercase text-white tracking-widest text-center leading-tight">Subir<br/>Perfil</span><input type="file" className="hidden" accept="image/*" onChange={handleProfilePhotoUpload} /></label></div>
                            <div className="relative group"><div className="w-28 h-28 rounded-2xl border-4 border-slate-700 overflow-hidden bg-[#0B1120] flex items-center justify-center shadow-2xl">{userProfile.fotoMoto ? <img src={userProfile.fotoMoto} alt="Moto" className="w-full h-full object-cover" /> : <Bike size={48} className="text-slate-500" />}</div><label className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Camera size={20} className="text-white mb-1"/><span className="text-[8px] font-black uppercase text-white tracking-widest text-center leading-tight">Subir<br/>Moto</span><input type="file" className="hidden" accept="image/*" onChange={handleMotoPhotoUpload} /></label></div>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-1">{form.recolector}</h2><p className="text-xs font-bold text-slate-500 mb-2">{currentUser.email}</p>
                            <div className="flex items-center gap-2 justify-center md:justify-start">
                                <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 shadow-lg", userProfile.categoria === 'Coordinador' ? "bg-yellow-900/40 border-yellow-500 text-yellow-400" : userProfile.categoria === 'Técnico' ? "bg-slate-700/50 border-slate-400 text-slate-300" : "bg-orange-900/40 border-orange-600 text-orange-400")}>{userProfile.categoria === 'Coordinador' ? <Award size={20}/> : userProfile.categoria === 'Técnico' ? <ShieldCheck size={20}/> : <Star size={20}/>}<span className="font-black uppercase text-xs tracking-widest">{userProfile.categoria || 'Operador'}</span></div>
                                <div className="bg-indigo-900/50 border border-indigo-600 text-indigo-400 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2"><Map size={16}/><span className="font-black uppercase text-xs tracking-widest">{userProfile.zona || 'Sin Asignar'}</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* GRÁFICA DE PASTEL (Izquierda) */}
                        <div className="bg-[#0B1120] rounded-[2rem] p-6 border border-slate-700 shadow-inner flex flex-col items-center justify-center relative">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest absolute top-6">Eficiencia del Mes</h4>
                            <div className="mt-8 -mb-10 w-full flex justify-center">
                                <PieChart width={220} height={120}>
                                    <Pie data={[{ value: gamificationStats.eficiencia, fill: gamificationStats.eficiencia >= 95 ? '#10b981' : gamificationStats.eficiencia >= 80 ? '#f59e0b' : '#ef4444' }, { value: 100 - gamificationStats.eficiencia, fill: '#1f2937' }]} cx={110} cy={110} startAngle={180} endAngle={0} innerRadius={80} outerRadius={110} dataKey="value" stroke="none" />
                                </PieChart>
                            </div>
                            <div className="text-center z-10">
                                <span className={cn("text-5xl font-black", gamificationStats.eficiencia >= 95 ? "text-green-400" : gamificationStats.eficiencia >= 80 ? "text-yellow-400" : "text-red-400")}>{gamificationStats.eficiencia}%</span>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Tu Meta es 95%</p>
                            </div>
                        </div>

                        {/* LAS 3 TARJETAS (Derecha) */}
                        <div className="space-y-4">
                            {/* 🔥 1. HORAS EXTRAS (CORTE OFICIAL) 🔥 */}
                            <div className="bg-purple-900/20 border border-purple-800/40 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-purple-600 rounded-xl text-white shadow-lg"><Clock size={20}/></div>
                                    <div>
                                        <h4 className="text-[10px] font-black text-purple-400 uppercase">Horas Extras (Corte)</h4>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                                            {sysConfig.heInicio ? `${formatLocalDate(sysConfig.heInicio)} al ${formatLocalDate(sysConfig.heFin)}` : 'Sin fechas definidas'}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-2xl font-black text-white">{gamificationStats.totalOT}h</span>
                            </div>

                            {/* 🔥 2. TOTAL VIAJES 🔥 */}
                            <div className="bg-blue-900/20 border border-blue-800/40 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3"><div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg"><Target size={20}/></div><div><h4 className="text-[10px] font-black text-blue-400 uppercase">Total Viajes (Mes)</h4><p className="text-xs text-slate-300 font-bold">Recolecciones y Entregas</p></div></div>
                                <span className="text-2xl font-black text-white">{gamificationStats.totalOps}</span>
                            </div>
                            {/* 🔥 3. META DE SECUNDARIAS 🔥 */}
                            <div className="bg-indigo-900/20 border border-indigo-800/40 p-4 rounded-2xl">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3"><div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg"><ListChecks size={16}/></div><div><h4 className="text-[10px] font-black text-indigo-400 uppercase">Meta Secundarias</h4><p className="text-[9px] text-slate-400 font-bold uppercase">Mínimo {sysConfig.metaSecundarias || 60} al mes</p></div></div>
                                    <span className="text-xl font-black text-white">
                                        {gamificationStats.totalSecundarias || 0}
                                        <span className="text-sm text-slate-500"> / {sysConfig.metaSecundarias || 60}</span>
                                    </span>
                                </div>
                                <div className="w-full bg-slate-900 rounded-full h-2.5 border border-slate-700 overflow-hidden">
                                    <div className={cn("h-2.5 rounded-full transition-all duration-1000", (gamificationStats.totalSecundarias || 0) >= Number(sysConfig.metaSecundarias || 60) ? "bg-green-500" : "bg-indigo-500")} style={{ width: `${Math.min(((gamificationStats.totalSecundarias || 0) / Number(sysConfig.metaSecundarias || 60)) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              ) : (<div className="space-y-4"><button onClick={() => setUserView('mantenimiento')} className="w-full bg-yellow-600/90 border-b-4 border-yellow-800 text-white py-4 rounded-2xl font-black uppercase shadow-xl hover:bg-yellow-500 transition-all flex items-center justify-center gap-3"><div className="bg-black/20 p-2 rounded-full"><Wrench size={20}/></div><span>Registrar Mantenimiento</span></button><ScheduleModule currentUser={currentUser} userName={USUARIOS_EMAIL[currentUser.email] || currentUser.email} /></div>)}
              </div>
              <div className="space-y-6">
                 <div className="bg-[#151F32] p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">{userMetrics.label === 'HOY (GLOBAL)' ? 'EFICIENCIA DIARIA (HOY)' : `EFICIENCIA: ${userMetrics.label}`}</p>
                    <h4 className="text-6xl font-black text-green-400 mb-2 leading-none">{userMetrics.ef}%</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase italic">{userMetrics.count > 0 ? `Basado en ${userMetrics.count} Registros de Hoy` : 'Esperando datos del día...'}</p>
                    <TrendingUp className="absolute -right-6 -bottom-6 text-slate-800 opacity-50" size={180}/>
                 </div>
              </div>
           </div>
        )}
        {appMode === 'admin' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in print-p-0">
             <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-800 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 print-hide">
                <div className="w-full xl:w-auto overflow-hidden">
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white mb-4 xl:mb-0">Centro de Control</h2>
                    <div className="flex gap-2 mt-0 xl:mt-4 bg-[#0B1120] p-1 rounded-xl w-full border border-slate-800 overflow-x-auto md:flex-wrap md:overflow-visible custom-scrollbar">
                        <button onClick={()=>setAdminSection('ops')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection==='ops'?"bg-green-600 text-white shadow-md":"text-slate-500 hover:text-slate-300")}><ShieldCheck size={14}/> Operaciones</button>
                        <button onClick={()=>setAdminSection('fleet')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection==='fleet'?"bg-orange-600 text-white shadow-md":"text-slate-500 hover:text-slate-300")}><Bike size={14}/> Flota</button>
                        <button onClick={()=>setAdminSection('hr')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection==='hr'?"bg-purple-600 text-white shadow-md":"text-slate-500 hover:text-slate-300")}><Clock size={14}/> Control HE</button>
                        <button onClick={()=>setAdminSection('agenda')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection==='agenda'?"bg-blue-600 text-white shadow-md":"text-slate-500 hover:text-slate-300")}><Calendar size={14}/> Horarios</button>
                        <button onClick={()=>setAdminSection('bi')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection==='bi'?"bg-indigo-600 text-white shadow-md":"text-slate-500 hover:text-slate-300")}><PieChartIcon size={14}/> Analítica</button>
                        <button onClick={()=>setAdminSection('catalogos')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection==='catalogos'?"bg-slate-200 text-black shadow-md":"text-slate-500 hover:text-slate-300")}><Settings size={14}/> Catálogos</button>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center w-full xl:w-auto">
                  <div className="flex flex-wrap bg-[#0B1120] p-2 rounded-xl border border-slate-800 items-center gap-2 w-full sm:w-auto">
                    <Filter size={16} className="text-slate-500 hidden sm:block"/>
                    <select value={filterZona} onChange={e=>setFilterZona(e.target.value)} className="bg-transparent font-black text-indigo-400 text-[10px] uppercase outline-none px-2 border-l border-slate-700 pl-2 flex-1 sm:flex-none cursor-pointer" title="Filtrar por Zona/Región">
                        <option value="all" className="bg-slate-900 text-white">🌎 Todas las Zonas</option>
                        {catalogs.paises.map(p => <option key={p} value={p} className="bg-indigo-900 text-white">📍 {p} (PAÍS COMPLETO)</option>)}
                        <optgroup label="ZONAS ESPECÍFICAS" className="bg-slate-800 text-slate-400">{Object.values(catalogs.zonas || {}).flat().map(z => <option key={z} value={z} className="bg-slate-900 text-white">  ↳ {z}</option>)}</optgroup>
                    </select>
                    <input type="date" value={filterSpecificDate} onChange={e=>setFilterSpecificDate(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 text-slate-300 border-l border-slate-700 pl-2 cursor-pointer flex-1 sm:flex-none" title="Filtrar por Día Exacto" />
                    <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none">{availableYears.map(y => <option key={y} value={y} className="bg-slate-900">{y}{y==='2025'?' (CSV)':''}</option>)}</select>
                    <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none">{['all',1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m} className="bg-slate-900">{m==='all'?'Año':'Mes '+m}</option>)}</select>
                    <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 max-w-[120px] text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none"><option value="all" className="bg-slate-900">Todos</option>{Object.values(catalogs.transportistas || {}).flat().map(u=><option key={u} value={u} className="bg-slate-900">{u}</option>)}</select>
                    <select value={filterSucursal} onChange={e=>setFilterSucursal(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 max-w-[120px] text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none"><option value="all" className="bg-slate-900">Sucursal</option>{Object.values(catalogs.sucursales || {}).flat().map(s=><option key={s} value={s} className="bg-slate-900">{s}</option>)}</select>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <button onClick={() => setShowAvisoModal(true)} className="bg-blue-600 text-white px-4 py-3 md:py-2 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center justify-center gap-2 hover:bg-blue-500 transition-all flex-1 sm:flex-none"><Bell size={14}/> Aviso</button>
                      <button onClick={exportToCSV} className="bg-green-600 text-white px-4 py-3 md:py-2 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center justify-center gap-2 hover:bg-green-700 transition-all flex-1 sm:flex-none"><FileSpreadsheet size={14}/> Excel</button>
                      <button onClick={() => downloadReport()} className="bg-white text-black px-4 py-3 md:py-2 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center justify-center gap-2 hover:bg-slate-200 transition-all flex-1 sm:flex-none"><Download size={14}/> PDF</button>
                    {isFetchingHistory && <span className="text-[10px] text-blue-400 font-bold uppercase flex items-center gap-2 animate-pulse"><Loader2 size={14} className="animate-spin"/> Descargando Historial...</span>}
                  </div>
                </div>
             </div>
             {adminSection === 'catalogos' && (
                <div className="animate-in fade-in space-y-8">
                   {/* 1. GESTIÓN DE USUARIOS */}
                   <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-violet-500"></div>
                       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                           <h3 className="text-xl font-black text-white flex items-center gap-3"><Users className="text-pink-500"/> Gestión de Usuarios, Rangos y Zonas</h3>
                           <div className="flex items-center gap-2 bg-[#0B1120] p-2 rounded-xl border border-slate-700">
                               <Filter size={14} className="text-slate-500"/>
                               <select value={filterUserTableZone} onChange={e=>setFilterUserTableZone(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-300 uppercase outline-none cursor-pointer">
                                   <option value="all">Todas las Zonas</option>
                                   {Object.values(catalogs.zonas || {}).flat().map(z => <option key={z} value={z}>{z}</option>)}
                               </select>
                           </div>
                       </div>
                       <div className="overflow-x-auto bg-[#0B1120] rounded-2xl border border-slate-700 shadow-inner">
                           <table className="w-full text-left">
                               <thead className="text-[10px] font-black text-slate-400 uppercase bg-slate-800/50"><tr><th className="px-5 py-4">Transportista</th><th className="px-5 py-4">Correo Acceso</th><th className="px-5 py-4">Foto</th><th className="px-5 py-4 w-48">Rango / Categoría</th><th className="px-5 py-4 w-48">🌍 Zona Asignada</th></tr></thead>
                               <tbody className="text-xs font-bold divide-y divide-slate-800 text-slate-300">
                                   {Object.values(catalogs.transportistas || {}).flat()
                                     .filter(name => !['ADMINISTRADOR', 'SUPERVISOR', 'NUEVO ADMIN', 'USUARIO PRUEBA'].includes(name))
                                     .filter(name => filterUserTableZone === 'all' || getUserZone(name) === filterUserTableZone)
                                     .map(name => {
                                       const email = Object.keys(USUARIOS_EMAIL).find(key => USUARIOS_EMAIL[key] === name);
                                       const profile = perfilesUsuarios[email] || {}; 
                                       return (
                                           <tr key={name} className="hover:bg-slate-800/30">
                                               <td className="px-5 py-4 text-white font-black">{name}</td>
                                               <td className="px-5 py-4 font-mono text-slate-400 text-[11px]">{email || <span className="text-red-500 italic">No vinculado</span>}</td>
                                               <td className="px-5 py-4"><div className="w-10 h-10 rounded-full border-2 border-slate-700 bg-black flex items-center justify-center overflow-hidden shadow-md">{profile.foto ? <img src={profile.foto} className="w-full h-full object-cover"/> : <User size={18} className="text-slate-600"/>}</div></td>
                                               <td className="px-5 py-4">{email ? (<div className="relative"><select value={profile.categoria || 'Operador'} onChange={(e) => handleAssignCategory(email, e.target.value)} className={cn("w-full p-2 bg-[#151F32] border border-slate-700 rounded text-[10px] uppercase outline-none", (profile.categoria||'Operador') === 'Coordinador' ? "text-yellow-400" : (profile.categoria||'Operador') === 'Técnico' ? "text-slate-300" : "text-orange-400")}><option value="Operador">Operador</option><option value="Técnico">Técnico</option><option value="Coordinador">Coordinador</option></select></div>) : '--'}</td>
                                               <td className="px-5 py-4">{email ? (<div className="relative"><select value={profile.zona || 'Sin Asignar'} onChange={(e) => handleAssignZone(email, e.target.value)} className="w-full p-2 bg-[#151F32] border border-indigo-900 rounded text-[10px] uppercase outline-none text-indigo-300"><option value="Sin Asignar">Sin Asignar</option>{Object.values(catalogs.zonas || {}).flat().map(z => <option key={z} value={z}>{z}</option>)}</select></div>) : '--'}</td>
                                           </tr>
                                       );
                                   })}
                               </tbody>
                           </table>
                       </div>
                   </div>               
                   {/* 2. EDITOR DE CATÁLOGOS */}
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                       <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                           <h3 className="text-xl font-black text-white flex items-center gap-2"><ListChecks className="text-blue-500"/> Editor de Catálogos</h3>
                           <select value={catalogCountry} onChange={e=>setCatalogCountry(e.target.value)} className="bg-[#0B1120] text-sm font-black text-white uppercase outline-none p-2 rounded-xl">{catalogs.paises.map(p => <option key={p} value={p}>{p}</option>)}</select>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="bg-indigo-900/10 p-5 rounded-2xl border border-indigo-800/40 md:col-span-2"><h4 className="text-xs font-bold text-indigo-300 uppercase mb-4">Zonas Operativas de {catalogCountry}</h4><div className="flex gap-2"><input type="text" value={newCatalogItems.zonas || ''} onChange={e=>setNewCatalogItems({...newCatalogItems, zonas: e.target.value})} className="flex-1 p-3 bg-[#151F32] border border-indigo-700/50 rounded-xl text-white text-[10px]"/><button onClick={() => handleAddCatalogItem('zonas')} className="bg-indigo-600 px-4 rounded-xl text-white"><Plus size={16}/></button></div><div className="flex flex-wrap gap-2 mt-4">{(catalogs.zonas[catalogCountry] || []).map(item => (<span key={item} className="bg-indigo-950/50 text-indigo-200 px-3 py-1.5 rounded-lg text-[9px] flex items-center gap-2">{item} <X size={12} className="cursor-pointer text-indigo-500" onClick={() => handleRemoveCatalogItem('zonas', item, catalogCountry)}/></span>))}</div></div>
                           <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-700"><h4 className="text-xs font-bold text-slate-300 uppercase mb-4">Transportistas ({catalogCountry})</h4><div className="flex gap-2"><input type="text" value={newCatalogItems.transportistas} onChange={e=>setNewCatalogItems({...newCatalogItems, transportistas: e.target.value.toUpperCase()})} className="flex-1 p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white text-[10px]"/><button onClick={() => handleAddCatalogItem('transportistas')} className="bg-blue-600 px-4 rounded-xl text-white"><Plus size={16}/></button></div><div className="flex flex-wrap gap-2 mt-4">{(catalogs.transportistas[catalogCountry] || []).map(item => (<span key={item} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] flex items-center gap-2">{item} <X size={12} className="cursor-pointer" onClick={() => handleRemoveCatalogItem('transportistas', item)}/></span>))}</div></div>
                           <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-700"><h4 className="text-xs font-bold text-slate-300 uppercase mb-4">Sucursales ({catalogCountry})</h4><div className="flex gap-2"><input type="text" value={newCatalogItems.sucursales} onChange={e=>setNewCatalogItems({...newCatalogItems, sucursales: e.target.value})} className="flex-1 p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white text-[10px]"/><button onClick={() => handleAddCatalogItem('sucursales')} className="bg-indigo-600 px-4 rounded-xl text-white"><Plus size={16}/></button></div><div className="flex flex-wrap gap-2 mt-4">{(catalogs.sucursales[catalogCountry] || []).map(item => (<span key={item} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] flex items-center gap-2">{item} <X size={12} className="cursor-pointer" onClick={() => handleRemoveCatalogItem('sucursales', item)}/></span>))}</div></div>
                           <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-700"><h4 className="text-xs font-bold text-slate-300 uppercase mb-4">Tipos de Diligencia ({catalogCountry})</h4><div className="flex gap-2"><input type="text" value={newCatalogItems.diligencias} onChange={e=>setNewCatalogItems({...newCatalogItems, diligencias: e.target.value})} className="flex-1 p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white text-[10px]"/><button onClick={() => handleAddCatalogItem('diligencias')} className="bg-green-600 px-4 rounded-xl text-white"><Plus size={16}/></button></div><div className="flex flex-wrap gap-2 mt-4">{(catalogs.diligencias[catalogCountry] || []).map(item => (<span key={item} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] flex items-center gap-2">{item} <X size={12} className="cursor-pointer text-slate-500" onClick={() => handleRemoveCatalogItem('diligencias', item)}/></span>))}</div></div>
                           <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-700"><h4 className="text-xs font-bold text-slate-300 uppercase mb-4">Áreas ({catalogCountry})</h4><div className="flex gap-2"><input type="text" value={newCatalogItems.areas} onChange={e=>setNewCatalogItems({...newCatalogItems, areas: e.target.value})} className="flex-1 p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white text-[10px]"/><button onClick={() => handleAddCatalogItem('areas')} className="bg-orange-600 px-4 rounded-xl text-white"><Plus size={16}/></button></div><div className="flex flex-wrap gap-2 mt-4">{(catalogs.areas[catalogCountry] || []).map(item => (<span key={item} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] flex items-center gap-2">{item} <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => handleRemoveCatalogItem('areas', item)}/></span>))}</div></div>
                       </div>
                   </div>
                   
                   {/* 3. NUEVO PANEL: CONFIGURACIÓN DE METAS (KPIs) */}
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                       <h3 className="text-xl font-black text-white flex items-center gap-2 mb-6 border-b border-slate-800 pb-4"><Target className="text-green-500"/> Configuración de Metas Operativas (KPIs)</h3>
                       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                           <div><label className="text-[10px] font-bold text-slate-400 uppercase">Min. Espera (Metro)</label><input type="number" value={sysConfig.metaMetro || 5} onChange={e=>setSysConfig({...sysConfig, metaMetro: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div>
                           <div><label className="text-[10px] font-bold text-slate-400 uppercase">Min. Espera (Interior)</label><input type="number" value={sysConfig.metaInterior || 10} onChange={e=>setSysConfig({...sysConfig, metaInterior: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div>
                           <div><label className="text-[10px] font-bold text-slate-400 uppercase">Min. Espera (Frontera)</label><input type="number" value={sysConfig.metaFrontera || 20} onChange={e=>setSysConfig({...sysConfig, metaFrontera: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div>
                           <div><label className="text-[10px] font-bold text-slate-400 uppercase">Meta Secundarias (Mes)</label><input type="number" value={sysConfig.metaSecundarias || 60} onChange={e=>setSysConfig({...sysConfig, metaSecundarias: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div>
                       </div>
                       <button onClick={handleSaveConfig} className="mt-6 w-full md:w-auto bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all shadow-md flex items-center justify-center gap-2"><Save size={16}/> Aplicar Nuevas Metas Globales</button>
                   </div>
                </div>
             )}

             {adminSection === 'bi' && (
                <div className="animate-in fade-in space-y-6 print-hide">
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-5"><Globe size={150} className="text-blue-500"/></div>
                       <h3 className="text-xl font-black text-white flex items-center gap-2 mb-2"><Globe className="text-blue-400"/> Tabla de Posiciones Global</h3>
                       <p className="text-xs text-slate-400 mb-6">Comparativa de rendimiento entre países y sub-zonas operativas.</p>
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
                           <div className="bg-[#0B1120] rounded-2xl border border-slate-700 overflow-hidden shadow-inner"><h4 className="bg-blue-900/20 p-4 text-xs font-black text-blue-300 uppercase tracking-widest border-b border-blue-900/50 flex items-center gap-2"><Trophy size={14}/> Comparativa por Países</h4><table className="w-full text-left"><thead className="text-[9px] font-bold text-slate-500 uppercase bg-slate-900/50"><tr><th className="px-4 py-3">País</th><th className="px-4 py-3 text-center">Eficiencia</th><th className="px-4 py-3 text-center">Viajes Vitales</th><th className="px-4 py-3 text-center">Total Viajes</th></tr></thead><tbody className="text-xs font-bold text-slate-300 divide-y divide-slate-800">{regionalMetrics.paises.length===0&&<tr><td colSpan="4" className="text-center py-4 text-slate-600">Sin datos</td></tr>}{regionalMetrics.paises.map((p, i) => (<tr key={p.nombre} className="hover:bg-slate-800/50"><td className="px-4 py-3 flex items-center gap-2"><span className="text-[10px] bg-slate-800 w-5 h-5 flex items-center justify-center rounded text-slate-400">{i+1}</span> {p.nombre}</td><td className="px-4 py-3 text-center"><span className={cn("px-2 py-1 rounded-md text-[10px] font-black", p.eficiencia >= 95 ? "bg-green-900/30 text-green-400" : p.eficiencia >= 80 ? "bg-yellow-900/30 text-yellow-400" : "bg-red-900/30 text-red-400")}>{p.eficiencia}%</span></td><td className="px-4 py-3 text-center text-blue-300">{p.vitales}</td><td className="px-4 py-3 text-center">{p.total}</td></tr>))}</tbody></table></div>
                           <div className="bg-[#0B1120] rounded-2xl border border-slate-700 overflow-hidden shadow-inner"><h4 className="bg-indigo-900/20 p-4 text-xs font-black text-indigo-300 uppercase tracking-widest border-b border-indigo-900/50 flex items-center gap-2"><MapPin size={14}/> Rendimiento por Sub-Zonas</h4><table className="w-full text-left"><thead className="text-[9px] font-bold text-slate-500 uppercase bg-slate-900/50"><tr><th className="px-4 py-3">Zona / Región</th><th className="px-4 py-3 text-center">Eficiencia</th><th className="px-4 py-3 text-center">Viajes Vitales</th><th className="px-4 py-3 text-center">Total Viajes</th></tr></thead><tbody className="text-xs font-bold text-slate-300 divide-y divide-slate-800">{regionalMetrics.zonas.length===0&&<tr><td colSpan="4" className="text-center py-4 text-slate-600">Sin datos</td></tr>}{regionalMetrics.zonas.map((z, i) => (<tr key={z.nombre} className="hover:bg-slate-800/50"><td className="px-4 py-3 flex items-center gap-2"><span className="text-[10px] bg-slate-800 w-5 h-5 flex items-center justify-center rounded text-slate-400">{i+1}</span> <span className="truncate max-w-[120px]" title={z.nombre}>{z.nombre}</span></td><td className="px-4 py-3 text-center"><span className={cn("px-2 py-1 rounded-md text-[10px] font-black", z.eficiencia >= 95 ? "bg-green-900/30 text-green-400" : z.eficiencia >= 80 ? "bg-yellow-900/30 text-yellow-400" : "bg-red-900/30 text-red-400")}>{z.eficiencia}%</span></td><td className="px-4 py-3 text-center text-blue-300">{z.vitales}</td><td className="px-4 py-3 text-center">{z.total}</td></tr>))}</tbody></table></div>
                       </div>
                   </div>
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 flex justify-between items-center"><div><h3 className="text-xl font-black text-white flex items-center gap-2"><PieChartIcon className="text-indigo-500"/> Inteligencia de Negocios (YoY)</h3><p className="text-xs text-slate-400">Comparativa Anual Mensualizada ({biMetrics.yPrev} vs {biMetrics.yCurrent})</p></div></div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><TrendingUp size={16} className="text-green-500"/> Eficiencia Operativa (%)</h4><p className="text-[9px] text-slate-500 mb-2 italic">💡 Para ver meses anteriores, usa el filtro de mes y presiona "🔄 Histórico DB".</p><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={biMetrics.dataYoY}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} /><YAxis domain={[0, 100]} hide /><Tooltip contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff'}} /><Legend iconType="circle" wrapperStyle={{fontSize: '10px'}}/><Line type="monotone" name={`Año ${biMetrics.yPrev}`} dataKey={`ef${biMetrics.yPrev}`} stroke="#64748b" strokeWidth={2} dot={false} /><Line type="monotone" name={`Año ${biMetrics.yCurrent}`} dataKey={`ef${biMetrics.yCurrent}`} stroke="#10b981" strokeWidth={4} connectNulls={true} /></LineChart></ResponsiveContainer></div></div>
                       <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><Fuel size={16} className="text-orange-500"/> Inversión Combustible ($)</h4><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={biMetrics.dataYoY}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} /><Tooltip cursor={{fill: '#1f2937'}} contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff'}} /><Legend iconType="circle" wrapperStyle={{fontSize: '10px'}}/><Bar name={`Año ${biMetrics.yPrev}`} dataKey={`fuel${biMetrics.yPrev}`} fill="#64748b" radius={[4, 4, 0, 0]} /><Bar name={`Año ${biMetrics.yCurrent}`} dataKey={`fuel${biMetrics.yCurrent}`} fill="#f97316" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
                       <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl lg:col-span-2"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><Wrench size={16} className="text-yellow-500"/> Costos de Mantenimiento Taller ($)</h4><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={biMetrics.dataYoY}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} /><Tooltip cursor={{fill: '#1f2937'}} contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff'}} /><Legend iconType="circle" wrapperStyle={{fontSize: '10px'}}/><Bar name={`Año ${biMetrics.yPrev}`} dataKey={`maint${biMetrics.yPrev}`} fill="#64748b" radius={[4, 4, 0, 0]} /><Bar name={`Año ${biMetrics.yCurrent}`} dataKey={`maint${biMetrics.yCurrent}`} fill="#eab308" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
                   </div>
                </div>
             )}
             {adminSection === 'ops' && (
                <div className="animate-in fade-in print-hide">
                   <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden mb-6">
                       <h3 className="text-xl font-black text-white flex items-center gap-3 mb-6"><PieChartIcon className="text-green-500"/> Estado Visual de Eficiencia Individual</h3>
                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                           {adminDashboardMetrics.transportistasStats.map(stat => (
                               <div key={stat.name} onClick={() => setSelectedAdminProfile(stat)} className={cn("bg-[#0B1120] p-4 rounded-2xl border flex flex-col items-center justify-between gap-2 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg", stat.isDanger ? "border-red-500/50 shadow-md shadow-red-900/20" : "border-slate-700 hover:border-slate-500")}>
                                   
                                   {/* 🔥 ESTATUS BADGE Y CHISMOSO 🔥 */}
                                   <div className="w-full flex justify-between items-center mb-1">
                                       <span className={cn("text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-widest", stat.estatus === 'EN RUTA' ? "bg-green-900/50 text-green-400" : stat.estatus === 'INACTIVO' ? "bg-red-900/50 text-red-400" : stat.estatus === 'DESCONECTADO' ? "bg-slate-800 text-slate-400" : "bg-orange-900/50 text-orange-400")}>
                                           {stat.estatus}
                                       </span>
                                       {stat.inactivoMin > 0 && (
                                           <span className={cn("text-[10px] font-black flex items-center gap-1", stat.isDanger ? "text-red-400 animate-pulse" : "text-slate-500")}>
                                               <Clock size={12}/> {stat.inactivoMin}m
                                           </span>
                                       )}
                                   </div>

                                   <span className="text-[11px] font-black text-white uppercase truncate w-full">{stat.name.split(' ')[0]} {stat.name.split(' ')[1] || ''}</span>
                                   
                                   <SmallGauge value={stat.eficiencia} size={70} />
                                   
                                   {/* 🔥 BARRA DE DILIGENCIAS SECUNDARIAS 🔥 */}
                                   <div className="w-full mt-2">
                                       <div className="flex justify-between text-[8px] font-bold text-slate-500 mb-1">
                                           <span>VITALES: {stat.totalMuestras}</span>
                                           <span>SECUNDARIAS: {stat.secundarias}</span>
                                       </div>
                                       <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                                           <div style={{width: `${stat.totalTrips > 0 ? (stat.totalMuestras/stat.totalTrips)*100 : 0}%`}} className="bg-green-500 h-full"></div>
                                           <div style={{width: `${stat.totalTrips > 0 ? (stat.secundarias/stat.totalTrips)*100 : 0}%`}} className="bg-orange-500 h-full"></div>
                                       </div>
                                   </div>
                                   
                                   {/* 🔥 ÚLTIMO PUNTO VISITADO 🔥 */}
                                   <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 mt-1 truncate w-full justify-center">
                                       <MapPin size={10}/> {stat.ultimaUbicacion || 'SIN RECORRIDO HOY'}
                                   </span>
                               </div>
                           ))}
                       </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800"><p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">EFICIENCIA VITAL</p><h3 className="text-4xl font-black text-white">{metrics.efP}%</h3></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800"><p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2">EFICIENCIA SECUNDARIA</p><h3 className="text-4xl font-black text-white">{metrics.efS}%</h3></div>
                      <div className="bg-[#0B1120] p-6 rounded-[2rem] border border-slate-800"><p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-2">TOTAL VIAJES</p><h3 className="text-4xl font-black text-white">{metrics.total}</h3></div>
                   </div>
                   <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-sm border border-slate-800 mt-6">
                      <h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><TrendingUp size={16} className="text-green-500"/> Evolución Anual de Eficiencia (%)</h4>
                      <p className="text-[9px] text-slate-500 mb-2 italic">💡 Resumen global anual leído al instante desde la Nube.</p>
                      <div className="h-60 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.monthlyData}>
                               <defs><linearGradient id="colorEf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                               <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                               <YAxis hide domain={[0, 100]} />
                               <Tooltip contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff'}} itemStyle={{color: '#10b981'}} formatter={(value) => [`${value}%`, 'Eficiencia']} />
                               <Area type="monotone" dataKey="ef" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEf)" connectNulls={true} />
                            </AreaChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
                   <div className="bg-[#151F32] rounded-[2.5rem] shadow-xl border border-slate-800 p-6 mt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
    <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest flex items-center gap-2"><ShieldCheck className="text-green-500" size={18}/> Bitácora de Operación Reciente (Detalle)</h4>
    <div className="flex gap-2">
        <button onClick={handleSyncToCloud} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-lg" title="Forzar Robot a leer todo el mes"><RefreshCw size={14}/> Sincronizar Nube</button>
        <button onClick={abrirMapaDeRuta} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-lg"><Map size={14}/> Ver Mapa de Ruta Diaria</button>
    </div></div>
    <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Transportista</th><th className="px-4 py-3">Punto</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th><th className="px-4 py-3">Espera</th><th className="px-4 py-3 text-center">Tipo</th><th className="px-4 py-3">Obs.</th><th className="px-4 py-3 text-center">Foto</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead>
    <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
    {metrics.rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((r, i) => (
                                <tr key={r.id || i} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 text-slate-300 font-bold">{getStrictDateString(r.createdAt)}</td>
                                    <td className="px-4 py-3 text-white">{r.recolector}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white">{r.sucursal}</span>
                                            {r.tiempoTransito > 0 && (<span className="text-[9px] text-blue-400 font-bold flex items-center gap-1 mt-0.5" title="Tiempo de viaje desde la última parada"><Bike size={10}/> Tránsito: {r.tiempoTransito}m</span>)}
                                            {r.ubicacion && r.ubicacion !== 'Sin GPS' && (<a href={r.ubicacionAnterior ? `https://www.google.com/maps/dir/?api=1&origin=${r.ubicacionAnterior}&destination=${r.ubicacion}` : `https://www.google.com/maps/search/?api=1&query=${r.ubicacion}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[9px] font-bold mt-0.5"><MapPin size={10} /> {r.ubicacionAnterior ? 'Ver Ruta Trazada' : 'Ver Ubicación'}</a>)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{r.hLlegada && r.mLlegada ? `${r.hLlegada}:${r.mLlegada} ${r.pLlegada || ''}` : '--'}</td>
                                    <td className="px-4 py-3 text-slate-500">{r.hSalida && r.mSalida ? `${r.hSalida}:${r.mSalida} ${r.pSalida || ''}` : '--'}</td>
                                    <td className={cn("px-4 py-3", r.tiempo > 5 ? "text-orange-400" : "text-green-400")}>{r.tiempo}m</td>
                                    <td className="px-4 py-3 text-center"><span className={cn("px-2 py-0.5 rounded-md text-[9px] border font-bold uppercase", r.categoria==="Principal"?"bg-indigo-900/30 border-indigo-900 text-indigo-300":"bg-orange-900/30 border-orange-900 text-orange-300")}>{r.categoria === "Principal" ? "Vital" : "Secundaria"}</span></td>
                                    <td className="px-4 py-3 text-xs italic text-slate-500 truncate max-w-[150px]" title={r.observaciones}>{r.observaciones || '--'}</td>
                                    <td className="px-4 py-3 text-center">{r.fotoData && r.fotoData.startsWith('http') ? <a href={r.fotoData} target="_blank" rel="noreferrer" className="inline-flex justify-center items-center bg-blue-900/30 text-blue-400 w-8 h-8 rounded-lg border border-blue-900"><ExternalLink size={14}/></a> : r.fotoData ? <img src={r.fotoData} className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-600 hover:border-white transition-all" onClick={()=>setViewingPhoto(r.fotoData)} alt="evidencia"/> : <span className="text-slate-700">-</span>}</td>
                                    <td className="px-4 py-3 flex items-center justify-center gap-2">
                                        {filterYear !== '2025' && (<><button onClick={() => openEditModal({...r, hLlegada: r.hLlegada || '', mLlegada: r.mLlegada || '', pLlegada: r.pLlegada || 'AM', hSalida: r.hSalida || '', mSalida: r.mSalida || '', pSalida: r.pSalida || 'AM'}, 'registros_produccion')} className="text-blue-400 hover:text-blue-200"><Edit3 size={16}/></button><button onClick={() => handleDelete('registros_produccion', r.id)} className="text-red-500 hover:text-red-300"><Trash2 size={16}/></button></>)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {/* 🔥 CONTROLES DE PAGINACIÓN REAL */}
                    <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between print-hide">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, metrics.rows.length)} de {metrics.rows.length} viajes
                            </span>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 shadow-md">
                                    <ChevronLeft size={14} /> Anterior
                                </button>
                                <span className="bg-[#0B1120] text-slate-300 px-4 py-2 rounded-lg text-[10px] font-black border border-slate-700">
                                    Pág. {currentPage} de {Math.ceil(metrics.rows.length / itemsPerPage) || 1}
                                </span>
                                <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage >= Math.ceil(metrics.rows.length / itemsPerPage)} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 shadow-md">
                                    Siguiente <ChevronRight size={14} />
                                </button>
                            </div>
                       </div>
                    </div>
                   </div>
                </div>
             )}
         {adminSection === 'fleet' && (
                <div className="animate-in fade-in space-y-6 print-hide">
                   
                   {/* 1. CORTE OPERATIVO */}
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3"><div className="p-3 bg-orange-900/30 rounded-xl text-orange-400"><Settings size={24}/></div><div><h3 className="text-sm font-black text-white uppercase">Corte Operativo de Flota (Combustible/Taller)</h3><p className="text-[10px] text-slate-400">Define el periodo activo para tu presupuesto.</p></div></div>
                        <div className="flex gap-2 w-full md:w-auto"><input type="date" value={sysConfig.flotaInicio || ''} onChange={e=>setSysConfig({...sysConfig, flotaInicio: e.target.value})} className="p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold text-[10px] flex-1"/><input type="date" value={sysConfig.flotaFin || ''} onChange={e=>setSysConfig({...sysConfig, flotaFin: e.target.value})} className="p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold text-[10px] flex-1"/><button onClick={handleSaveConfig} className="bg-orange-600 hover:bg-orange-500 text-white px-4 rounded-xl font-bold text-[10px] uppercase transition-all shadow-md">Fijar</button></div>
                   </div>

                   {/* 2. KPI CARDS (Dólares y Galones) */}
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} className="text-green-500"/></div><p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-2">COMB. (MES)</p><h3 className="text-3xl font-black text-white">${fleetMetrics.totalFuelCost}</h3></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Wrench size={80} className="text-yellow-500"/></div><p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-2">TALLER (MES)</p><h3 className="text-3xl font-black text-white">${fleetMetrics.totalMaintCost}</h3></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Fuel size={80} className="text-orange-500"/></div><p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2">GALONES</p><h3 className="text-3xl font-black text-white">{fleetMetrics.totalGalones}</h3></div>
                      <div className="bg-[#0B1120] p-6 rounded-[2rem] border border-slate-800 flex flex-col justify-center"><p className="text-[10px] font-bold text-slate-500 uppercase">GASTO TOTAL FLOTA</p><h3 className="text-3xl font-black text-white">${(parseFloat(fleetMetrics.totalFuelCost) + parseFloat(fleetMetrics.totalMaintCost)).toFixed(2)}</h3></div>
                   </div>

                   {/* 3. GRÁFICA A ANCHO COMPLETO */}
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                        <h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-orange-500"/> Costo Operativo por Transportista ($)</h4>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={fleetMetrics.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} interval={0} angle={-45} textAnchor="end" height={60} />
                                    <Tooltip cursor={{fill: '#1f2937'}} contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', color: '#fff'}} />
                                    <Legend verticalAlign="top" height={36} />
                                    <Bar dataKey="fuel" name="Combustible" stackId="a" fill="#ea580c" />
                                    <Bar dataKey="maint" name="Taller" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                   </div>

                   {/* 4. TABLAS LADO A LADO LIBERADAS (Mes completo) */}
                   <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* TABLA COMBUSTIBLE */}
                        <div className="bg-[#151F32] p-4 rounded-[2rem] border border-slate-800 flex flex-col h-[400px]">
                            <h4 className="font-bold text-slate-300 text-xs uppercase mb-2 flex items-center gap-2 shrink-0"><Fuel size={14} className="text-orange-500"/> Cargas de Combustible</h4>
                            <div className="overflow-y-auto h-full pb-2 custom-scrollbar">
                                <table className="w-full text-left relative">
                                    <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] sticky top-0 z-10 shadow-sm"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Galones</th><th className="px-4 py-3">Costo</th><th className="px-4 py-3">Km</th><th className="px-4 py-3 text-center">Ticket</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead>
                                    <tbody className="text-[10px] text-slate-400 divide-y divide-slate-800">
                                        {fuelData.filter(d => checkDate(d.fecha) && (filterUser==='all' || (USUARIOS_EMAIL[d.usuario]||'').includes(filterUser))).map((r) => (<tr key={r.id} className="hover:bg-slate-800/50"><td className="px-2 py-3">{formatLocalDate(r.fecha)}</td><td className="px-2 py-3 text-white">{USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-2 py-3">{r.galones}</td><td className="px-2 py-3 text-green-400">${r.costo}</td><td className="px-2 py-3">{r.kilometraje}</td><td className="px-2 py-3 text-center">{r.foto && <button onClick={()=>setViewingPhoto(r.foto)} className="bg-orange-900/50 text-orange-400 px-2 py-1 rounded border border-orange-900 text-[9px] uppercase hover:bg-orange-900">Ver</button>}</td><td className="px-2 py-3 flex justify-center gap-2"><button onClick={()=>openEditModal(r, 'registros_combustible')}><Edit size={14} className="text-blue-500 hover:text-blue-300"/></button><button onClick={()=>handleDelete('registros_combustible', r.id)}><Trash2 size={14} className="text-red-500 hover:text-red-300"/></button></td></tr>))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        {/* TABLA TALLER */}
                        <div className="bg-[#151F32] p-4 rounded-[2rem] border border-slate-800 flex flex-col h-[400px]">
                            <h4 className="font-bold text-slate-300 text-xs uppercase mb-2 flex items-center gap-2 shrink-0"><Wrench size={14} className="text-yellow-500"/> Servicios de Taller</h4>
                            <div className="overflow-y-auto h-full pb-2 custom-scrollbar">
                                <table className="w-full text-left relative">
                                    <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] sticky top-0 z-10 shadow-sm"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Taller</th><th className="px-4 py-3">Costo</th><th className="px-4 py-3 text-center">Evidencia</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead>
                                    <tbody className="text-[10px] text-slate-400 divide-y divide-slate-800">
                                        {maintData.filter(d => checkDate(d.fecha) && (filterUser==='all' || (USUARIOS_EMAIL[d.usuario]||'').includes(filterUser))).map((r) => (<tr key={r.id} className="hover:bg-slate-800/50"><td className="px-2 py-3">{formatLocalDate(r.fecha)}</td><td className="px-2 py-3 text-white">{USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-2 py-3 text-white">{r.tipo}</td><td className="px-2 py-3">{r.taller}</td><td className="px-2 py-3 text-yellow-400">${r.costo}</td><td className="px-2 py-3 text-center">{r.foto && <button onClick={()=>setViewingPhoto(r.foto)} className="bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded border border-yellow-900 text-[9px] uppercase hover:bg-yellow-900">Ver Foto</button>}</td><td className="px-2 py-3 flex justify-center gap-2"><button onClick={()=>openEditModal(r, 'registros_mantenimiento')}><Edit size={14} className="text-blue-500 hover:text-blue-300"/></button><button onClick={()=>handleDelete('registros_mantenimiento', r.id)}><Trash2 size={14} className="text-red-500 hover:text-red-300"/></button></td></tr>))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                   </div>
                   
                </div>
             )}
             {adminSection === 'hr' && (
                <div className="animate-in fade-in space-y-6 print-hide">
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3"><div className="p-3 bg-purple-900/30 rounded-xl text-purple-400"><Settings size={24}/></div><div><h3 className="text-sm font-black text-white uppercase">Corte de Quincena (Horas Extra)</h3><p className="text-[10px] text-slate-400">Define las fechas para la exportación y visualización del transportista.</p></div></div>
                        <div className="flex gap-2 w-full md:w-auto"><input type="date" value={sysConfig.heInicio || ''} onChange={e=>setSysConfig({...sysConfig, heInicio: e.target.value})} className="p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold text-[10px] flex-1"/><input type="date" value={sysConfig.heFin || ''} onChange={e=>setSysConfig({...sysConfig, heFin: e.target.value})} className="p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold text-[10px] flex-1"/><button onClick={handleSaveConfig} className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-xl font-bold text-[10px] uppercase transition-all shadow-md">Fijar</button></div>
                   </div>
                   <div className="flex justify-between items-center bg-[#151F32] p-6 rounded-[2rem] border border-slate-800">
                      <div><h3 className="text-2xl font-black text-white">Nómina de Horas Extras</h3><p className="text-xs text-slate-400">Mostrando el historial completo del mes actual</p></div>
                      <button onClick={exportPayrollCSV} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2 hover:bg-purple-700 transition-all" title="El Excel descargará solo la quincena configurada arriba"><FileSpreadsheet size={16}/> Exportar Excel (Quincena)</button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={100} className="text-purple-500"/></div><p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-2">HORAS EXTRAS (TODO EL MES)</p><h3 className="text-5xl font-black text-white">{hrMetrics.totalHoras} <span className="text-lg text-slate-500">hrs</span></h3><p className="text-xs text-slate-400 mt-2">Registros procesados: {hrMetrics.totalRegistros}</p></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-purple-500"/> Ranking Horas Extra (Mes)</h4><div className="space-y-3">{hrMetrics.rankingOt.slice(0,5).map((u, i) => (<div key={i} className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold text-white">{i+1}</div><span className="text-sm font-bold text-slate-300">{u.name}</span></div><div className="flex items-center gap-2"><div className="h-2 bg-purple-900 rounded-full w-24 overflow-hidden"><div className="h-full bg-purple-500" style={{width: `${(u.hours / (parseFloat(hrMetrics.totalHoras) || 1)) * 100}%`}}></div></div><span className="text-xs font-bold text-white">{u.hours}h</span></div></div>))}</div></div>
                   </div>
                   <div className="bg-[#151F32] rounded-[2.5rem] shadow-xl border border-slate-800 p-6">
                      <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest mb-6 flex items-center gap-2"><ClipboardList className="text-purple-500" size={18}/> Detalle Mensual de Horas Extras</h4>
                      <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Inicio</th><th className="px-4 py-3">Fin</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead>
                      <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                          {hrMetrics.rawData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((r, i) => (
                              <tr key={r.id} className="hover:bg-slate-800/50">
                                  <td className="px-4 py-3 text-white font-bold">{getStrictDateString(r.fecha)}</td>
                                  <td className="px-4 py-3 text-white">{USUARIOS_EMAIL[r.usuario] || r.usuario}</td>
                                  <td className="px-4 py-3">{r.horaInicio}</td>
                                  <td className="px-4 py-3">{r.horaFin}</td>
                                  <td className="px-4 py-3 text-purple-400 font-black">{r.horasCalculadas}h</td>
                                  <td className="px-4 py-3 italic text-slate-500">{r.motivo}</td>
                                  <td className="px-4 py-3 flex justify-center gap-2"><button onClick={()=>openEditModal(r, 'registros_horas_extras')}><Edit size={14} className="text-blue-500 hover:text-blue-300"/></button><button onClick={()=>handleDelete('registros_horas_extras', r.id)}><Trash2 size={14} className="text-red-500 hover:text-red-300"/></button></td>
                              </tr>
                          ))}
                      </tbody></table></div>
                      {/* 🔥 CONTROLES DE PAGINACIÓN */}
                      <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between print-hide">
                          <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                              Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, hrMetrics.rawData.length)} de {hrMetrics.rawData.length} registros
                          </span>
                          <div className="flex gap-2">
                              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 shadow-md">
                                  <ChevronLeft size={14} /> Ant.
                              </button>
                              <span className="bg-[#0B1120] text-slate-300 px-4 py-2 rounded-lg text-[10px] font-black border border-slate-700">
                                  Pág. {currentPage} de {Math.ceil(hrMetrics.rawData.length / itemsPerPage) || 1}
                              </span>
                              <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage >= Math.ceil(hrMetrics.rawData.length / itemsPerPage)} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 shadow-md">
                                  Sig. <ChevronRight size={14} />
                              </button>
                          </div>
                      </div>
                   </div>
                </div>
             )}

           {adminSection === 'agenda' && (
                <div className="animate-in fade-in">
                    <div className="bg-[#151F32] p-4 rounded-xl border border-slate-800 mb-6 flex flex-col md:flex-row items-center justify-between shadow-sm gap-4 print-hide">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Globe size={14}/> Contexto Operativo:</span>
                            <select value={catalogCountry} onChange={e=>setCatalogCountry(e.target.value)} className="bg-[#0B1120] text-blue-400 text-xs font-black uppercase px-4 py-2 rounded-lg outline-none border border-slate-700 cursor-pointer shadow-inner">
                                {catalogs.paises.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        
                        {/* 🔥 EL INTERRUPTOR MAESTRO DE PUBLICACIÓN 🔥 */}
                        <div className="flex items-center gap-3 w-full md:w-auto bg-[#0B1120] p-2 rounded-xl border border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visibilidad en App:</span>
                            <button 
                                onClick={async () => {
                                    try { await setDoc(doc(db, "configuraciones", "general"), { agendaPublicada: !(sysConfig.agendaPublicada !== false) }, { merge: true }); } catch (e) { alert("Error de conexión"); }
                                }} 
                                className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-md", sysConfig.agendaPublicada !== false ? "bg-green-600 hover:bg-green-500 text-white" : "bg-red-600 hover:bg-red-500 text-white")}
                            >
                                {sysConfig.agendaPublicada !== false ? '👁️ PÚBLICA (VISIBLE)' : '🙈 OCULTA (EN EDICIÓN)'}
                            </button>
                        </div>
                    </div>
                    <AgendaAdmin sucursalesObj={catalogs.sucursales} transportistasObj={catalogs.transportistas} countryContext={catalogCountry} />
                </div>
             )}
          </div>
        )}
        {appMode === 'supervisor' && (
           <div className="space-y-6 md:space-y-8 animate-in fade-in print-p-0">
             <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-800 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 print-hide">
                <div className="w-full xl:w-auto overflow-hidden">
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white mb-4 xl:mb-0 flex items-center gap-2"><Eye className="text-blue-500"/> Visor Operativo supervision</h2>
                    <div className="flex gap-2 mt-0 xl:mt-4 bg-[#0B1120] p-1 rounded-xl w-full border border-slate-800 overflow-x-auto md:flex-wrap md:overflow-visible custom-scrollbar">
                        <button onClick={()=>setSupervisorSection('bitacora')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all", supervisorSection==='bitacora'?"bg-blue-600 text-white shadow-md":"text-slate-500 hover:bg-slate-800")}>Bitácora</button>
                        <button onClick={()=>setSupervisorSection('combustible')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all", supervisorSection==='combustible'?"bg-orange-600 text-white shadow-md":"text-slate-500 hover:bg-slate-800")}>Combustible</button>
                        <button onClick={()=>setSupervisorSection('taller')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all", supervisorSection==='taller'?"bg-yellow-600 text-black shadow-md":"text-slate-500 hover:bg-slate-800")}>Taller</button>
                        <button onClick={()=>setSupervisorSection('agenda')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all", supervisorSection==='agenda'?"bg-purple-600 text-white shadow-md":"text-slate-500 hover:bg-slate-800")}>Horarios</button>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center w-full xl:w-auto">
                  <div className="flex flex-wrap bg-[#0B1120] p-2 rounded-xl border border-slate-800 items-center gap-2 w-full sm:w-auto">
                    <Filter size={14} className="text-slate-500 hidden sm:block"/>
                    <input type="date" value={filterSpecificDate} onChange={e=>setFilterSpecificDate(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 text-slate-300 border-l border-slate-700 pl-2 cursor-pointer flex-1 sm:flex-none" title="Filtrar por Día Exacto" />
                    <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none">{availableYears.map(y => <option key={y} value={y} className="bg-slate-900">{y}{y==='2025'?' (CSV)':''}</option>)}</select>
                    <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none"><option value="all">Toda la Flota</option>{Object.values(catalogs.transportistas || {}).flat().map(u=><option key={u} value={u} className="bg-slate-900">{u}</option>)}</select>
                    <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none"><option value="all" className="bg-slate-900">Año</option>{[1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m} className="bg-slate-900">Mes {m}</option>)}</select>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <button onClick={() => setShowAvisoModal(true)} className="bg-blue-600 text-white px-4 py-3 md:py-2 rounded-lg text-[9px] font-black uppercase hover:bg-blue-500 transition-all flex items-center gap-1 shadow-md"><Send size={12}/> AVISO</button>
                      <button onClick={() => downloadReport()} className="bg-white text-black px-4 py-3 md:py-2 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 transition-all flex items-center gap-1"><Download size={12}/> PDF</button>
                  </div>
                </div>
             </div>
             
            {supervisorSection === 'bitacora' && (
                <div className="space-y-6">
                    <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 print-hide">
                        <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest mb-4 flex items-center gap-2"><Users className="text-blue-500" size={18}/> Monitor de Estatus en Vivo</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {adminDashboardMetrics.transportistasStats.map(stat => (
                             <div key={stat.name} className={cn("px-3 py-2 rounded-xl flex items-center gap-3 border shadow-sm transition-all", stat.estatus === 'Standby' ? "bg-green-900/20 border-green-500/50" : stat.estatus === 'En Ruta' ? "bg-blue-900/20 border-blue-500/30" : stat.estatus === 'Almuerzo' ? "bg-yellow-900/20 border-yellow-500/50" : "bg-slate-800/40 border-slate-700")}>
                                    <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", stat.estatus === 'Standby' ? "bg-green-500 animate-pulse" : stat.estatus === 'En Ruta' ? "bg-blue-500" : stat.estatus === 'Almuerzo' ? "bg-yellow-500" : "bg-slate-600")}></div>
                                    <div className="flex flex-col flex-1">
                                        <span className={cn("text-[10px] font-black uppercase leading-tight", stat.estatus === 'Inactivo' ? "text-slate-500" : "text-white")}>{stat.name.split(' ')[0]}</span>
                                        <span className={cn("text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md w-fit mt-0.5", stat.estatus === 'Standby' ? "bg-green-600 text-white" : stat.estatus === 'En Ruta' ? "bg-blue-600 text-white" : stat.estatus === 'Almuerzo' ? "bg-yellow-600 text-black" : "bg-slate-700 text-slate-400")}>
                                            {stat.estatus === 'Standby' ? 'DISPONIBLE' : stat.estatus === 'En Ruta' ? 'EN RUTA' : stat.estatus === 'Almuerzo' ? 'ALMORZANDO' : 'INACTIVO'}
                                        </span>
                                    </div>
                                    
                                    {/* ⏱️ EL CHISMOSO: Solo aparece en ruta, ignorando la hora de almuerzo */}
                                    {stat.estatus === 'En Ruta' && stat.minutosInactivo !== null && (
                                        <div className="text-right">
                                            <p className="text-[7px] text-slate-500 uppercase font-bold leading-none mb-0.5">Últ. Parada</p>
                                            <span className={cn("text-[9px] font-mono font-black", stat.minutosInactivo >= 60 ? "text-red-400 animate-pulse" : "text-blue-300")}>
                                                {stat.minutosInactivo > 120 ? '+2 hrs' : `${stat.minutosInactivo}m`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* TABLA DE BITÁCORA ORIGINAL */}
                    <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 overflow-x-auto print-hide">
                       <table className="w-full text-left">
                          <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Transportista</th><th className="px-4 py-3">Punto</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th><th className="px-4 py-3">Espera</th><th className="px-4 py-3 text-center">Tipo</th><th className="px-4 py-3">Obs.</th><th className="px-4 py-3 text-center rounded-r-lg">Foto</th></tr></thead>
                          <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800 overflow-y-auto h-full custom-scrollbar">
                             {metrics.rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((r, i) => (<tr key={r.id || i} className="hover:bg-slate-800/50 transition-colors"><td className="px-4 py-3 text-slate-300 font-bold">{getStrictDateString(r.createdAt)}</td><td className="px-4 py-3 text-white">{r.recolector}</td><td className="px-4 py-3"><div className="flex flex-col"><span className="font-bold text-white">{r.sucursal}</span>{r.tiempoTransito > 0 && (<span className="text-[9px] text-blue-400 font-bold flex items-center gap-1 mt-0.5" title="Tiempo de viaje desde la última parada"><Bike size={10}/> Tránsito: {r.tiempoTransito}m</span>)}{r.ubicacion && r.ubicacion !== 'Sin GPS' && (<a href={r.ubicacionAnterior ? `https://www.google.com/maps/dir/?api=1&origin=${r.ubicacionAnterior}&destination=${r.ubicacion}` : `https://www.google.com/maps/search/?api=1&query=${r.ubicacion}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[9px] font-bold mt-0.5" title="Ver en mapa real"><MapPin size={10} /> {r.ubicacionAnterior ? 'Ver Ruta Trazada' : 'Ver Ubicación'}</a>)}</div></td><td className="px-4 py-3 text-slate-500">{r.hLlegada && r.mLlegada ? `${r.hLlegada}:${r.mLlegada} ${r.pLlegada || ''}` : '--'}</td><td className="px-4 py-3 text-slate-500">{r.hSalida && r.mSalida ? `${r.hSalida}:${r.mSalida} ${r.pSalida || ''}` : '--'}</td><td className={cn("px-4 py-3", r.tiempo > 5 ? "text-orange-400" : "text-green-400")}>{r.tiempo}m</td><td className="px-4 py-3 text-center"><span className={cn("px-2 py-0.5 rounded-md text-[9px] border font-bold uppercase", r.categoria==="Principal"?"bg-indigo-900/30 border-indigo-900 text-indigo-300":"bg-orange-900/30 border-orange-900 text-orange-300")}>{r.categoria === "Principal" ? "Vital" : "Secundaria"}</span></td><td className="px-4 py-3 text-xs italic text-slate-500 truncate max-w-[150px]" title={r.observaciones}>{r.observaciones || '--'}</td><td className="px-4 py-3 text-center">{r.fotoData && r.fotoData.startsWith('http') ? <a href={r.fotoData} target="_blank" rel="noreferrer" className="inline-flex justify-center items-center bg-blue-900/30 text-blue-400 w-8 h-8 rounded-lg border border-blue-900"><ExternalLink size={14}/></a> : r.fotoData ? <img src={r.fotoData} className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-600 hover:border-white transition-all" onClick={()=>setViewingPhoto(r.fotoData)} alt="evidencia"/> : <span className="text-slate-700">-</span>}</td></tr>))}
                          </tbody>
                       </table>
                       {/* 🔥 CONTROLES DE PAGINACIÓN REAL */}
                       <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between print-hide">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, metrics.rows.length)} de {metrics.rows.length} viajes
                            </span>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 shadow-md">
                                    <ChevronLeft size={14} /> Anterior
                                </button>
                                <span className="bg-[#0B1120] text-slate-300 px-4 py-2 rounded-lg text-[10px] font-black border border-slate-700">
                                    Pág. {currentPage} de {Math.ceil(metrics.rows.length / itemsPerPage) || 1}
                                </span>
                                <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage >= Math.ceil(metrics.rows.length / itemsPerPage)} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 shadow-md">
                                    Siguiente <ChevronRight size={14} />
                                </button>
                            </div>
                       </div>
                    </div>
                </div>
             )}

             {supervisorSection === 'combustible' && (
                <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 overflow-x-auto print-hide">
                   <table className="w-full text-left">
                      <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Galones</th><th className="px-4 py-3">Costo Total</th><th className="px-4 py-3">Km</th><th className="px-4 py-3 text-center rounded-r-lg">Ticket</th></tr></thead>
                      <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800 overflow-y-auto h-full custom-scrollbar">
                         {fuelData.filter(d => checkDate(d.fecha) && (filterUser==='all' || (USUARIOS_EMAIL[d.usuario]||'').includes(filterUser))).map((r, i) => (<tr key={r.id || i} className="hover:bg-slate-800/50"><td className="px-4 py-3">{formatLocalDate(r.fecha)}</td><td className="px-4 py-3 text-white">{USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-4 py-3">{r.galones}</td><td className="px-4 py-3 text-green-400">${r.costo}</td><td className="px-4 py-3">{r.kilometraje}</td><td className="px-4 py-3 text-center">{r.foto && <button onClick={()=>setViewingPhoto(r.foto)} className="bg-orange-900/50 text-orange-400 px-2 py-1 rounded border border-orange-900 text-[9px] uppercase hover:bg-orange-900">Ver Ticket</button>}</td></tr>))}
                      </tbody>
                   </table>
                </div>
             )}

             {supervisorSection === 'taller' && (
                <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 overflow-x-auto print-hide">
                   <table className="w-full text-left">
                      <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Taller</th><th className="px-4 py-3">Costo</th><th className="px-4 py-3 text-center rounded-r-lg">Evidencia</th></tr></thead>
                      <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800 overflow-y-auto h-full custom-scrollbar">
                         {maintData.filter(d => checkDate(d.fecha) && (filterUser==='all' || (USUARIOS_EMAIL[d.usuario]||'').includes(filterUser))).map((r, i) => (<tr key={r.id || i} className="hover:bg-slate-800/50"><td className="px-4 py-3">{formatLocalDate(r.fecha)}</td><td className="px-4 py-3 text-white">{USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-4 py-3">{r.tipo}</td><td className="px-4 py-3">{r.taller}</td><td className="px-4 py-3 text-yellow-400">${r.costo}</td><td className="px-4 py-3 text-center">{r.foto && <button onClick={()=>setViewingPhoto(r.foto)} className="bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded border border-yellow-900 text-[9px] uppercase hover:bg-yellow-900">Ver Foto</button>}</td></tr>))}
                      </tbody>
                   </table>
                </div>
             )}

             {supervisorSection === 'agenda' && (
                <div className="animate-in fade-in print-hide">
                    <div className="bg-[#151F32] p-4 rounded-xl border border-slate-800 mb-6 flex items-center justify-between shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Globe size={14}/> Contexto Operativo:</span>
                        <select value={catalogCountry} onChange={e=>setCatalogCountry(e.target.value)} className="bg-[#0B1120] text-blue-400 text-xs font-black uppercase px-4 py-2 rounded-lg outline-none border border-slate-700 cursor-pointer shadow-inner">
                            {catalogs.paises.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    {/* 🔥 AQUÍ LE DECIMOS A LA AGENDA QUE EL SUPERVISOR SOLO PUEDE VER 🔥 */}
                    <AgendaAdmin sucursalesObj={catalogs.sucursales} transportistasObj={catalogs.transportistas} countryContext={catalogCountry} readOnly={true} />
                </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
}
