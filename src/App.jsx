import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  Bike, LayoutDashboard, ClipboardList, FileSearch, TrendingUp, Clock, MapPin, 
  CheckCircle2, Database, Download, Camera, User, Lock, Calendar, Trash2, Activity, ShieldCheck, BarChart3, Filter, RefreshCw, X, ChevronRight, Layers
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  LineChart, Line, AreaChart, Area, LabelList
} from 'recharts';
import Papa from 'papaparse';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

// --- 1. CONFIGURACIÓN ---
const ADMIN_PASSWORD = "1234"; 
const firebaseConfig = {
  apiKey: "AIzaSyDwb_iRqVAPh7PI7TLVaThvBX6VPXgHbLM",
  authDomain: "recolekta-app.firebaseapp.com",
  projectId: "recolekta-app",
  storageBucket: "recolekta-app.firebasestorage.app",
  messagingSenderId: "367430492614",
  appId: "1:367430492614:web:de8a74da7db328114dd2c7",
  measurementId: "G-KB7BXRZ1QX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// LINK PÚBLICO ACTUALIZADO
const GITHUB_CSV_URL = "https://raw.githubusercontent.com/mnoeanaliza/recolekta-os/refs/heads/main/Datos.csv";

const CATALOGOS = {
  transportistas: ["ANTONIO RIVAS", "BRAYAN REYES", "CARLOS SOSA", "DAVID ALVARADO", "EDWIN FLORES", "FELIX VASQUEZ", "FLOR CARDOZA", "GIOVANNI CALLEJAS", "HILDEBRANDO MENJIVAR", "JAIRO GIL", "JASON BARRERA", "ROGELIO MAZARIEGO", "TEODORO PÉREZ", "WALTER RIVAS"],
  sucursales: ["Constitución", "Soyapango", "San Miguel", "Lourdes", "Valle Dulce", "Venecia", "San Miguel 2", "Sonsonate 1", "Puerto", "San Martín", "San Miguel 3", "Sonsonate 2", "San Gabriel", "Casco", "La Unión", "Sonsonate 3", "Cojutepeque", "Zacatecoluca", "Santa Ana", "Merliot", "Escalón", "Médica", "Santa Tecla", "Plaza Soma", "Plaza Sur", "Santa Elena", "Chalatenango", "Aguilares", "Metapán", "Marsella", "Opico", "N/A (EN RUTA)"],
  areas: ["LABORATORIO / PROCESAMIENTO", "TUVET", "Imágenes Escalón", "Centro de Distribución", "LAB. Externo", "Contabilidad", "RRHH", "Contac Center", "Empresas", "Fisioterapia", "Cuentas por cobrar", "Mercadeo", "Fidelizacion", "IT", "LOGÍSTICA / RUTA"],
  diligencias: ["Recolección de muestras", "Entrega de Muestras", "Traslado de toallas", "Traslado de reactivo", "Traslado de insumos", "Traslado de cortes", "Traslado de documentos", "Pago de aseguradora", "Pago o tramite bancario", "Tramite o diligencia extraordinaria", "INCIDENCIA EN RUTA"]
};

const RECOLECCION_STRINGS = ["recolección", "entrega", "muestras", "recepción", "recoleccion"];

export default function App() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [appMode, setAppMode] = useState('user'); 
  const [adminTab, setAdminTab] = useState('general'); 
  const [dataSource, setDataSource] = useState('live'); 
  const [liveData, setLiveData] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [form, setForm] = useState({ recolector: '', sucursal: '', area: '', tipo: '', hLlegada: '08', mLlegada: '00', pLlegada: 'AM', hSalida: '08', mSalida: '05', pSalida: 'AM', observaciones: '' });
  const [suggestions, setSuggestions] = useState({ transportistas: [], sucursales: [] });
  const [activeInput, setActiveInput] = useState(null);

  useEffect(() => {
    // Protección para Auth
    signInAnonymously(auth).catch(e => console.warn("Activa Autenticación Anónima en Firebase Console"));
    
    if (!localStorage.getItem('recolekta_tutorial_v24')) setShowWelcome(true);

    // Carga de GitHub con link directo
    setLoadingHistory(true);
    Papa.parse(GITHUB_CSV_URL, {
        download: true, header: true,
        complete: (res) => {
            const mapped = (res.data || []).map(row => ({
                recolector: String(row['Nombre de Transportista']||'').toUpperCase().trim(),
                tiempo: parseFloat(row['Minutos de espera'])||0,
                sucursal: row['Sucursal ']||'N/A',
                tipo: String(row['Diligencia realizada:']||'').toLowerCase().includes("recolección") ? "Recolección" : "Diligencia",
                month: parseInt(String(row['Marca temporal']||'').split(/[\s\/]+/)[1])||1
            })).filter(r => r.recolector !== '');
            setCsvData(mapped);
            setLoadingHistory(false);
        },
        error: () => setLoadingHistory(false)
    });

    const q = query(collection(db, "registros_produccion"), orderBy("createdAt", "desc"), limit(1000));
    const unsubscribe = onSnapshot(q, (snap) => setLiveData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const data = dataSource === 'live' ? liveData : csvData;
    const fallback = { eficiencia: 0, promRec: 0, promDil: 0, recsCount: 0, dilsCount: 0, total: 0, monthlyData: [], topSucursales: [], filteredRows: [] };
    if (!data || data.length === 0) return fallback;

    try {
      let filtered = [...data];
      if (filterMonth !== 'all') filtered = filtered.filter(d => (d.month === parseInt(filterMonth)) || (new Date(d.createdAt).getMonth() + 1 === parseInt(filterMonth)));
      if (filterUser !== 'all') filtered = filtered.filter(d => d.recolector === filterUser);

      const recs = filtered.filter(d => d.categoria === 'Recolección' || RECOLECCION_STRINGS.some(s => d.tipo?.toLowerCase().includes(s)));
      const dils = filtered.filter(d => d.categoria === 'Diligencia' || !RECOLECCION_STRINGS.some(s => d.tipo?.toLowerCase().includes(s)));
      const eficiencia = recs.length > 0 ? ((recs.filter(d => (d.tiempo || 0) <= 5).length / recs.length) * 100).toFixed(1) : 0;
      const promRec = recs.length > 0 ? (recs.reduce((a,b)=>a+(b.tiempo||0),0)/recs.length).toFixed(1) : 0;
      const promDil = dils.length > 0 ? (dils.reduce((a,b)=>a+(b.tiempo||0),0)/dils.length).toFixed(1) : 0;

      const monthlyData = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => {
        let mDocs = data.filter(d => (d.month === i+1) || (new Date(d.createdAt).getMonth() === i));
        if (filterUser !== 'all') mDocs = mDocs.filter(d => d.recolector === filterUser);
        const mRecs = mDocs.filter(d => d.categoria === 'Recolección' || RECOLECCION_STRINGS.some(s => d.tipo?.toLowerCase().includes(s)));
        const mEf = mRecs.length > 0 ? (mRecs.filter(d => (d.tiempo || 0) <= 5).length / mRecs.length) * 100 : 0;
        return { name: m, ef: parseFloat(mEf.toFixed(1)), count: mDocs.length };
      }).filter(d => d.count > 0);

      const topSucursales = Object.entries(filtered.reduce((acc, curr) => {
        if(!curr.sucursal || curr.sucursal === 'N/A') return acc;
        acc[curr.sucursal] = acc[curr.sucursal] || {t:0, c:0}; acc[curr.sucursal].t += (curr.tiempo||0); acc[curr.sucursal].c++; return acc;
      }, {})).map(([name, d]) => ({ name, time: parseFloat((d.t/d.c).toFixed(1)) })).sort((a,b)=>b.time-a.time).slice(0, 8);

      return { ...fallback, total: filtered.length, recsCount: recs.length, dilsCount: dils.length, eficiencia, promRec, promDil, monthlyData, topSucursales, filteredRows: filtered };
    } catch (e) { return fallback; }
  }, [liveData, csvData, filterMonth, filterUser, dataSource]);

  const downloadReport = () => {
    if (!metrics || metrics.total === 0) return alert("Sin datos.");
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42); doc.rect(0,0,210,45,'F');
    doc.setTextColor(255); doc.setFontSize(22); doc.text("RECOLEKTA OS", 45, 25);
    doc.setDrawColor(34, 197, 94); doc.circle(25,25,8,'S'); doc.text("R", 22.5, 27);
    doc.setTextColor(40); doc.setFontSize(14); doc.text(filterUser==='all'?"REPORTE CONSOLIDADO":"FICHA: "+filterUser, 20, 60);
    const rows = metrics.monthlyData.map(m => {
      const idx = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].indexOf(m.name);
      const mDocs = metrics.filteredRows.filter(d => (d.month === idx+1) || (new Date(d.createdAt).getMonth() === idx));
      const mRecs = mDocs.filter(d => d.categoria === 'Recolección' || RECOLECCION_STRINGS.some(s => d.tipo?.toLowerCase().includes(s)));
      const mDils = mDocs.filter(d => d.categoria === 'Diligencia' || !RECOLECCION_STRINGS.some(s => d.tipo?.toLowerCase().includes(s)));
      const mEf = mRecs.length > 0 ? ((mRecs.filter(d => (d.tiempo||0) <= 5).length / mRecs.length) * 100).toFixed(1) : 0;
      const mAvgR = mRecs.length > 0 ? (mRecs.reduce((a,b)=>a+(b.tiempo||0),0)/mRecs.length).toFixed(1) : 0;
      const mAvgD = mDils.length > 0 ? (mDils.reduce((a,b)=>a+(b.tiempo||0),0)/mDils.length).toFixed(1) : 0;
      return [m.name, mRecs.length, `${mAvgR}m`, mDils.length, `${mAvgD}m`, `${mEf}%` ];
    });
    autoTable(doc, { startY: 75, head: [['Periodo', 'N° Recs', 'Prom. Rec', 'N° Dils', 'Prom. Dil', 'Eficiencia %']], body: rows, headStyles: { fillColor: [15, 23, 42] }});
    doc.save(`Recolekta_Reporte.pdf`);
  };

  const handleAutocomplete = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val.toUpperCase() }));
    if (val.length > 0) {
      const cat = field === 'recolector' ? 'transportistas' : 'sucursales';
      setSuggestions({ ...suggestions, [cat]: CATALOGOS[cat].filter(i => i.toUpperCase().includes(val.toUpperCase())).slice(0, 6) });
      setActiveInput(field);
    } else setActiveInput(null);
  };

  const timeToMins = (h, m, p) => { let hh = parseInt(h); if (p === 'PM' && hh < 12) hh += 12; if (p === 'AM' && hh === 12) hh = 0; return hh * 60 + parseInt(m); };
  const getWait = () => { const s = timeToMins(form.hLlegada, form.mLlegada, form.pLlegada), e = timeToMins(form.hSalida, form.mSalida, form.pSalida); return (e-s)>=0?e-s:0; };

  const KPICard = ({ title, value, subtitle, icon: Icon, color }) => (
    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between relative overflow-hidden">
      <div className="relative z-10"><p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p><h3 className="text-xl md:text-2xl font-black text-slate-800">{value}</h3><p className="text-[9px] text-slate-500 font-medium">{subtitle}</p></div>
      <div className={cn("p-2 md:p-3 rounded-xl shadow-sm", color)}><Icon className="text-white" size={18} /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F7FE] text-slate-800 font-sans pb-10">
      {showWelcome && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
          <div className="bg-white max-w-md w-full rounded-[2.5rem] p-8 text-center shadow-2xl relative">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 rotate-3 shadow-lg"><Bike size={32}/></div>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">¡Ruta Iniciada!</h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">Usa esta app para tu reporte diario.</p>
            <button onClick={() => { setShowWelcome(false); localStorage.setItem('recolekta_tutorial_v24', 'true'); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center justify-center gap-3">Empezar <ChevronRight size={16}/></button>
          </div>
        </div>
      )}

      <nav className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 md:gap-3"><div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg rotate-3"><Bike size={18}/></div><h1 className="text-sm md:text-xl font-black uppercase tracking-tighter leading-none">Recolekta <span className="text-green-600">OS</span></h1></div>
        <div className="flex bg-slate-100 p-1 rounded-xl border scale-90 md:scale-100">
            <button onClick={() => setAppMode('user')} className={cn("px-4 md:px-6 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase transition-all", appMode === 'user' ? "bg-white text-slate-900 shadow-md" : "text-slate-400")}>Usuario</button>
            <button onClick={() => { const p = prompt("Clave:"); if(p===ADMIN_PASSWORD) setAppMode('admin'); }} className={cn("px-4 md:px-6 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase transition-all", appMode === 'admin' ? "bg-white text-slate-900 shadow-md" : "text-slate-400")}>Admin</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {appMode === 'user' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-2xl md:rounded-[3rem] shadow-xl border-t-[10px] border-green-500">
              <h2 className="text-xl md:text-2xl font-black mb-8 uppercase flex items-center gap-3"><ClipboardList className="text-green-500"/> Registro de Ruta</h2>
              <form onSubmit={async (e) => { e.preventDefault(); try { const isR = RECOLECCION_STRINGS.some(s=>form.tipo.toLowerCase().includes(s)); await addDoc(collection(db, "registros_produccion"), { ...form, tiempo: getWait(), createdAt: new Date().toISOString(), categoria: isR ? "Recolección" : "Diligencia" }); alert("¡Enviado!"); setForm({...form, sucursal: '', observaciones: ''}); } catch(e) {alert("Error");} }} className="space-y-6">
                <div className="relative"><label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase">Transportista</label><input type="text" placeholder="BUSCAR NOMBRE..." className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-xl md:rounded-2xl font-bold uppercase focus:border-green-500 outline-none transition-all shadow-inner" value={form.recolector} onChange={e => handleAutocomplete('recolector', e.target.value)} required />{activeInput === 'recolector' && suggestions.transportistas.length > 0 && (<div className="absolute z-30 w-full mt-1 bg-white shadow-xl rounded-xl border">{suggestions.transportistas.map(s => <div key={s} onClick={() => { setForm({...form, recolector: s}); setActiveInput(null); }} className="p-3 hover:bg-green-50 cursor-pointer text-xs font-bold border-b last:border-0">{s}</div>)}</div>)}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><select className="p-4 bg-slate-50 rounded-xl md:rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} required><option value="">-- TAREA --</option>{CATALOGOS.diligencias.map(d => <option key={d} value={d}>{d}</option>)}</select><select className="p-4 bg-slate-50 rounded-xl md:rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500" value={form.area} onChange={e => setForm({...form, area: e.target.value})} required={form.audTrans === "Sin incidencia"}><option value="">-- ÁREA --</option>{CATALOGOS.areas.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                <div className="relative"><input type="text" placeholder="SUCURSAL..." className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-xl md:rounded-2xl font-bold uppercase focus:border-blue-500 outline-none shadow-inner" value={form.sucursal} onChange={e => handleAutocomplete('sucursal', e.target.value)} required />{activeInput === 'sucursal' && suggestions.sucursales.length > 0 && (<div className="absolute z-30 w-full mt-2 bg-white shadow-xl rounded-xl border">{suggestions.sucursales.map(s => <div key={s} onClick={() => { setForm({...form, sucursal: s}); setActiveInput(null); }} className="p-3 hover:bg-blue-50 cursor-pointer text-xs font-bold border-b last:border-0">{s}</div>)}</div>)}</div>
                <div className="bg-slate-900 p-6 md:p-8 rounded-2xl md:rounded-3xl text-white flex flex-col sm:flex-row justify-around items-center gap-6"><div className="flex gap-4"><div><p className="text-[9px] font-bold text-green-400 mb-2 uppercase">Entrada</p><div className="flex gap-1"><select className="bg-slate-800 p-2 rounded-lg font-black text-sm" value={form.hLlegada} onChange={e=>setForm({...form, hLlegada:e.target.value})}>{Array.from({length: 12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select><select className="bg-green-600 p-2 rounded-lg text-[10px]" value={form.pLlegada} onChange={e=>setForm({...form, pLlegada:e.target.value})}><option>AM</option><option>PM</option></select></div></div><div><p className="text-[9px] font-bold text-orange-400 mb-2 uppercase">Salida</p><div className="flex gap-1"><select className="bg-slate-800 p-2 rounded-lg font-black text-sm" value={form.hSalida} onChange={e=>setForm({...form, hSalida:e.target.value})}>{Array.from({length: 12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select><select className="bg-orange-600 p-2 rounded-lg text-[10px]" value={form.pSalida} onChange={e=>setForm({...form, pSalida:e.target.value})}><option>AM</option><option>PM</option></select></div></div></div><div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-slate-700 w-full sm:w-auto pt-4 sm:pt-0 sm:pl-8 font-black"><p className="text-[10px] text-slate-500 uppercase leading-none mb-1">Espera</p><h4 className={cn("text-3xl md:text-5xl tracking-tighter transition-colors", getWait() > 5 ? "text-orange-400" : "text-green-400")}>{getWait()}m</h4></div></div>
                <label className="w-full p-8 bg-slate-50 border-2 border-dashed rounded-xl md:rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white transition-all text-slate-400 font-bold uppercase text-[9px] shadow-sm"><Camera size={24}/><p>Foto Obligatoria</p><input type="file" className="hidden" accept="image/*" required /></label>
                <button type="submit" className="w-full bg-slate-900 text-white py-4 md:py-6 rounded-xl md:rounded-3xl font-black text-xl shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-4 uppercase tracking-tighter">Sincronizar <CheckCircle2 size={24} className="text-green-500"/></button>
              </form>
            </div>
            <div className="space-y-6"><div className="bg-slate-900 p-8 md:p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group"><p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest leading-none">Tu Eficiencia Hoy</p><h4 className="text-5xl md:text-7xl font-black text-green-500 mb-2 leading-none">{(liveData.filter(d => d.recolector === form.recolector && (d.tiempo||0) <= 5).length / (liveData.filter(d => d.recolector === form.recolector && d.categoria === 'Recolección').length || 1) * 100).toFixed(0)}%</h4><TrendingUp className="absolute -right-10 -bottom-10 text-white opacity-5" size={200}/></div><button onClick={() => { setFilterUser(form.recolector); downloadReport(); }} className="w-full bg-white p-5 rounded-2xl border-2 text-slate-600 font-black text-[11px] uppercase flex items-center justify-center gap-3 shadow-md hover:bg-slate-50 active:scale-95 transition-all"><Download size={18}/> Mi Ficha Semanal</button></div>
          </div>
        ) : (
          /* 7. MODO ADMIN */
          <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500">
             <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-white p-6 md:p-10 rounded-2xl md:rounded-[3rem] shadow-xl border border-slate-100">
                <div><h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none">Auditoría HUB</h2><div className="flex gap-2 mt-4 md:mt-6 bg-slate-100 p-1.5 rounded-xl border shadow-inner"><button onClick={()=>setAdminTab('general')} className={cn("px-4 md:px-8 py-2 rounded-lg text-[9px] md:text-[11px] font-black uppercase transition-all", adminTab==='general'?"bg-white shadow-md text-slate-900":"text-slate-400 hover:text-slate-600")}>Panorama</button><button onClick={()=>setAdminTab('individual')} className={cn("px-4 md:px-8 py-2 rounded-lg text-[9px] md:text-[11px] font-black uppercase transition-all", adminTab==='individual'?"bg-white shadow-md text-slate-900":"text-slate-400 hover:text-slate-600")}>Individual</button></div></div>
                <div className="flex flex-wrap gap-2 md:gap-4 w-full lg:w-auto">
                   <button onClick={downloadReport} className="flex-1 lg:flex-none bg-green-600 text-white px-4 md:px-8 py-3 rounded-xl font-black text-[9px] md:text-[11px] flex items-center justify-center gap-2 shadow-lg uppercase hover:bg-green-700 transition-all"><Download size={16}/> Reporte</button>
                   <div className="flex bg-slate-50 p-1 md:p-2 rounded-xl border-2 gap-2 md:gap-4 items-center flex-1 lg:flex-none shadow-inner"><select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-transparent font-black text-[9px] md:text-[11px] uppercase outline-none px-2 shadow-sm">{['all',1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m}>{m==='all'?'Año':'Mes '+m}</option>)}</select>{adminTab === 'individual' && <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} className="bg-transparent font-black text-[9px] md:text-[11px] uppercase outline-none px-2 max-w-[100px] md:max-w-[150px] shadow-sm"><option value="all">Elegir Flota</option>{CATALOGOS.transportistas.map(u=><option key={u} value={u}>{u}</option>)}</select>}</div>
                   <button onClick={() => setDataSource(dataSource === 'live' ? 'csv' : 'live')} className={cn("px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase shadow-md flex items-center justify-center gap-2 md:gap-3 transition-all", dataSource==='live'?"bg-blue-600 text-white":"bg-green-600 text-white")}>{loadingHistory ? <RefreshCw size={14} className="animate-spin"/> : <Layers size={14}/>} {dataSource==='live'?'Historial':'Ver Live'}</button>
                </div>
             </div>

             {metrics?.total > 0 ? (
               <div className="space-y-6 md:space-y-12 animate-in slide-in-from-bottom-5 duration-700">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                   <KPICard title="Eficiencia" value={`${metrics.eficiencia}%`} subtitle="Meta 95%" icon={TrendingUp} color="bg-green-600" />
                   <KPICard title="Promedio" value={`${metrics.promRec}m`} subtitle="Muestras" icon={Clock} color="bg-blue-600" />
                   <KPICard title="Diligencias" value={metrics.dilsCount} subtitle="Volumen" icon={BarChart3} color="bg-orange-500" />
                   <KPICard title="Registros" value={metrics.total} subtitle={dataSource==='live'?'Firebase':'GitHub'} icon={Database} color="bg-slate-800" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
                   <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border h-[400px] md:h-[500px] flex flex-col transition-all hover:shadow-2xl"><h4 className="font-black text-slate-800 uppercase text-xs md:text-sm mb-8 flex items-center gap-4"><TrendingUp className="text-indigo-500" size={20}/> Evolución Operativa</h4><ResponsiveContainer width="100%" height="100%"><AreaChart data={metrics.monthlyData}><defs><linearGradient id="colorEf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} /><YAxis domain={[0, 100]} hide /><Tooltip/><Area type="monotone" dataKey="ef" stroke="#6366f1" strokeWidth={5} fillOpacity={1} fill="url(#colorEf)" dot={{r:6, fill:'#6366f1', strokeWidth:4, stroke:'#fff'}}/></AreaChart></ResponsiveContainer></div>
                   <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-sm border h-[400px] md:h-[500px] flex flex-col transition-all hover:shadow-2xl"><h4 className="font-black text-slate-800 uppercase text-xs md:text-sm mb-8 flex items-center gap-4"><MapPin className="text-red-500" size={20}/> Sucursales Críticas</h4><ResponsiveContainer width="100%" height="100%"><BarChart data={metrics.topSucursales} layout="vertical" margin={{right: 40}}><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={80} tick={{fontSize: 9, fontWeight: 'bold'}} /><Tooltip/><Bar dataKey="time" fill="#ef4444" radius={[0, 8, 8, 0]}><LabelList dataKey="time" position="right" style={{fontSize:'10px',fontWeight:'bold',fill:'#ef4444'}} formatter={(v)=>`${v}m`}/></Bar></BarChart></ResponsiveContainer></div>
                </div>
                <div className="bg-white rounded-2xl md:rounded-[4rem] shadow-xl border overflow-hidden">
                   <div className="p-6 md:p-10 border-b bg-slate-50/50 flex justify-between items-center"><div className="flex items-center gap-4 md:gap-6"><ShieldCheck className="text-green-500" size={24}/><h4 className="font-black text-slate-800 uppercase text-xs md:text-sm tracking-widest leading-none">Matriz de Cumplimiento Logístico</h4></div></div>
                   <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead className="bg-slate-50 text-[10px] md:text-[12px] font-black uppercase text-slate-400"><tr><th className="px-6 md:px-12 py-6">Periodo</th><th className="text-center">Recolecciones</th><th className="text-center font-bold text-green-600">Eficiencia %</th><th className="text-center">Dils Adicionales</th><th className="text-right px-6 md:px-12">Calificación</th></tr></thead><tbody className="divide-y">{metrics.monthlyData.map((r, i) => (<tr key={i} className="hover:bg-slate-50/80 transition-all group"><td className="px-6 md:px-12 py-6 font-black text-slate-800 text-xs md:text-sm tracking-tight">{r.name}</td><td className="text-center font-bold text-slate-400 text-xs md:text-sm">{metrics.filteredRows.filter(d=> (d.month === i+1 || new Date(d.createdAt).getMonth() === i) && (d.categoria==='Recolección' || RECOLECCION_STRINGS.some(s=>d.tipo?.toLowerCase().includes(s)))).length}</td><td className="text-center font-black text-green-600 text-lg md:text-2xl">{r.ef}%</td><td className="text-center font-bold text-orange-600 text-xs md:text-sm">{metrics.filteredRows.filter(d=> (d.month === i+1 || new Date(d.createdAt).getMonth() === i) && (d.categoria==='Diligencia' || !RECOLECCION_STRINGS.some(s=>d.tipo?.toLowerCase().includes(s)))).length}</td><td className="text-right px-6 md:px-12"><span className={cn("px-4 py-1.5 rounded-full text-[8px] md:text-[10px] font-black uppercase shadow-lg border-2", r.ef >= 95 ? "bg-green-500 text-white border-green-400" : "bg-white text-orange-600 border-orange-100")}>{r.ef >= 95 ? 'LOGRADA' : 'BAJO META'}</span></td></tr>))}</tbody></table></div>
                </div>
               </div>
             ) : (
                <div className="bg-white p-20 md:p-60 rounded-[2.5rem] md:rounded-[8rem] border-4 md:border-[10px] border-dashed border-slate-50 text-center flex flex-col items-center gap-12 animate-pulse"><div className="w-24 h-24 md:w-40 md:h-40 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 shadow-inner"><RefreshCw size={40} className="animate-spin"/></div><div><h3 className="text-xl md:text-5xl font-black uppercase text-slate-300 tracking-[0.4em]">Cargando Datos...</h3><p className="text-slate-400 mt-4 md:mt-8 font-black uppercase text-[10px] md:text-sm tracking-[0.2em] md:tracking-[0.8em]">Sincronizando registros en vivo y descargando historial desde GitHub</p></div></div>
             )}
          </div>
        )}
      </main>
    </div>
  );
}