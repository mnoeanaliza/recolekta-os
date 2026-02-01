import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  Bike, LayoutDashboard, ClipboardList, FileSearch, TrendingUp, Clock, MapPin, 
  CheckCircle2, Database, Download, Camera, Image as ImageIcon, RefreshCw, X, ChevronRight, Layers, ShieldCheck, Eye
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
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

  useEffect(() => {
    signInAnonymously(auth).catch(() => {});
    if (!localStorage.getItem('recolekta_tutorial_v35')) setShowWelcome(true);

    Papa.parse(GITHUB_CSV_URL, {
        download: true, header: true,
        complete: (res) => {
            const mapped = (res.data || []).map(row => {
                const tipo = String(row['Diligencia realizada:']||'').toLowerCase();
                const esPrincipal = PRINCIPAL_KEYWORDS.some(k => tipo.includes(k));
                return {
                    recolector: String(row['Nombre de Transportista']||'').toUpperCase().trim(),
                    tiempo: parseFloat(row['Minutos de espera'])||0,
                    sucursal: row['Sucursal ']||'N/A',
                    tipo: esPrincipal ? "Principal" : "Secundaria",
                    originalTipo: row['Diligencia realizada:'],
                    month: parseInt(String(row['Marca temporal']||'').split(/[\s\/]+/)[1])||1,
                    createdAt: new Date().toISOString()
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
      if (filterMonth !== 'all') filtered = filtered.filter(d => (d.month === parseInt(filterMonth)) || (new Date(d.createdAt).getMonth() + 1 === parseInt(filterMonth)));
      if (filterUser !== 'all') filtered = filtered.filter(d => d.recolector === filterUser);

      const pItems = filtered.filter(d => d.categoria === "Principal" || PRINCIPAL_KEYWORDS.some(k => (d.originalTipo||'').toLowerCase().includes(k)));
      const sItems = filtered.filter(d => d.categoria !== "Principal" && !PRINCIPAL_KEYWORDS.some(k => (d.originalTipo||'').toLowerCase().includes(k)));

      const calcEf = (arr) => arr.length > 0 ? ((arr.filter(x => (x.tiempo||0) <= 5).length / arr.length) * 100).toFixed(1) : 0;
      const calcAvg = (arr) => arr.length > 0 ? (arr.reduce((a,b)=>a+(b.tiempo||0),0)/arr.length).toFixed(1) : 0;

      const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const monthlyData = labels.map((m, i) => {
        const mDocs = data.filter(d => (d.month === i+1) || (new Date(d.createdAt).getMonth() === i));
        const finalDocs = filterUser === 'all' ? mDocs : mDocs.filter(d => d.recolector === filterUser);
        const mRecs = finalDocs.filter(d => d.categoria === "Principal" || PRINCIPAL_KEYWORDS.some(k => (d.originalTipo||'').toLowerCase().includes(k)));
        const mDils = finalDocs.filter(d => d.categoria !== "Principal" && !PRINCIPAL_KEYWORDS.some(k => (d.originalTipo||'').toLowerCase().includes(k)));
        
        return { 
            name: m, 
            count: finalDocs.length,
            recs: mRecs.length,
            dils: mDils.length,
            ef: calcEf(mRecs),
            avgR: calcAvg(mRecs),
            avgD: calcAvg(mDils)
        };
      }).filter(d => d.count > 0);

      const topSucursales = Object.entries(filtered.reduce((acc, curr) => {
        if(!curr.sucursal || curr.sucursal === 'N/A') return acc;
        acc[curr.sucursal] = acc[curr.sucursal] || {t:0, c:0}; acc[curr.sucursal].t += (curr.tiempo||0); acc[curr.sucursal].c++; return acc;
      }, {})).map(([name, d]) => ({ name, time: parseFloat((d.t/d.c).toFixed(1)) })).sort((a,b)=>b.time-a.time).slice(0, 8);

      return { total: filtered.length, efP: calcEf(pItems), avgP: calcAvg(pItems), countP: pItems.length, efS: calcEf(sItems), avgS: calcAvg(sItems), countS: sItems.length, monthlyData, topSucursales, rows: filtered };
    } catch (e) { return fb; }
  }, [liveData, csvData, filterMonth, filterUser, dataSource]);

  const [form, setForm] = useState({ recolector: '', sucursal: '', area: '', tipo: '', hLlegada: '08', mLlegada: '00', pLlegada: 'AM', hSalida: '08', mSalida: '00', pSalida: 'AM' });
  const [activeInput, setActiveInput] = useState(null);

  const handleInput = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value.toUpperCase() }));
    setActiveInput(field);
  };

  const timeToMins = (h, m, p) => { let hh = parseInt(h); if (p === 'PM' && hh < 12) hh += 12; if (p === 'AM' && hh === 12) hh = 0; return hh * 60 + parseInt(m); };
  const getWait = () => { const s = timeToMins(form.hLlegada, form.mLlegada, form.pLlegada), e = timeToMins(form.hSalida, form.mSalida, form.pSalida); return (e-s)>=0?e-s:0; };

  const downloadProfessionalReport = () => {
    if (!metrics || metrics.total === 0) return alert("Sin datos.");
    const doc = new jsPDF();
    const slate900 = [15, 23, 42];

    doc.setFillColor(...slate900); doc.rect(0, 0, 210, 50, 'F');
    doc.setTextColor(255); doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text("RECOLEKTA OS", 20, 25);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("SISTEMA DE GESTIÓN LOGÍSTICA BIOMÉDICA", 20, 32);
    
    doc.setFontSize(14); doc.text(filterUser === 'all' ? "REPORTE CONSOLIDADO DE FLOTA" : `FICHA DE DESEMPEÑO: ${filterUser}`, 20, 42);

    doc.setTextColor(40); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`Eficiencia Recolección: ${metrics.efP}% (Meta: 95%)`, 20, 60);
    doc.text(`Promedio Espera (Muestras): ${metrics.avgP} min`, 20, 65);
    doc.text(`Total Diligencias Adic.: ${metrics.countS}`, 120, 60);
    doc.text(`Promedio Espera (Diligencias): ${metrics.avgS} min`, 120, 65);

    const tableRows = metrics.monthlyData.map(m => [
        m.name, m.recs, `${m.ef}%`, `${m.avgR}m`, m.dils, `${m.avgD}m`
    ]);

    autoTable(doc, {
        startY: 75,
        head: [['Mes', 'Recolecciones', 'Eficiencia %', 'Espera Prom. (Rec)', 'Diligencias Adic.', 'Espera Prom. (Dil)']],
        body: tableRows,
        headStyles: { fillColor: slate900, fontSize: 9, halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center', fontStyle: 'bold' } },
        theme: 'striped'
    });

    doc.save(`Recolekta_Reporte_${filterUser}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FE] text-slate-800 font-sans pb-10" onClick={() => setActiveInput(null)}>
      {viewingPhoto && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={(e) => {e.stopPropagation(); setViewingPhoto(null);}}>
          <div className="relative max-w-4xl w-full">
            <button className="absolute -top-12 right-0 text-white flex items-center gap-2 font-black uppercase text-xs bg-rose-600 px-4 py-2 rounded-full"><X size={20}/> Cerrar</button>
            <img src={viewingPhoto} className="max-h-[85vh] mx-auto rounded-2xl border-4 border-white shadow-2xl" alt="Evidencia" />
          </div>
        </div>
      )}

      {showWelcome && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white max-w-md w-full rounded-[3rem] p-10 text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg"><Bike size={32}/></div>
            <h2 className="text-2xl font-black uppercase mb-4 tracking-tighter">Control Logístico</h2>
            <p className="text-slate-500 text-sm mb-10 leading-relaxed">Reporta muestras y diligencias por separado. <br/><b>Recuerda: Foto obligatoria.</b></p>
            <button onClick={() => { setShowWelcome(false); localStorage.setItem('recolekta_tutorial_v35', 'true'); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Empezar</button>
          </div>
        </div>
      )}

      <nav className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2 md:gap-3"><div className="w-8 h-8 md:w-10 md:h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg rotate-3"><Bike size={18}/></div><h1 className="text-sm md:text-xl font-black uppercase tracking-tighter leading-none">Recolekta <span className="text-green-600">OS</span></h1></div>
        <div className="flex bg-slate-100 p-1 rounded-xl border">
            <button onClick={() => setAppMode('user')} className={cn("px-4 md:px-6 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase transition-all", appMode === 'user' ? "bg-white text-slate-900 shadow-md" : "text-slate-400")}>Usuario</button>
            <button onClick={() => { const p = prompt("Clave:"); if(p===ADMIN_PASSWORD) setAppMode('admin'); }} className={cn("px-4 md:px-6 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase transition-all", appMode === 'admin' ? "bg-white text-slate-900 shadow-md" : "text-slate-400")}>Admin</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {appMode === 'user' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <div className="lg:col-span-2 bg-white p-6 md:p-12 rounded-[2.5rem] shadow-xl border-t-[10px] border-green-500">
              <h2 className="text-xl md:text-2xl font-black mb-8 uppercase flex items-center gap-3"><ClipboardList className="text-green-500"/> Registro de Ruta</h2>
              <form onSubmit={async (e) => { e.preventDefault(); 
                  if(!imagePreview) return alert("SUBE UNA FOTO PARA CONTINUAR.");
                  try { 
                    const isP = PRINCIPAL_KEYWORDS.some(k=>form.tipo.toLowerCase().includes(k));
                    await addDoc(collection(db, "registros_produccion"), { 
                      ...form, tiempo: getWait(), createdAt: new Date().toISOString(), 
                      categoria: isP ? "Principal" : "Secundaria", fotoData: imagePreview, month: new Date().getMonth() + 1 
                    }); 
                    alert("¡Sincronizado!"); setForm({...form, sucursal: ''}); setImagePreview(null);
                  } catch(e) {alert("Error de Envío.");} 
                }} className="space-y-6">
                
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase leading-none mb-1">Responsable</label>
                  <input type="text" placeholder="BUSCAR NOMBRE..." className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold uppercase focus:border-green-500 outline-none transition-all shadow-inner" value={form.recolector} onChange={e => handleInput('recolector', e.target.value)} onFocus={() => setActiveInput('recolector')} required />
                  {activeInput === 'recolector' && form.recolector.length > 0 && (
                    <div className="absolute z-30 w-full mt-1 bg-white shadow-xl rounded-xl border max-h-40 overflow-y-auto">
                      {CATALOGOS.transportistas.filter(t=>t.includes(form.recolector)).map(s => (
                        <div key={s} onClick={() => { setForm({...form, recolector: s}); setActiveInput(null); }} className="p-3 hover:bg-green-50 cursor-pointer text-xs font-bold border-b">{s}</div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><select className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 shadow-inner" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} required><option value="">-- DILIGENCIA --</option>{CATALOGOS.diligencias.map(d => <option key={d} value={d}>{d}</option>)}</select><select className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 shadow-inner" value={form.area} onChange={e => setForm({...form, area: e.target.value})} required><option value="">-- ÁREA DESTINO --</option>{CATALOGOS.areas.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <input type="text" placeholder="SUCURSAL ACTUAL..." className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-xl font-bold uppercase focus:border-blue-500 outline-none shadow-inner" value={form.sucursal} onChange={e => handleInput('sucursal', e.target.value)} onFocus={() => setActiveInput('sucursal')} required />
                  {activeInput === 'sucursal' && form.sucursal.length > 0 && (
                    <div className="absolute z-30 w-full mt-2 bg-white shadow-xl rounded-xl border max-h-40 overflow-y-auto">
                      {CATALOGOS.sucursales.filter(t=>t.toUpperCase().includes(form.sucursal)).map(s => (
                        <div key={s} onClick={() => { setForm({...form, sucursal: s}); setActiveInput(null); }} className="p-3 hover:bg-blue-50 cursor-pointer text-xs font-bold border-b">{s}</div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="bg-slate-900 p-6 md:p-8 rounded-[2rem] text-white flex flex-col md:flex-row justify-around items-center gap-6">
                    <div className="flex gap-4">
                        <div className="text-center">
                          <p className="text-[8px] font-bold text-green-400 uppercase mb-2">Entrada</p>
                          <div className="flex gap-1">
                            <select className="bg-slate-800 p-2 rounded-lg font-black text-xs" value={form.hLlegada} onChange={e=>setForm({...form, hLlegada:e.target.value})}>{Array.from({length: 12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select>
                            <select className="bg-slate-800 p-2 rounded-lg font-black text-xs" value={form.mLlegada} onChange={e=>setForm({...form, mLlegada:e.target.value})}>{Array.from({length: 60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select>
                            <select className="bg-green-600 p-2 rounded-lg text-[9px] font-black" value={form.pLlegada} onChange={e=>setForm({...form, pLlegada:e.target.value})}><option>AM</option><option>PM</option></select>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] font-bold text-orange-400 uppercase mb-2">Salida</p>
                          <div className="flex gap-1">
                            <select className="bg-slate-800 p-2 rounded-lg font-black text-xs" value={form.hSalida} onChange={e=>setForm({...form, hSalida:e.target.value})}>{Array.from({length: 12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select>
                            <select className="bg-slate-800 p-2 rounded-lg font-black text-xs" value={form.mSalida} onChange={e=>setForm({...form, mSalida:e.target.value})}>{Array.from({length: 60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select>
                            <select className="bg-orange-600 p-2 rounded-lg text-[9px] font-black" value={form.pSalida} onChange={e=>setForm({...form, pSalida:e.target.value})}><option>AM</option><option>PM</option></select>
                          </div>
                        </div>
                    </div>
                    <div className="text-center border-t md:border-t-0 md:border-l border-slate-700 w-full md:w-auto pt-4 md:pt-0 md:pl-10 font-black"><p className="text-[10px] text-slate-500 uppercase mb-1">Espera</p><h4 className={cn("text-4xl md:text-6xl font-black", getWait() > 5 ? "text-orange-400" : "text-green-400")}>{getWait()}m</h4></div>
                </div>

                {imagePreview && (
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden border-2 border-green-500 shadow-xl"><img src={imagePreview} className="w-full h-full object-cover" alt="Preview"/><button onClick={()=>setImagePreview(null)} className="absolute top-2 right-2 p-2 bg-rose-600 text-white rounded-full shadow-md"><X size={16}/></button></div>
                )}
                
                <label className="w-full p-8 md:p-12 bg-slate-50 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white transition-all text-slate-400 font-bold uppercase text-[10px] shadow-sm"><Camera size={32}/><p>{imagePreview ? "Cambiar Evidencia" : "Captura de Foto Obligatoria"}</p><input type="file" className="hidden" accept="image/*" onChange={(e)=>{const f=e.target.files[0]; if(f){const r=new FileReader(); r.onloadend=()=>setImagePreview(r.result); r.readAsDataURL(f);}}} /></label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button type="submit" disabled={!imagePreview} className={cn("w-full py-5 rounded-3xl font-black text-xl shadow-xl transition-all uppercase tracking-widest", imagePreview ? "bg-slate-900 text-white active:scale-95 shadow-green-500/20" : "bg-slate-200 text-slate-400 cursor-not-allowed")}>Sincronizar <CheckCircle2 size={24} className={imagePreview?"text-green-500":"text-slate-300"} ml-3/></button>
                  <button type="button" onClick={downloadProfessionalReport} className="w-full bg-white border-2 border-slate-200 py-5 rounded-3xl font-black text-xl text-slate-600 uppercase flex items-center justify-center gap-3 active:scale-95"><Download size={20}/> Descargar Ficha</button>
                </div>
              </form>
            </div>
            <div className="space-y-6"><div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group"><p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest leading-none">Mi Efficiency Hub</p><h4 className="text-7xl font-black text-green-500 mb-2 leading-none">{metrics.efP}%</h4><p className="text-[10px] font-bold text-slate-400 uppercase italic">Foco en Vital (Muestras)</p><TrendingUp className="absolute -right-10 -bottom-10 text-white opacity-5" size={220}/></div></div>
          </div>
        ) : (
          /* MONITOR ADMINISTRATIVO */
          <div className="space-y-10 animate-in fade-in duration-500">
             <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-white p-8 md:p-12 rounded-[3.5rem] shadow-xl border border-slate-100">
                <div><h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none">Monitor HUB</h2><div className="flex gap-2 mt-6 bg-slate-100 p-1.5 rounded-xl border w-fit shadow-inner"><button onClick={()=>setAdminTab('general')} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", adminTab==='general'?"bg-white shadow-md text-slate-900":"text-slate-400")}>Panorama</button><button onClick={()=>setAdminTab('individual')} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all", adminTab==='individual'?"bg-white shadow-md text-slate-900":"text-slate-400")}>Individual</button></div></div>
                <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                  <div className="flex bg-slate-50 p-2 rounded-xl border-2 gap-4 items-center flex-1 lg:flex-none shadow-sm"><select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-transparent font-black text-[11px] uppercase outline-none px-2">{['all',1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m}>{m==='all'?'Año':'Mes '+m}</option>)}</select>{adminTab === 'individual' && <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} className="bg-transparent font-black text-[11px] uppercase outline-none px-2 min-w-[150px]"><option value="all">Elegir Flota</option>{CATALOGOS.transportistas.map(u=><option key={u} value={u}>{u}</option>)}</select>}</div>
                  <button onClick={downloadProfessionalReport} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-3 active:scale-95"><Download size={16}/> Reporte</button>
                  <button onClick={() => setDataSource(dataSource === 'live' ? 'csv' : 'live')} className={cn("px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-3 transition-all", dataSource==='live'?"bg-blue-600 text-white":"bg-green-600 text-white")}><Layers size={16}/> {dataSource==='live'?'Ver Historial':'Ver Live'}</button>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2"><p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Vital (Muestras)</p><h3 className="text-4xl font-black text-slate-800">{metrics.efP}% <span className="text-xs text-slate-400 font-bold ml-2">Eficiencia</span></h3><p className="text-xs font-bold text-slate-500 bg-indigo-50 w-fit px-3 py-1 rounded-full">Espera: {metrics.avgP}m</p></div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-2"><p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Secundario</p><h3 className="text-4xl font-black text-slate-800">{metrics.efS}% <span className="text-xs text-slate-400 font-bold ml-2">Eficiencia</span></h3><p className="text-xs font-bold text-slate-500 bg-orange-50 w-fit px-3 py-1 rounded-full">Espera: {metrics.avgS}m</p></div>
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-center"><p className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Total Registros</p><h3 className="text-5xl font-black">{metrics.total}</h3></div>
             </div>

             <div className="bg-white rounded-[3rem] shadow-xl border overflow-hidden p-6 md:p-12">
                <h4 className="font-black text-slate-800 uppercase text-xs md:text-sm tracking-widest mb-10 flex items-center gap-4"><ShieldCheck className="text-green-500" size={24}/> Bitácora de Operación Reciente</h4>
                <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-6 py-4 text-left">Transportista</th><th className="px-6 py-4">Punto</th><th className="px-6 py-4">Tiempo</th><th className="px-6 py-4 text-center">Evidencia</th><th className="px-6 py-4">Categoría</th></tr></thead><tbody className="divide-y">{metrics.rows.slice(0, 20).map((r, i) => (<tr key={i} className="hover:bg-slate-50/80 group transition-all"><td className="px-6 py-6 font-black text-slate-800 text-sm tracking-tight">{r.recolector}</td><td className="px-6 py-6 text-slate-500 font-bold text-xs">{r.sucursal}</td><td className={cn("px-6 py-6 font-black", r.tiempo > 5 ? "text-orange-500" : "text-green-600")}>{r.tiempo}m</td><td className="px-6 py-6 text-center">{r.fotoData ? <div className="relative group cursor-pointer inline-block" onClick={()=>setViewingPhoto(r.fotoData)}><img src={r.fotoData} className="w-12 h-12 rounded-lg object-cover border-2 border-slate-100 shadow-sm" alt="Thumbnail" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-all"><Eye className="text-white" size={16}/></div></div> : <ImageIcon className="text-slate-200" size={20}/>}</td><td className="px-6 py-6"><span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase border", r.categoria === "Principal" ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-orange-50 text-orange-600 border-orange-100")}>{r.categoria}</span></td></tr>))}</tbody></table></div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}