import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  Bike, ClipboardList, TrendingUp, Clock, CheckCircle2, Database, Download, Camera, Image as ImageIcon, RefreshCw, X, ChevronRight, Layers, ShieldCheck, Eye, Filter, Moon, Sun
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import Papa from 'papaparse';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

// --- CONFIGURACIÓN ---
const ADMIN_PASSWORD = "1020"; 
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

const GITHUB_CSV_URL = "https://raw.githubusercontent.com/mnoeanaliza/recolekta-os/refs/heads/main/Datos.csv";

const CATALOGOS = {
  transportistas: ["ANTONIO RIVAS", "BRAYAN REYES", "CARLOS SOSA", "DAVID ALVARADO", "EDWIN FLORES", "FELIX VASQUEZ", "FLOR CARDOZA", "GIOVANNI CALLEJAS", "HILDEBRANDO MENJIVAR", "JAIRO GIL", "JASON BARRERA", "ROGELIO MAZARIEGO", "TEODORO PÉREZ", "WALTER RIVAS"],
  sucursales: ["Constitución", "Soyapango", "San Miguel", "Lourdes", "Valle Dulce", "Venecia", "San Miguel 2", "Sonsonate 1", "Puerto", "San Martín", "San Miguel 3", "Sonsonate 2", "San Gabriel", "Casco", "La Unión", "Sonsonate 3", "Cojutepeque", "Zacatecoluca", "Santa Ana", "Merliot", "Escalón", "Médica", "Santa Tecla", "Plaza Soma", "Plaza Sur", "Santa Elena", "Chalatenango", "Aguilares", "Metapán", "Marsella", "Opico", "N/A (EN RUTA)"],
  areas: ["LABORATORIO / PROCESAMIENTO", "TUVET", "Imágenes Escalón", "Centro de Distribución", "LAB. Externo", "Contabilidad", "RRHH", "Contac Center", "Empresas", "Fisioterapia", "Cuentas por cobrar", "Mercadeo", "Fidelizacion", "IT", "LOGÍSTICA / RUTA"],
  diligencias: ["Recolección de muestras", "Entrega de Muestras", "Traslado de toallas", "Traslado de reactivo", "Traslado de insumos", "Traslado de cortes", "Traslado de documentos", "Pago de aseguradora", "Pago o tramite bancario", "Tramite o diligencia extraordinaria", "INCIDENCIA EN RUTA"]
};

const PRINCIPAL_KEYWORDS = ["muestras", "entrega", "recepción", "recolección", "recoleccion"];

export default function App() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [appMode, setAppMode] = useState('user'); 
  const [adminTab, setAdminTab] = useState('general'); 
  const [dataSource, setDataSource] = useState('live'); 
  const [liveData, setLiveData] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [imagePreview, setImagePreview] = useState(null);
  const [viewingPhoto, setViewingPhoto] = useState(null);

  // ESTADO DEL FORMULARIO
  const [form, setForm] = useState({ recolector: '', sucursal: '', area: '', tipo: '', hLlegada: '08', mLlegada: '00', pLlegada: 'AM', hSalida: '08', mSalida: '05', pSalida: 'AM' });
  const [activeInput, setActiveInput] = useState(null);

  useEffect(() => {
    signInAnonymously(auth).catch(() => {});
    if (!localStorage.getItem('recolekta_tutorial_v38')) setShowWelcome(true);

    Papa.parse(GITHUB_CSV_URL, {
        download: true, header: true,
        complete: (res) => {
            const mapped = (res.data || []).map(row => {
                const tipoRaw = String(row['Diligencia realizada:']||'');
                const isP = PRINCIPAL_KEYWORDS.some(k => tipoRaw.toLowerCase().includes(k));
                let tiempoClean = 0;
                const tiempoRaw = String(row['Minutos de espera'] || '0');
                const matches = tiempoRaw.match(/\d+/);
                if (matches) tiempoClean = parseInt(matches[0]);

                return {
                    recolector: String(row['Nombre de Transportista']||'').toUpperCase().trim(),
                    tiempo: tiempoClean,
                    sucursal: row['Sucursal '] || 'Ruta Externa',
                    tipo: tipoRaw, 
                    categoria: isP ? "Principal" : "Secundaria",
                    originalTipo: tipoRaw,
                    fotoData: row['Fotografía de bitácora:'] || null, 
                    month: parseInt(String(row['Marca temporal']||'').split(/[\s\/]+/)[1])||1,
                    createdAt: row['Marca temporal'] 
                };
            }).filter(r => r.recolector !== '');
            setCsvData(mapped);
        }
    });

    const q = query(collection(db, "registros_produccion"), orderBy("createdAt", "desc"), limit(500));
    const unsubscribe = onSnapshot(q, (snap) => setLiveData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, []);

  const metrics = useMemo(() => {
    const data = dataSource === 'live' ? liveData : csvData;
    const fb = { total: 0, efP: 0, avgP: 0, countP: 0, efS: 0, avgS: 0, countS: 0, monthlyData: [], topSucursales: [], rows: [] };
    if (!data || data.length === 0) return fb;

    try {
      let filtered = [...data];
      if (filterMonth !== 'all') {
         filtered = filtered.filter(d => {
             const date = new Date(d.createdAt);
             const m = isNaN(date.getMonth()) ? d.month : date.getMonth() + 1;
             return m === parseInt(filterMonth);
         });
      }
      if (filterUser !== 'all') filtered = filtered.filter(d => d.recolector === filterUser);

      const isPrincipal = (d) => {
          if (d.categoria === "Principal") return true;
          const txt = (d.tipo || d.originalTipo || '').toLowerCase();
          return PRINCIPAL_KEYWORDS.some(k => txt.includes(k));
      };

      const pItems = filtered.filter(d => isPrincipal(d));
      const sItems = filtered.filter(d => !isPrincipal(d));

      const calcEf = (arr) => arr.length > 0 ? ((arr.filter(x => (x.tiempo||0) <= 5).length / arr.length) * 100).toFixed(1) : 0;
      const calcAvg = (arr) => arr.length > 0 ? (arr.reduce((a,b)=>a+(b.tiempo||0),0)/arr.length).toFixed(1) : 0;

      const monthlyData = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => {
        const mDocs = data.filter(d => {
             const date = new Date(d.createdAt);
             const mon = isNaN(date.getMonth()) ? d.month : date.getMonth() + 1;
             return mon === i + 1;
        });
        const finalDocs = filterUser === 'all' ? mDocs : mDocs.filter(d => d.recolector === filterUser);
        const mRecs = finalDocs.filter(d => isPrincipal(d));
        const mDils = finalDocs.filter(d => !isPrincipal(d));
        
        return { 
            name: m, count: finalDocs.length, recs: mRecs.length, dils: mDils.length,
            ef: calcEf(mRecs), avgR: calcAvg(mRecs), avgD: calcAvg(mDils)
        };
      });

      const topSucursales = Object.entries(filtered.reduce((acc, curr) => {
        if(!curr.sucursal || curr.sucursal === 'N/A') return acc;
        acc[curr.sucursal] = acc[curr.sucursal] || {t:0, c:0}; acc[curr.sucursal].t += (curr.tiempo||0); acc[curr.sucursal].c++; return acc;
      }, {})).map(([name, d]) => ({ name, time: parseFloat((d.t/d.c).toFixed(1)) })).sort((a,b)=>b.time-a.time).slice(0, 8);

      return { total: filtered.length, efP: calcEf(pItems), avgP: calcAvg(pItems), countP: pItems.length, efS: calcEf(sItems), avgS: calcAvg(sItems), countS: sItems.length, monthlyData, topSucursales, rows: filtered };
    } catch (e) { return fb; }
  }, [liveData, csvData, filterMonth, filterUser, dataSource]);

  // --- KPI DIARIO PERSONALIZADO ---
  const userMetrics = useMemo(() => {
    const data = dataSource === 'live' ? liveData : csvData;
    const targetUser = form.recolector;
    
    // 1. Filtrar por Usuario
    let userDocs = data;
    if (targetUser && targetUser.length > 2) {
        userDocs = data.filter(d => d.recolector === targetUser);
    }

    // 2. Filtrar por HOY (Reinicio diario)
    const today = new Date().toLocaleDateString();
    userDocs = userDocs.filter(d => new Date(d.createdAt).toLocaleDateString() === today);

    const isPrincipal = (d) => {
        if (d.categoria === "Principal") return true;
        const txt = (d.tipo || d.originalTipo || '').toLowerCase();
        return PRINCIPAL_KEYWORDS.some(k => txt.includes(k));
    };

    const recs = userDocs.filter(d => isPrincipal(d));
    const ef = recs.length > 0 ? ((recs.filter(x => (x.tiempo||0) <= 5).length / recs.length) * 100).toFixed(1) : 0;
    
    return { 
        ef: ef, 
        count: userDocs.length, 
        label: targetUser && targetUser.length > 2 ? targetUser.split(' ')[0] : 'HOY (GLOBAL)' 
    };
  }, [liveData, csvData, form.recolector, dataSource]);

  const convertToMinutes = (h, m, p) => {
    let hour = parseInt(h);
    if (p === 'AM' && hour === 12) hour = 0; 
    if (p === 'PM' && hour !== 12) hour += 12; 
    return hour * 60 + parseInt(m);
  };

  const getWait = () => {
    const startMins = convertToMinutes(form.hLlegada, form.mLlegada, form.pLlegada);
    const endMins = convertToMinutes(form.hSalida, form.mSalida, form.pSalida);
    let diff = endMins - startMins;
    if (diff < 0) return 0; 
    return diff;
  };

  const handleInput = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value.toUpperCase() }));
    setActiveInput(field);
  };

  const downloadReport = () => {
    if (!metrics || metrics.total === 0) return alert("Sin datos para generar reporte.");
    const doc = new jsPDF();
    const slate900 = [15, 23, 42];
    const green500 = [34, 197, 94];

    doc.setFillColor(...slate900); doc.rect(0,0,210,45,'F');
    doc.setFillColor(...green500); doc.circle(20, 22, 10, 'F');
    doc.setTextColor(255); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("R", 17.5, 24);
    doc.setFontSize(22); doc.text("RECOLEKTA OS", 35, 22);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("SISTEMA DE GESTIÓN LOGÍSTICA Y TRANSPORTE", 35, 29);
    
    doc.setTextColor(40); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    const reportTitle = filterUser === 'all' ? "REPORTE CONSOLIDADO DE FLOTA" : `FICHA HISTÓRICA: ${filterUser}`;
    doc.text(reportTitle, 20, 60);

    doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`Periodo: ${filterMonth === 'all' ? 'ANUAL' : 'MES ' + filterMonth} | Fuente: ${dataSource.toUpperCase()}`, 20, 66);
    
    doc.setTextColor(0);
    doc.text(`Eficiencia Recolección: ${metrics.efP}% (Meta: 95%)`, 20, 75);
    doc.text(`Promedio Espera (Muestras): ${metrics.avgP} min`, 20, 81);
    doc.text(`Total Diligencias Adic.: ${metrics.countS}`, 120, 75);
    doc.text(`Promedio Espera (Diligencias): ${metrics.avgS} min`, 120, 81);

    const rows = metrics.monthlyData.filter(m => m.count > 0).map(m => [
        m.name, m.recs, `${m.ef}%`, `${m.avgR}m`, m.dils, `${m.avgD}m`
    ]);

    autoTable(doc, {
        startY: 90,
        head: [['Mes', 'Recolecciones', 'Eficiencia %', 'T. Prom (Rec)', 'Diligencias', 'T. Prom (Dil)']],
        body: rows,
        headStyles: { fillColor: slate900, fontSize: 9, halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center', fontStyle: 'bold', textColor: green500 } },
        theme: 'striped'
    });
    doc.save(`Recolekta_Reporte_${filterUser}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans pb-10" onClick={() => setActiveInput(null)}>
      {/* MODAL FOTO */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4" onClick={(e) => {e.stopPropagation(); setViewingPhoto(null);}}>
          <div className="relative max-w-4xl w-full flex flex-col items-center">
             <img src={viewingPhoto} className="max-h-[80vh] rounded-lg border border-white/20" alt="Evidencia" />
             <button className="mt-6 bg-white text-black px-6 py-3 rounded-full font-bold uppercase text-xs" onClick={()=>setViewingPhoto(null)}>Cerrar Vista</button>
          </div>
        </div>
      )}

      {/* BIENVENIDA DARK */}
      {showWelcome && (
        <div className="fixed inset-0 z-[100] bg-[#0B1120]/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#151F32] max-w-md w-full rounded-[3rem] p-10 text-center shadow-2xl border border-slate-800">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-green-500/20"><Bike size={32}/></div>
            <h2 className="text-2xl font-black uppercase mb-4 tracking-tighter text-white">Recolekta OS</h2>
            <p className="text-slate-400 text-sm mb-10 leading-relaxed">Gestión Logística Operativa. <br/><b>Modo Ejecutivo Activo.</b></p>
            <button onClick={() => { setShowWelcome(false); localStorage.setItem('recolekta_tutorial_v38', 'true'); }} className="w-full bg-white text-[#0B1120] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-200 transition-colors">Iniciar Sesión</button>
          </div>
        </div>
      )}

      {/* NAVBAR DARK */}
      <nav className="bg-[#151F32] border-b border-slate-800 px-4 md:px-8 py-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white border border-slate-700"><Bike size={18}/></div><h1 className="text-lg font-black tracking-tighter text-white">Recolekta <span className="text-green-500">OS</span></h1></div>
        <div className="flex bg-[#0B1120] p-1 rounded-xl border border-slate-800">
            <button onClick={() => setAppMode('user')} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all", appMode === 'user' ? "bg-slate-700 text-white shadow-md" : "text-slate-500 hover:text-slate-300")}>Usuario</button>
            <button onClick={() => { const p = prompt("Clave:"); if(p===ADMIN_PASSWORD) setAppMode('admin'); }} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all", appMode === 'admin' ? "bg-slate-700 text-white shadow-md" : "text-slate-500 hover:text-slate-300")}>Admin</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {appMode === 'user' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            {/* FORMULARIO DARK */}
            <div className="lg:col-span-2 bg-[#151F32] p-6 md:p-10 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-500 to-emerald-400"></div>
              <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-white"><ClipboardList className="text-green-500"/> Registro de Ruta</h2>
              <form onSubmit={async (e) => { e.preventDefault(); 
                  if(!imagePreview) return alert("FOTO REQUERIDA");
                  if(getWait() === 0 && form.mLlegada !== form.mSalida) return alert("ERROR EN HORAS: Verifica AM/PM");
                  try { 
                    const isP = PRINCIPAL_KEYWORDS.some(k=>form.tipo.toLowerCase().includes(k));
                    await addDoc(collection(db, "registros_produccion"), { 
                      ...form, tiempo: getWait(), createdAt: new Date().toISOString(), 
                      categoria: isP ? "Prioridad" : "Secundaria", fotoData: imagePreview, month: new Date().getMonth() + 1 
                    }); 
                    alert("¡Registrado!"); setForm({...form, sucursal: ''}); setImagePreview(null);
                  } catch(e) {alert("Error de Red");} 
                }} className="space-y-5">
                
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Responsable</label>
                  <input type="text" placeholder="BUSCAR NOMBRE..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase focus:border-green-500 outline-none transition-all text-white placeholder-slate-600" value={form.recolector} onChange={e => handleInput('recolector', e.target.value)} onFocus={() => setActiveInput('recolector')} required />
                  {activeInput === 'recolector' && form.recolector.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-[#1F2937] shadow-xl rounded-xl border border-slate-700 max-h-40 overflow-y-auto">
                      {CATALOGOS.transportistas.filter(t=>t.includes(form.recolector)).map(s => (
                        <div key={s} onClick={() => { setForm({...form, recolector: s}); setActiveInput(null); }} className="p-3 hover:bg-slate-700 cursor-pointer text-xs font-bold border-b border-slate-800 text-slate-300">{s}</div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select className="p-4 bg-[#0B1120] rounded-2xl font-bold outline-none border-2 border-slate-800 focus:border-blue-500 text-slate-300" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} required><option value="">-- DILIGENCIA --</option>{CATALOGOS.diligencias.map(d => <option key={d} value={d}>{d}</option>)}</select>
                    <select className="p-4 bg-[#0B1120] rounded-2xl font-bold outline-none border-2 border-slate-800 focus:border-indigo-500 text-slate-300" value={form.area} onChange={e => setForm({...form, area: e.target.value})} required><option value="">-- ÁREA --</option>{CATALOGOS.areas.map(a => <option key={a} value={a}>{a}</option>)}</select>
                </div>
                
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <input type="text" placeholder="SUCURSAL..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase focus:border-blue-500 outline-none text-white placeholder-slate-600" value={form.sucursal} onChange={e => handleInput('sucursal', e.target.value)} onFocus={() => setActiveInput('sucursal')} required />
                  {activeInput === 'sucursal' && form.sucursal.length > 0 && (
                    <div className="absolute z-30 w-full mt-2 bg-[#1F2937] shadow-xl rounded-xl border border-slate-700 max-h-40 overflow-y-auto">
                      {CATALOGOS.sucursales.filter(t=>t.toUpperCase().includes(form.sucursal)).map(s => (
                        <div key={s} onClick={() => { setForm({...form, sucursal: s}); setActiveInput(null); }} className="p-3 hover:bg-slate-700 cursor-pointer text-xs font-bold border-b border-slate-800 text-slate-300">{s}</div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* RELOJ DARK */}
                <div className="bg-[#0B1120] p-6 rounded-[2rem] text-white grid grid-cols-1 sm:grid-cols-2 gap-6 items-center shadow-inner border border-slate-800">
                    <div className="space-y-4">
                        <div className="flex flex-col items-center sm:items-start">
                          <p className="text-[9px] font-bold text-green-400 uppercase tracking-widest mb-1">Llegada</p>
                          <div className="flex gap-1">
                            <select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16 border border-slate-700" value={form.hLlegada} onChange={e=>setForm({...form, hLlegada:e.target.value})}>{Array.from({length: 12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select>
                            <select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16 border border-slate-700" value={form.mLlegada} onChange={e=>setForm({...form, mLlegada:e.target.value})}>{Array.from({length: 60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select>
                            <select className="bg-green-900 text-green-400 border border-green-700 p-2 rounded-lg font-bold text-[10px] w-14" value={form.pLlegada} onChange={e=>setForm({...form, pLlegada:e.target.value})}><option>AM</option><option>PM</option></select>
                          </div>
                        </div>
                        <div className="flex flex-col items-center sm:items-start">
                          <p className="text-[9px] font-bold text-orange-400 uppercase tracking-widest mb-1">Salida</p>
                          <div className="flex gap-1">
                            <select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16 border border-slate-700" value={form.hSalida} onChange={e=>setForm({...form, hSalida:e.target.value})}>{Array.from({length: 12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select>
                            <select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16 border border-slate-700" value={form.mSalida} onChange={e=>setForm({...form, mSalida:e.target.value})}>{Array.from({length: 60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select>
                            <select className="bg-orange-900 text-orange-400 border border-orange-700 p-2 rounded-lg font-bold text-[10px] w-14" value={form.pSalida} onChange={e=>setForm({...form, pSalida:e.target.value})}><option>AM</option><option>PM</option></select>
                          </div>
                        </div>
                    </div>
                    <div className="text-center border-t sm:border-t-0 sm:border-l border-slate-800 pt-4 sm:pt-0 h-full flex flex-col justify-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Espera Calc.</p>
                        <h4 className={cn("text-5xl font-black", getWait() > 5 ? "text-orange-400" : "text-green-400")}>{getWait()}m</h4>
                        {getWait() === 0 && <p className="text-[9px] text-rose-400 mt-2 font-bold animate-pulse">VERIFICAR HORAS</p>}
                    </div>
                </div>

                {imagePreview && (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden border-2 border-green-500 shadow-md"><img src={imagePreview} className="w-full h-full object-cover" alt="Preview"/><button onClick={()=>setImagePreview(null)} className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-full"><X size={14}/></button></div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                    <label className="col-span-1 p-4 bg-[#0B1120] border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-800 transition-all text-slate-400 font-bold uppercase text-[9px]"><Camera size={24}/><p>Foto</p><input type="file" className="hidden" accept="image/*" onChange={(e)=>{const f=e.target.files[0]; if(f){const r=new FileReader(); r.onloadend=()=>setImagePreview(r.result); r.readAsDataURL(f);}}} /></label>
                    <button type="submit" disabled={!imagePreview} className={cn("col-span-1 rounded-2xl font-black text-sm shadow-lg transition-all uppercase flex flex-col items-center justify-center gap-2", imagePreview ? "bg-white text-black hover:bg-gray-200" : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700")}><CheckCircle2 size={24} className={imagePreview?"text-green-600":"text-slate-600"}/> Sincronizar</button>
                </div>
                <button type="button" onClick={downloadReport} className="w-full bg-slate-800 border border-slate-700 py-3 rounded-xl font-bold text-xs text-slate-300 uppercase flex items-center justify-center gap-2 hover:bg-slate-700 transition-all"><Download size={14}/> Descargar Reporte</button>
              </form>
            </div>
            
            {/* TARJETA KPI USUARIO DARK */}
            <div className="space-y-6">
                 <div className="bg-[#151F32] p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">
                        {userMetrics.label === 'HOY (GLOBAL)' ? 'EFICIENCIA DIARIA (HOY)' : `EFICIENCIA: ${userMetrics.label}`}
                    </p>
                    <h4 className="text-6xl font-black text-green-400 mb-2 leading-none">{userMetrics.ef}%</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase italic">
                        {userMetrics.count > 0 ? `Basado en ${userMetrics.count} Registros de Hoy` : 'Esperando datos del día...'}
                    </p>
                    <TrendingUp className="absolute -right-6 -bottom-6 text-slate-800 opacity-50" size={180}/>
                 </div>
            </div>
          </div>
        ) : (
          /* MONITOR ADMIN DARK */
          <div className="space-y-8 animate-in fade-in">
             <div className="bg-[#151F32] p-8 rounded-[2.5rem] shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                <div><h2 className="text-3xl font-black uppercase tracking-tighter text-white">Central y Analisis de Datos</h2><div className="flex gap-2 mt-4 bg-[#0B1120] p-1 rounded-xl w-fit border border-slate-800"><button onClick={()=>setAdminTab('general')} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", adminTab==='general'?"bg-slate-700 text-white shadow-md":"text-slate-500 hover:text-slate-300")}>Panorama</button><button onClick={()=>setAdminTab('individual')} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", adminTab==='individual'?"bg-slate-700 text-white shadow-md":"text-slate-500 hover:text-slate-300")}>Individual</button></div></div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex bg-[#0B1120] p-2 rounded-xl border border-slate-800 items-center"><Filter size={16} className="text-slate-500"/><select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 text-slate-300">{['all',1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m} className="bg-slate-900">{m==='all'?'Año Completo':'Mes '+m}</option>)}</select>{adminTab === 'individual' && <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 max-w-[120px] text-slate-300"><option value="all" className="bg-slate-900">Flota</option>{CATALOGOS.transportistas.map(u=><option key={u} value={u} className="bg-slate-900">{u}</option>)}</select>}</div>
                  <button onClick={downloadReport} className="bg-white text-black px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2 hover:bg-slate-200 transition-all"><Download size={14}/> PDF</button>
                  <button onClick={() => setDataSource(dataSource === 'live' ? 'csv' : 'live')} className={cn("px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2", dataSource==='live'?"bg-blue-600 text-white":"bg-green-600 text-white")}><Layers size={14}/> {dataSource==='live'?'Historial':'En Vivo'}</button>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-sm border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={100} className="text-indigo-500"/></div>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">{filterUser === 'all' ? 'VITAL (GLOBAL FLOTA)' : `VITAL (${filterUser})`}</p>
                    <div className="flex items-baseline gap-2"><h3 className="text-4xl font-black text-white">{metrics.efP}%</h3><span className="text-xs font-bold text-slate-500">Eficiencia</span></div>
                    <div className="mt-4 flex gap-2"><span className="text-[10px] font-bold bg-indigo-900/30 text-indigo-400 px-3 py-1 rounded-full border border-indigo-900">Espera: {metrics.avgP}m</span><span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">Vol: {metrics.countP}</span></div>
                </div>
                <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-sm border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><ClipboardList size={100} className="text-orange-500"/></div>
                    <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2">SECUNDARIO (ADMIN)</p>
                    <div className="flex items-baseline gap-2"><h3 className="text-4xl font-black text-white">{metrics.efS}%</h3><span className="text-xs font-bold text-slate-500">Eficiencia</span></div>
                    <div className="mt-4 flex gap-2"><span className="text-[10px] font-bold bg-orange-900/30 text-orange-400 px-3 py-1 rounded-full border border-orange-900">Espera: {metrics.avgS}m</span><span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">Vol: {metrics.countS}</span></div>
                </div>
                <div className="bg-[#0B1120] p-6 rounded-[2rem] shadow-inner border border-slate-800 text-white flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute -bottom-4 -right-4 opacity-20"><Database size={100} className="text-slate-600"/></div>
                    <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">TOTAL REGISTROS</p>
                    <h3 className="text-5xl font-black">{metrics.total}</h3>
                    <p className="text-[10px] font-bold text-slate-600 uppercase mt-auto">Fuente: {dataSource}</p>
                </div>
             </div>

             <div className="bg-[#151F32] rounded-[2.5rem] shadow-xl border border-slate-800 p-6">
                <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest mb-6 flex items-center gap-2"><ShieldCheck className="text-green-500" size={18}/> Bitácora de Operación Reciente</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Transportista</th><th className="px-4 py-3">Punto</th><th className="px-4 py-3">Espera</th><th className="px-4 py-3 text-center">Foto</th><th className="px-4 py-3 rounded-r-lg">Tipo</th></tr></thead>
                    <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                      {metrics.rows.slice(0, 20).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 text-white">{r.recolector}</td>
                          <td className="px-4 py-3">{r.sucursal}</td>
                          <td className={cn("px-4 py-3", r.tiempo > 5 ? "text-orange-400" : "text-green-400")}>{r.tiempo}m</td>
                          <td className="px-4 py-3 text-center">
                            {r.fotoData && r.fotoData.startsWith('http') ? 
                              <a href={r.fotoData} target="_blank" rel="noreferrer" className="inline-flex justify-center items-center bg-blue-900/30 text-blue-400 w-8 h-8 rounded-lg border border-blue-900"><ExternalLink size={14}/></a> :
                              r.fotoData ? <img src={r.fotoData} className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-600 hover:border-white transition-all" onClick={()=>setViewingPhoto(r.fotoData)} alt="evidencia"/> : <span className="text-slate-700">-</span>
                            }
                          </td>
                          <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-md text-[9px] border", r.categoria==="Principal"?"bg-indigo-900/30 border-indigo-900 text-indigo-300":"bg-orange-900/30 border-orange-900 text-orange-300")}>{r.categoria}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
