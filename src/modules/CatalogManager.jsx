import React from 'react';
import { addDoc, collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Award, BarChart3, Bell, Bike, Briefcase, Calendar, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Database, DollarSign, Download, Edit, Edit3, Eraser, Eye, ExternalLink, FileSpreadsheet, Filter, Fuel, Globe, Image as ImageIcon, Layers, ListChecks, Loader2, Map, MapPin, MessageSquare, PieChart as PieChartIcon, Plus, Printer, RefreshCw, Save, Search, Send, Settings, ShieldCheck, Smartphone, Star, Target, Trash2, TrendingUp, Trophy, UploadCloud, User, Users, Wrench, X, XCircle } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, storage } from '../config/firebase';
import FleetAgenda from './FleetAgenda';
import { cn, formatLocalDate, formatTurnosVisually, formatWithDay, getStrictDateString, PRINCIPAL_KEYWORDS, USUARIOS_EMAIL } from '../utils/constants';

export default function CatalogManager(props) {
  const { SmallGauge, abrirMapaDeRuta, activeInput, activeUserCountry, adminDashboardMetrics, adminSection, agendaData, alertasData, appMode, availableYears, avisoForm, biMetrics, catalogCountry, catalogs, checkDate, compressImage, convertToMinutes, csvData, currentPage, currentUser, cycleCategory, dataSource, dismissAlert, downloadReport, editFormData, editingItem, exportPayrollCSV, exportToCSV, extractDateInfo, filterMonth, filterSpecificDate, filterSucursal, filterUser, filterUserTableZone, filterYear, filterZona, fleetMetrics, form, fuelData, gamificationStats, getMetaEspera, getUserCountry, getUserZone, getWait, gpsLocation, handleAddCatalogItem, handleAssignCategory, handleAssignZone, handleDelete, handleEditFormChange, handleFile, handleInput, handleMotoPhotoUpload, handleProfilePhotoUpload, handleRemoveCatalogItem, handleSaveConfig, handleStartOperation, handleSyncToCloud, handleUpdate, hiddenAlerts, hrMetrics, imageFile, imagePreview, isCompressing, isFetchingHistory, isGettingGps, isOperating, isUploading, isUserInFilterZone, itemsPerPage, liveData, liveWaitMins, logout, maintData, mapaModalData, metrics, newCatalogItems, openEditModal, operationStartTime, otData, perfilesUsuarios, previousGps, queryLimit, regionalMetrics, resumenesMensualesNube, selectedAdminProfile, setActiveInput, setAdminSection, setAgendaData, setAlertasData, setAppMode, setAvisoForm, setCatalogCountry, setCatalogs, setCsvData, setCurrentPage, setDataSource, setEditFormData, setEditingItem, setFilterMonth, setFilterSpecificDate, setFilterSucursal, setFilterUser, setFilterUserTableZone, setFilterYear, setFilterZona, setForm, setFuelData, setGpsLocation, setHiddenAlerts, setImageFile, setImagePreview, setIsCompressing, setIsFetchingHistory, setIsGettingGps, setIsOperating, setIsUploading, setLiveData, setLiveWaitMins, setMaintData, setMapaModalData, setNewCatalogItems, setOperationStartTime, setOtData, setPerfilesUsuarios, setPreviousGps, setQueryLimit, setResumenesMensualesNube, setSelectedAdminProfile, setShowAvisoModal, setShowWelcome, setSupervisorSection, setSysConfig, setTransitTimeMins, setUserProfile, setUserView, setViewingPhoto, showAvisoModal, showWelcome, supervisorSection, sysConfig, transitTimeMins, transportistaOtData, userAlerts, userMetrics, userProfile, userView, viewingPhoto } = props;

  return (
<div className="animate-in fade-in space-y-8">
                    {/* 🟢 FORMULARIO ALTA DE NUEVOS TRANSPORTISTAS */}
                   <div className="bg-[#0B1120] p-6 rounded-2xl border border-slate-700 mt-6 shadow-inner">
                       <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">➕ Registrar Nuevo Transportista en el Sistema</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                           <div>
                               <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Nombre Completo</label>
                               <input type="text" id="new_user_name" placeholder="EJ. JUAN PÉREZ" className="w-full p-2.5 bg-[#151F32] border border-slate-700 rounded-lg text-xs font-bold text-white uppercase" />
                           </div>
                           <div>
                               <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Correo Electrónico</label>
                               <input type="email" id="new_user_email" placeholder="juan@recolekta.com" className="w-full p-2.5 bg-[#151F32] border border-slate-700 rounded-lg text-xs font-bold text-white" />
                           </div>
                           <div>
                               <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Contraseña Inicial</label>
                               <input type="text" id="new_user_password" placeholder="Mínimo 6 letras" className="w-full p-2.5 bg-[#151F32] border border-slate-700 rounded-lg text-xs font-bold text-white" />
                           </div>
                           <div>
                               <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Zona Operativa</label>
                               <select id="new_user_zone" className="w-full p-2.5 bg-[#151F32] border border-slate-700 rounded-lg text-xs font-bold text-indigo-300">
                                   {Object.values(catalogs.zonas || {}).flat().map(z => <option key={z} value={z}>{z}</option>)}
                               </select>
                           </div>
                           <button type="button" onClick={async () => {
        const nameInput = document.getElementById('new_user_name');
        const emailInput = document.getElementById('new_user_email');
        const passInput = document.getElementById('new_user_password');
        const zoneInput = document.getElementById('new_user_zone');
        const name = nameInput.value.trim().toUpperCase();
        const email = emailInput.value.trim().toLowerCase();
        const password = passInput.value.trim();
        const zone = zoneInput.value;
        if (!name || !email || !password) return alert("Por favor completa los campos obligatorios.");
        if (password.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");
        try {
          // A) Actualizar el catálogo maestro de transportistas en Firestore
          let nuevosTransportistas = {
            ...catalogs.transportistas
          };
          const listaActual = nuevosTransportistas[catalogCountry] || [];
          if (listaActual.includes(name)) return alert("Este nombre ya existe en los catálogos.");
          nuevosTransportistas[catalogCountry] = [...listaActual, name].sort();
          await setDoc(doc(db, "configuraciones", "catalogos"), {
            transportistas: nuevosTransportistas
          }, {
            merge: true
          });

          // B) Crear el documento de perfil vinculado
          await setDoc(doc(db, "usuarios_perfiles", email), {
            nombre: name,
            zona: zone,
            categoria: 'Operador',
            estatus: 'Inactivo',
            createdAt: new Date().toISOString()
          });

          // C) El truco de la App Secundaria para Firebase Auth sin desloguear al Admin
          // 🟢 CORRECCIÓN: Importamos deleteApp de firebase/app
          const {
            initializeApp,
            deleteApp
          } = await import('firebase/app');
          const {
            getAuth,
            createUserWithEmailAndPassword,
            signOut: secondarySignOut
          } = await import('firebase/auth');

          // Accedemos a la configuración interna del SDK ya inicializado
          const fbConfig = db.app.options;
          const appSecundaria = initializeApp(fbConfig, "AppTemporalCreacion");
          const authSecundario = getAuth(appSecundaria);
          await createUserWithEmailAndPassword(authSecundario, email, password);
          await secondarySignOut(authSecundario);

          // 🟢 CORRECCIÓN: Usamos el método modular correcto
          await deleteApp(appSecundaria);
          alert(`¡Transportista ${name} creado con éxito en Autenticación, Catálogos y Perfiles! 🚀`);

          // Limpieza de inputs
          nameInput.value = '';
          emailInput.value = '';
          passInput.value = '';
        } catch (err) {
          console.error(err);
          alert("Error durante la creación: " + err.message);
        }
      }} className="w-full bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-lg text-xs font-black uppercase shadow-md transition-all">

                               Crear Usuario
                           </button>
                       </div>
                   </div>
                   {/* 1. GESTIÓN DE USUARIOS */}
                   <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-violet-500"></div>
                       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                           <h3 className="text-xl font-black text-white flex items-center gap-3"><Users className="text-pink-500" /> Gestión de Usuarios, Rangos y Zonas</h3>
                           <div className="flex items-center gap-2 bg-[#0B1120] p-2 rounded-xl border border-slate-700">
                               <Filter size={14} className="text-slate-500" />
                               <select value={filterUserTableZone} onChange={e => setFilterUserTableZone(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-300 uppercase outline-none cursor-pointer">
                                   <option value="all">Todas las Zonas</option>
                                   {Object.values(catalogs.zonas || {}).flat().map(z => <option key={z} value={z}>{z}</option>)}
                               </select>
                           </div>
                       </div>
                       <div className="overflow-x-auto bg-[#0B1120] rounded-2xl border border-slate-700 shadow-inner">
                           <table className="w-full text-left">
                               <thead className="text-[10px] font-black text-slate-400 uppercase bg-slate-800/50"><tr><th className="px-5 py-4">Transportista</th><th className="px-5 py-4">Correo Acceso</th><th className="px-5 py-4">Foto</th><th className="px-5 py-4 w-48">Rango / Categoría</th><th className="px-5 py-4 w-48">🌍 Zona Asignada</th></tr></thead>
                               <tbody className="text-xs font-bold divide-y divide-slate-800 text-slate-300">
                                   {Object.values(catalogs.transportistas || {}).flat().filter(name => !['ADMINISTRADOR', 'SUPERVISOR', 'NUEVO ADMIN', 'USUARIO PRUEBA'].includes(name)).filter(name => filterUserTableZone === 'all' || getUserZone(name) === filterUserTableZone).map(name => {
            // 🟢 CORRECCIÓN: Busca el correo primero en los perfiles de Firebase en vivo, y si no, usa el respaldo estático.
            const email = Object.keys(perfilesUsuarios).find(key => perfilesUsuarios[key]?.nombre === name) || Object.keys(USUARIOS_EMAIL).find(key => USUARIOS_EMAIL[key] === name); //const email = Object.keys(USUARIOS_EMAIL).find(key => USUARIOS_EMAIL[key] === name);
            const profile = perfilesUsuarios[email] || {};
            return <tr key={name} className="hover:bg-slate-800/30">
                                               <td className="px-5 py-4 text-white font-black">{name}</td>
                                               <td className="px-5 py-4 font-mono text-slate-400 text-[11px]">{email || <span className="text-red-500 italic">No vinculado</span>}</td>
                                               <td className="px-5 py-4"><div className="w-10 h-10 rounded-full border-2 border-slate-700 bg-black flex items-center justify-center overflow-hidden shadow-md">{profile.foto ? <img src={profile.foto} className="w-full h-full object-cover" /> : <User size={18} className="text-slate-600" />}</div></td>
                                               <td className="px-5 py-4">{email ? <div className="relative"><select value={profile.categoria || 'Operador'} onChange={e => handleAssignCategory(email, e.target.value)} className={cn("w-full p-2 bg-[#151F32] border border-slate-700 rounded text-[10px] uppercase outline-none", (profile.categoria || 'Operador') === 'Coordinador' ? "text-yellow-400" : (profile.categoria || 'Operador') === 'Técnico' ? "text-slate-300" : "text-orange-400")}><option value="Operador">Operador</option><option value="Técnico">Técnico</option><option value="Coordinador">Coordinador</option></select></div> : '--'}</td>
                                               <td className="px-5 py-4">{email ? <div className="relative"><select value={profile.zona || 'Sin Asignar'} onChange={e => handleAssignZone(email, e.target.value)} className="w-full p-2 bg-[#151F32] border border-indigo-900 rounded text-[10px] uppercase outline-none text-indigo-300"><option value="Sin Asignar">Sin Asignar</option>{Object.values(catalogs.zonas || {}).flat().map(z => <option key={z} value={z}>{z}</option>)}</select></div> : '--'}</td>
                                           </tr>;
          })}
                               </tbody>
                           </table>
                       </div>
                   </div>               
                   {/* 2. EDITOR DE CATÁLOGOS */}
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                       <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                           <h3 className="text-xl font-black text-white flex items-center gap-2"><ListChecks className="text-blue-500" /> Editor de Catálogos</h3>
                           <select value={catalogCountry} onChange={e => setCatalogCountry(e.target.value)} className="bg-[#0B1120] text-sm font-black text-white uppercase outline-none p-2 rounded-xl">{catalogs.paises.map(p => <option key={p} value={p}>{p}</option>)}</select>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="bg-indigo-900/10 p-5 rounded-2xl border border-indigo-800/40 md:col-span-2"><h4 className="text-xs font-bold text-indigo-300 uppercase mb-4">Zonas Operativas de {catalogCountry}</h4><div className="flex gap-2"><input type="text" value={newCatalogItems.zonas || ''} onChange={e => setNewCatalogItems({
            ...newCatalogItems,
            zonas: e.target.value
          })} className="flex-1 p-3 bg-[#151F32] border border-indigo-700/50 rounded-xl text-white text-[10px]" /><button onClick={() => handleAddCatalogItem('zonas')} className="bg-indigo-600 px-4 rounded-xl text-white"><Plus size={16} /></button></div><div className="flex flex-wrap gap-2 mt-4">{(catalogs.zonas[catalogCountry] || []).map(item => <span key={item} className="bg-indigo-950/50 text-indigo-200 px-3 py-1.5 rounded-lg text-[9px] flex items-center gap-2">{item} <X size={12} className="cursor-pointer text-indigo-500" onClick={() => handleRemoveCatalogItem('zonas', item, catalogCountry)} /></span>)}</div></div>
                           <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-700"><h4 className="text-xs font-bold text-slate-300 uppercase mb-4">Transportistas ({catalogCountry})</h4><div className="flex gap-2"><input type="text" value={newCatalogItems.transportistas} onChange={e => setNewCatalogItems({
            ...newCatalogItems,
            transportistas: e.target.value.toUpperCase()
          })} className="flex-1 p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white text-[10px]" /><button onClick={() => handleAddCatalogItem('transportistas')} className="bg-blue-600 px-4 rounded-xl text-white"><Plus size={16} /></button></div><div className="flex flex-wrap gap-2 mt-4">{(catalogs.transportistas[catalogCountry] || []).map(item => <span key={item} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] flex items-center gap-2">{item} <X size={12} className="cursor-pointer" onClick={() => handleRemoveCatalogItem('transportistas', item)} /></span>)}</div></div>
                           <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-700"><h4 className="text-xs font-bold text-slate-300 uppercase mb-4">Sucursales ({catalogCountry})</h4><div className="flex gap-2"><input type="text" value={newCatalogItems.sucursales} onChange={e => setNewCatalogItems({
            ...newCatalogItems,
            sucursales: e.target.value
          })} className="flex-1 p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white text-[10px]" /><button onClick={() => handleAddCatalogItem('sucursales')} className="bg-indigo-600 px-4 rounded-xl text-white"><Plus size={16} /></button></div><div className="flex flex-wrap gap-2 mt-4">{(catalogs.sucursales[catalogCountry] || []).map(item => <span key={item} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] flex items-center gap-2">{item} <X size={12} className="cursor-pointer" onClick={() => handleRemoveCatalogItem('sucursales', item)} /></span>)}</div></div>
                           <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-700"><h4 className="text-xs font-bold text-slate-300 uppercase mb-4">Tipos de Diligencia ({catalogCountry})</h4><div className="flex gap-2"><input type="text" value={newCatalogItems.diligencias} onChange={e => setNewCatalogItems({
            ...newCatalogItems,
            diligencias: e.target.value
          })} className="flex-1 p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white text-[10px]" /><button onClick={() => handleAddCatalogItem('diligencias')} className="bg-green-600 px-4 rounded-xl text-white"><Plus size={16} /></button></div><div className="flex flex-wrap gap-2 mt-4">{(catalogs.diligencias[catalogCountry] || []).map(item => <span key={item} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] flex items-center gap-2">{item} <X size={12} className="cursor-pointer text-slate-500" onClick={() => handleRemoveCatalogItem('diligencias', item)} /></span>)}</div></div>
                           <div className="bg-[#0B1120] p-5 rounded-2xl border border-slate-700"><h4 className="text-xs font-bold text-slate-300 uppercase mb-4">Áreas ({catalogCountry})</h4><div className="flex gap-2"><input type="text" value={newCatalogItems.areas} onChange={e => setNewCatalogItems({
            ...newCatalogItems,
            areas: e.target.value
          })} className="flex-1 p-3 bg-[#151F32] border border-slate-700 rounded-xl text-white text-[10px]" /><button onClick={() => handleAddCatalogItem('areas')} className="bg-orange-600 px-4 rounded-xl text-white"><Plus size={16} /></button></div><div className="flex flex-wrap gap-2 mt-4">{(catalogs.areas[catalogCountry] || []).map(item => <span key={item} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[9px] flex items-center gap-2">{item} <X size={12} className="cursor-pointer hover:text-red-400" onClick={() => handleRemoveCatalogItem('areas', item)} /></span>)}</div></div>
                       </div>
                   </div>
                   
                   {/* 3. NUEVO PANEL: CONFIGURACIÓN DE METAS (KPIs) */}
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                       <h3 className="text-xl font-black text-white flex items-center gap-2 mb-6 border-b border-slate-800 pb-4"><Target className="text-green-500" /> Configuración de Metas Operativas (KPIs)</h3>
                       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                           <div><label className="text-[10px] font-bold text-slate-400 uppercase">Min. Espera (Metro)</label><input type="number" value={sysConfig.metaMetro || 5} onChange={e => setSysConfig({
          ...sysConfig,
          metaMetro: e.target.value
        })} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold" /></div>
                           <div><label className="text-[10px] font-bold text-slate-400 uppercase">Min. Espera (Interior)</label><input type="number" value={sysConfig.metaInterior || 10} onChange={e => setSysConfig({
          ...sysConfig,
          metaInterior: e.target.value
        })} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold" /></div>
                           <div><label className="text-[10px] font-bold text-slate-400 uppercase">Min. Espera (Frontera)</label><input type="number" value={sysConfig.metaFrontera || 20} onChange={e => setSysConfig({
          ...sysConfig,
          metaFrontera: e.target.value
        })} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold" /></div>
                           <div><label className="text-[10px] font-bold text-slate-400 uppercase">Meta Secundarias (Mes)</label><input type="number" value={sysConfig.metaSecundarias || 60} onChange={e => setSysConfig({
          ...sysConfig,
          metaSecundarias: e.target.value
        })} className="w-full p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold" /></div>
                       </div>
                       <button onClick={handleSaveConfig} className="mt-6 w-full md:w-auto bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all shadow-md flex items-center justify-center gap-2"><Save size={16} /> Aplicar Nuevas Metas Globales</button>
                   </div>
                </div>
  );
}
