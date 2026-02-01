import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  Bike, ClipboardList, TrendingUp, Clock, CheckCircle2, Database, Download, Camera, Image as ImageIcon, RefreshCw, X, Layers, ShieldCheck, Eye, ExternalLink, AlertTriangle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import Papa from 'papaparse';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

// --- 1. CONFIGURACIÓN ---
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
    if (!localStorage.getItem('recolekta_tutorial_v36')) setShowWelcome(true);

    // 1. CARGA Y LIMPIEZA DE CSV (HISTORIAL)
    Papa.parse(GITHUB_CSV_URL, {
        download: true, header: true,
        complete: (res) => {
            const mapped = (res.data || []).map(row => {
                const tipoRaw = String(row['Diligencia realizada:']||'');
                const tipoClean = tipoRaw.toLowerCase();
                const isP = PRINCIPAL_KEYWORDS.some(k => tipoClean.includes(k));
                
                // Limpieza de tiempo: "3 min" -> 3
                let tiempoClean = 0;
                const tiempoRaw = String(row['Minutos de espera'] || '0');
                const matches = tiempoRaw.match(/\d+/);
                if (matches) tiempoClean = parseInt(matches[0]);

                return {
                    recolector: String(row['Nombre de Transportista']||'').toUpperCase().trim(),
                    tiempo: tiempoClean,
                    sucursal: row['Sucursal '] || 'Ruta Externa',
                    // Normalizar Categoría para que coincida con Live
                    tipo: tipoRaw, 
                    categoria: isP ? "Principal" : "Secundaria",
                    originalTipo: tipoRaw,
                    // Detectar Foto de Drive
                    fotoData: row['Fotografía de bitácora:'] || null, 
                    month: parseInt(String(row['Marca temporal']||'').split(/[\s\/]+/)[1])||1,
                    createdAt: row['Marca temporal'] // Fecha original para ordenar
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
      // Filtros
      if (filterMonth !== 'all') {
         filtered = filtered.filter(d => {
             // Compatibilidad: Live usa Date objects, CSV usa enteros 1-12
             const date = new Date(d.createdAt);
             const m = isNaN(date.getMonth()) ? d.month : date.getMonth() + 1;
             return m === parseInt(filterMonth);
         });
      }
      if (filterUser !== 'all') filtered = filtered.filter(d => d.recolector === filterUser);

      // Clasificación Unificada (Live + CSV)
      const isPrincipal = (d) => {
          if (d.categoria === "Principal") return true;
          const txt = (d.tipo || d.originalTipo || '').toLowerCase();
          return PRINCIPAL_KEYWORDS.some(k => txt.includes(k));
      };

      const pItems = filtered.filter(d => isPrincipal(d));
      const sItems = filtered.filter(d => !isPrincipal(d));

      const calcEf = (arr) => arr.length > 0 ? ((arr.filter(x => (x.tiempo||0) <= 5).length / arr.length) * 100).toFixed(1) : 0;
      const calcAvg = (arr) => arr.length > 0 ? (arr.reduce((a,b)=>a+(b.tiempo||0),0)/arr.length).toFixed(1) : 0;

      // Generar datos mensuales
      const monthlyData = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => {
        const mDocs = data.filter(d => {
             const date = new Date(d.createdAt);
             const mon = isNaN(date.getMonth()) ? d.month : date.getMonth() + 1;
             return mon === i + 1;
        });
        
        // Filtro de usuario dentro del map mensual
        const finalDocs = filterUser === 'all' ? mDocs : mDocs.filter(d => d.recolector === filterUser);
        
        const mRecs = finalDocs.filter(d => isPrincipal(d));
        const mDils = finalDocs.filter(d => !isPrincipal(d));
        
        return { 
            name: m, 
            count: finalDocs.length,
            recs: mRecs.length,
            dils: mDils.length,
            ef: calcEf(mRecs),
            avgR: calcAvg(mRecs),
            avgD: calcAvg(mDils)
        };
      });

      const topSucursales = Object.entries(filtered.reduce((acc, curr) => {
        if(!curr.sucursal || curr.sucursal === 'N/A') return acc;
        acc[curr.sucursal] = acc[curr.sucursal] || {t:0, c:0}; acc[curr.sucursal].t += (curr.tiempo||0); acc[curr.sucursal].c++; return acc;
      }, {})).map(([name, d]) => ({ name, time: parseFloat((d.t/d.c).toFixed(1)) })).sort((a,b)=>b.time-a.time).slice(0, 8);

      return { total: filtered.length, efP: calcEf(pItems), avgP: calcAvg(pItems), countP: pItems.length, efS: calcEf(sItems), avgS: calcAvg(sItems), countS: sItems.length, monthlyData, topSucursales, rows: filtered };
    } catch (e) { return fb; }
  }, [liveData, csvData, filterMonth, filterUser, dataSource]);

  // --- LÓGICA DE TIEMPO ROBUSTA (Solución AM/PM y negativos) ---
  const convertToMinutes = (h, m, p) => {
    let hour = parseInt(h);
    if (p === 'AM' && hour === 12) hour = 0; // 12 AM es 00:xx
    if (p === 'PM' && hour !== 12) hour += 12; // 1 PM es 13:xx, pero 12 PM es 12:xx
    return hour * 60 + parseInt(m);
  };

  const getWait = () => {
    const startMins = convertToMinutes(form.hLlegada, form.mLlegada, form.pLlegada);
    const endMins = convertToMinutes(form.hSalida, form.mSalida, form.pSalida);
    let diff = endMins - startMins;
    
    // Si la diferencia es negativa, asumimos error de entrada (o turno de noche, pero en este caso bloqueamos)
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
    doc.setFillColor(15, 23, 42); doc.rect(0,0,210,45,'F');
    doc.setTextColor(255); doc.setFontSize(22); doc.text("RECOLEKTA OS", 20, 25);
    doc.setFontSize(10); doc.text("SISTEMA DE GESTIÓN LOGÍSTICA", 20, 32);
    
    doc.setTextColor(40); doc.setFontSize(14); 
    doc.text(filterUser === 'all' ? "REPORTE GLOBAL DE FLOTA" : `FICHA INDIVIDUAL: ${filterUser}`, 20, 60);

    const rows = metrics.monthlyData.filter(m => m.count > 0).map(m => [
        m.name, m.recs, `${m.ef}%`, `${m.avgR}m`, m.dils, `${m.avgD}m`
    ]);

    autoTable(doc, {
        startY: 70,
        head: [['Mes', 'Recolecciones', 'Eficiencia %', 'T. Prom (Rec)', 'Diligencias', 'T. Prom (Dil)']],
        body: rows,
        headStyles: { fillColor: [15, 23, 42] },
        theme: 'grid'
    });
    doc.save(`Reporte_${filterUser}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FE] text-slate-800 font-sans pb-10" onClick={() => setActiveInput(null)}>
      {/* MODAL FOTO */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4" onClick={(e) => {e.stopPropagation(); setViewingPhoto(null);}}>
          <div className="relative max-w-4xl w-full flex flex-col items-center">
             <img src={viewingPhoto} className="max-h-[80vh] rounded-lg border border-white/20" alt="Evidencia" />
             <button className="mt-6 bg-white text-black px-6 py-3 rounded-full font-bold uppercase text-xs" onClick={()=>setViewingPhoto(null)}>Cerrar Vista</button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white"><Bike size={18}/></div><h1 className="text-lg font-black tracking-tighter">Recolekta <span className="text-green-600">OS</span></h1></div>
        <div className="flex bg-slate-100 p-1 rounded-xl border">
            <button onClick={() => setAppMode('user')} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all", appMode === 'user' ? "bg-white text-slate-900 shadow-md" : "text-slate-400")}>Usuario</button>
            <button onClick={() => { const p = prompt("Clave:"); if(p===ADMIN_PASSWORD) setAppMode('admin'); }} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all", appMode === 'admin' ? "bg-white text-slate-900 shadow-md" : "text-slate-400")}>Admin</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {appMode === 'user' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border-t-[8px] border-green-500">
              <h2 className="text-xl font-black mb-6 flex items-center gap-3"><ClipboardList className="text-green-500"/> Registro de Ruta</h2>
              <form onSubmit={async (e) => { e.preventDefault(); 
                  if(!imagePreview) return alert("FOTO REQUERIDA");
                  if(getWait() === 0 && form.mLlegada !== form.mSalida) return alert("ERROR EN HORAS: Verifica AM/PM");
                  try { 
                    const isP = PRINCIPAL_KEYWORDS.some(k=>form.tipo.toLowerCase().includes(k));
                    await addDoc(collection(db, "registros_produccion"), { 
                      ...form, tiempo: getWait(), createdAt: new Date().toISOString(), 
                      categoria: isP ? "Principal" : "Secundaria", fotoData: imagePreview, month: new Date().getMonth() + 1 
                    }); 
                    alert("¡Registrado!"); setForm({...form, sucursal: ''}); setImagePreview(null);
                  } catch(e) {alert("Error de Red");} 
                }} className="space-y-5">
                
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Responsable</label>
                  <input type="text" placeholder="BUSCAR NOMBRE..." className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold uppercase focus:border-green-500 outline-none shadow-inner transition-all" value={form.recolector} onChange={e => handleInput('recolector', e.target.value)} onFocus={() => setActiveInput('recolector')} required />
                  {activeInput === 'recolector' && form.recolector.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white shadow-xl rounded-xl border max-h-40 overflow-y-auto">
                      {CATALOGOS.transportistas.filter(t=>t.includes(form.recolector)).map(s => (
                        <div key={s} onClick={() => { setForm({...form, recolector: s}); setActiveInput(null); }} className="p-3 hover:bg-green-50 cursor-pointer text-xs font-bold border-b">{s}</div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><select className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 shadow-inner" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} required><option value="">-- DILIGENCIA --</option>{CATALOGOS.diligencias.map(d => <option key={d} value={d}>{d}</option>)}</select><select className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 shadow-inner" value={form.area} onChange={e => setForm({...form, area: e.target.value})} required><option value="">-- ÁREA --</option>{CATALOGOS.areas.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <input type="text" placeholder="SUCURSAL..." className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold uppercase focus:border-blue-500 outline-none shadow-inner" value={form.sucursal} onChange={e => handleInput('sucursal', e.target.value)} onFocus={() => setActiveInput('sucursal')} required />
                  {activeInput === 'sucursal' && form.sucursal.length > 0 && (
                    <div className="absolute z-30 w-full mt-2 bg-white shadow-xl rounded-xl border max-h-40 overflow-y-auto">
                      {CATALOGOS.sucursales.filter(t=>t.toUpperCase().includes(form.sucursal)).map(s => (
                        <div key={s} onClick={() => { setForm({...form, sucursal: s}); setActiveInput(null); }} className="p-3 hover:bg-blue-50 cursor-pointer text-xs font-bold border-b">{s}</div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* RELOJ RESPONSIVO (GRID para evitar desbordes) */}
                <div className="bg-slate-900 p-6 rounded-[2rem] text-white grid grid-cols-1 sm:grid-cols-2 gap-6 items-center shadow-lg">
                    <div className="space-y-4">
                        <div className="flex flex-col items-center sm:items-start">
                          <p className="text-[9px] font-bold text-green-400 uppercase tracking-widest mb-1">Llegada</p>
                          <div className="flex gap-1">
                            <select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16" value={form.hLlegada} onChange={e=>setForm({...form, hLlegada:e.target.value})}>{Array.from({length: 12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select>
                            <select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16" value={form.mLlegada} onChange={e=>setForm({...form, mLlegada:e.target.value})}>{Array.from({length: 60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select>
                            <select className="bg-green-600 p-2 rounded-lg font-bold text-[10px] w-14" value={form.pLlegada} onChange={e=>setForm({...form, pLlegada:e.target.value})}><option>AM</option><option>PM</option></select>
                          </div>
                        </div>
                        <div className="flex flex-col items-center sm:items-start">
                          <p className="text-[9px] font-bold text-orange-400 uppercase tracking-widest mb-1">Salida</p>
                          <div className="flex gap-1">
                            <select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16" value={form.hSalida} onChange={e=>setForm({...form, hSalida:e.target.value})}>{Array.from({length: 12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select>
                            <select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16" value={form.mSalida} onChange={e=>setForm({...form, mSalida:e.target.value})}>{Array.from({length: 60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select>
                            <select className="bg-orange-600 p-2 rounded-lg font-bold text-[10px] w-14" value={form.pSalida} onChange={e=>setForm({...form, pSalida:e.target.value})}><option>AM</option><option>PM</option></select>
                          </div>
                        </div>
                    </div>
                    <div className="text-center border-t sm:border-t-0 sm:border-l border-slate-700 pt-4 sm:pt-0 h-full flex flex-col justify-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Espera Calc.</p>
                        <h4 className={cn("text-5xl font-black", getWait() > 5 ? "text-orange-400" : "text-green-400")}>{getWait()}m</h4>
                        {getWait() === 0 && <p className="text-[9px] text-rose-400 mt-2 font-bold animate-pulse">VERIFICAR HORAS</p>}
                    </div>
                </div>

                {imagePreview && (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden border-2 border-green-500 shadow-md"><img src={imagePreview} className="w-full h-full object-cover" alt="Preview"/><button onClick={()=>setImagePreview(null)} className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-full"><X size={14}/></button></div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                    <label className="col-span-1 p-4 bg-slate-50 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white transition-all text-slate-400 font-bold uppercase text-[9px]"><Camera size={24}/><p>Foto</p><input type="file" className="hidden" accept="image/*" onChange={(e)=>{const f=e.target.files[0]; if(f){const r=new FileReader(); r.onloadend=()=>setImagePreview(r.result); r.readAsDataURL(f);}}} /></label>
                    <button type="submit" disabled={!imagePreview} className={cn("col-span-1 rounded-2xl font-black text-sm shadow-lg transition-all uppercase flex flex-col items-center justify-center gap-2", imagePreview ? "bg-slate-900 text-white active:scale-95" : "bg-slate-200 text-slate-400 cursor-not-allowed")}><CheckCircle2 size={24} className={imagePreview?"text-green-500":"text-slate-300"}/> Sincronizar</button>
                </div>
                <button type="button" onClick={downloadReport} className="w-full bg-white border border-slate-200 py-3 rounded-xl font-bold text-xs text-slate-500 uppercase flex items-center justify-center gap-2 hover:bg-slate-50"><Download size={14}/> Descargar Mi Ficha</button>
              </form>
            </div>
            
            <div className="space-y-6">
                 <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Efficiency Core</p>
                    <h4 className="text-6xl font-black text-green-500 mb-2 leading-none">{metrics.efP}%</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase italic">Basado en Muestras</p>
                    <TrendingUp className="absolute -right-6 -bottom-6 text-white opacity-5" size={180}/>
                 </div>
            </div>
          </div>
        ) : (
          /* MONITOR ADMIN */
          <div className="space-y-8 animate-in fade-in">
             <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div><h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Centro de Monitoreo</h2><div className="flex gap-2 mt-4 bg-slate-50 p-1 rounded-xl w-fit"><button onClick={()=>setAdminTab('general')} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", adminTab==='general'?"bg-white shadow-md text-slate-900":"text-slate-400")}>Panorama</button><button onClick={()=>setAdminTab('individual')} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", adminTab==='individual'?"bg-white shadow-md text-slate-900":"text-slate-400")}>Individual</button></div></div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex bg-slate-50 p-2 rounded-xl border items-center"><select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2">{['all',1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m}>{m==='all'?'Año':'Mes '+m}</option>)}</select>{adminTab === 'individual' && <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 max-w-[120px]"><option value="all">Flota</option>{CATALOGOS.transportistas.map(u=><option key={u} value={u}>{u}</option>)}</select>}</div>
                  <button onClick={downloadReport} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2"><Download size={14}/> PDF</button>
                  <button onClick={() => setDataSource(dataSource === 'live' ? 'csv' : 'live')} className={cn("px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2", dataSource==='live'?"bg-blue-600 text-white":"bg-green-600 text-white")}><Layers size={14}/> {dataSource==='live'?'Historial':'En Vivo'}</button>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Vital (Muestras)</p>
                    <div className="flex items-baseline gap-2"><h3 className="text-4xl font-black text-slate-800">{metrics.efP}%</h3><span className="text-xs font-bold text-slate-400">Eficiencia</span></div>
                    <div className="mt-4 flex gap-2"><span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">Espera: {metrics.avgP}m</span><span className="text-[10px] font-bold bg-slate-50 text-slate-500 px-3 py-1 rounded-full">Vol: {metrics.countP}</span></div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2">Secundario</p>
                    <div className="flex items-baseline gap-2"><h3 className="text-4xl font-black text-slate-800">{metrics.efS}%</h3><span className="text-xs font-bold text-slate-400">Eficiencia</span></div>
                    <div className="mt-4 flex gap-2"><span className="text-[10px] font-bold bg-orange-50 text-orange-600 px-3 py-1 rounded-full">Espera: {metrics.avgS}m</span><span className="text-[10px] font-bold bg-slate-50 text-slate-500 px-3 py-1 rounded-full">Vol: {metrics.countS}</span></div>
                </div>
                <div className="bg-slate-900 p-6 rounded-[2rem] shadow-sm text-white flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Total Global</p>
                    <h3 className="text-5xl font-black">{metrics.total}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-auto">Fuente: {dataSource}</p>
                </div>
             </div>

             <div className="bg-white rounded-[2.5rem] shadow-xl border overflow-hidden p-6">
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6 flex items-center gap-2"><ShieldCheck className="text-green-500" size={18}/> Bitácora Reciente</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[9px] font-black text-slate-400 uppercase bg-slate-50"><tr><th className="px-4 py-3">Transportista</th><th className="px-4 py-3">Punto</th><th className="px-4 py-3">Espera</th><th className="px-4 py-3 text-center">Foto</th><th className="px-4 py-3">Tipo</th></tr></thead>
                    <tbody className="text-xs font-bold text-slate-600 divide-y">
                      {metrics.rows.slice(0, 15).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-900">{r.recolector}</td>
                          <td className="px-4 py-3">{r.sucursal}</td>
                          <td className={cn("px-4 py-3", r.tiempo > 5 ? "text-orange-500" : "text-green-600")}>{r.tiempo}m</td>
                          <td className="px-4 py-3 text-center">
                            {r.fotoData && r.fotoData.startsWith('http') ? 
                              <a href={r.fotoData} target="_blank" rel="noreferrer" className="inline-flex justify-center items-center bg-blue-50 text-blue-600 w-8 h-8 rounded-lg"><ExternalLink size={14}/></a> :
                              r.fotoData ? <img src={r.fotoData} className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200" onClick={()=>setViewingPhoto(r.fotoData)} alt="evidencia"/> : <span className="text-slate-200">-</span>
                            }
                          </td>
                          <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-md text-[9px] border", r.categoria==="Principal"?"bg-indigo-50 border-indigo-100 text-indigo-600":"bg-orange-50 border-orange-100 text-orange-600")}>{r.categoria}</span></td>
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