import React, { useState, useEffect, useMemo } from 'react';
// --- 1. IMPORTACIONES ---
import { useAuth } from './context/AuthContext';
import LoginModule from './components/LoginModule';
import { db, storage } from './config/firebase'; 
import FuelModule from './components/FuelModule'; 
import ScheduleModule from './components/ScheduleModule';
import MaintenanceModule from './components/MaintenanceModule';
import OvertimeModule from './components/OvertimeModule';
import AgendaAdmin from './components/AgendaAdmin';

import { collection, addDoc, query, onSnapshot, orderBy, limit, getDocs, doc, deleteDoc, updateDoc, where } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- ICONOS ---
import { 
  Bike, ClipboardList, TrendingUp, Clock, CheckCircle2, Database, Download, Camera, 
  ExternalLink, MessageSquare, BarChart3, FileSpreadsheet, User, Fuel, DollarSign, 
  Calendar, Wrench, Briefcase, Eye, Search, Filter, MapPin, Layers, ShieldCheck, 
  Loader2, Image as ImageIcon, Eraser, Edit, Trash2, X, Edit3, Save, RefreshCw, PieChart,
  Bell, Send, XCircle, Check
} from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, LineChart, Line } from 'recharts';
import Papa from 'papaparse';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const GITHUB_CSV_URL = "https://raw.githubusercontent.com/mnoeanaliza/recolekta-os/refs/heads/main/Datos.csv";

export const USUARIOS_EMAIL = {
  "brayan@recolekta.com": "BRAYAN REYES",
  "edwin@recolekta.com": "EDWIN FLORES",
  "teodoro@recolekta.com": "TEODORO PÉREZ",
  "giovanni@recolekta.com": "GIOVANNI CALLEJAS",
  "jairo@recolekta.com": "JAIRO GIL",
  "jason@recolekta.com": "JASON BARRERA",
  "antonio@recolekta.com": "ANTONIO RIVAS",
  "walter@recolekta.com": "WALTER RIVAS",
  "rogelio@recolekta.com": "ROGELIO MAZARIEGO",
  "david@recolekta.com": "DAVID ALVARADO",
  "carlos@recolekta.com": "CARLOS SOSA",
  "felix@recolekta.com": "FELIX VASQUEZ",
  "flor@recolekta.com": "FLOR CARDOZA",
  "hildebrando@recolekta.com": "HILDEBRANDO MENJIVAR",
  "test@admin.com": "USUARIO PRUEBA",
  "chofer@recolekta.com": "CHOFER PRUEBA",
  "admin@recolekta.com": "ADMINISTRADOR",
  "supervision@recolekta.com": "SUPERVISOR",
  "supervisor@recolekta.com": "SUPERVISOR"
};

const CATALOGOS = {
  transportistas: [
    "BRAYAN REYES", "EDWIN FLORES", "TEODORO PÉREZ", "GIOVANNI CALLEJAS", "JAIRO GIL", "JASON BARRERA", 
    "ANTONIO RIVAS", "WALTER RIVAS", "ROGELIO MAZARIEGO", "DAVID ALVARADO", "CARLOS SOSA", "FELIX VASQUEZ", 
    "FLOR CARDOZA", "HILDEBRANDO MENJIVAR", "USUARIO PRUEBA"
  ],
  sucursales: [
    "Constitución", "Soyapango", "San Miguel", "Lourdes", "Valle Dulce", "Venecia", "San Miguel 2", "Sonsonate 1", 
    "Puerto", "San Martín", "San Miguel 3", "Sonsonate 2", "San Gabriel", "Casco", "La Unión", "Sonsonate 3", 
    "Cojutepeque", "Zacatecoluca", "Santa Ana 1", "Merliot 1", "Santa Ana 2", "Merliot 2", "Ramblas", "Escalón 1", 
    "Metapán", "Escalón 2", "Marsella", "Medica 1", "Opico", "Medica 2", "Medica 3", "Medica 4", "Santa Tecla", 
    "Plaza Soma", "Plaza Sur", "Santa Elena", "Chalatenango", "Aguilares"
  ],
  areas: ["LABORATORIO / PROCESAMIENTO", "TUVET", "Imágenes Escalón","Imágenes Medica", "Centro de Distribución", "LAB. Externo", "Contabilidad", "RRHH", "Contac Center", "Empresas", "Fisioterapia", "Cuentas por cobrar", "Mercadeo", "Fidelizacion", "IT", "LOGÍSTICA / RUTA"],
  diligencias: ["Recolección de muestras", "Entrega de Muestras", "Traslado de toallas", "Traslado de reactivo", "Traslado de insumos", "Traslado de cortes", "Traslado de documentos", "Pago de aseguradora", "Pago o tramite bancario", "Tramite o diligencia extraordinaria", "INCIDENCIA EN RUTA"]
};

const PRINCIPAL_KEYWORDS = ["muestras", "entrega", "recepción", "recolección", "recoleccion"];

const isPrincipalData = (d) => { 
    if (d.categoria === "Principal") return true; 
    const txt = (d.tipo || d.originalTipo || '').toLowerCase(); 
    return PRINCIPAL_KEYWORDS.some(k => txt.includes(k)); 
};

const formatLocalDate = (dateStr) => {
    if (!dateStr) return '--';
    if (dateStr.includes('-') && !dateStr.includes('T')) {
        const [y, m, d] = dateStr.split('-');
        if (y && m && d) return `${d}/${m}/${y}`;
    }
    try { return new Date(dateStr).toLocaleDateString('es-ES'); } catch(e) { return dateStr; }
};

export default function App() {
  const { currentUser } = useAuth();
  if (!currentUser) return <LoginModule />;
  return <Dashboard />;
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
  const [fuelData, setFuelData] = useState([]); 
  const [maintData, setMaintData] = useState([]); 
  const [otData, setOtData] = useState([]); 
  const [csvData, setCsvData] = useState([]); 
  const [agendaData, setAgendaData] = useState([]); 
  const [alertasData, setAlertasData] = useState([]);
  
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  
  const availableYears = useMemo(() => {
      const current = new Date().getFullYear();
      const start = 2025;
      const years = [];
      for(let y = start; y <= current + 1; y++) { years.push(y.toString()); }
      return years;
  }, []);

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

  useEffect(() => {
    if (!currentUser) return;
    const email = currentUser.email.toLowerCase().trim();
    if (email === 'admin@recolekta.com') { setAppMode('admin'); } 
    else if (email === 'supervision@recolekta.com' || email === 'supervisor@recolekta.com') { setAppMode('supervisor'); } 
    else {
      setAppMode('user');
      const nombreReal = USUARIOS_EMAIL[currentUser.email];
      if (nombreReal) setForm(prev => ({ ...prev, recolector: nombreReal }));
    }

    const savedHiddenAlerts = localStorage.getItem(`recolekta_hidden_alerts_${email}`);
    if (savedHiddenAlerts) {
        try { setHiddenAlerts(JSON.parse(savedHiddenAlerts)); } catch (e) { console.error("Error parsing hidden alerts", e); }
    }
  }, [currentUser]);

  useEffect(() => {
    if (!localStorage.getItem('recolekta_tutorial_v97')) setShowWelcome(true);

    Papa.parse(GITHUB_CSV_URL, {
        download: true, header: true,
        complete: (res) => {
            const mapped = (res.data || []).map(row => {
                const tipoRaw = String(row['Diligencia realizada:']||'');
                const isP = PRINCIPAL_KEYWORDS.some(k => tipoRaw.toLowerCase().includes(k));
                let tiempoClean = 0;
                const matches = String(row['Minutos de espera'] || '0').match(/\d+/);
                if (matches) tiempoClean = parseInt(matches[0]);
                return { recolector: String(row['Nombre de Transportista']||'').toUpperCase().trim(), tiempo: tiempoClean, sucursal: row['Sucursal '] || 'Ruta Externa', tipo: tipoRaw, categoria: isP ? "Principal" : "Secundaria", originalTipo: tipoRaw, fotoData: row['Fotografía de bitácora:'] || null, observaciones: row['Observaciones'] || '', month: parseInt(String(row['Marca temporal']||'').split(/[\s\/]+/)[1])||1, createdAt: row['Marca temporal'], hLlegada: '--', mLlegada: '--', pLlegada: '', hSalida: '--', mSalida: '--', pSalida: '' };
            }).filter(r => r.recolector !== '');
            setCsvData(mapped);
        }
    });

    let unsubOps, unsubFuel, unsubMaint, unsubOt, unsubAlertas;
    
    // 🛡️ SOLUCIÓN: QUITAR ORDER BY PARA EVITAR EL INDEX COMPUESTO EN USUARIOS
    if (appMode === 'admin' || appMode === 'supervisor') {
        if (dataSource === 'live') {
            const qOps = query(collection(db, "registros_produccion"), orderBy("createdAt", "desc"), limit(2000)); 
            unsubOps = onSnapshot(qOps, (snap) => setLiveData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            const qFuel = query(collection(db, "registros_combustible"), orderBy("fecha", "desc"), limit(3000));
            unsubFuel = onSnapshot(qFuel, (snap) => setFuelData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            const qMaint = query(collection(db, "registros_mantenimiento"), orderBy("fecha", "desc"), limit(3000));
            unsubMaint = onSnapshot(qMaint, (snap) => setMaintData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            const qOt = query(collection(db, "registros_horas_extras"), orderBy("fecha", "desc"), limit(3000));
            unsubOt = onSnapshot(qOt, (snap) => setOtData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            const qAlertas = query(collection(db, "alertas_flota"), orderBy("createdAt", "desc"), limit(20));
            unsubAlertas = onSnapshot(qAlertas, (snap) => setAlertasData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        } else {
            const fetchHistory = async () => {
                setIsFetchingHistory(true);
                try {
                    const startStr = `${parseInt(filterYear) - 1}-01-01`; const endStr = `${parseInt(filterYear) + 1}-01-01`;
                    const snapOps = await getDocs(query(collection(db, "registros_produccion"), where("createdAt", ">=", startStr), where("createdAt", "<", endStr))); setLiveData(snapOps.docs.map(d => ({ id: d.id, ...d.data() })));
                    const snapFuel = await getDocs(query(collection(db, "registros_combustible"), where("fecha", ">=", startStr.slice(0,10)), where("fecha", "<", endStr.slice(0,10)))); setFuelData(snapFuel.docs.map(d => ({ id: d.id, ...d.data() })));
                    const snapMaint = await getDocs(query(collection(db, "registros_mantenimiento"), where("fecha", ">=", startStr.slice(0,10)), where("fecha", "<", endStr.slice(0,10)))); setMaintData(snapMaint.docs.map(d => ({ id: d.id, ...d.data() })));
                    const snapOt = await getDocs(query(collection(db, "registros_horas_extras"), where("fecha", ">=", startStr.slice(0,10)), where("fecha", "<", endStr.slice(0,10)))); setOtData(snapOt.docs.map(d => ({ id: d.id, ...d.data() })));
                } catch (error) { console.error("Error histórico", error); } finally { setIsFetchingHistory(false); }
            };
            fetchHistory();
        }
    } else if (appMode === 'user' && currentUser?.email) {
        // MODO transportista: QUITAMOS EL ORDER BY PARA QUE FUNCIONE SIN INDICES FIREBASE
        const qOps = query(collection(db, "registros_produccion"), where("usuarioEmail", "==", currentUser.email), limit(50));
        unsubOps = onSnapshot(qOps, (snap) => {
            const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            arr.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setLiveData(arr);
        });

        const qOt = query(collection(db, "registros_horas_extras"), where("usuario", "==", currentUser.email), limit(50));
        unsubOt = onSnapshot(qOt, (snap) => {
            const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            arr.sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));
            setOtData(arr);
        });

        const qAlertas = query(collection(db, "alertas_flota"), orderBy("createdAt", "desc"), limit(10));
        unsubAlertas = onSnapshot(qAlertas, (snap) => setAlertasData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        
        setFuelData([]); setMaintData([]);
    }

    const loadAgenda = async () => { const snap = await getDocs(collection(db, "agenda_flota")); setAgendaData(snap.docs.map(d => ({ id: d.id, ...d.data() }))); };
    loadAgenda();

    return () => { if (unsubOps) unsubOps(); if (unsubFuel) unsubFuel(); if (unsubMaint) unsubMaint(); if (unsubOt) unsubOt(); if (unsubAlertas) unsubAlertas(); };
  }, [dataSource, filterYear, filterMonth, appMode, currentUser]); 

  const extractDateInfo = (dateStr) => {
      if (!dateStr) return { year: null, month: null };
      if (dateStr.includes('/')) { const parts = dateStr.split(/[\s\/:]+/); return { year: parts.find(p => p.length === 4) || '2025', month: parseInt(parts[1], 10) }; } 
      else { const d = new Date(dateStr); if(isNaN(d.getTime())) return { year: null, month: null }; return { year: d.getFullYear().toString(), month: d.getMonth() + 1 }; }
  };
  const checkDate = (dateStr) => { const { year, month } = extractDateInfo(dateStr); return year === filterYear && (filterMonth === 'all' || month === parseInt(filterMonth)); };

  const handleDelete = async (collectionName, id) => { if(window.confirm("⚠️ ¿Eliminar registro permanentemente?")) { try { await deleteDoc(doc(db, collectionName, id)); } catch(e) { alert("Error al eliminar"); } } };
  const openEditModal = (item, collectionName) => { setEditingItem({...item, collectionName}); setEditFormData(item); };
  const handleUpdate = async () => { if(!editingItem) return; try { const { id, collectionName, ...rest } = editingItem; await updateDoc(doc(db, collectionName, id), editFormData); setEditingItem(null); } catch(e) { console.error(e); alert("Error al actualizar"); } };
  const handleEditFormChange = (e) => { const { name, value } = e.target; setEditFormData(prev => ({...prev, [name]: value})); };

  const fleetMetrics = useMemo(() => {
    let filteredFuel = fuelData.filter(d => checkDate(d.fecha)); let filteredMaint = maintData.filter(d => checkDate(d.fecha));
    if (filterUser !== 'all') { filteredFuel = filteredFuel.filter(d => (USUARIOS_EMAIL[d.usuario] || '') === filterUser); filteredMaint = filteredMaint.filter(d => (USUARIOS_EMAIL[d.usuario] || '') === filterUser); }
    const totalFuelCost = filteredFuel.reduce((acc, curr) => acc + parseFloat(curr.costo || 0), 0); const totalGalones = filteredFuel.reduce((acc, curr) => acc + parseFloat(curr.galones || 0), 0); const totalMaintCost = filteredMaint.reduce((acc, curr) => acc + parseFloat(curr.costo || 0), 0);
    const userStats = {};
    const process = (i, k) => { const rawName = i.usuario || 'Desconocido'; const name = (USUARIOS_EMAIL[rawName] || rawName).split(' ')[0]; userStats[name] = userStats[name] || { fuel: 0, maint: 0 }; userStats[name][k] += parseFloat(i.costo || 0); };
    filteredFuel.forEach(i => process(i, 'fuel')); filteredMaint.forEach(i => process(i, 'maint'));
    const chartData = Object.entries(userStats).map(([name, stats]) => ({ name, fuel: parseFloat(stats.fuel.toFixed(2)), maint: parseFloat(stats.maint.toFixed(2)), total: parseFloat((stats.fuel + stats.maint).toFixed(2)) })).sort((a,b) => b.total - a.total);
    return { totalFuelCost: totalFuelCost.toFixed(2), totalGalones: totalGalones.toFixed(2), totalMaintCost: totalMaintCost.toFixed(2), chartData };
  }, [fuelData, maintData, filterMonth, filterUser, filterYear]);

  const hrMetrics = useMemo(() => {
    let filteredOt = otData.filter(d => checkDate(d.fecha));
    if (filterUser !== 'all') filteredOt = filteredOt.filter(d => (USUARIOS_EMAIL[d.usuario] || '') === filterUser);
    const totalHoras = filteredOt.reduce((acc, curr) => { const hrs = parseFloat(String(curr.horasCalculadas).replace(',', '.')) || 0; return acc + hrs; }, 0);
    const userOtStats = filteredOt.reduce((acc, curr) => { const rawName = curr.usuario || 'Desconocido'; const name = USUARIOS_EMAIL[rawName] || rawName; const hrs = parseFloat(String(curr.horasCalculadas).replace(',', '.')) || 0; acc[name] = (acc[name] || 0) + hrs; return acc; }, {});
    const rankingOt = Object.entries(userOtStats).map(([name, hours]) => ({ name, hours: parseFloat(hours.toFixed(2)) })).sort((a,b) => b.hours - a.hours);
    return { totalHoras: totalHoras.toFixed(2), totalRegistros: filteredOt.length, rankingOt, rawData: filteredOt };
  }, [otData, filterMonth, filterUser, filterYear]);

  const metrics = useMemo(() => {
    const data = filterYear === '2025' ? csvData : liveData;
    let filtered = data.filter(d => checkDate(d.createdAt));
    if (filterUser !== 'all') filtered = filtered.filter(d => d.recolector === filterUser);
    const pItems = filtered.filter(d => isPrincipalData(d)); const sItems = filtered.filter(d => !isPrincipalData(d));
    const calcEf = (arr) => arr.length > 0 ? ((arr.filter(x => (x.tiempo||0) <= 5).length / arr.length) * 100).toFixed(1) : 0;
    const calcAvg = (arr) => arr.length > 0 ? (arr.reduce((a,b)=>a+(b.tiempo||0),0)/arr.length).toFixed(1) : 0;
    const monthlyData = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => { const mDocs = data.filter(d => { const { year, month } = extractDateInfo(d.createdAt); return year === filterYear && month === i + 1; }); const finalDocs = filterUser === 'all' ? mDocs : mDocs.filter(d => d.recolector === filterUser); const mRecs = finalDocs.filter(d => isPrincipalData(d)); return { name: m, ef: parseFloat(calcEf(mRecs)), count: finalDocs.length }; }).filter(d => d.count > 0);
    const sucursalStats = filtered.reduce((acc, curr) => { if(!curr.sucursal || curr.sucursal === 'N/A' || curr.sucursal === 'Ruta Externa') return acc; acc[curr.sucursal] = acc[curr.sucursal] || { totalTime: 0, count: 0 }; acc[curr.sucursal].totalTime += (curr.tiempo || 0); acc[curr.sucursal].count += 1; return acc; }, {});
    const topSucursales = Object.entries(sucursalStats).map(([name, stats]) => ({ name, avgWait: parseFloat((stats.totalTime / stats.count).toFixed(1)) })).sort((a,b) => b.avgWait - a.avgWait).slice(0, 5);
    return { total: filtered.length, efP: calcEf(pItems), avgP: calcAvg(pItems), countP: pItems.length, efS: calcEf(sItems), avgS: calcAvg(sItems), countS: sItems.length, monthlyData, topSucursales, rows: filtered };
  }, [liveData, csvData, filterMonth, filterUser, filterYear]);

  const biMetrics = useMemo(() => {
      const y1 = filterYear; const y2 = (parseInt(filterYear) - 1).toString(); const allOps = [...liveData, ...csvData]; const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const dataYoY = months.map((m, i) => {
          const mNum = i + 1;
          const getOps = (y) => { let docs = allOps.filter(d => { const info = extractDateInfo(d.createdAt); return info.year === y && info.month === mNum; }); if (filterUser !== 'all') docs = docs.filter(x => x.recolector === filterUser); return docs; };
          const ops1 = getOps(y1); const ops2 = getOps(y2);
          const calcEf = (docs) => { const recs = docs.filter(d => isPrincipalData(d)); if(recs.length === 0) return 0; return parseFloat(((recs.filter(x => (x.tiempo||0) <= 5).length / recs.length) * 100).toFixed(1)); };
          const getFuel = (y) => { let docs = fuelData.filter(d => { const info = extractDateInfo(d.fecha); return info.year === y && info.month === mNum; }); if (filterUser !== 'all') docs = docs.filter(x => (USUARIOS_EMAIL[x.usuario]||'') === filterUser); return docs.reduce((sum, d) => sum + parseFloat(d.costo||0), 0); };
          const getMaint = (y) => { let docs = maintData.filter(d => { const info = extractDateInfo(d.fecha); return info.year === y && info.month === mNum; }); if (filterUser !== 'all') docs = docs.filter(x => (USUARIOS_EMAIL[x.usuario]||'') === filterUser); return docs.reduce((sum, d) => sum + parseFloat(d.costo||0), 0); };
          return { name: m, [`ef${y1}`]: calcEf(ops1), [`ef${y2}`]: calcEf(ops2), [`fuel${y1}`]: parseFloat(getFuel(y1).toFixed(2)), [`fuel${y2}`]: parseFloat(getFuel(y2).toFixed(2)), [`maint${y1}`]: parseFloat(getMaint(y1).toFixed(2)), [`maint${y2}`]: parseFloat(getMaint(y2).toFixed(2)) }
      });
      return { dataYoY, yCurrent: y1, yPrev: y2 };
  }, [liveData, csvData, fuelData, maintData, filterYear, filterUser]);

  const convertToMinutes = (h, m, p) => { let hour = parseInt(h); if (p === 'AM' && hour === 12) hour = 0; if (p === 'PM' && hour !== 12) hour += 12; return hour * 60 + parseInt(m); };
  const getWait = () => { const startMins = convertToMinutes(form.hLlegada, form.mLlegada, form.pLlegada); const endMins = convertToMinutes(form.hSalida, form.mSalida, form.pSalida); return Math.max(0, endMins - startMins); };
  const handleInput = (field, value) => { setForm(prev => ({ ...prev, [field]: field === 'recolector' ? value.toUpperCase() : value })); setActiveInput(field); };
  const compressImage = (file) => { return new Promise((resolve) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (event) => { const img = new Image(); img.src = event.target.result; img.onload = () => { const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; const scaleSize = MAX_WIDTH / img.width; canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); canvas.toBlob((blob) => { resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() })); }, 'image/jpeg', 0.7); }; }; }); };
  const handleFile = async (e) => { const file = e.target.files[0]; if (file) { setIsCompressing(true); try { const compressedFile = await compressImage(file); setImageFile(compressedFile); const reader = new FileReader(); reader.onloadend = () => setImagePreview(reader.result); reader.readAsDataURL(compressedFile); } catch (e) { alert("Error al procesar la imagen"); } finally { setIsCompressing(false); } } };
  
  const userMetrics = useMemo(() => {
    const data = filterYear === '2025' ? csvData : liveData;
    const targetUser = form.recolector;
    let userDocs = targetUser && targetUser.length > 2 ? data.filter(d => d.recolector === targetUser) : data;
    const today = new Date().toLocaleDateString();
    userDocs = userDocs.filter(d => new Date(d.createdAt).toLocaleDateString() === today);
    const recs = userDocs.filter(d => isPrincipalData(d));
    const ef = recs.length > 0 ? ((recs.filter(x => (x.tiempo||0) <= 5).length / recs.length) * 100).toFixed(1) : 0;
    return { ef: ef, count: userDocs.length, label: targetUser && targetUser.length > 2 ? targetUser.split(' ')[0] : 'HOY' };
  }, [liveData, csvData, form.recolector, filterYear]);

  // --- LÓGICA DE ALERTAS (CON ID DE MEMORIA VINCULADA AL TEXTO) ---
  const userAlerts = useMemo(() => {
      const alerts = [];
      if (appMode !== 'user') return alerts;

      const miAgenda = agendaData.find(a => a.id === form.recolector);
      if (miAgenda) {
          const todayDate = new Date();
          const day = String(todayDate.getDate()).padStart(2, '0');
          const month = String(todayDate.getMonth() + 1).padStart(2, '0');
          const year = todayDate.getFullYear();

          const localTodayStr = `${year}-${month}-${day}`; 
          const todayShortSlash = `${day}/${month}`;       
          const todayShortDash = `${day}-${month}`;        
          const todayFullSlash = `${day}/${month}/${year}`;
          const todayFullDash = `${day}-${month}-${year}`; 
          
          const monthUnpadded = todayDate.getMonth() + 1;
          const dayUnpadded = todayDate.getDate();
          const todayShortSlashUnp = `${dayUnpadded}/${monthUnpadded}`; 
          const todayFullSlashUnp = `${dayUnpadded}/${monthUnpadded}/${year}`; 

          const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
          const todayName = days[todayDate.getDay()];

          const isMaintToday = miAgenda.mantenimiento === localTodayStr;
          
          const turnosTxt = (miAgenda.turnos || '').toLowerCase();
          const hasTurnoToday = 
              turnosTxt.includes(todayName.toLowerCase()) || 
              turnosTxt.includes(todayShortSlash) || 
              turnosTxt.includes(todayShortDash) || 
              turnosTxt.includes(todayFullSlash) || 
              turnosTxt.includes(todayFullDash) ||
              turnosTxt.includes(todayShortSlashUnp) ||
              turnosTxt.includes(todayFullSlashUnp);

          // Ahora el ID depende del texto exacto. Si el Admin cambia el texto, la alerta revive para el chofer.
          const maintId = `auto_maint_${localTodayStr}_${miAgenda.mantenimiento || ''}`;
          const turnoId = `auto_turno_${localTodayStr}_${miAgenda.turnos || ''}`;

          if (isMaintToday && !hiddenAlerts.includes(maintId)) alerts.push({ id: maintId, type: 'maint', title: '¡Mantenimiento Hoy!', msg: 'Lleva la unidad al taller en la hora indicada.' });
          if (hasTurnoToday && !hiddenAlerts.includes(turnoId)) alerts.push({ id: turnoId, type: 'turno', title: '¡Turno Extra Hoy!', msg: 'Registra tus horas al finalizar.' });
      }

      alertasData.forEach(alerta => {
          if (hiddenAlerts.includes(alerta.id)) return;
          if (alerta.para === 'Todos' || alerta.para === form.recolector) {
              alerts.push({ 
                  ...alerta, 
                  type: 'admin_msg',
                  title: alerta.tipo === 'confirm' ? 'Requiere Confirmación' : (alerta.para === 'Todos' ? 'Aviso General' : 'Mensaje Directo'),
                  msg: alerta.mensaje 
              });
          }
      });
      return alerts;
  }, [agendaData, form.recolector, alertasData, appMode, hiddenAlerts]);

  const dismissAlert = async (alerta) => {
      if (alerta.tipo === 'confirm') {
          try { await deleteDoc(doc(db, "alertas_flota", alerta.id)); } catch(e) { alert("Error al confirmar"); }
      } else {
          const newHidden = [...hiddenAlerts, alerta.id];
          setHiddenAlerts(newHidden);
          if (currentUser && currentUser.email) {
              localStorage.setItem(`recolekta_hidden_alerts_${currentUser.email}`, JSON.stringify(newHidden));
          }
      }
  };

  const exportToCSV = () => { 
    const data = filterYear === '2025' ? csvData : liveData; 
    if (!data || data.length === 0) return alert("No hay datos"); 
    const csvRows = data.map(r => ({ Fecha: r.createdAt, Mes: r.month, Transportista: r.recolector, Sucursal: r.sucursal, Diligencia: r.tipo, Area: r.area || 'N/A', Categoria: r.categoria, Entrada: r.hLlegada && r.mLlegada ? `${r.hLlegada}:${r.mLlegada} ${r.pLlegada}` : '', Salida: r.hSalida && r.mSalida ? `${r.hSalida}:${r.mSalida} ${r.pSalida}` : '', Espera_Minutos: r.tiempo, Observaciones: r.observaciones || '', Foto_URL: r.fotoData || '' })); 
    const csv = Papa.unparse(csvRows, { delimiter: ";" }); 
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob); 
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Respaldo_Recolekta_${filterYear}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); 
  };
  
  const exportPayrollCSV = () => { 
    if (!otData || otData.length === 0) return alert("No hay datos de horas extras."); 
    const formatTime12 = (time24) => { if(!time24) return ''; const [h, m] = time24.split(':'); let hours = parseInt(h); const ampm = hours >= 12 ? 'p.m.' : 'a.m.'; hours = hours % 12; hours = hours ? hours : 12; return `${hours}:${m} ${ampm}`; }; 
    const splitSchedule = (scheduleStr) => { if (!scheduleStr || !scheduleStr.includes('-')) return { start: '', end: '' }; const parts = scheduleStr.split('-'); return { start: parts[0].trim(), end: parts[1].trim() }; }; 
    const csvRows = otData.map(r => { const workHours = splitSchedule(r.horarioTurno || ''); const heStart = formatTime12(r.horaInicio); const heEnd = formatTime12(r.horaFin); return { 'A': '', 'B': formatLocalDate(r.createdAt || r.fecha), 'C': USUARIOS_EMAIL[r.usuario] || r.usuario, 'D': formatLocalDate(r.fecha), 'E': workHours.start, 'F': workHours.end, 'G': heStart, 'H': heEnd, 'I': r.horasCalculadas, 'J': r.motivo || '', 'K': r.horarioTurno || '', 'L': `${heStart} - ${heEnd}` }; }); 
    const csv = Papa.unparse(csvRows, { delimiter: ";", header: false }); 
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob); 
    const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Consolidado_HE_${filterYear}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); 
  };
  
  const downloadReport = (forcedUser = null) => {
    let validForcedUser = (forcedUser && typeof forcedUser !== 'object') ? forcedUser : null;
    const doc = new jsPDF();
    const slate900 = [15, 23, 42]; const green500 = [34, 197, 94]; const orange500 = [249, 115, 22];
    const drawHeader = (title, subtitle) => { doc.setFillColor(...slate900); doc.rect(0,0,210,40,'F'); doc.setFillColor(...green500); doc.circle(20, 20, 10, 'F'); doc.setTextColor(255); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("R", 17.5, 22); doc.setFontSize(22); doc.text("RECOLEKTA OS", 35, 18); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("SISTEMA DE GESTIÓN LOGÍSTICA", 35, 24); doc.setTextColor(40); doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(title, 15, 55); doc.setFontSize(10); doc.setTextColor(100); doc.text(subtitle, 15, 61); };
    const dateStr = new Date().toLocaleDateString();

    if (appMode === 'supervisor' && supervisorSection === 'agenda') {
        drawHeader("AGENDA OPERATIVA GLOBAL", `Generado: ${dateStr}`);
        const rows = agendaData.map(a => [a.id, a.horario || '--', a.zona || '--', a.puntos || '--', a.turnos || 'Ninguno', formatLocalDate(a.mantenimiento)]);
        autoTable(doc, { startY: 65, head: [['Transportista', 'Horario Base', 'Zona/Ruta', 'Puntos/Sucursales', 'Turnos Extra', 'Mantenimiento']], body: rows, headStyles: { fillColor: slate900 }, theme: 'grid', styles: { fontSize: 8 } });
        doc.save("Recolekta_Agenda_Global.pdf");
        return;
    }
    if (appMode === 'supervisor' && supervisorSection === 'combustible') {
        drawHeader("CONTROL DE COMBUSTIBLE", `Generado: ${dateStr} | Filtro: ${filterUser !== 'all' ? filterUser : 'GLOBAL'} | Año: ${filterYear}`);
        let data = fuelData.filter(d => checkDate(d.fecha));
        if (filterUser !== 'all') data = data.filter(d => (USUARIOS_EMAIL[d.usuario]||'').includes(filterUser));
        const rows = data.map(r => [formatLocalDate(r.fecha), USUARIOS_EMAIL[r.usuario] || r.usuario, r.galones, `$${r.costo}`]);
        autoTable(doc, { startY: 65, head: [['Fecha', 'Usuario', 'Galones', 'Total Pagado']], body: rows, headStyles: { fillColor: slate900 }, theme: 'striped' });
        doc.save("Recolekta_Combustible.pdf");
        return;
    }
    if (appMode === 'supervisor' && supervisorSection === 'taller') {
        drawHeader("CONTROL DE TALLER Y MANTENIMIENTO", `Generado: ${dateStr} | Filtro: ${filterUser !== 'all' ? filterUser : 'GLOBAL'} | Año: ${filterYear}`);
        let data = maintData.filter(d => checkDate(d.fecha));
        if (filterUser !== 'all') data = data.filter(d => (USUARIOS_EMAIL[d.usuario]||'').includes(filterUser));
        const rows = data.map(r => [formatLocalDate(r.fecha), USUARIOS_EMAIL[r.usuario] || r.usuario, r.tipo, r.taller, r.descripcion || '--', `$${r.costo}`]);
        autoTable(doc, { startY: 65, head: [['Fecha', 'Usuario', 'Tipo', 'Taller', 'Detalle/Descripción', 'Costo']], body: rows, headStyles: { fillColor: slate900 }, theme: 'striped' });
        doc.save("Recolekta_Mantenimiento.pdf");
        return;
    }

    const targetUser = validForcedUser || (appMode === 'user' ? form.recolector : (filterUser !== 'all' ? filterUser : null));
    const reportTitle = targetUser ? `FICHA HISTÓRICA: ${targetUser}` : "REPORTE CONSOLIDADO DE FLOTA";
    drawHeader(reportTitle, `Periodo: ${filterMonth === 'all' ? 'ANUAL' : 'MES ' + filterMonth} ${filterYear} | Fuente: ${filterYear==='2025'?'CSV':dataSource.toUpperCase()}`);
    let reportData = filterYear === '2025' ? csvData : liveData;
    reportData = reportData.filter(d => checkDate(d.createdAt));
    if (targetUser) reportData = reportData.filter(d => d.recolector === targetUser);
    const pItems = reportData.filter(d => isPrincipalData(d));
    const sItems = reportData.filter(d => !isPrincipalData(d));
    const efP = pItems.length > 0 ? ((pItems.filter(x => (x.tiempo||0) <= 5).length / pItems.length) * 100).toFixed(1) : 0;
    const avgP = pItems.length > 0 ? (pItems.reduce((a,b)=>a+(b.tiempo||0),0)/pItems.length).toFixed(1) : 0;
    const avgS = sItems.length > 0 ? (sItems.reduce((a,b)=>a+(b.tiempo||0),0)/sItems.length).toFixed(1) : 0;
    doc.setTextColor(0);
    doc.text(`Eficiencia Recolección: ${efP}% (Meta: 95%)`, 20, 75);
    doc.text(`Promedio Espera (Muestras): ${avgP} min`, 20, 81);
    doc.text(`Total Diligencias Adic.: ${sItems.length}`, 120, 75);
    doc.text(`Promedio Espera (Diligencias): ${avgS} min`, 120, 81);
    const showCharts = appMode === 'admin'; 
    if (showCharts && reportData.length > 0) {
        const monthlyData = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => { const mDocs = reportData.filter(d => extractDateInfo(d.createdAt).month === i + 1); const mRecs = mDocs.filter(d => isPrincipalData(d)); const mEf = mRecs.length > 0 ? ((mRecs.filter(x => (x.tiempo||0) <= 5).length / mRecs.length) * 100).toFixed(1) : 0; return { name: m, ef: parseFloat(mEf) }; });
        const sucursalStats = reportData.reduce((acc, curr) => { if(!curr.sucursal || curr.sucursal === 'N/A' || curr.sucursal === 'Ruta Externa') return acc; acc[curr.sucursal] = acc[curr.sucursal] || { totalTime: 0, count: 0 }; acc[curr.sucursal].totalTime += (curr.tiempo || 0); acc[curr.sucursal].count += 1; return acc; }, {});
        const topSucursales = Object.entries(sucursalStats).map(([name, stats]) => ({ name, avgWait: parseFloat((stats.totalTime / stats.count).toFixed(1)) })).sort((a,b) => b.avgWait - a.avgWait).slice(0, 5);
        doc.setFontSize(9); doc.setTextColor(100); doc.text("EFICIENCIA MENSUAL (%)", 35, 90); doc.setDrawColor(200); doc.line(20, 95, 20, 135); doc.line(20, 135, 90, 135); if(monthlyData.some(m => m.ef > 0)) { const barWidth = 50 / 12; monthlyData.forEach((m, i) => { const h = (m.ef / 100) * 35; if(h > 0) { doc.setFillColor(...green500); doc.rect(22 + (i * barWidth * 1.2), (135) - h, barWidth, h, 'F'); doc.setFontSize(6); doc.text(m.name, 23 + (i * barWidth * 1.2), 139); } }); }
        doc.setFontSize(9); doc.setTextColor(100); doc.text("TOP DEMORAS (MIN)", 130, 90); doc.setDrawColor(200); doc.line(110, 95, 110, 135); doc.line(110, 135, 190, 135); if(topSucursales.length > 0) { const maxTime = Math.max(...topSucursales.map(s => s.avgWait)) || 10; topSucursales.forEach((s, i) => { const w = (s.avgWait / maxTime) * 70; doc.setFillColor(...orange500); doc.rect(111, 100 + (i * 7), w, 4, 'F'); doc.setFontSize(7); doc.setTextColor(50); doc.text(`${s.name} (${s.avgWait}m)`, 112, 99 + (i * 7)); }); }
    }
    const monthlyTableRows = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => { const mDocs = reportData.filter(d => extractDateInfo(d.createdAt).month === i + 1); const mRecs = mDocs.filter(d => isPrincipalData(d)); const mDils = mDocs.filter(d => !isPrincipalData(d)); const mEf = mRecs.length > 0 ? ((mRecs.filter(x => (x.tiempo||0) <= 5).length / mRecs.length) * 100).toFixed(1) : 0; const mAvgR = mRecs.length > 0 ? (mRecs.reduce((a,b)=>a+(b.tiempo||0),0)/mRecs.length).toFixed(1) : 0; const mAvgD = mDils.length > 0 ? (mDils.reduce((a,b)=>a+(b.tiempo||0),0)/mDils.length).toFixed(1) : 0; return [m, mRecs.length, `${mEf}%`, `${mAvgR}m`, mDils.length, `${mAvgD}m`]; }).filter(r => r[1] > 0 || r[4] > 0);
    autoTable(doc, { startY: showCharts ? 150 : 95, head: [['Mes', 'Recolecciones', 'Eficiencia %', 'T. Prom (Rec)', 'Diligencias', 'T. Prom (Dil)']], body: monthlyTableRows, headStyles: { fillColor: slate900, halign: 'center' }, columnStyles: { 0: { fontStyle: 'bold', halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold', textColor: green500 }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' } }, theme: 'striped' });
    doc.save(`Recolekta_Reporte_${targetUser || 'Global'}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans pb-24" onClick={() => setActiveInput(null)}>
      {/* MODAL DE IMAGEN */}
      {viewingPhoto && <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4" onClick={() => setViewingPhoto(null)}><div className="relative max-w-4xl w-full flex flex-col items-center"><img src={viewingPhoto} className="max-h-[80vh] rounded-lg border border-white/20" alt="Evidencia" /><button className="mt-6 bg-white text-black px-6 py-3 rounded-full font-bold uppercase text-xs">Cerrar</button></div></div>}

      {/* MODAL DE EDICIÓN CRUD */}
      {editingItem && (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#151F32] p-8 rounded-[2rem] border border-slate-700 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-white flex items-center gap-2"><Edit3 size={20} className="text-blue-500"/> Editar Registro</h3><button onClick={() => setEditingItem(null)}><X className="text-slate-500 hover:text-white" size={24}/></button></div>
                <div className="space-y-4">
                    {editingItem.collectionName === 'registros_produccion' && (<><div><label className="text-[10px] font-bold text-slate-400 uppercase">Sucursal</label><input name="sucursal" value={editFormData.sucursal || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] font-bold text-slate-400 uppercase">H. Llegada (01-12)</label><input name="hLlegada" value={editFormData.hLlegada || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">M. Llegada (00-59)</label><input name="mLlegada" value={editFormData.mLlegada || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div></div><div className="grid grid-cols-2 gap-2"><div><label className="text-[10px] font-bold text-slate-400 uppercase">H. Salida (01-12)</label><input name="hSalida" value={editFormData.hSalida || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">M. Salida (00-59)</label><input name="mSalida" value={editFormData.mSalida || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Observaciones</label><textarea name="observaciones" value={editFormData.observaciones || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold h-20 resize-none"/></div></>)}
                    {editingItem.collectionName === 'registros_combustible' && (<><div><label className="text-[10px] font-bold text-slate-400 uppercase">Galones</label><input name="galones" type="number" step="0.1" value={editFormData.galones || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Costo ($)</label><input name="costo" type="number" step="0.01" value={editFormData.costo || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Kilometraje</label><input name="kilometraje" type="number" value={editFormData.kilometraje || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div></>)}
                    {editingItem.collectionName === 'registros_mantenimiento' && (<><div><label className="text-[10px] font-bold text-slate-400 uppercase">Taller</label><input name="taller" value={editFormData.taller || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Costo ($)</label><input name="costo" type="number" step="0.01" value={editFormData.costo || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Detalle</label><textarea name="descripcion" value={editFormData.descripcion || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold h-24 resize-none"/></div></>)}
                    {editingItem.collectionName === 'registros_horas_extras' && (<><div><label className="text-[10px] font-bold text-slate-400 uppercase">Hora Inicio</label><input name="horaInicio" type="time" value={editFormData.horaInicio || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Hora Fin</label><input name="horaFin" type="time" value={editFormData.horaFin || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase">Motivo</label><input name="motivo" value={editFormData.motivo || ''} onChange={handleEditFormChange} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"/></div></>)}
                    <button onClick={handleUpdate} className="w-full py-4 bg-green-600 rounded-xl font-black uppercase text-sm shadow-lg hover:bg-green-500 flex justify-center items-center gap-2"><CheckCircle2 size={18}/> Guardar Cambios</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL DE ENVÍO DE AVISOS */}
      {showAvisoModal && (
        <div className="fixed inset-0 z-[150] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#151F32] p-8 rounded-[2rem] border border-slate-700 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-white flex items-center gap-2"><Send size={20} className="text-blue-500"/> Enviar Aviso a Flota</h3><button onClick={() => setShowAvisoModal(false)}><XCircle className="text-slate-500 hover:text-white" size={24}/></button></div>
                <div className="space-y-4">
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Aviso</label><select value={avisoForm.tipo} onChange={e=>setAvisoForm({...avisoForm, tipo: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"><option value="info">ℹ️ Informativo (Solo lectura)</option><option value="confirm">✅ Requiere Confirmación</option></select></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Destinatario</label><select value={avisoForm.para} onChange={e=>setAvisoForm({...avisoForm, para: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold"><option value="Todos">Toda la Flota (Global)</option>{CATALOGOS.transportistas.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Mensaje Corto</label><textarea value={avisoForm.mensaje} onChange={e=>setAvisoForm({...avisoForm, mensaje: e.target.value})} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold h-24 resize-none" placeholder="Escribe el recordatorio o alerta aquí..."/></div>
                    <button onClick={async () => { if(!avisoForm.mensaje) return; await addDoc(collection(db, 'alertas_flota'), {...avisoForm, createdAt: new Date().toISOString()}); setShowAvisoModal(false); setAvisoForm({mensaje: '', para: 'Todos', tipo: 'info'}); alert("Aviso enviado a la plataforma."); }} className="w-full py-4 bg-blue-600 rounded-xl font-black uppercase text-sm shadow-lg hover:bg-blue-500 flex items-center justify-center gap-2"><Send size={16}/> Enviar Mensaje</button>
                </div>
            </div>
        </div>
      )}

      <nav className="bg-[#151F32] border-b border-slate-800 px-4 md:px-8 py-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white border border-slate-700"><Bike size={18}/></div><h1 className="text-lg font-black tracking-tighter text-white">Recolekta OS <span className="text-green-500">OS</span></h1></div>
        <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end"><span className="text-white text-[10px] font-bold uppercase tracking-widest">{currentUser.email}</span><span className="text-slate-500 text-[8px] uppercase">{appMode.toUpperCase()}</span></div>
            <button onClick={logout} className="bg-red-900/20 text-red-400 border border-red-900/50 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all">Salir</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {/* =========================================
            BLOQUE USUARIO (TRANSPORTISTA)
            ========================================= */}
        {appMode === 'user' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
              <div className="lg:col-span-2">

              {userAlerts.length > 0 && (
                  <div className="mb-6 space-y-3 animate-in slide-in-from-top-4">
                      {userAlerts.map((alerta, idx) => (
                          <div key={idx} className={cn("p-4 rounded-xl flex items-center justify-between shadow-lg border", alerta.type === 'turno' ? "bg-purple-900/30 border-purple-500 text-purple-200" : alerta.type === 'maint' ? "bg-yellow-900/30 border-yellow-500 text-yellow-200" : alerta.tipo === 'confirm' ? "bg-red-900/30 border-red-500 text-red-200" : "bg-blue-900/30 border-blue-500 text-blue-200")}>
                              <div className="flex items-center gap-4">
                                  <div className="p-2 bg-black/30 rounded-lg">
                                      {alerta.type === 'turno' ? <Clock size={24} className="text-purple-400"/> : alerta.type === 'maint' ? <Wrench size={24} className="text-yellow-400"/> : <Bell size={24} className={alerta.tipo === 'confirm' ? "text-red-400" : "text-blue-400"}/>}
                                  </div>
                                  <div>
                                      <h4 className="font-black uppercase text-xs opacity-80">{alerta.title}</h4>
                                      <p className="text-sm font-bold mt-0.5">{alerta.msg}</p>
                                  </div>
                              </div>
                              {alerta.tipo === 'confirm' ? (
                                  <button onClick={(e) => { e.preventDefault(); dismissAlert(alerta); }} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1 shadow-lg"><Check size={14}/> CONFIRMAR</button>
                              ) : (
                                  <button onClick={(e) => { e.preventDefault(); dismissAlert(alerta); }} className="text-slate-400 hover:text-white"><X size={18}/></button>
                              )}
                          </div>
                      ))}
                  </div>
              )}

              <div className="flex gap-2 mb-6 p-1 bg-[#151F32] rounded-xl w-fit border border-slate-800 overflow-x-auto">
                 <button onClick={() => setUserView('ruta')} className={cn("px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap", userView === 'ruta' ? "bg-green-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Bike size={16}/> Ruta</button>
                 <button onClick={() => setUserView('combustible')} className={cn("px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap", userView === 'combustible' ? "bg-orange-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Fuel size={16}/> Combustible</button>
                 <button onClick={() => setUserView('agenda')} className={cn("px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap", userView === 'agenda' || userView === 'mantenimiento' ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Calendar size={16}/> Agenda</button>
                 <button onClick={() => setUserView('extras')} className={cn("px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap", userView === 'extras' ? "bg-purple-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Clock size={16}/> H. Extra</button>
              </div>

              {userView === 'ruta' ? (
                 <div className="bg-[#151F32] p-6 md:p-10 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-500 to-emerald-400"></div>
                    <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-white"><ClipboardList className="text-green-500"/> Registro de Ruta</h2>
                    <form onSubmit={async (e) => { e.preventDefault(); if(!imageFile) return alert("FOTO REQUERIDA"); if(getWait() === 0 && form.mLlegada !== form.mSalida) return alert("ERROR EN HORAS"); if (!CATALOGOS.transportistas.includes(form.recolector)) return alert("TRANSPORTISTA NO VÁLIDO"); if (!CATALOGOS.sucursales.includes(form.sucursal)) return alert("SUCURSAL NO VÁLIDA"); setIsUploading(true); try { const storageRef = ref(storage, `evidencias/${Date.now()}_${form.recolector.replace(/\s+/g, '_')}`); await uploadBytes(storageRef, imageFile); const photoURL = await getDownloadURL(storageRef); const isP = PRINCIPAL_KEYWORDS.some(k=>form.tipo.toLowerCase().includes(k)); await addDoc(collection(db, "registros_produccion"), { ...form, tiempo: getWait(), createdAt: new Date().toISOString(), categoria: isP ? "Principal" : "Secundaria", fotoData: photoURL, month: new Date().getMonth() + 1, usuarioEmail: currentUser.email }); alert("¡Registrado!"); setForm(prev => ({...prev, sucursal: '', observaciones: ''})); setImagePreview(null); setImageFile(null); } catch(e) { console.error(e); alert("Error al subir"); } finally { setIsUploading(false); } }} className="space-y-5">
                      <div className="relative"><label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Responsable</label><div className="relative"><input type="text" className={cn("w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase text-slate-400 cursor-not-allowed")} value={form.recolector} disabled /><User size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500"/></div></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><select className="p-4 bg-[#0B1120] rounded-2xl font-bold outline-none border-2 border-slate-800 focus:border-blue-500 text-slate-300" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} required><option value="">-- DILIGENCIA --</option>{CATALOGOS.diligencias.map(d => <option key={d} value={d}>{d}</option>)}</select><select className="p-4 bg-[#0B1120] rounded-2xl font-bold outline-none border-2 border-slate-800 focus:border-indigo-500 text-slate-300" value={form.area} onChange={e => setForm({...form, area: e.target.value})} required><option value="">-- ÁREA --</option>{CATALOGOS.areas.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                      <div className="relative" onClick={e => e.stopPropagation()}><input type="text" placeholder="SUCURSAL..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase focus:border-blue-500 outline-none text-white placeholder-slate-600" value={form.sucursal} onChange={e => handleInput('sucursal', e.target.value)} onFocus={() => setActiveInput('sucursal')} required />{activeInput === 'sucursal' && form.sucursal.length > 0 && (<div className="absolute z-30 w-full mt-2 bg-[#1F2937] shadow-xl rounded-xl border border-slate-700 max-h-40 overflow-y-auto">{CATALOGOS.sucursales.filter(t=>t.toUpperCase().includes(form.sucursal.toUpperCase())).map(s => (<div key={s} onClick={() => { setForm({...form, sucursal: s}); setActiveInput(null); }} className="p-3 hover:bg-slate-700 cursor-pointer text-xs font-bold border-b border-slate-800 text-slate-300">{s}</div>))}</div>)}</div>
                      <div className="bg-[#0B1120] p-6 rounded-[2rem] text-white grid grid-cols-1 sm:grid-cols-2 gap-6 items-center shadow-inner border border-slate-800"><div className="space-y-4"><div className="flex flex-col items-center sm:items-start"><p className="text-[9px] font-bold text-green-400 uppercase tracking-widest mb-1">Llegada</p><div className="flex gap-1"><select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16 border border-slate-700" value={form.hLlegada} onChange={e=>setForm({...form, hLlegada:e.target.value})}>{Array.from({length: 12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select><select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16 border border-slate-700" value={form.mLlegada} onChange={e=>setForm({...form, mLlegada:e.target.value})}>{Array.from({length: 60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select><select className="bg-green-900 text-green-400 border border-green-700 p-2 rounded-lg font-bold text-[10px] w-14" value={form.pLlegada} onChange={e=>setForm({...form, pLlegada:e.target.value})}><option>AM</option><option>PM</option></select></div></div><div className="flex flex-col items-center sm:items-start"><p className="text-[9px] font-bold text-orange-400 uppercase tracking-widest mb-1">Salida</p><div className="flex gap-1"><select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16 border border-slate-700" value={form.hSalida} onChange={e=>setForm({...form, hSalida:e.target.value})}>{Array.from({length: 12},(_,i)=>String(i+1).padStart(2,'0')).map(h=><option key={h}>{h}</option>)}</select><select className="bg-slate-800 p-2 rounded-lg font-bold text-xs w-16 border border-slate-700" value={form.mSalida} onChange={e=>setForm({...form, mSalida:e.target.value})}>{Array.from({length: 60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select><select className="bg-orange-900 text-orange-400 border border-orange-700 p-2 rounded-lg font-bold text-[10px] w-14" value={form.pSalida} onChange={e=>setForm({...form, pSalida:e.target.value})}><option>AM</option><option>PM</option></select></div></div></div><div className="text-center border-t sm:border-t-0 sm:border-l border-slate-800 pt-4 sm:pt-0 h-full flex flex-col justify-center"><p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Espera Calc.</p><h4 className={cn("text-5xl font-black", getWait() > 5 ? "text-orange-400" : "text-green-400")}>{getWait()}m</h4></div></div>
                      <textarea placeholder="OBSERVACIONES..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600 resize-none h-24" value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} />
                      <div className="grid grid-cols-2 gap-4"><label className="col-span-1 p-4 bg-[#0B1120] border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-800 transition-all text-slate-400 font-bold uppercase text-[9px]"><Camera size={24}/><p>Foto</p><input type="file" className="hidden" accept="image/*" onChange={handleFile} /></label><button type="submit" disabled={!imagePreview || isUploading || isCompressing} className={cn("col-span-1 rounded-2xl font-black text-sm shadow-lg transition-all uppercase flex flex-col items-center justify-center gap-2", imagePreview && !isUploading && !isCompressing ? "bg-white text-black hover:bg-gray-200" : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700")}>{isCompressing ? <Loader2 className="animate-spin" size={24}/> : (isUploading ? <Loader2 className="animate-spin" size={24}/> : <CheckCircle2 size={24} className={imagePreview?"text-green-600":"text-slate-600"}/>)}{isCompressing ? 'Procesando...' : (isUploading ? 'Subiendo...' : 'Sincronizar')}</button></div>
                      <button type="button" onClick={() => downloadReport(null)} className="w-full bg-slate-800 border border-slate-700 py-3 rounded-xl font-bold text-xs text-slate-300 uppercase flex items-center justify-center gap-2 hover:bg-slate-700 transition-all"><Download size={14}/> Descargar Mi Ficha</button>
                    </form>
                 </div>
              ) : userView === 'combustible' ? (
                 <FuelModule currentUser={currentUser} />
              ) : userView === 'extras' ? (
                 <OvertimeModule currentUser={currentUser} history={otData} />
              ) : userView === 'mantenimiento' ? (
                 <MaintenanceModule currentUser={currentUser} onBack={() => setUserView('agenda')} />
              ) : (
                 <div className="space-y-4">
                    <button onClick={() => setUserView('mantenimiento')} className="w-full bg-yellow-600/90 border-b-4 border-yellow-800 text-white py-4 rounded-2xl font-black uppercase shadow-xl hover:bg-yellow-500 transition-all flex items-center justify-center gap-3"><div className="bg-black/20 p-2 rounded-full"><Wrench size={20}/></div><span>Registrar Mantenimiento</span></button>
                    <ScheduleModule currentUser={currentUser} userName={USUARIOS_EMAIL[currentUser.email] || currentUser.email} />
                 </div>
              )}
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

        {/* =========================================
            BLOQUE ADMIN 
            ========================================= */}
        {appMode === 'admin' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="bg-[#151F32] p-8 rounded-[2.5rem] shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Central y Analisis de Datos</h2>
                    <div className="flex flex-wrap gap-2 mt-4 bg-[#0B1120] p-1 rounded-xl w-full md:w-fit border border-slate-800">
                        <button onClick={()=>setAdminSection('ops')} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex-1 md:flex-none text-center", adminSection==='ops'?"bg-green-600 text-white shadow-md":"text-slate-500 hover:text-slate-300")}>Operaciones</button>
                        <button onClick={()=>setAdminSection('fleet')} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex-1 md:flex-none text-center", adminSection==='fleet'?"bg-orange-600 text-white shadow-md":"text-slate-500 hover:text-slate-300")}>Flota</button>
                        <button onClick={()=>setAdminSection('hr')} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex-1 md:flex-none text-center", adminSection==='hr'?"bg-purple-600 text-white shadow-md":"text-slate-500 hover:text-slate-300")}>Horas Extras</button>
                        <button onClick={()=>setAdminSection('agenda')} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex-1 md:flex-none text-center", adminSection==='agenda'?"bg-blue-600 text-white shadow-md":"text-slate-500 hover:text-slate-300")}>Horarios</button>
                        <button onClick={()=>setAdminSection('bi')} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex-1 md:flex-none text-center flex items-center gap-1", adminSection==='bi'?"bg-indigo-600 text-white shadow-md":"text-slate-500 hover:text-slate-300")}><PieChart size={12}/> Analítica YoY</button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex bg-[#0B1120] p-2 rounded-xl border border-slate-800 items-center"><Filter size={16} className="text-slate-500"/>
                  <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300">
                      {availableYears.map(y => <option key={y} value={y}>{y}{y==='2025'?' (CSV)':''}</option>)}
                  </select>
                  <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 text-slate-300 border-l border-slate-700 pl-2">{['all',1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m} className="bg-slate-900">{m==='all'?'Año Completo':'Mes '+m}</option>)}</select>
                  <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 max-w-[120px] text-slate-300 border-l border-slate-700 pl-2"><option value="all" className="bg-slate-900">Flota</option>{CATALOGOS.transportistas.map(u=><option key={u} value={u} className="bg-slate-900">{u}</option>)}</select>
                  </div>
                  
                  <button onClick={() => setShowAvisoModal(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2 hover:bg-blue-500 transition-all"><Bell size={14}/> Aviso</button>
                  <button onClick={exportToCSV} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2 hover:bg-green-700 transition-all"><FileSpreadsheet size={14}/> Excel Total</button>
                  <button onClick={() => downloadReport(null)} className="bg-white text-black px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2 hover:bg-slate-200 transition-all"><Download size={14}/> PDF Datos</button>
                  <button onClick={() => setDataSource(dataSource === 'live' ? 'historical' : 'live')} className={cn("px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2", dataSource==='live'?"bg-slate-700 text-white":"bg-indigo-600 text-white")} disabled={isFetchingHistory}>
                      {isFetchingHistory ? <Loader2 size={14} className="animate-spin" /> : dataSource === 'live' ? <Database size={14}/> : <RefreshCw size={14}/>} 
                      {isFetchingHistory ? 'Descargando...' : dataSource === 'live' ? 'Histórico DB' : 'Volver a Vivo'}
                  </button>
                </div>
             </div>

             {adminSection === 'bi' && (
                <div className="animate-in fade-in space-y-6">
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 flex justify-between items-center">
                       <div><h3 className="text-xl font-black text-white flex items-center gap-2"><PieChart className="text-indigo-500"/> Inteligencia de Negocios (YoY)</h3><p className="text-xs text-slate-400">Comparativa Anual Mensualizada ({biMetrics.yPrev} vs {biMetrics.yCurrent})</p></div>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><TrendingUp size={16} className="text-green-500"/> Eficiencia Operativa (%)</h4><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={biMetrics.dataYoY}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} /><YAxis domain={[0, 100]} hide /><Tooltip contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff'}} /><Legend iconType="circle" wrapperStyle={{fontSize: '10px'}}/><Line type="monotone" name={`Año ${biMetrics.yPrev}`} dataKey={`ef${biMetrics.yPrev}`} stroke="#64748b" strokeWidth={2} dot={false} /><Line type="monotone" name={`Año ${biMetrics.yCurrent}`} dataKey={`ef${biMetrics.yCurrent}`} stroke="#10b981" strokeWidth={4} /></LineChart></ResponsiveContainer></div></div>
                       <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><Fuel size={16} className="text-orange-500"/> Inversión Combustible ($)</h4><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={biMetrics.dataYoY}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} /><Tooltip cursor={{fill: '#1f2937'}} contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff'}} /><Legend iconType="circle" wrapperStyle={{fontSize: '10px'}}/><Bar name={`Año ${biMetrics.yPrev}`} dataKey={`fuel${biMetrics.yPrev}`} fill="#64748b" radius={[4, 4, 0, 0]} /><Bar name={`Año ${biMetrics.yCurrent}`} dataKey={`fuel${biMetrics.yCurrent}`} fill="#f97316" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
                       <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl lg:col-span-2"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><Wrench size={16} className="text-yellow-500"/> Costos de Mantenimiento Taller ($)</h4><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={biMetrics.dataYoY}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} /><Tooltip cursor={{fill: '#1f2937'}} contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff'}} /><Legend iconType="circle" wrapperStyle={{fontSize: '10px'}}/><Bar name={`Año ${biMetrics.yPrev}`} dataKey={`maint${biMetrics.yPrev}`} fill="#64748b" radius={[4, 4, 0, 0]} /><Bar name={`Año ${biMetrics.yCurrent}`} dataKey={`maint${biMetrics.yCurrent}`} fill="#eab308" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
                   </div>
                </div>
             )}

             {adminSection === 'ops' && (
                <div className="animate-in fade-in">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-sm border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={100} className="text-indigo-500"/></div><p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">{filterUser === 'all' ? 'VITAL (GLOBAL FLOTA)' : `VITAL (${filterUser})`}</p><div className="flex items-baseline gap-2"><h3 className="text-4xl font-black text-white">{metrics.efP}%</h3><span className="text-xs font-bold text-slate-500">Eficiencia</span></div><div className="mt-4 flex gap-2"><span className="text-[10px] font-bold bg-indigo-900/30 text-indigo-400 px-3 py-1 rounded-full border border-indigo-900">Espera: {metrics.avgP}m</span><span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">Vol: {metrics.countP}</span></div></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-sm border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><ClipboardList size={100} className="text-orange-500"/></div><p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2">SECUNDARIO (ADMIN)</p><div className="flex items-baseline gap-2"><h3 className="text-4xl font-black text-white">{metrics.efS}%</h3><span className="text-xs font-bold text-slate-500">Eficiencia</span></div><div className="mt-4 flex gap-2"><span className="text-[10px] font-bold bg-orange-900/30 text-orange-400 px-3 py-1 rounded-full border border-orange-900">Espera: {metrics.avgS}m</span><span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700">Vol: {metrics.countS}</span></div></div>
                      <div className="bg-[#0B1120] p-6 rounded-[2rem] shadow-inner border border-slate-800 text-white flex flex-col justify-center relative overflow-hidden"><div className="absolute -bottom-4 -right-4 opacity-20"><Database size={100} className="text-slate-600"/></div><p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">TOTAL REGISTROS</p><h3 className="text-5xl font-black">{metrics.total}</h3><p className="text-[10px] font-bold text-slate-600 uppercase mt-auto">Fuente: {filterYear === '2025' ? 'CSV ARCHIVO MUERTO' : dataSource}</p></div>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-sm border border-slate-800"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><TrendingUp size={16} className="text-green-500"/> Evolución Anual de Eficiencia</h4><div className="h-60 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={metrics.monthlyData}><defs><linearGradient id="colorEf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} /><YAxis hide domain={[0, 100]} /><Tooltip contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff'}} itemStyle={{color: '#10b981'}} formatter={(value) => [`${value}%`, 'Eficiencia']} /><Area type="monotone" dataKey="ef" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEf)" /></AreaChart></ResponsiveContainer></div></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-sm border border-slate-800"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-orange-500"/> Top 5 Puntos con Mayor Demora</h4><div className="h-60 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={metrics.topSucursales} margin={{ left: 0, right: 30 }}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false}/><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} /><Tooltip cursor={{fill: '#1f2937'}} contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff'}} formatter={(value) => [`${value} min`, 'Espera Promedio']} /><Bar dataKey="avgWait" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20} /></BarChart></ResponsiveContainer></div></div>
                   </div>

                   <div className="bg-[#151F32] rounded-[2.5rem] shadow-xl border border-slate-800 p-6 mt-6">
                      <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest mb-6 flex items-center gap-2"><ShieldCheck className="text-green-500" size={18}/> Bitácora de Operación Reciente</h4>
                      <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Transportista</th><th className="px-4 py-3">Punto</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th><th className="px-4 py-3">Espera</th><th className="px-4 py-3 text-center">Foto</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead>
                        <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                            {metrics.rows.slice(0, 50).map((r, i) => (
                                <tr key={r.id || i} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 text-white">{r.recolector}</td>
                                    <td className="px-4 py-3">{r.sucursal}</td>
                                    <td className="px-4 py-3 text-slate-500">{r.hLlegada && r.mLlegada ? `${r.hLlegada}:${r.mLlegada} ${r.pLlegada || ''}` : '--'}</td>
                                    <td className="px-4 py-3 text-slate-500">{r.hSalida && r.mSalida ? `${r.hSalida}:${r.mSalida} ${r.pSalida || ''}` : '--'}</td>
                                    <td className={cn("px-4 py-3", r.tiempo > 5 ? "text-orange-400" : "text-green-400")}>{r.tiempo}m</td>
                                    <td className="px-4 py-3 text-center">{r.fotoData && r.fotoData.startsWith('http') ? <a href={r.fotoData} target="_blank" rel="noreferrer" className="inline-flex justify-center items-center bg-blue-900/30 text-blue-400 w-8 h-8 rounded-lg border border-blue-900"><ExternalLink size={14}/></a> : r.fotoData ? <img src={r.fotoData} className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-600 hover:border-white transition-all" onClick={()=>setViewingPhoto(r.fotoData)} alt="evidencia"/> : <span className="text-slate-700">-</span>}</td>
                                    <td className="px-4 py-3 flex items-center justify-center gap-2">
                                        {filterYear !== '2025' && (
                                            <>
                                            <button onClick={() => openEditModal({...r, hLlegada: r.hLlegada || '', mLlegada: r.mLlegada || '', pLlegada: r.pLlegada || 'AM', hSalida: r.hSalida || '', mSalida: r.mSalida || '', pSalida: r.pSalida || 'AM'}, 'registros_produccion')} className="text-blue-400 hover:text-blue-200"><Edit3 size={16}/></button>
                                            <button onClick={() => handleDelete('registros_produccion', r.id)} className="text-red-500 hover:text-red-300"><Trash2 size={16}/></button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table></div>
                   </div>
                </div>
             )}
             
             {adminSection === 'fleet' && (
                <div className="animate-in fade-in space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} className="text-green-500"/></div><p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-2">COMB. (MES)</p><h3 className="text-3xl font-black text-white">${fleetMetrics.totalFuelCost}</h3></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Wrench size={80} className="text-yellow-500"/></div><p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-2">TALLER (MES)</p><h3 className="text-3xl font-black text-white">${fleetMetrics.totalMaintCost}</h3></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Fuel size={80} className="text-orange-500"/></div><p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2">GALONES</p><h3 className="text-3xl font-black text-white">{fleetMetrics.totalGalones}</h3></div>
                      <div className="bg-[#0B1120] p-6 rounded-[2rem] border border-slate-800 flex flex-col justify-center"><p className="text-[10px] font-bold text-slate-500 uppercase">GASTO TOTAL FLOTA</p><h3 className="text-3xl font-black text-white">${(parseFloat(fleetMetrics.totalFuelCost) + parseFloat(fleetMetrics.totalMaintCost)).toFixed(2)}</h3></div>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-orange-500"/> Costo Operativo por Transportista ($)</h4><div className="h-60 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={fleetMetrics.chartData}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#64748b'}} interval={0} angle={-45} textAnchor="end" height={60} /><Tooltip cursor={{fill: '#1f2937'}} contentStyle={{backgroundColor: '#0B1120', border: '1px solid #1f2937', color: '#fff'}} /><Legend verticalAlign="top" height={36} /><Bar dataKey="fuel" name="Combustible" stackId="a" fill="#ea580c" /><Bar dataKey="maint" name="Taller" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
                      <div className="space-y-4">
                          <div className="bg-[#151F32] p-4 rounded-[2rem] border border-slate-800 overflow-hidden h-40"><h4 className="font-bold text-slate-300 text-xs uppercase mb-2 flex items-center gap-2"><Fuel size={14} className="text-orange-500"/> Últimas Cargas</h4><div className="overflow-y-auto h-full pb-6"><table className="w-full text-left"><thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Galones</th><th className="px-4 py-3">Costo Total</th><th className="px-4 py-3">Km</th><th className="px-4 py-3 text-center">Ticket</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead><tbody className="text-[10px] text-slate-400 divide-y divide-slate-800">{fuelData.filter(d => checkDate(d.fecha) && (filterUser==='all' || (USUARIOS_EMAIL[d.usuario]||'').includes(filterUser))).slice(0,20).map((r, i) => (<tr key={r.id} className="hover:bg-slate-800/50"><td className="px-2 py-3">{formatLocalDate(r.fecha)}</td><td className="px-2 py-3">{USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-2 py-3">{r.galones}</td><td className="px-2 py-3 text-green-400">${r.costo}</td><td className="px-2 py-3">{r.kilometraje}</td><td className="px-2 py-3 text-center">{r.foto && <button onClick={()=>setViewingPhoto(r.foto)} className="bg-orange-900/50 text-orange-400 px-2 py-1 rounded border border-orange-900 text-[9px] uppercase hover:bg-orange-900">Ver</button>}</td><td className="px-2 py-3 flex justify-center gap-2"><button onClick={()=>openEditModal(r, 'registros_combustible')}><Edit size={14} className="text-blue-500 hover:text-blue-300"/></button><button onClick={()=>handleDelete('registros_combustible', r.id)}><Trash2 size={14} className="text-red-500 hover:text-red-300"/></button></td></tr>))}</tbody></table></div></div>
                          <div className="bg-[#151F32] p-4 rounded-[2rem] border border-slate-800 overflow-hidden max-h-80"><h4 className="font-bold text-slate-300 text-xs uppercase mb-2 flex items-center gap-2"><Wrench size={14} className="text-yellow-500"/> Últimos Mantenimientos</h4><div className="overflow-y-auto h-full pb-6"><table className="w-full text-left"><thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Taller</th><th className="px-4 py-3">Costo</th><th className="px-4 py-3 text-center">Evidencia</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead><tbody className="text-[10px] text-slate-400 divide-y divide-slate-800">{maintData.filter(d => checkDate(d.fecha) && (filterUser==='all' || (USUARIOS_EMAIL[d.usuario]||'').includes(filterUser))).slice(0,20).map((r, i) => (<tr key={r.id} className="hover:bg-slate-800/50"><td className="px-2 py-3">{formatLocalDate(r.fecha)}</td><td className="px-2 py-3">{USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-2 py-3 text-white">{r.tipo}</td><td className="px-2 py-3">{r.taller}</td><td className="px-2 py-3 text-yellow-400">${r.costo}</td><td className="px-2 py-3 text-center">{r.foto && <button onClick={()=>setViewingPhoto(r.foto)} className="bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded border border-yellow-900 text-[9px] uppercase hover:bg-yellow-900">Ver Foto</button>}</td><td className="px-2 py-3 flex justify-center gap-2"><button onClick={()=>openEditModal(r, 'registros_mantenimiento')}><Edit size={14} className="text-blue-500 hover:text-blue-300"/></button><button onClick={()=>handleDelete('registros_mantenimiento', r.id)}><Trash2 size={14} className="text-red-500 hover:text-red-300"/></button></td></tr>))}</tbody></table></div></div>
                      </div>
                   </div>
                </div>
             )}

             {adminSection === 'hr' && (
                <div className="animate-in fade-in space-y-6">
                   <div className="flex justify-between items-center bg-[#151F32] p-6 rounded-[2rem] border border-slate-800">
                      <div>
                          <h3 className="text-2xl font-black text-white">Nómina de Horas Extras</h3>
                          <p className="text-xs text-slate-400">Control de asistencia y pagos adicionales.</p>
                      </div>
                      <button onClick={exportPayrollCSV} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2 hover:bg-purple-700 transition-all"><FileSpreadsheet size={16}/> Exportar Excel RRHH</button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={100} className="text-purple-500"/></div>
                          <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-2">HORAS EXTRAS TOTALES</p>
                          <h3 className="text-5xl font-black text-white">{hrMetrics.totalHoras} <span className="text-lg text-slate-500">hrs</span></h3>
                          <p className="text-xs text-slate-400 mt-2">Registros procesados: {hrMetrics.totalRegistros}</p>
                      </div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800">
                          <h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-purple-500"/> Ranking Horas Extra</h4>
                          <div className="space-y-3">
                              {hrMetrics.rankingOt.slice(0,5).map((u, i) => (
                                  <div key={i} className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                          <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold text-white">{i+1}</div>
                                          <span className="text-sm font-bold text-slate-300">{u.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          <div className="h-2 bg-purple-900 rounded-full w-24 overflow-hidden"><div className="h-full bg-purple-500" style={{width: `${(u.hours / (parseFloat(hrMetrics.totalHoras) || 1)) * 100}%`}}></div></div>
                                          <span className="text-xs font-bold text-white">{u.hours}h</span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                   </div>
                   <div className="bg-[#151F32] rounded-[2.5rem] shadow-xl border border-slate-800 p-6">
                      <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest mb-6 flex items-center gap-2"><ClipboardList className="text-purple-500" size={18}/> Detalle de Horas Extras</h4>
                      <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Inicio</th><th className="px-4 py-3">Fin</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead><tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">{hrMetrics.rawData.map((r, i) => (<tr key={r.id} className="hover:bg-slate-800/50"><td className="px-4 py-3">{formatLocalDate(r.fecha)}</td><td className="px-4 py-3 text-white">{USUARIOS_EMAIL[r.usuario] || r.usuario}</td><td className="px-4 py-3">{r.horaInicio}</td><td className="px-4 py-3">{r.horaFin}</td><td className="px-4 py-3 text-purple-400">{r.horasCalculadas}h</td><td className="px-4 py-3 italic text-slate-500">{r.motivo}</td><td className="px-4 py-3 flex justify-center gap-2"><button onClick={()=>openEditModal(r, 'registros_horas_extras')}><Edit size={14} className="text-blue-500 hover:text-blue-300"/></button><button onClick={()=>handleDelete('registros_horas_extras', r.id)}><Trash2 size={14} className="text-red-500 hover:text-red-300"/></button></td></tr>))}</tbody></table></div>
                   </div>
                </div>
             )}

             {adminSection === 'agenda' && (
                <div className="animate-in fade-in">
                    <AgendaAdmin sucursales={CATALOGOS.sucursales} />
                </div>
             )}
          </div>
        )}

        {/* =========================================
            BLOQUE SUPERVISOR
            ========================================= */}
        {appMode === 'supervisor' && (
           <div className="space-y-6 animate-in fade-in">
             <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-black uppercase text-white flex items-center gap-2"><Eye className="text-blue-500"/> Visor Operativo</h2>
                <div className="flex gap-2 flex-wrap justify-center">
                   <button onClick={()=>setSupervisorSection('bitacora')} className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all", supervisorSection==='bitacora'?"bg-blue-600 text-white":"text-slate-500 hover:bg-slate-800")}>Bitácora</button>
                   <button onClick={()=>setSupervisorSection('combustible')} className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all", supervisorSection==='combustible'?"bg-orange-600 text-white":"text-slate-500 hover:bg-slate-800")}>Combustible</button>
                   <button onClick={()=>setSupervisorSection('taller')} className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all", supervisorSection==='taller'?"bg-yellow-600 text-black":"text-slate-500 hover:bg-slate-800")}>Taller</button>
                   <button onClick={()=>setSupervisorSection('agenda')} className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all", supervisorSection==='agenda'?"bg-purple-600 text-white":"text-slate-500 hover:bg-slate-800")}>Horario Global</button>
                </div>
                <div className="flex bg-[#0B1120] p-2 rounded-xl border border-slate-800 items-center gap-2">
                   <Filter size={14} className="text-slate-500"/>
                   <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300">
                      {availableYears.map(y => <option key={y} value={y}>{y}{y==='2025'?' (CSV)':''}</option>)}
                   </select>
                   <select value={filterUser} onChange={e=>setFilterUser(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300 border-l border-slate-700 pl-2"><option value="all">Toda la Flota</option>{CATALOGOS.transportistas.map(u=><option key={u} value={u}>{u}</option>)}</select>
                   <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300 border-l border-slate-700 pl-2"><option value="all">Año</option>{[1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m}>Mes {m}</option>)}</select>
                   
                   <button onClick={() => setShowAvisoModal(true)} className="ml-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-blue-500 transition-all flex items-center gap-1 shadow-md"><Send size={12}/> AVISO</button>
                   <button onClick={() => downloadReport(null)} className="ml-2 bg-white text-black px-4 py-2 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 transition-all flex items-center gap-1"><Download size={12}/> PDF</button>
                </div>
             </div>
             
             {supervisorSection === 'bitacora' && (
                <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Transportista</th><th className="px-4 py-3">Punto</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th><th className="px-4 py-3">Espera</th><th className="px-4 py-3 text-center">Foto</th><th className="px-4 py-3 rounded-r-lg">Tipo</th></tr></thead>
                      <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                         {metrics.rows.slice(0, 50).map((r, i) => (<tr key={r.id || i} className="hover:bg-slate-800/50 transition-colors"><td className="px-4 py-3 text-white">{r.recolector}</td><td className="px-4 py-3">{r.sucursal}</td><td className="px-4 py-3 text-slate-500">{r.hLlegada && r.mLlegada ? `${r.hLlegada}:${r.mLlegada} ${r.pLlegada || ''}` : '--'}</td><td className="px-4 py-3 text-slate-500">{r.hSalida && r.mSalida ? `${r.hSalida}:${r.mSalida} ${r.pSalida || ''}` : '--'}</td><td className={cn("px-4 py-3", r.tiempo > 5 ? "text-orange-400" : "text-green-400")}>{r.tiempo}m</td><td className="px-4 py-3 text-center">{r.fotoData && <button onClick={()=>setViewingPhoto(r.fotoData)} className="bg-blue-900/50 text-blue-400 px-2 py-1 rounded border border-blue-900 text-[9px] uppercase hover:bg-blue-800">Ver</button>}</td><td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-md text-[9px] border", r.categoria==="Principal"?"bg-indigo-900/30 border-indigo-900 text-indigo-300":"bg-orange-900/30 border-orange-900 text-orange-300")}>{r.categoria}</span></td></tr>))}
                      </tbody>
                   </table>
                </div>
             )}

             {supervisorSection === 'combustible' && (
                <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Galones</th><th className="px-4 py-3">Costo Total</th><th className="px-4 py-3">Km</th><th className="px-4 py-3 text-center rounded-r-lg">Ticket</th></tr></thead>
                      <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                         {fuelData.filter(d => checkDate(d.fecha) && (filterUser==='all' || (USUARIOS_EMAIL[d.usuario]||'').includes(filterUser))).map((r, i) => (<tr key={r.id || i} className="hover:bg-slate-800/50"><td className="px-4 py-3">{formatLocalDate(r.fecha)}</td><td className="px-4 py-3 text-white">{USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-4 py-3">{r.galones}</td><td className="px-4 py-3 text-green-400">${r.costo}</td><td className="px-4 py-3">{r.kilometraje}</td><td className="px-4 py-3 text-center">{r.foto && <button onClick={()=>setViewingPhoto(r.foto)} className="bg-orange-900/50 text-orange-400 px-2 py-1 rounded border border-orange-900 text-[9px] uppercase hover:bg-orange-900">Ver Ticket</button>}</td></tr>))}
                      </tbody>
                   </table>
                </div>
             )}

             {supervisorSection === 'taller' && (
                <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Taller</th><th className="px-4 py-3">Costo</th><th className="px-4 py-3 text-center rounded-r-lg">Evidencia</th></tr></thead>
                      <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                         {maintData.filter(d => checkDate(d.fecha) && (filterUser==='all' || (USUARIOS_EMAIL[d.usuario]||'').includes(filterUser))).map((r, i) => (<tr key={r.id || i} className="hover:bg-slate-800/50"><td className="px-4 py-3">{formatLocalDate(r.fecha)}</td><td className="px-4 py-3 text-white">{USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-4 py-3">{r.tipo}</td><td className="px-4 py-3">{r.taller}</td><td className="px-4 py-3 text-yellow-400">${r.costo}</td><td className="px-4 py-3 text-center">{r.foto && <button onClick={()=>setViewingPhoto(r.foto)} className="bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded border border-yellow-900 text-[9px] uppercase hover:bg-yellow-900">Ver Foto</button>}</td></tr>))}
                      </tbody>
                   </table>
                </div>
             )}

             {supervisorSection === 'agenda' && (
                <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 overflow-x-auto">
                   <div className="mb-4">
                        <h3 className="font-bold text-white">HORARIO GLOBAL DE FLOTA</h3>
                        <p className="text-xs text-slate-500">Vista consolidada de horarios y mantenimientos.</p>
                   </div>
                   <table className="w-full text-left">
                      <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Transportista</th><th className="px-4 py-3">Horario Base</th><th className="px-4 py-3">Zona / Ruta</th><th className="px-4 py-3">Puntos / Sucursales</th><th className="px-4 py-3">Turnos Extra</th><th className="px-4 py-3 rounded-r-lg">Prox. Mantenimiento</th></tr></thead>
                      <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                         {agendaData.map((a, i) => (
                             <tr key={i} className="hover:bg-slate-800/50">
                                 <td className="px-4 py-3 text-white">{a.id}</td>
                                 <td className="px-4 py-3 text-blue-400">{a.horario || '--'}</td>
                                 <td className="px-4 py-3">{a.zona || '--'}</td>
                                 <td className="px-4 py-3 italic">{a.puntos || '--'}</td>
                                 <td className="px-4 py-3">{a.turnos || 'Ninguno'}</td>
                                 <td className="px-4 py-3 text-yellow-500">{formatLocalDate(a.mantenimiento)}</td>
                             </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
}