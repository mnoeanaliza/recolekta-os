import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
// --- 1. IMPORTACIONES ---
import { useAuth } from './context/AuthContext';
import LoginModule from './components/LoginModule';
import { cloudFunctions, db, storage } from './config/firebase';
import FuelModule from './components/FuelModule'; 
import ScheduleModule from './components/ScheduleModule';
import MaintenanceModule from './components/MaintenanceModule';
import FleetAgenda from './modules/FleetAgenda';
import AdminDashboard from './modules/AdminDashboard';
import SupervisorDashboard from './modules/SupervisorDashboard';
import TransportistaHome from './modules/TransportistaHome';
import OvertimeModule from './components/OvertimeModule';
//import { USUARIOS_EMAIL } from '../App.jsx';
import { collection, addDoc, query, onSnapshot, orderBy, limit, getDocs, getCountFromServer, doc, deleteDoc, updateDoc, where, arrayUnion, setDoc, Timestamp, documentId, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

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
import { ADMIN_EMAILS, SUPERVISOR_EMAILS, cn, DEFAULT_CATALOGS, GITHUB_CSV_URL, PRINCIPAL_KEYWORDS, formatLocalDate, formatTurnosVisually, formatWithDay, getStrictDateString, isPrincipalData, USUARIOS_EMAIL } from './utils/constants';

export { USUARIOS_EMAIL } from './utils/constants';

// Carga diferida del Mapa
const RutaOptimizada = lazy(() => import('./components/RutaOptimizada.jsx'));

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const normalizeName = (value) => String(value || '').toUpperCase().trim();

const toMillis = (value) => {
    if (!value) return null;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
};

const getAlertExpiryMillis = (alerta) => {
    const explicitExpiry = toMillis(alerta.expiresAt);
    if (explicitExpiry) return explicitExpiry;

    const createdAt = toMillis(alerta.createdAt);
    if (!createdAt) return null;
    const fallbackDays = alerta.tipo === 'confirm' ? 14 : 7;
    return createdAt + (fallbackDays * DAY_IN_MS);
};

const isAlertExpired = (alerta, now = Date.now()) => {
    const expiry = getAlertExpiryMillis(alerta);
    return expiry !== null && expiry <= now;
};

const normalizeDateForComparison = (value) => {
    if (!value) return '';

    const source = typeof value?.toDate === 'function' ? value.toDate() : value;
    if (source instanceof Date) {
        if (Number.isNaN(source.getTime())) return '';
        return `${source.getFullYear()}-${String(source.getMonth() + 1).padStart(2, '0')}-${String(source.getDate()).padStart(2, '0')}`;
    }

    const raw = String(source).trim();
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;

    const localMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (localMatch) return `${localMatch[3]}-${localMatch[2].padStart(2, '0')}-${localMatch[1].padStart(2, '0')}`;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const isDateInRange = (value, startDate, endDate) => {
    const date = normalizeDateForComparison(value);
    if (!date) return false;
    const start = normalizeDateForComparison(startDate);
    const end = normalizeDateForComparison(endDate);
    return (!start || date >= start) && (!end || date <= end);
};

const cleanToken = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const isRecordForUser = (record, userEmail, profile, userForm) => {
    if (!record) return false;
    const cleanEmail = cleanToken(userEmail);
    const emailPrefix = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
    const catalogName = cleanToken(USUARIOS_EMAIL[cleanEmail] || USUARIOS_EMAIL[String(userEmail || '').toLowerCase().trim()]);
    const profileName = cleanToken(profile?.nombre);
    const formName = cleanToken(userForm?.recolector);

    const allowedTokens = [cleanEmail, emailPrefix, catalogName, profileName, formName].filter(Boolean);

    const candidates = [
        record.usuario,
        record.recolector,
        record.usuarioEmail,
        record.colaborador,
        record.email,
        record.nombre
    ].map(cleanToken).filter(Boolean);

    return candidates.some(candidate => {
        if (allowedTokens.includes(candidate)) return true;
        if (candidate.startsWith('nombre:') && allowedTokens.includes(candidate.replace('nombre:', '').trim())) return true;
        if (catalogName && (candidate.includes(catalogName) || catalogName.includes(candidate))) return true;
        if (profileName && (candidate.includes(profileName) || profileName.includes(candidate))) return true;
        if (formName && (candidate.includes(formName) || formName.includes(candidate))) return true;
        if (emailPrefix && candidate === emailPrefix) return true;
        return false;
    });
};

const sortByRecordDateDesc = (first, second) =>
    normalizeDateForComparison(second.fecha).localeCompare(normalizeDateForComparison(first.fecha));

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
  const [appMode, setAppMode] = useState(() => {
      const email = String(currentUser?.email || '').toLowerCase().trim();
      if (ADMIN_EMAILS.includes(email)) return 'admin';
      if (SUPERVISOR_EMAILS.includes(email)) return 'supervisor';
      return 'user';
  });
  const [userView, setUserView] = useState('ruta'); 
  const [adminSection, setAdminSection] = useState('ops');
  const [supervisorSection, setSupervisorSection] = useState('bitacora');
  const [dataSource, setDataSource] = useState('live'); 
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isRebuildingSummaries, setIsRebuildingSummaries] = useState(false);
  const [liveData, setLiveData] = useState([]);
  const [resumenesMensualesNube, setResumenesMensualesNube] = useState({});
  const [serverMonthlyCount, setServerMonthlyCount] = useState(null);
  // 🔥 CONTROL DE PAGINACIÓN REAL
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // 🔥 BOTÓN MÁGICO: FUERZA A LA NUBE A RECALCULAR TODO EL MES HISTÓRICO
const handleSyncToCloud = async () => {
      const now = new Date();
      const currentYear = now.getFullYear().toString();
      const currentMonth = now.getMonth() + 1;
      
      const targetYear = Number(filterYear) || now.getFullYear();
      const targetMonth = filterMonth === 'all' 
          ? (targetYear === Number(currentYear) ? currentMonth : 12) 
          : Number(filterMonth);
      
      const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const targetMonthName = monthNames[targetMonth - 1] || 'Mes';

      if (dataSource !== 'live') {
          alert("Para sincronizar los contadores con la Nube, selecciona Datos en Vivo.");
          return;
      }
      if(!window.confirm(`Esta acción leerá los registros de ${targetMonthName} ${targetYear} y sincronizará los perfiles de transportistas y el resumen en la Nube. ¿Continuar?`)) return;
      
      setIsFetchingHistory(true);
      try {
          const start = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
          const nextMonthDate = new Date(targetYear, targetMonth, 1);
          const end = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
          const monthlySnapshot = await getDocs(query(
              collection(db, "registros_produccion"),
              where("createdAt", ">=", start),
              where("createdAt", "<", end),
              orderBy("createdAt", "desc"),
              limit(10000)
          ));
          const monthlyDocs = monthlySnapshot.docs.map((recordDoc) => ({ id: recordDoc.id, ...recordDoc.data() }));
          if (monthlyDocs.length === 0) {
              alert(`No se encontraron registros de producción para ${targetMonthName} ${targetYear}.`);
              return;
          }

          let count = 0;
          const batch = writeBatch(db);
          const usersByEmail = new globalThis.Map();
          const profilesByEmail = new globalThis.Map();
          const normalizeEmail = (value) => String(value || '').toLowerCase().trim();
          const normalizeName = (value) => String(value || '').toUpperCase().trim();

          Object.entries(USUARIOS_EMAIL).forEach(([email, nombre]) => {
              usersByEmail.set(normalizeEmail(email), normalizeName(nombre));
          });
          Object.entries(perfilesUsuarios).forEach(([email, profile]) => {
              const normalizedEmail = normalizeEmail(email);
              profilesByEmail.set(normalizedEmail, profile);
              if (profile?.nombre) usersByEmail.set(normalizedEmail, normalizeName(profile.nombre));
          });
          // Extrae usuarios de catálogos
          Object.values(catalogs.transportistas || {}).flat().forEach((nombre) => {
              const cleanNom = normalizeName(nombre);
              const foundEmail = Object.keys(perfilesUsuarios).find(em => normalizeName(perfilesUsuarios[em]?.nombre) === cleanNom);
              if (foundEmail) usersByEmail.set(normalizeEmail(foundEmail), cleanNom);
          });
          // Extrae usuarios directamente de los registros de operaciones del mes
          monthlyDocs.forEach((d) => {
              const email = normalizeEmail(d.usuarioEmail);
              const recolector = normalizeName(d.recolector);
              if (email && !usersByEmail.has(email)) {
                  usersByEmail.set(email, recolector || email.split('@')[0].toUpperCase());
              }
          });

          let globalVitales = 0;
          let globalVitalesATiempo = 0;
          let globalSecundarias = 0;
          const porUsuarioResumen = {};

          // Calcula los perfiles desde Firebase para incluir usuarios creados recientemente.
          for (const [email, nombre] of usersByEmail.entries()) {
              if (!email || !nombre || ADMIN_EMAILS.includes(email) || SUPERVISOR_EMAILS.includes(email)) continue;

              const profile = profilesByEmail.get(email) || {};
              const miMeta = getMetaEspera(profile.zona);

              const userDocs = monthlyDocs.filter((d) => {
                  const registroEmail = normalizeEmail(d.usuarioEmail);
                  return (registroEmail && registroEmail === email) || normalizeName(d.recolector) === nombre;
              });

              let vitalesTotal = 0;
              let vitalesA_Tiempo = 0;
              let secundariasTotal = 0;

              userDocs.forEach(viaje => {
                  if (isPrincipalData(viaje)) {
                      vitalesTotal++;
                      globalVitales++;
                      if ((viaje.tiempo || 0) <= miMeta) {
                          vitalesA_Tiempo++;
                          globalVitalesATiempo++;
                      }
                  } else {
                      secundariasTotal++;
                      globalSecundarias++;
                  }
              });

              let eficiencia = 100;
              if (vitalesTotal > 0) eficiencia = parseFloat(((vitalesA_Tiempo / vitalesTotal) * 100).toFixed(1));

              porUsuarioResumen[email] = {
                  vitales: vitalesTotal,
                  aTiempo: vitalesA_Tiempo,
                  secundarias: secundariasTotal,
                  total: vitalesTotal + secundariasTotal,
                  eficiencia: eficiencia
              };

              const hasChanges = Number(profile.eficienciaNube ?? 100) !== eficiencia
                  || Number(profile.vitalesNube || 0) !== vitalesTotal
                  || Number(profile.secundariasNube || 0) !== secundariasTotal;
              if (hasChanges) {
                  batch.set(doc(db, "usuarios_perfiles", email), {
                      eficienciaNube: eficiencia,
                      vitalesNube: vitalesTotal,
                      secundariasNube: secundariasTotal,
                      ultimaAuditoria: new Date().toISOString()
                  }, { merge: true });
                  count++;
              }
          }

          // También actualizamos el resumen operativo del mes en la nube
          const monthDocId = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
          const globalEf = globalVitales > 0 ? parseFloat(((globalVitalesATiempo / globalVitales) * 100).toFixed(1)) : 100;
          batch.set(doc(db, "resumenes_operativos", monthDocId), {
              _conteoProduccion: {
                  vitales: globalVitales,
                  aTiempo: globalVitalesATiempo,
                  secundarias: globalSecundarias,
                  total: globalVitales + globalSecundarias
              },
              totalViajesMes: globalVitales + globalSecundarias,
              vitales: globalVitales,
              secundarias: globalSecundarias,
              eficienciaGlobal: globalEf,
              porUsuario: porUsuarioResumen,
              actualizadoEn: new Date().toISOString()
          }, { merge: true });

          await batch.commit();
          alert(`Sincronización completa para ${targetMonthName} ${targetYear}.\nSe leyeron ${monthlyDocs.length} registros y se actualizaron los perfiles y el resumen mensual en la Nube.`);
      } catch(e) { 
          console.error(e);
          alert("Error al sincronizar. Revisa la consola."); 
      } finally {
          setIsFetchingHistory(false);
      }
  };

  const handleRebuildHistoricalSummaries = async () => {
      if (appMode !== 'admin') return;
      if (!window.confirm(`Se leerán una sola vez los registros de ${filterYear} para reconstruir los 12 resúmenes mensuales con datos 100% reales. ¿Continuar?`)) return;
      setIsRebuildingSummaries(true);
      try {
          const year = Number(filterYear);
          const startTimestamp = `${year}-01-01`;
          const endTimestamp = `${year + 1}-01-01`;

          // 1. Obtener registros de producción, combustible y mantenimiento del año seleccionado sin límites inválidos
          const [prodSnap, fuelSnap, maintSnap] = await Promise.all([
              getDocs(query(collection(db, "registros_produccion"), where("createdAt", ">=", startTimestamp), where("createdAt", "<", endTimestamp))),
              getDocs(query(collection(db, "registros_combustible"), where("fecha", ">=", startTimestamp), where("fecha", "<", endTimestamp))),
              getDocs(query(collection(db, "registros_mantenimiento"), where("fecha", ">=", startTimestamp), where("fecha", "<", endTimestamp)))
          ]);

          const config = sysConfig || {};
          const metaMetro = Number(config.metaMetro || 5);
          const metaInterior = Number(config.metaInterior || 10);
          const metaFrontera = Number(config.metaFrontera || 20);

          const getMeta = (zone) => {
              const z = String(zone || "").toLowerCase();
              if (z.includes("oriente") || z.includes("occidente")) return metaInterior;
              if (z.includes("guatemala") || z.includes("honduras") || z.includes("costa rica")) return metaFrontera;
              return metaMetro;
          };

          // Inicializar los 12 meses
          const monthlyBuckets = {};
          for (let m = 1; m <= 12; m++) {
              const monthKey = `${year}-${String(m).padStart(2, '0')}`;
              monthlyBuckets[monthKey] = {
                  vitales: 0,
                  aTiempo: 0,
                  secundarias: 0,
                  total: 0,
                  gastoCombustible: 0,
                  galonesCombustible: 0,
                  gastoMantenimiento: 0,
                  porUsuario: {},
                  porZona: {},
                  porPais: {}
              };
          }

          // Procesar producción
          prodSnap.forEach(docSnap => {
              const d = docSnap.data();
              const dateInfo = extractDateInfo(d.createdAt);
              if (dateInfo.year !== String(year) || !dateInfo.month) return;
              const monthKey = `${year}-${String(dateInfo.month).padStart(2, '0')}`;
              const bucket = monthlyBuckets[monthKey];
              if (!bucket) return;

              const isPrinc = isPrincipalData(d);
              const userEmail = String(d.usuarioEmail || '').toLowerCase().trim();
              const userName = String(d.recolector || '').toUpperCase().trim();
              const userKey = userEmail || (userName ? `nombre:${userName}` : 'desconocido');
              const zone = String(d.zona || perfilesUsuarios[userEmail]?.zona || 'Sin Asignar').trim();
              const country = getUserCountry(userName) || (zone.includes('-') ? zone.split('-')[0].trim() : 'El Salvador');
              const meta = getMeta(zone);
              const tiempo = Number(d.tiempo || 0);
              const onTime = tiempo <= meta;

              bucket.total += 1;
              if (isPrinc) {
                  bucket.vitales += 1;
                  if (onTime) bucket.aTiempo += 1;
              } else {
                  bucket.secundarias += 1;
              }

              // Por usuario
              if (!bucket.porUsuario[userKey]) {
                  bucket.porUsuario[userKey] = { vitales: 0, aTiempo: 0, secundarias: 0, total: 0 };
              }
              const uStats = bucket.porUsuario[userKey];
              uStats.total += 1;
              if (isPrinc) {
                  uStats.vitales += 1;
                  if (onTime) uStats.aTiempo += 1;
              } else {
                  uStats.secundarias += 1;
              }
              uStats.eficiencia = uStats.vitales > 0 ? parseFloat(((uStats.aTiempo / uStats.vitales) * 100).toFixed(1)) : 100;

              // Por zona
              if (!bucket.porZona[zone]) bucket.porZona[zone] = { vitales: 0, aTiempo: 0, secundarias: 0, total: 0 };
              bucket.porZona[zone].total += 1;
              if (isPrinc) {
                  bucket.porZona[zone].vitales += 1;
                  if (onTime) bucket.porZona[zone].aTiempo += 1;
              } else {
                  bucket.porZona[zone].secundarias += 1;
              }

              // Por país
              if (!bucket.porPais[country]) bucket.porPais[country] = { vitales: 0, aTiempo: 0, secundarias: 0, total: 0 };
              bucket.porPais[country].total += 1;
              if (isPrinc) {
                  bucket.porPais[country].vitales += 1;
                  if (onTime) bucket.porPais[country].aTiempo += 1;
              } else {
                  bucket.porPais[country].secundarias += 1;
              }
          });

          // Procesar combustible
          fuelSnap.forEach(docSnap => {
              const d = docSnap.data();
              const dateInfo = extractDateInfo(d.fecha);
              if (dateInfo.year !== String(year) || !dateInfo.month) return;
              const monthKey = `${year}-${String(dateInfo.month).padStart(2, '0')}`;
              const bucket = monthlyBuckets[monthKey];
              if (!bucket) return;
              bucket.gastoCombustible += Number(d.costo || 0);
              bucket.galonesCombustible += Number(d.galones || 0);
          });

          // Procesar mantenimiento
          maintSnap.forEach(docSnap => {
              const d = docSnap.data();
              const dateInfo = extractDateInfo(d.fecha);
              if (dateInfo.year !== String(year) || !dateInfo.month) return;
              const monthKey = `${year}-${String(dateInfo.month).padStart(2, '0')}`;
              const bucket = monthlyBuckets[monthKey];
              if (!bucket) return;
              bucket.gastoMantenimiento += Number(d.costo || 0);
          });

          // Guardar los 12 resúmenes en Firestore
          const batch = writeBatch(db);
          Object.entries(monthlyBuckets).forEach(([monthKey, b]) => {
              const eficiencia = b.vitales > 0 ? parseFloat(((b.aTiempo / b.vitales) * 100).toFixed(1)) : 100;
              batch.set(doc(db, "resumenes_operativos", monthKey), {
                  _conteoProduccion: {
                      vitales: b.vitales,
                      aTiempo: b.aTiempo,
                      secundarias: b.secundarias,
                      total: b.total,
                      gastoCombustible: parseFloat(b.gastoCombustible.toFixed(2)),
                      galonesCombustible: parseFloat(b.galonesCombustible.toFixed(2)),
                      gastoMantenimiento: parseFloat(b.gastoMantenimiento.toFixed(2))
                  },
                  eficienciaGlobal: eficiencia,
                  totalViajesMes: b.total,
                  gastoCombustible: parseFloat(b.gastoCombustible.toFixed(2)),
                  galonesCombustible: parseFloat(b.galonesCombustible.toFixed(2)),
                  gastoMantenimiento: parseFloat(b.gastoMantenimiento.toFixed(2)),
                  porUsuario: b.porUsuario,
                  porZona: b.porZona,
                  porPais: b.porPais,
                  ultimaActualizacion: new Date().toISOString()
              }, { merge: true });
          });

          await batch.commit();
          alert(`¡Resúmenes de ${year} recalculados con éxito! Se procesaron ${prodSnap.size} viajes de producción y se actualizaron los 12 meses.`);
      } catch (error) {
          console.error("Error recalculando resúmenes", error);
          alert("Error recalculando resúmenes: " + (error.message || error));
      } finally {
          setIsRebuildingSummaries(false);
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
  const [avisoForm, setAvisoForm] = useState({ mensaje: '', para: 'Todos', tipo: 'info', duracionDias: 7 });
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
      if (!otData || otData.length === 0) return [];
      return otData
          .filter((record) => {
              if (!isRecordForUser(record, currentUser?.email, userProfile, form)) return false;
              return isDateInRange(record.fecha, sysConfig?.heInicio, sysConfig?.heFin);
          })
          .sort(sortByRecordDateDesc);
  }, [otData, sysConfig, currentUser?.email, form.recolector, userProfile.nombre]);

useEffect(() => {
    if (!currentUser) return;
    if (!currentUser.email) { if (typeof logout === 'function') logout(); return; }
    const email = currentUser.email.toLowerCase().trim();
    if (ADMIN_EMAILS.includes(email)) setAppMode('admin'); 
    else if (SUPERVISOR_EMAILS.includes(email)) setAppMode('supervisor'); 
    else { 
        setAppMode('user'); 
        const nombreReal = USUARIOS_EMAIL[email]; 
        if (nombreReal) setForm(prev => ({ ...prev, recolector: nombreReal })); 
    }

    const savedHiddenAlerts = localStorage.getItem(`recolekta_hidden_alerts_${email}`);
    if (savedHiddenAlerts) { try { setHiddenAlerts(JSON.parse(savedHiddenAlerts)); } catch (e) {} }

    const unsubProfile = onSnapshot(doc(db, "usuarios_perfiles", email), (docSnap) => { 
        if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(prev => ({ ...prev, ...data })); 
            setPerfilesUsuarios(prev => ({ ...prev, [email]: data }));
            
            // 🟢 EL PUENTE DINÁMICO: Si el perfil tiene nombre en Firebase, lo inyecta en el formulario móvil
            if (data.nombre) {
                setForm(prev => ({ ...prev, recolector: data.nombre.toUpperCase() }));
            }
        } 
    });
    return () => unsubProfile();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.email) return;
    if (!localStorage.getItem('recolekta_tutorial_v98')) setShowWelcome(true);
    const unsubConfig = onSnapshot(doc(db, "configuraciones", "general"), (snap) => { if(snap.exists()) setSysConfig(snap.data()); });

    const unsubCatalogs = onSnapshot(doc(db, "configuraciones", "catalogos"), (snap) => {
        const data = snap.exists() ? snap.data() : {};
        const migrate = (field, defaultObj) => { if (!data[field]) return defaultObj; if (Array.isArray(data[field])) return { "El Salvador": data[field] }; return data[field]; };
        setCatalogs({
            paises: data.paises || DEFAULT_CATALOGS.paises, zonas: data.zonas || DEFAULT_CATALOGS.zonas,
            transportistas: migrate('transportistas', DEFAULT_CATALOGS.transportistas), sucursales: migrate('sucursales', DEFAULT_CATALOGS.sucursales),
            areas: migrate('areas', DEFAULT_CATALOGS.areas), diligencias: migrate('diligencias', DEFAULT_CATALOGS.diligencias)
        });
    });
    return () => { unsubConfig(); unsubCatalogs(); };
  }, [currentUser?.email]);

  useEffect(() => {
    const shouldLoadProfiles = (appMode === 'admin' && adminSection !== 'inicio')
        || (appMode === 'supervisor' && supervisorSection !== 'inicio');
    if (!currentUser?.email || !shouldLoadProfiles) {
        if (appMode !== 'user') setPerfilesUsuarios({});
        return;
    }
    const unsubAllProfiles = onSnapshot(collection(db, "usuarios_perfiles"), (snap) => {
        let perfiles = {}; 
        snap.forEach(doc => { perfiles[doc.id] = doc.data(); }); 
        setPerfilesUsuarios(perfiles); 
    });
    return () => unsubAllProfiles();
  }, [currentUser?.email, appMode, adminSection, supervisorSection]);

  useEffect(() => {
    const isAnalyticsOpen = (appMode === 'admin' && adminSection === 'bi') || (appMode === 'supervisor' && supervisorSection === 'bi');
    const needsCsv = filterYear === '2025' || isAnalyticsOpen;
    if (!currentUser?.email || appMode === 'user' || !needsCsv || csvData.length > 0) return;
    Papa.parse(GITHUB_CSV_URL, { download: true, header: true, complete: (res) => {
        const mapped = (res.data || []).map(row => {
            const tipoRaw = String(row['Diligencia realizada:']||''); const isP = PRINCIPAL_KEYWORDS.some(k => tipoRaw.toLowerCase().includes(k)); let tiempoClean = 0; const matches = String(row['Minutos de espera'] || '0').match(/\d+/); if (matches) tiempoClean = parseInt(matches[0]);
            return { recolector: String(row['Nombre de Transportista']||'').toUpperCase().trim(), tiempo: tiempoClean, sucursal: row['Sucursal '] || 'Ruta Externa', tipo: tipoRaw, categoria: isP ? "Principal" : "Secundaria", originalTipo: tipoRaw, fotoData: row['Fotografía de bitácora:'] || null, observaciones: row['Observaciones'] || '', month: parseInt(String(row['Marca temporal']||'').split(/[\s\/]+/)[1])||1, createdAt: row['Marca temporal'], hLlegada: '--', mLlegada: '--', pLlegada: '', hSalida: '--', mSalida: '--', pSalida: '' };
        }).filter(r => r.recolector !== '');
        setCsvData(mapped);
    }});
  }, [currentUser?.email, appMode, filterYear, csvData.length, adminSection, supervisorSection]);

  useEffect(() => {
    if (!currentUser?.email) return;
    const shouldLoadAllAgenda = (appMode === 'admin' && adminSection === 'agenda') || (appMode === 'supervisor' && supervisorSection === 'agenda');

    if (shouldLoadAllAgenda) {
        const unsub = onSnapshot(collection(db, "agenda_flota"), (snap) => setAgendaData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsub();
    }

    if (appMode === 'user' && form.recolector) {
        const agendaRef = doc(db, "agenda_flota", form.recolector);
        const unsub = onSnapshot(agendaRef, (snap) => setAgendaData(snap.exists() ? [{ id: snap.id, ...snap.data() }] : []));
        return () => unsub();
    }

    setAgendaData([]);
  }, [currentUser?.email, appMode, adminSection, supervisorSection, form.recolector]);

  useEffect(() => {
    if (!currentUser?.email) return;
    const isAnalyticsOpen = (appMode === 'admin' && adminSection === 'bi') || (appMode === 'supervisor' && supervisorSection === 'bi');
    const isAdminOps = appMode === 'admin' && (adminSection === 'ops' || adminSection === 'inicio');
    const isUserProfile = appMode === 'user' && userView === 'perfil';

    if (isAnalyticsOpen || isAdminOps) {
        const previousYear = String(Number(filterYear) - 1);
        const summariesQuery = query(
            collection(db, "resumenes_operativos"),
            where(documentId(), ">=", `${previousYear}-01`),
            where(documentId(), "<=", `${filterYear}-12`),
            orderBy(documentId())
        );
        const unsub = onSnapshot(summariesQuery, (snap) => {
            const summaries = {};
            snap.forEach(summaryDoc => { summaries[summaryDoc.id] = summaryDoc.data(); });
            setResumenesMensualesNube(summaries);
        });
        return () => unsub();
    }

    if (isUserProfile) {
        const now = new Date();
        const currentMonthDocId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const unsub = onSnapshot(doc(db, "resumenes_operativos", currentMonthDocId), (snap) => {
            if (snap.exists()) {
                setResumenesMensualesNube(prev => ({ ...prev, [currentMonthDocId]: snap.data() }));
            }
        });
        return () => unsub();
    }

    setResumenesMensualesNube({});
  }, [currentUser?.email, appMode, adminSection, supervisorSection, filterYear, userView]);

  useEffect(() => {
    if (!currentUser?.email) return;
    const alertLimit = appMode === 'user' ? 10 : 20;
    const unsub = onSnapshot(query(collection(db, "alertas_flota"), orderBy("createdAt", "desc"), limit(alertLimit)), (snap) => {
        setAlertasData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUser?.email, appMode]);

  useEffect(() => {
    if (!currentUser?.email || appMode !== 'admin' || adminSection !== 'ops') return;
    let cancelled = false;
    const fetchExactCount = async () => {
        try {
            const currY = Number(filterYear);
            const currM = filterMonth === 'all' ? (new Date().getMonth() + 1) : parseInt(filterMonth);
            const mStr = String(currM).padStart(2, '0');
            const startISO = `${currY}-${mStr}-01`;
            const nextMonthYear = currM === 12 ? currY + 1 : currY;
            const nextMonthNum = currM === 12 ? 1 : currM + 1;
            const endISO = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-01`;

            let q = query(
                collection(db, "registros_produccion"),
                where("createdAt", ">=", startISO),
                where("createdAt", "<", endISO)
            );
            if (filterUser !== 'all') {
                q = query(q, where("recolector", "==", filterUser));
            }
            const countSnap = await getCountFromServer(q);
            if (!cancelled) {
                setServerMonthlyCount(countSnap.data().count);
            }
        } catch (e) {
            console.error("Error fetching exact monthly count", e);
        }
    };
    fetchExactCount();
    return () => { cancelled = true; };
  }, [appMode, adminSection, filterYear, filterMonth, filterUser, currentUser?.email, liveData.length]);

  useEffect(() => {
    if (!currentUser?.email) return;
    let unsubOps;
    let unsubFuel;
    let unsubMaint;
    let cancelled = false;

    const now = new Date();
    const currentMonthNum = now.getMonth() + 1;
    const currentYearStr = now.getFullYear().toString();
    const startOfMonthISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfMonthStr = startOfMonthISO.substring(0, 10);
    const startOfDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isHistoricalMonth = filterYear !== currentYearStr || (filterMonth !== 'all' && Number(filterMonth) !== currentMonthNum);

    const loadHistoricalProduction = async () => {
        // El histórico 2025 vive en el CSV; no debe duplicarse con lecturas de Firestore.
        if (filterYear === '2025' || filterMonth === 'all') {
            setLiveData([]);
            return;
        }
        setIsFetchingHistory(true);
        try {
            const month = String(filterMonth).padStart(2, '0');
            const start = `${filterYear}-${month}-01`;
            const nextMonth = Number(filterMonth) === 12 ? 1 : Number(filterMonth) + 1;
            const nextYear = Number(filterMonth) === 12 ? Number(filterYear) + 1 : Number(filterYear);
            const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
            const snap = await getDocs(query(collection(db, "registros_produccion"), where("createdAt", ">=", start), where("createdAt", "<", end), orderBy("createdAt", "desc"), limit(10000)));
            if (!cancelled) setLiveData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error cargando operaciones históricas", error);
            if (!cancelled) setLiveData([]);
        } finally {
            if (!cancelled) setIsFetchingHistory(false);
        }
    };

    if (appMode === 'admin') {
        if (adminSection === 'ops') {
            setFuelData([]); setMaintData([]);
            if (isHistoricalMonth) loadHistoricalProduction();
            else {
                unsubOps = onSnapshot(query(collection(db, "registros_produccion"), where("createdAt", ">=", startOfMonthISO), orderBy("createdAt", "desc"), limit(queryLimit)), (snap) => setLiveData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            }
        } else if (adminSection === 'fleet') {
            setLiveData([]);
            unsubFuel = onSnapshot(query(collection(db, "registros_combustible"), where("fecha", ">=", startOfMonthStr)), (snap) => setFuelData(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.fecha.localeCompare(a.fecha))));
            unsubMaint = onSnapshot(query(collection(db, "registros_mantenimiento"), where("fecha", ">=", startOfMonthStr)), (snap) => setMaintData(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.fecha.localeCompare(a.fecha))));
        } else if (adminSection === 'hr') {
            setLiveData([]); setFuelData([]); setMaintData([]);
        } else {
            setLiveData([]); setFuelData([]); setMaintData([]);
        }
    } else if (appMode === 'supervisor') {
        if (supervisorSection === 'bitacora') {
            setFuelData([]); setMaintData([]);
            unsubOps = onSnapshot(query(collection(db, "registros_produccion"), where("createdAt", ">=", startOfDayStr), orderBy("createdAt", "desc"), limit(queryLimit)), (snap) => setLiveData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        } else if (supervisorSection === 'combustible') {
            setLiveData([]); setMaintData([]);
            unsubFuel = onSnapshot(query(collection(db, "registros_combustible"), where("fecha", ">=", startOfMonthStr)), (snap) => setFuelData(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.fecha.localeCompare(a.fecha))));
        } else if (supervisorSection === 'taller') {
            setLiveData([]); setFuelData([]);
            unsubMaint = onSnapshot(query(collection(db, "registros_mantenimiento"), where("fecha", ">=", startOfMonthStr)), (snap) => setMaintData(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.fecha.localeCompare(a.fecha))));
        } else {
            setLiveData([]); setFuelData([]); setMaintData([]);
        }
    } else if (appMode === 'user') {
        setFuelData([]);
        const cleanUserEmail = currentUser.email.toLowerCase().trim();
        unsubOps = onSnapshot(
            query(collection(db, "registros_produccion"), where("usuarioEmail", "==", cleanUserEmail), where("createdAt", ">=", startOfDayStr), orderBy("createdAt", "desc"), limit(100)),
            (snap) => {
                setLiveData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            },
            (error) => { console.error("Error cargando registros del día", error); }
        );
        unsubMaint = onSnapshot(query(collection(db, "registros_mantenimiento"), where("usuario", "==", currentUser.email), orderBy("fecha", "desc"), limit(1)), (snap) => setMaintData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
    return () => {
        cancelled = true;
        if(unsubOps) unsubOps();
        if(unsubFuel) unsubFuel();
        if(unsubMaint) unsubMaint();
    };
  }, [appMode, adminSection, supervisorSection, currentUser?.email, queryLimit, appMode === 'admin' && adminSection === 'ops' ? `${filterYear}:${filterMonth}` : 'inactive']);

  useEffect(() => {
      if (!currentUser?.email) return;
      
      let q;
      if (appMode === 'user') {
          const cleanEmail = currentUser.email.toLowerCase().trim();
          const possibleNames = [
              cleanEmail,
              cleanEmail.split('@')[0],
              USUARIOS_EMAIL[cleanEmail],
              userProfile?.nombre,
              form?.recolector
          ].filter(Boolean);

          const userIdentitiesSet = new Set();
          possibleNames.forEach(name => {
              const raw = String(name).trim();
              if (!raw) return;
              userIdentitiesSet.add(raw);
              userIdentitiesSet.add(raw.toLowerCase());
              userIdentitiesSet.add(raw.toUpperCase());
              userIdentitiesSet.add(`NOMBRE:${raw.toUpperCase()}`);
              userIdentitiesSet.add(`nombre:${raw.toLowerCase()}`);
          });
          const userIdentities = Array.from(userIdentitiesSet).slice(0, 30);
          
          if (userIdentities.length > 0) {
              q = query(collection(db, "registros_horas_extras"), where("usuario", "in", userIdentities), limit(500));
          } else {
              q = query(collection(db, "registros_horas_extras"), limit(500));
          }
      } else {
          // Admin needs all records for the period. Since dates are mixed format, we pull a larger chunk.
          q = query(collection(db, "registros_horas_extras"), limit(2000));
      }

      const unsubOt = onSnapshot(
          q,
          (snap) => {
              setOtData(snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort(sortByRecordDateDesc));
          },
          (error) => {
              console.error('Error cargando horas extras', error);
          }
      );
      return () => unsubOt();
  }, [currentUser?.email, appMode, userProfile?.nombre, form?.recolector]);

  const getUserZone = (emailOrName) => { 
      let email = emailOrName; 
      if (email && !email.includes('@')) {
          // 🟢 CORRECCIÓN: Busca la zona en Firebase en vivo, si no, usa GitHub
          email = Object.keys(perfilesUsuarios).find(key => perfilesUsuarios[key]?.nombre === emailOrName) || Object.keys(USUARIOS_EMAIL).find(key => USUARIOS_EMAIL[key] === emailOrName); 
      }
      return perfilesUsuarios[email]?.zona || 'Sin Asignar'; 
  };

  const getUserDisplayName = (emailOrName) => {
      const key = String(emailOrName || '').toLowerCase().trim();
      return perfilesUsuarios[key]?.nombre || USUARIOS_EMAIL[key] || emailOrName || '';
  };
  
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

  const handleDelete = async (collectionName, id) => { 
    if(!id || !collectionName) return;
    if(window.confirm("⚠️ ¿Eliminar registro permanentemente?")) { 
      try { 
        await deleteDoc(doc(db, collectionName, id)); 
        if (collectionName === 'registros_horas_extras') {
          setOtData(prev => prev.filter(item => item.id !== id));
        } else if (collectionName === 'registros_combustible') {
          setFuelData(prev => prev.filter(item => item.id !== id));
        } else if (collectionName === 'registros_mantenimiento') {
          setMaintData(prev => prev.filter(item => item.id !== id));
        } else if (collectionName === 'registros_produccion') {
          setLiveData(prev => prev.filter(item => item.id !== id));
        }
        alert("¡Registro eliminado correctamente!");
      } catch(e) { 
        console.error("Error al eliminar:", e);
        alert(`Error al eliminar: ${e.message || e}`); 
      } 
    } 
  };

  const openEditModal = (item, collectionName) => { 
    const formattedItem = { ...item };
    if (formattedItem.fecha) {
        formattedItem.fecha = normalizeDateForComparison(formattedItem.fecha);
    }
    setEditingItem({ ...item, collectionName }); 
    setEditFormData(formattedItem); 
  };

  const handleUpdate = async () => { 
    if(!editingItem || !editingItem.id || !editingItem.collectionName) return; 
    try { 
      const { id, collectionName } = editingItem; 
      const payload = { ...editFormData };
      delete payload.id;
      delete payload.collectionName;
      
      if (collectionName === 'registros_horas_extras') {
        if (payload.horasCalculadas !== undefined) {
          payload.horasCalculadas = parseFloat(payload.horasCalculadas) || 0;
        }
      }
      
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });
      
      await updateDoc(doc(db, collectionName, id), payload); 
      
      if (collectionName === 'registros_horas_extras') {
        setOtData(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
      } else if (collectionName === 'registros_combustible') {
        setFuelData(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
      } else if (collectionName === 'registros_mantenimiento') {
        setMaintData(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
      } else if (collectionName === 'registros_produccion') {
        setLiveData(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
      }

      setEditingItem(null); 
      alert("¡Registro actualizado correctamente!");
    } catch(e) { 
      console.error("Error al actualizar:", e);
      alert(`Error al actualizar: ${e.message || e}`); 
    } 
  };
  
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
                  newData.horasCalculadas = parseFloat((diffMins / 60).toFixed(1));
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
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear().toString();
      const currentMonthDocId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const currentEmail = String(currentUser?.email || '').toLowerCase().trim();
      const currentRecolector = String(form.recolector || userProfile.nombre || '').toUpperCase().trim();

      const monthSummary = resumenesMensualesNube[currentMonthDocId]?.porUsuario?.[currentEmail]
          || (currentRecolector ? resumenesMensualesNube[currentMonthDocId]?.porUsuario?.[`nombre:${currentRecolector}`] : null)
          || (currentRecolector ? resumenesMensualesNube[currentMonthDocId]?.porUsuario?.[currentRecolector] : null);

      let vitales = userProfile.vitalesNube !== undefined && Number(userProfile.vitalesNube) > 0
          ? Number(userProfile.vitalesNube) 
          : (monthSummary?.vitales !== undefined ? Number(monthSummary.vitales) : 0);
      let secundarias = userProfile.secundariasNube !== undefined && Number(userProfile.secundariasNube) > 0
          ? Number(userProfile.secundariasNube) 
          : (monthSummary?.secundarias !== undefined ? Number(monthSummary.secundarias) : 0);
      let efRaw = userProfile.eficienciaNube !== undefined 
          ? userProfile.eficienciaNube 
          : (monthSummary?.eficiencia !== undefined ? monthSummary.eficiencia : 100);

      let totalOps = vitales + secundarias;
      let totalSecundarias = secundarias;

      // Respaldo de seguridad: Si no hay datos consolidados pero hoy ya existen registros en liveData
      if (totalOps === 0 && liveData.length > 0) {
          const liveVitales = liveData.filter(d => isPrincipalData(d)).length;
          const liveSecundarias = liveData.filter(d => !isPrincipalData(d)).length;
          totalOps = liveVitales + liveSecundarias;
          totalSecundarias = liveSecundarias;
      }
      
      const userOt = otData.filter(d => { 
          if (!isRecordForUser(d, currentEmail, userProfile, form)) return false;
          if (sysConfig?.heInicio && sysConfig?.heFin) {
              return isDateInRange(d.fecha, sysConfig.heInicio, sysConfig.heFin);
          }
          const dateInfo = extractDateInfo(d.fecha); return dateInfo.month === currentMonth && dateInfo.year === currentYear;
      });
      const totalOT = userOt.reduce((acc, curr) => acc + parseFloat(String(curr.horasCalculadas).replace(',','.') || 0), 0);
      
      return { 
          eficiencia: parseFloat(efRaw), 
          totalOps: totalOps, 
          totalOT: totalOT.toFixed(1),
          totalSecundarias: totalSecundarias
      };
  }, [userProfile, otData, currentUser, sysConfig, resumenesMensualesNube, form.recolector, liveData]);
const cycleCategory = async () => { const categories = ['Operador', 'Técnico', 'Coordinador']; const currentIndex = categories.indexOf(userProfile.categoria || 'Operador'); const nextCategory = categories[(currentIndex + 1) % categories.length]; try { await setDoc(doc(db, "usuarios_perfiles", currentUser.email), { categoria: nextCategory }, { merge: true }); } catch(e) {} };
const hrMetrics = useMemo(() => {
    let filteredOt = otData.filter((record) => isDateInRange(record.fecha, sysConfig.heInicio, sysConfig.heFin));
    if (filterZona !== 'all') filteredOt = filteredOt.filter(d => isUserInFilterZone(d.usuario, filterZona)); 
    
    // 🟢 CORRECCIÓN 1: Filtro global con limpieza de formato
    if (filterUser !== 'all') filteredOt = filteredOt.filter(d => {
        const emailLimpio = d.usuario ? d.usuario.toLowerCase().trim() : '';
        return (perfilesUsuarios[emailLimpio]?.nombre || USUARIOS_EMAIL[emailLimpio] || '') === filterUser;
    });

    const totalHoras = filteredOt.reduce((acc, curr) => { const hrs = parseFloat(String(curr.horasCalculadas).replace(',', '.')) || 0; return acc + hrs; }, 0);
    const userOtStats = filteredOt.reduce((acc, curr) => { 
        const rawName = curr.usuario || 'Desconocido'; 
        // 🟢 CORRECCIÓN 2: Ranking y sumatoria con limpieza de formato
        const emailLimpio = rawName.toLowerCase().trim();
        const name = perfilesUsuarios[emailLimpio]?.nombre?.toUpperCase() || USUARIOS_EMAIL[emailLimpio] || rawName; 
        
        const hrs = parseFloat(String(curr.horasCalculadas).replace(',', '.')) || 0; acc[name] = (acc[name] || 0) + hrs; return acc; 
    }, {});
    
    const rankingOt = Object.entries(userOtStats).map(([name, hours]) => ({ name, hours: parseFloat(hours.toFixed(2)) })).sort((a,b) => b.hours - a.hours); return { totalHoras: totalHoras.toFixed(2), totalRegistros: filteredOt.length, rankingOt, rawData: filteredOt };
  }, [otData, filterUser, filterZona, sysConfig, perfilesUsuarios]);

  const fleetMetrics = useMemo(() => {
    let filteredFuel = fuelData.filter(d => checkDate(d.fecha)); let filteredMaint = maintData.filter(d => checkDate(d.fecha));
    if (filterZona !== 'all') { filteredFuel = filteredFuel.filter(d => isUserInFilterZone(d.usuario, filterZona)); filteredMaint = filteredMaint.filter(d => isUserInFilterZone(d.usuario, filterZona)); }
    if (filterUser !== 'all') { filteredFuel = filteredFuel.filter(d => getUserDisplayName(d.usuario) === filterUser); filteredMaint = filteredMaint.filter(d => getUserDisplayName(d.usuario) === filterUser); }
    const totalFuelCost = filteredFuel.reduce((acc, curr) => acc + parseFloat(curr.costo || 0), 0); const totalGalones = filteredFuel.reduce((acc, curr) => acc + parseFloat(curr.galones || 0), 0); const totalMaintCost = filteredMaint.reduce((acc, curr) => acc + parseFloat(curr.costo || 0), 0);
    const userStats = {};
    const resolveFleetIdentity = (usuario) => {
        const rawValue = String(usuario || 'Desconocido').trim();
        const normalizedValue = rawValue.toLowerCase();
        const displayName = String(getUserDisplayName(rawValue) || rawValue).trim().toUpperCase();
        const profileEmail = normalizedValue.includes('@')
            ? normalizedValue
            : Object.keys(perfilesUsuarios).find(email => String(perfilesUsuarios[email]?.nombre || '').trim().toUpperCase() === displayName)
                || Object.keys(USUARIOS_EMAIL).find(email => String(USUARIOS_EMAIL[email] || '').trim().toUpperCase() === displayName);

        return { key: profileEmail || `nombre:${displayName}`, name: displayName };
    };
    const process = (item, costType) => {
        const identity = resolveFleetIdentity(item.usuario);
        userStats[identity.key] = userStats[identity.key] || { name: identity.name, fuel: 0, maint: 0 };
        userStats[identity.key][costType] += parseFloat(item.costo || 0);
    };
    filteredFuel.forEach(i => process(i, 'fuel')); filteredMaint.forEach(i => process(i, 'maint'));
    const chartData = Object.values(userStats).map(stats => ({ name: stats.name, fuel: parseFloat(stats.fuel.toFixed(2)), maint: parseFloat(stats.maint.toFixed(2)), total: parseFloat((stats.fuel + stats.maint).toFixed(2)) })).sort((a,b) => b.total - a.total);
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
                const pCount = mRecs.length;
                const sCount = finalDocs.length - mRecs.length;
                efVal = isFuture ? null : (pCount > 0 ? parseFloat(calcEf(mRecs)) : null);
                countVal = finalDocs.length;
                return { name: m, ef: efVal, count: countVal, vitales: pCount, secundarias: sCount };
            } else if (filterUser === 'all') {
                // B) Si la PC NO tiene los datos (Ej. al seleccionar "Año" en Vivo), lee de la Nube
                const resumen = resumenesMensualesNube[documentId];
                const hasTrips = resumen && Number(resumen.totalViajesMes || resumen._conteoProduccion?.total || 0) > 0;
                efVal = isFuture || !hasTrips ? null : parseFloat(resumen.eficienciaGlobal);
                countVal = resumen ? Number(resumen.totalViajesMes || resumen._conteoProduccion?.total || 0) : 0;
                const vCount = Number(resumen?.vitales ?? resumen?._conteoProduccion?.vitales ?? (resumen?.porUsuario ? Object.values(resumen.porUsuario).reduce((acc, u) => acc + Number(u.vitales || 0), 0) : 0));
                const sCount = Number(resumen?.secundarias ?? resumen?._conteoProduccion?.secundarias ?? (resumen?.porUsuario ? Object.values(resumen.porUsuario).reduce((acc, u) => acc + Number(u.secundarias || 0), 0) : 0));
                return { name: m, ef: efVal, count: countVal, vitales: vCount, secundarias: sCount };
            } else {
                efVal = null;
                return { name: m, ef: null, count: 0, vitales: 0, secundarias: 0 };
            }
        });
    
    const sucursalStats = filtered.reduce((acc, curr) => { if(!curr.sucursal || curr.sucursal === 'N/A' || curr.sucursal === 'Ruta Externa') return acc; acc[curr.sucursal] = acc[curr.sucursal] || { totalTime: 0, count: 0 }; acc[curr.sucursal].totalTime += (curr.tiempo || 0); acc[curr.sucursal].count += 1; return acc; }, {});
    const topSucursales = Object.entries(sucursalStats).map(([name, stats]) => ({ name, avgWait: parseFloat((stats.totalTime / stats.count).toFixed(1)) })).sort((a,b) => b.avgWait - a.avgWait).slice(0, 5);
    
    const isYearView = filterMonth === 'all';
    const targetMonthNum = isYearView ? currMonth : Number(filterMonth);
    const activeDocId = `${filterYear}-${String(targetMonthNum).padStart(2, '0')}`;
    const activeMonthSummary = resumenesMensualesNube[activeDocId];
    const isFiltered = filterUser !== 'all' || filterZona !== 'all' || filterSucursal !== 'all' || Boolean(filterSpecificDate);
    
    let totalMesVal = (serverMonthlyCount !== null && !isFiltered && isYearView) 
        ? serverMonthlyCount 
        : (activeMonthSummary?.totalViajesMes || activeMonthSummary?._conteoProduccion?.total || filtered.length);
    
    let vitalesMes = activeMonthSummary?.vitales ?? activeMonthSummary?._conteoProduccion?.vitales;
    let secundariasMes = activeMonthSummary?.secundarias ?? activeMonthSummary?._conteoProduccion?.secundarias;
    if ((vitalesMes === undefined || secundariasMes === undefined) && activeMonthSummary?.porUsuario) {
        vitalesMes = Object.values(activeMonthSummary.porUsuario).reduce((acc, u) => acc + Number(u.vitales || 0), 0);
        secundariasMes = Object.values(activeMonthSummary.porUsuario).reduce((acc, u) => acc + Number(u.secundarias || 0), 0);
    }
    if (vitalesMes === undefined && secundariasMes === undefined) {
        vitalesMes = pItems.length;
        secundariasMes = sItems.length;
    }

    const MONTH_NAMES_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const periodLabel = isYearView 
        ? `MES ACTUAL (${MONTH_NAMES_ES[currMonth - 1] || 'SEPTIEMBRE'})` 
        : (MONTH_NAMES_ES[targetMonthNum - 1] || 'MES');

    return { 
        total: totalMesVal, 
        totalBitacora: filtered.length, 
        vitalesMes, 
        secundariasMes, 
        periodLabel,
        isYearView,
        efP: calcEf(pItems), 
        avgP: calcAvg(pItems), 
        countP: pItems.length, 
        efS: calcEf(sItems), 
        avgS: calcAvg(sItems), 
        countS: sItems.length, 
        monthlyData, 
        topSucursales, 
        rows: filtered 
    };
  // 🔥 EL CANDADO CORREGIDO: Faltaba incluir resumenesMensualesNube y serverMonthlyCount en la lista de aquí abajo 👇
  }, [liveData, csvData, filterMonth, filterUser, filterYear, filterSpecificDate, filterSucursal, filterZona, perfilesUsuarios, resumenesMensualesNube, serverMonthlyCount]);

  const getSummaryStatsForFilters = (summary = {}) => {
      if (filterUser !== 'all') {
          const selectedName = normalizeName(filterUser);
          const selectedEmail = Object.keys(perfilesUsuarios).find(email => normalizeName(perfilesUsuarios[email]?.nombre) === selectedName)
              || Object.keys(USUARIOS_EMAIL).find(email => normalizeName(USUARIOS_EMAIL[email]) === selectedName);
          return selectedEmail ? summary.porUsuario?.[selectedEmail] || null : null;
      }
      if (filterZona !== 'all') {
          return summary.porZona?.[filterZona] || summary.porPais?.[filterZona] || null;
      }
      return {
          ...(summary._conteoProduccion || {}),
          gastoCombustible: summary.gastoCombustible,
          galonesCombustible: summary.galonesCombustible,
          gastoMantenimiento: summary.gastoMantenimiento
      };
  };

  const regionalMetrics = useMemo(() => {
      const selectedSummaries = Object.entries(resumenesMensualesNube)
          .filter(([monthId]) => monthId.startsWith(`${filterYear}-`) && (filterMonth === 'all' || monthId.endsWith(`-${String(filterMonth).padStart(2, '0')}`)))
          .map(([, summary]) => summary);
      const countryStats = {};
      const zoneStats = {};
      const accumulateMap = (target, source = {}) => {
          Object.entries(source).forEach(([name, values]) => {
              const current = target[name] || { vitales: 0, aTiempo: 0, secundarias: 0, total: 0 };
              target[name] = {
                  vitales: current.vitales + Number(values.vitales || 0),
                  aTiempo: current.aTiempo + Number(values.aTiempo || 0),
                  secundarias: current.secundarias + Number(values.secundarias || 0),
                  total: current.total + Number(values.total || 0)
              };
          });
      };
      selectedSummaries.forEach(summary => {
          accumulateMap(countryStats, summary.porPais);
          accumulateMap(zoneStats, summary.porZona);
      });

      const formatRows = (stats, type) => Object.entries(stats)
          .filter(([name]) => name !== 'Sin Asignar')
          .map(([nombre, values]) => ({
              nombre,
              tipo: type,
              vitales: values.vitales,
              onTime: values.aTiempo,
              secundarias: values.secundarias,
              total: values.total,
              eficiencia: values.vitales > 0 ? parseFloat(((values.aTiempo / values.vitales) * 100).toFixed(1)) : 0
          }))
          .sort((a, b) => b.eficiencia - a.eficiencia);

      if (Object.keys(countryStats).length > 0 || Object.keys(zoneStats).length > 0) {
          return { paises: formatRows(countryStats, 'pais'), zonas: formatRows(zoneStats, 'zona') };
      }

      const data = filterYear === '2025' ? csvData : liveData;
      const fallback = {};
      data.filter(d => checkDate(d.createdAt)).forEach(d => {
          const zone = getUserZone(d.recolector);
          const country = zone.includes('-') ? zone.split('-')[0].trim() : zone;
          const principal = isPrincipalData(d);
          const onTime = principal && (d.tiempo || 0) <= getMetaEspera(zone);
          for (const [name, type] of [[country, 'pais'], [zone, 'zona']]) {
              if (!fallback[`${type}:${name}`]) fallback[`${type}:${name}`] = { nombre: name, tipo: type, vitales: 0, onTime: 0, secundarias: 0, total: 0 };
              const row = fallback[`${type}:${name}`];
              row.total += 1;
              if (principal) { row.vitales += 1; if (onTime) row.onTime += 1; } else row.secundarias += 1;
          }
      });
      const rows = Object.values(fallback).map(row => ({ ...row, eficiencia: row.vitales > 0 ? parseFloat(((row.onTime / row.vitales) * 100).toFixed(1)) : 0 }));
      return {
          paises: rows.filter(row => row.tipo === 'pais' && row.nombre !== 'Sin Asignar').sort((a, b) => b.eficiencia - a.eficiencia),
          zonas: rows.filter(row => row.tipo === 'zona' && row.nombre !== 'Sin Asignar').sort((a, b) => b.eficiencia - a.eficiencia)
      };
  }, [liveData, csvData, filterYear, filterMonth, perfilesUsuarios, resumenesMensualesNube]);

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
          const calcEf = (docs) => { const recs = docs.filter(d => isPrincipalData(d)); if(recs.length === 0) return null; return parseFloat(((recs.filter(x => (x.tiempo||0) <= getMetaEspera(getUserZone(x.recolector))).length / recs.length) * 100).toFixed(1)); };
          
          const getFuel = (y) => { let docs = fuelData.filter(d => { const info = extractDateInfo(d.fecha); return info.year === y && info.month === mNum; }); if (filterZona !== 'all') docs = docs.filter(x => isUserInFilterZone(x.usuario, filterZona)); if (filterUser !== 'all') docs = docs.filter(x => getUserDisplayName(x.usuario) === filterUser); return docs.reduce((sum, d) => sum + parseFloat(d.costo||0), 0); };
          const getMaint = (y) => { let docs = maintData.filter(d => { const info = extractDateInfo(d.fecha); return info.year === y && info.month === mNum; }); if (filterZona !== 'all') docs = docs.filter(x => isUserInFilterZone(x.usuario, filterZona)); if (filterUser !== 'all') docs = docs.filter(x => getUserDisplayName(x.usuario) === filterUser); return docs.reduce((sum, d) => sum + parseFloat(d.costo||0), 0); };
          
          // 🔥 EL SÚPER MOTOR HÍBRIDO (Eficiencia + Finanzas + CSV Local) 🔥
          let efY1 = 0; let efY2 = 0;
          let fuelY1 = 0; let fuelY2 = 0;
          let maintY1 = 0; let maintY2 = 0;

          const statsY1 = getSummaryStatsForFilters(resumenesMensualesNube[docIdY1] || {});
          const statsY2 = getSummaryStatsForFilters(resumenesMensualesNube[docIdY2] || {});
          const summaryEfficiency = (stats, fallback) => (stats && stats.vitales !== undefined && Number(stats.vitales) > 0)
              ? parseFloat(((Number(stats.aTiempo || 0) / Number(stats.vitales)) * 100).toFixed(1))
              : fallback;

          efY1 = isFutureY1 ? null : summaryEfficiency(statsY1, calcEf(ops1));
          efY2 = isFutureY2 ? null : summaryEfficiency(statsY2, calcEf(ops2));
          fuelY1 = isFutureY1 ? null : (statsY1?.gastoCombustible !== undefined && statsY1?.gastoCombustible !== null ? Number(statsY1.gastoCombustible) : getFuel(y1));
          fuelY2 = isFutureY2 ? null : (statsY2?.gastoCombustible !== undefined && statsY2?.gastoCombustible !== null ? Number(statsY2.gastoCombustible) : getFuel(y2));
          maintY1 = isFutureY1 ? null : (statsY1?.gastoMantenimiento !== undefined && statsY1?.gastoMantenimiento !== null ? Number(statsY1.gastoMantenimiento) : getMaint(y1));
          maintY2 = isFutureY2 ? null : (statsY2?.gastoMantenimiento !== undefined && statsY2?.gastoMantenimiento !== null ? Number(statsY2.gastoMantenimiento) : getMaint(y2));
          
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
    const userEmailClean = String(currentUser?.email || '').toLowerCase().trim();
    const todayStr = getStrictDateString(new Date()); 

    let userDocs = data;
    if (appMode !== 'user' && targetUser && targetUser.length > 2) {
      const targetNormalized = targetUser.toUpperCase().trim();
      userDocs = data.filter(d => 
        (d.recolector && d.recolector.toUpperCase().trim() === targetNormalized) ||
        (d.usuarioEmail && d.usuarioEmail.toLowerCase().trim() === userEmailClean)
      );
    }
    userDocs = userDocs.filter(d => getStrictDateString(d.createdAt) === todayStr);
    const recs = userDocs.filter(d => isPrincipalData(d));
    const ef = recs.length > 0 
      ? ((recs.filter(x => (x.tiempo||0) <= getMetaEspera(userProfile.zona)).length / recs.length) * 100).toFixed(1) 
      : (userDocs.length > 0 ? '100.0' : 0);
    return { ef: ef, count: userDocs.length, label: targetUser && targetUser.length > 2 ? targetUser.split(' ')[0] : 'HOY' };
  }, [liveData, csvData, form.recolector, filterYear, userProfile.zona, appMode, currentUser?.email]);
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
        const email = Object.keys(perfilesUsuarios).find(key => perfilesUsuarios[key]?.nombre === name) || Object.keys(USUARIOS_EMAIL).find(key => USUARIOS_EMAIL[key] === name);
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
          const isMaintToday = miAgenda.mantenimiento === localTodayStr;
          const maintenanceDate = miAgenda.mantenimiento ? new Date(`${miAgenda.mantenimiento}T00:00:00`) : null;
          const todayAtMidnight = new Date(`${localTodayStr}T00:00:00`);
          const overdueDays = maintenanceDate && !Number.isNaN(maintenanceDate.getTime())
              ? Math.floor((todayAtMidnight.getTime() - maintenanceDate.getTime()) / DAY_IN_MS)
              : 0;
          const isMaintRecentlyPast = overdueDays > 0 && overdueDays <= 7;
          const hasRegisteredMaint = Boolean(miAgenda.mantenimiento) && maintData.some(m => m.fecha >= miAgenda.mantenimiento);
          
          if (!hasRegisteredMaint) {
              const overdueId = `kpi_maint_past_${miAgenda.mantenimiento || ''}`;
              if (isMaintRecentlyPast && !hiddenAlerts.includes(overdueId)) alerts.push({ id: overdueId, type: 'kpi_danger', title: '🔴 ALERTA DE KPI: Mantenimiento Vencido', msg: `Tu fecha de taller (${formatWithDay(formatLocalDate(miAgenda.mantenimiento))}) ya pasó. ¡Repórtalo ya o afectará tu evaluación mensual!`, tipo: 'info' });
              const maintId = `auto_maint_${localTodayStr}_${miAgenda.mantenimiento || ''}`;
              if (isMaintToday && !hiddenAlerts.includes(maintId)) alerts.push({ id: maintId, type: 'maint', title: '¡Mantenimiento Hoy!', msg: 'Lleva la unidad al taller asignado y registra el comprobante.' });
          }
          const turnosTxt = (miAgenda.turnos || '').toLowerCase();
          const hasTurnoToday = turnosTxt.includes(todayName.toLowerCase()) || turnosTxt.includes(todayShortSlash) || turnosTxt.includes(todayShortDash) || turnosTxt.includes(todayFullSlash) || turnosTxt.includes(todayFullDash) || turnosTxt.includes(todayShortSlashUnp) || turnosTxt.includes(todayFullSlashUnp);
          const turnoId = `auto_turno_${localTodayStr}_${miAgenda.turnos || ''}`;
          if (hasTurnoToday && !hiddenAlerts.includes(turnoId)) alerts.push({ id: turnoId, type: 'turno', title: '¡Turno Extra Hoy!', msg: 'Registra tus horas al finalizar.' });
      }
      alertasData.forEach(alerta => { if (hiddenAlerts.includes(alerta.id) || isAlertExpired(alerta)) return; if (alerta.para === 'Todos' || alerta.para === form.recolector) alerts.push({ ...alerta, type: 'admin_msg', title: alerta.tipo === 'confirm' ? 'Requiere Confirmación' : (alerta.para === 'Todos' ? 'Aviso Global' : 'Mensaje Directo'), msg: alerta.mensaje }); });
      return alerts;
  }, [agendaData, form.recolector, alertasData, appMode, hiddenAlerts, maintData]);

  const activeAlertasData = useMemo(() => alertasData.filter(alerta => !isAlertExpired(alerta)), [alertasData]);
  const expiredAlertasData = useMemo(() => alertasData.filter(alerta => isAlertExpired(alerta)), [alertasData]);

  const dismissAlert = async (alerta, replyText = '') => {
      if (alerta.tipo === 'confirm' && replyText) { try { await updateDoc(doc(db, "alertas_flota", alerta.id), { respuestas: arrayUnion({ usuario: form.recolector, respuesta: replyText, fecha: new Date().toISOString() }) }); } catch(e) {} } 
      else if (alerta.tipo === 'info' && alerta.para !== 'Todos') { try { await deleteDoc(doc(db, "alertas_flota", alerta.id)); } catch(e) {} }
      const newHidden = [...hiddenAlerts, alerta.id]; setHiddenAlerts(newHidden);
      if (currentUser && currentUser.email) localStorage.setItem(`recolekta_hidden_alerts_${currentUser.email}`, JSON.stringify(newHidden));
  };

  const handleCleanupExpiredAlerts = async () => {
      if (expiredAlertasData.length === 0) {
          alert("No hay avisos vencidos en la tanda cargada.");
          return;
      }
      if (!window.confirm(`Se eliminarán ${expiredAlertasData.length} avisos vencidos. ¿Continuar?`)) return;

      try {
          await Promise.all(expiredAlertasData.map(alerta => deleteDoc(doc(db, "alertas_flota", alerta.id))));
          alert(`Se eliminaron ${expiredAlertasData.length} avisos vencidos.`);
      } catch (error) {
          console.error("No se pudieron limpiar los avisos vencidos", error);
          alert("No fue posible completar la limpieza. Revisa tu conexión e inténtalo nuevamente.");
      }
  };
  
  const exportToCSV = () => { 
    if (!metrics.rows || metrics.rows.length === 0) return alert("No hay datos"); 
    const csvRows = metrics.rows.map(r => ({ Fecha: getStrictDateString(r.createdAt), Transportista: r.recolector, Sucursal: r.sucursal, Diligencia: r.tipo, Area: r.area || 'N/A', Categoria: r.categoria, Entrada: r.hLlegada && r.mLlegada ? `${r.hLlegada}:${r.mLlegada} ${r.pLlegada}` : '', Salida: r.hSalida && r.mSalida ? `${r.hSalida}:${r.mSalida} ${r.pSalida}` : '', Espera_Minutos: r.tiempo, Observaciones: r.observaciones || '', Foto_URL: r.fotoData || '' })); 
    const csv = Papa.unparse(csvRows, { delimiter: ";" }); const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Respaldo_Recolekta_${filterYear}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); 
  };
  
const exportPayrollCSV = () => { 
    // 💡 El filtro de la quincena se aplica EXCLUSIVAMENTE al exportar el Excel
    let exportData = otData.filter((record) => isDateInRange(record.fecha, sysConfig.heInicio, sysConfig.heFin));
    
    if (exportData.length === 0) return alert("No hay datos de horas extras en este rango de quincena."); 
    const formatTime12 = (time24) => { if(!time24) return ''; const [h, m] = time24.split(':'); let hours = parseInt(h, 10); const ampm = hours >= 12 ? 'p.m.' : 'a.m.'; hours = hours % 12; hours = hours ? hours : 12; return `${hours}:${m} ${ampm}`; }; 
    const splitSchedule = (scheduleStr) => { if (!scheduleStr || !scheduleStr.includes('-')) return { start: '', end: '' }; const parts = scheduleStr.split('-'); return { start: parts[0].trim(), end: parts[1].trim() }; }; 
    
    const csvRows = exportData.map((r, index) => { 
        const workHours = splitSchedule(r.horarioTurno || ''); const heStart = formatTime12(r.horaInicio); const heEnd = formatTime12(r.horaFin); 
        
        // 🟢 CORRECCIÓN BLINDADA: Limpieza de formato para forzar el cruce de datos
        const emailLimpio = r.usuario ? r.usuario.toLowerCase().trim() : '';
        const nombreTransportista = perfilesUsuarios[emailLimpio]?.nombre?.toUpperCase() || USUARIOS_EMAIL[emailLimpio] || r.usuario;

        return { 
            'ID': index + 1, 
            'Marca temporal': getStrictDateString(r.createdAt || r.fecha), 
            'Nombre del Transportista': nombreTransportista, 
            'Fecha': getStrictDateString(r.fecha), 
            'Hora de trabajo Inicio': workHours.start, 
            'Hora de trabajo Fin': workHours.end, 
            'Horario de Horas extras Inicio': heStart, 
            'Horario de Horas extras Fin': heEnd, 
            'Horas extras': r.horasCalculadas, 
            'Actividad Realizada / Observaciones': r.motivo || '', 
            'HorarioTrabajo': r.horarioTurno || '', 
            'HorarioHE': `${heStart} - ${heEnd}` 
        }; 
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
            
            // 🟢 FILTRO BLINDADO DE EMPLEADOS ACTIVOS (Para borrar fantasmas como Flor)
            const activeTransportistas = Object.values(catalogs.transportistas || {})
                                        .flat()
                                        .map(name => name.toUpperCase().trim());
            
            // Comparamos limpiando los espacios invisibles
            let agendaToExport = agendaData.filter(a => activeTransportistas.includes(a.id.toUpperCase().trim()));
            
            if (filterZona !== 'all') {
                agendaToExport = agendaToExport.filter(a => isUserInFilterZone(a.id, filterZona));
            }
            
            if (agendaToExport.length === 0) return alert("No hay horarios para esta selección.");

            let titleParts = []; if (filterZona !== 'all') titleParts.push(`ZONA: ${filterZona}`);
            const reportTitle = titleParts.length > 0 ? `AGENDA DE FLOTA | ${titleParts[0]}` : "AGENDA GLOBAL DE FLOTA";
            
            drawHeader(reportTitle, `Generado: ${dateStr}`);
            const rows = agendaToExport.map(a => [a.id, a.horario || '--', a.zona || '--', a.puntos || '--', formatTurnosVisually(a.turnos) || 'Ninguno', formatWithDay(formatLocalDate(a.mantenimiento))]);
            autoTable(doc, { startY: 65, head: [['Transportista', 'Horario Base', 'Zona/Ruta', 'Puntos/Sucursales', 'Turnos Extra', 'Prox. Mantenimiento']], body: rows, headStyles: { fillColor: slate900 }, theme: 'grid', styles: { fontSize: 8 } });
            doc.save("Recolekta_Agenda_Horarios.pdf"); return;
        }
        if (currentSection === 'combustible' || currentSection === 'fleet') {
            let dataToExport = fuelData.filter(d => checkDate(d.fecha)); if (filterUser !== 'all') dataToExport = dataToExport.filter(d => getUserDisplayName(d.usuario) === filterUser);
            if (dataToExport.length === 0) return alert("No hay datos de combustible.");
            drawHeader("CONTROL DE COMBUSTIBLE", `Generado: ${dateStr} | Filtro: ${filterUser !== 'all' ? filterUser : 'GLOBAL'}`);
            const rows = dataToExport.map(r => [formatLocalDate(r.fecha), getUserDisplayName(r.usuario), r.galones, `$${r.costo}`, r.kilometraje]);
            autoTable(doc, { startY: 65, head: [['Fecha', 'Usuario', 'Galones', 'Costo Total', 'Km']], body: rows, headStyles: { fillColor: slate900 }, theme: 'striped' }); doc.save("Recolekta_Combustible.pdf"); return;
        }
        if (currentSection === 'taller') {
            let dataToExport = maintData.filter(d => checkDate(d.fecha)); if (filterUser !== 'all') dataToExport = dataToExport.filter(d => getUserDisplayName(d.usuario) === filterUser);
            if (dataToExport.length === 0) return alert("No hay datos de taller.");
            drawHeader("CONTROL DE TALLER Y MANTENIMIENTO", `Generado: ${dateStr} | Filtro: ${filterUser !== 'all' ? filterUser : 'GLOBAL'}`);
            const rows = dataToExport.map(r => [formatLocalDate(r.fecha), getUserDisplayName(r.usuario), r.tipo, r.taller, r.descripcion || '--', `$${r.costo}`]);
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

  const viewProps = {
    SmallGauge,
    abrirMapaDeRuta,
    activeInput,
    activeUserCountry,
    adminDashboardMetrics,
    adminSection,
    agendaData,
    alertasData,
    appMode,
    availableYears,
    avisoForm,
    biMetrics,
    catalogCountry,
    catalogs,
    checkDate,
    compressImage,
    convertToMinutes,
    csvData,
    currentPage,
    currentUser,
    cycleCategory,
    dataSource,
    dismissAlert,
    downloadReport,
    editFormData,
    editingItem,
    exportPayrollCSV,
    exportToCSV,
    extractDateInfo,
    filterMonth,
    filterSpecificDate,
    filterSucursal,
    filterUser,
    filterUserTableZone,
    filterYear,
    filterZona,
    fleetMetrics,
    form,
    fuelData,
    gamificationStats,
    getMetaEspera,
    getUserCountry,
    getUserZone,
    getWait,
    gpsLocation,
    handleAddCatalogItem,
    handleAssignCategory,
    handleAssignZone,
    handleDelete,
    handleEditFormChange,
    handleFile,
    handleInput,
    handleMotoPhotoUpload,
    handleProfilePhotoUpload,
    handleRebuildHistoricalSummaries,
    handleRemoveCatalogItem,
    handleSaveConfig,
    handleStartOperation,
    handleSyncToCloud,
    handleUpdate,
    hiddenAlerts,
    hrMetrics,
    imageFile,
    imagePreview,
    isCompressing,
    isFetchingHistory,
    isRebuildingSummaries,
    isGettingGps,
    isOperating,
    isUploading,
    isUserInFilterZone,
    itemsPerPage,
    liveData,
    liveWaitMins,
    logout,
    maintData,
    mapaModalData,
    metrics,
    newCatalogItems,
    openEditModal,
    operationStartTime,
    otData,
    perfilesUsuarios,
    previousGps,
    queryLimit,
    regionalMetrics,
    resumenesMensualesNube,
    selectedAdminProfile,
    setActiveInput,
    setAdminSection,
    setAgendaData,
    setAlertasData,
    setAppMode,
    setAvisoForm,
    setCatalogCountry,
    setCatalogs,
    setCsvData,
    setCurrentPage,
    setDataSource,
    setEditFormData,
    setEditingItem,
    setFilterMonth,
    setFilterSpecificDate,
    setFilterSucursal,
    setFilterUser,
    setFilterUserTableZone,
    setFilterYear,
    setFilterZona,
    setForm,
    setFuelData,
    setGpsLocation,
    setHiddenAlerts,
    setImageFile,
    setImagePreview,
    setIsCompressing,
    setIsFetchingHistory,
    setIsGettingGps,
    setIsOperating,
    setIsUploading,
    setLiveData,
    setLiveWaitMins,
    setMaintData,
    setMapaModalData,
    setNewCatalogItems,
    setOperationStartTime,
    setOtData,
    setPerfilesUsuarios,
    setPreviousGps,
    setQueryLimit,
    setResumenesMensualesNube,
    setSelectedAdminProfile,
    setShowAvisoModal,
    setShowWelcome,
    setSupervisorSection,
    setSysConfig,
    setTransitTimeMins,
    setUserProfile,
    setUserView,
    setViewingPhoto,
    showAvisoModal,
    showWelcome,
    supervisorSection,
    sysConfig,
    transitTimeMins,
    transportistaOtData,
    userAlerts,
    userMetrics,
    userProfile,
    userView,
    viewingPhoto
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
                           <div className="flex flex-wrap gap-2 items-center mt-1">
                                {/* SOLUCIÓN ASIMETRÍA: inline-flex, items-center y leading-none aplicados */}
                                <span className={cn("inline-flex items-center justify-center text-[9px] font-black px-2.5 py-1.5 rounded-full uppercase tracking-widest leading-none", selectedAdminProfile.categoria === 'Coordinador' ? "bg-yellow-900/50 text-yellow-400 border border-yellow-500" : selectedAdminProfile.categoria === 'Técnico' ? "bg-slate-700 text-slate-300 border border-slate-400" : "bg-orange-900/50 text-orange-400 border border-orange-500")}>
                                    {selectedAdminProfile.categoria}
                                </span>
                                <span className="bg-indigo-900/50 text-indigo-400 border border-indigo-500 text-[9px] font-black px-2.5 py-1.5 rounded-full uppercase tracking-widest inline-flex items-center justify-center gap-1 leading-none">
                                    <Globe size={10}/> {selectedAdminProfile.zona}
                                </span>
                                
                                {/* 🔥 BOTÓN OVERRIDE DEL ADMIN */}
                                {selectedAdminProfile.estatus !== 'Inactivo' && (
                                    <button 
                                        onClick={async () => {
                                            try {
                                                await setDoc(doc(db, "usuarios_perfiles", selectedAdminProfile.email), { estatus: 'Inactivo' }, { merge: true });
                                                setSelectedAdminProfile(prev => ({...prev, estatus: 'Inactivo'}));
                                            } catch(e){}
                                        }} 
                                        className="bg-red-900/40 text-red-400 border border-red-500 text-[9px] font-black px-2.5 py-1.5 rounded-full uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                                        title="Apagar app del transportista"
                                    >
                                        FORZAR DESCONEXIÓN
                                    </button>
                                )}
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
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Vigencia</label><select value={avisoForm.duracionDias} onChange={e=>setAvisoForm({...avisoForm, duracionDias: Number(e.target.value)})} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold"><option value={1}>1 día</option><option value={3}>3 días</option><option value={7}>7 días</option><option value={14}>14 días</option><option value={30}>30 días</option></select></div>
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase">Mensaje Corto</label><textarea value={avisoForm.mensaje} onChange={e=>setAvisoForm({...avisoForm, mensaje: e.target.value})} className="w-full p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white font-bold h-24 resize-none" placeholder="Escribe el recordatorio o alerta aquí..."/></div>
                    <button onClick={async () => { const mensaje = avisoForm.mensaje.trim(); if(!mensaje) return; const createdAt = new Date(); const expiresAt = new Date(createdAt.getTime() + (Number(avisoForm.duracionDias) * DAY_IN_MS)); await addDoc(collection(db, 'alertas_flota'), {...avisoForm, mensaje, createdAt: createdAt.toISOString(), expiresAt: Timestamp.fromDate(expiresAt)}); setAvisoForm({mensaje: '', para: 'Todos', tipo: 'info', duracionDias: 7}); alert("Aviso enviado a la plataforma."); }} className="w-full py-4 bg-blue-600 rounded-xl font-black uppercase text-sm shadow-lg hover:bg-blue-500 flex items-center justify-center gap-2"><Send size={16}/> Enviar Mensaje</button>
                </div>
                <div className="mt-8 border-t border-slate-700 pt-6">
                    <div className="flex items-center justify-between gap-3 mb-4"><h4 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><MessageSquare size={14}/> Avisos Activos y Respuestas</h4>{expiredAlertasData.length > 0 && <button onClick={handleCleanupExpiredAlerts} className="text-[9px] font-black uppercase text-red-400 hover:text-red-300 flex items-center gap-1.5" title="Eliminar avisos cuya vigencia terminó"><Trash2 size={13}/> Limpiar vencidos ({expiredAlertasData.length})</button>}</div>
                    <div className="space-y-3">
                        {activeAlertasData.length === 0 ? <p className="text-xs text-slate-600 italic">No hay avisos activos en la calle.</p> : null}
                        {activeAlertasData.map(a => (
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
        {appMode === 'user' && <TransportistaHome {...viewProps} />}
        {appMode === 'admin' && <AdminDashboard {...viewProps} />}
        {appMode === 'supervisor' && <SupervisorDashboard {...viewProps} />}
      </main>
    </div>
  );
}
