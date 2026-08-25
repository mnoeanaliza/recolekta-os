import React from 'react';
import { addDoc, collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Award, BarChart3, Bell, Bike, Briefcase, Calendar, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Database, DollarSign, Download, Edit, Edit3, Eraser, Eye, ExternalLink, FileSpreadsheet, Filter, Fuel, Globe, Image as ImageIcon, Layers, ListChecks, Loader2, Map, MapPin, MessageSquare, PieChart as PieChartIcon, Plus, Printer, RefreshCw, Save, Search, Send, Settings, ShieldCheck, Smartphone, Star, Target, Trash2, TrendingUp, Trophy, UploadCloud, User, Users, Wrench, X, XCircle } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, storage } from '../config/firebase';
import FuelModule from '../components/FuelModule';
import MaintenanceModule from '../components/MaintenanceModule';
import OvertimeModule from '../components/OvertimeModule';
import ScheduleModule from '../components/ScheduleModule';
import FleetAgenda from './FleetAgenda';
import CatalogManager from './CatalogManager';
import Reports from './Reports';
import { cn, formatLocalDate, formatTurnosVisually, formatWithDay, getStrictDateString, PRINCIPAL_KEYWORDS, USUARIOS_EMAIL } from '../utils/constants';

export default function AdminDashboard(props) {
  const { SmallGauge, abrirMapaDeRuta, activeInput, activeUserCountry, adminDashboardMetrics, adminSection, agendaData, alertasData, appMode, availableYears, avisoForm, biMetrics, catalogCountry, catalogs, checkDate, compressImage, convertToMinutes, csvData, currentPage, currentUser, cycleCategory, dataSource, dismissAlert, downloadReport, editFormData, editingItem, exportPayrollCSV, exportToCSV, extractDateInfo, filterMonth, filterSpecificDate, filterSucursal, filterUser, filterUserTableZone, filterYear, filterZona, fleetMetrics, form, fuelData, gamificationStats, getMetaEspera, getUserCountry, getUserZone, getWait, gpsLocation, handleAddCatalogItem, handleAssignCategory, handleAssignZone, handleDelete, handleEditFormChange, handleFile, handleInput, handleMotoPhotoUpload, handleProfilePhotoUpload, handleRemoveCatalogItem, handleSaveConfig, handleStartOperation, handleSyncToCloud, handleUpdate, hiddenAlerts, hrMetrics, imageFile, imagePreview, isCompressing, isFetchingHistory, isGettingGps, isOperating, isUploading, isUserInFilterZone, itemsPerPage, liveData, liveWaitMins, logout, maintData, mapaModalData, metrics, newCatalogItems, openEditModal, operationStartTime, otData, perfilesUsuarios, previousGps, queryLimit, regionalMetrics, resumenesMensualesNube, selectedAdminProfile, setActiveInput, setAdminSection, setAgendaData, setAlertasData, setAppMode, setAvisoForm, setCatalogCountry, setCatalogs, setCsvData, setCurrentPage, setDataSource, setEditFormData, setEditingItem, setFilterMonth, setFilterSpecificDate, setFilterSucursal, setFilterUser, setFilterUserTableZone, setFilterYear, setFilterZona, setForm, setFuelData, setGpsLocation, setHiddenAlerts, setImageFile, setImagePreview, setIsCompressing, setIsFetchingHistory, setIsGettingGps, setIsOperating, setIsUploading, setLiveData, setLiveWaitMins, setMaintData, setMapaModalData, setNewCatalogItems, setOperationStartTime, setOtData, setPerfilesUsuarios, setPreviousGps, setQueryLimit, setResumenesMensualesNube, setSelectedAdminProfile, setShowAvisoModal, setShowWelcome, setSupervisorSection, setSysConfig, setTransitTimeMins, setUserProfile, setUserView, setViewingPhoto, showAvisoModal, showWelcome, supervisorSection, sysConfig, transitTimeMins, transportistaOtData, userAlerts, userMetrics, userProfile, userView, viewingPhoto } = props;

  return (
<div className="space-y-6 md:space-y-8 animate-in fade-in print-p-0">
             <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-800 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 print-hide">
                <div className="w-full xl:w-auto overflow-hidden">
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white mb-4 xl:mb-0">Centro de Control</h2>
                    <div className="flex gap-2 mt-0 xl:mt-4 bg-[#0B1120] p-1 rounded-xl w-full border border-slate-800 overflow-x-auto md:flex-wrap md:overflow-visible custom-scrollbar">
                        <button onClick={() => setAdminSection('ops')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection === 'ops' ? "bg-green-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300")}><ShieldCheck size={14} /> Operaciones</button>
                        <button onClick={() => setAdminSection('fleet')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection === 'fleet' ? "bg-orange-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300")}><Bike size={14} /> Flota</button>
                        <button onClick={() => setAdminSection('hr')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection === 'hr' ? "bg-purple-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300")}><Clock size={14} /> Control HE</button>
                        <button onClick={() => setAdminSection('agenda')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection === 'agenda' ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300")}><Calendar size={14} /> Horarios</button>
                        <button onClick={() => setAdminSection('bi')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection === 'bi' ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300")}><PieChartIcon size={14} /> Analítica</button>
                        <button onClick={() => setAdminSection('catalogos')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5", adminSection === 'catalogos' ? "bg-slate-200 text-black shadow-md" : "text-slate-500 hover:text-slate-300")}><Settings size={14} /> Catálogos</button>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center w-full xl:w-auto">
                  <div className="flex flex-wrap bg-[#0B1120] p-2 rounded-xl border border-slate-800 items-center gap-2 w-full sm:w-auto">
                    <Filter size={16} className="text-slate-500 hidden sm:block" />
                    <select value={filterZona} onChange={(e) => setFilterZona(e.target.value)} className="bg-transparent font-black text-indigo-400 text-[10px] uppercase outline-none px-2 border-l border-slate-700 pl-2 flex-1 sm:flex-none cursor-pointer" title="Filtrar por Zona/Región">
                        <option value="all" className="bg-slate-900 text-white">🌎 Todas las Zonas</option>
                        {catalogs.paises.map((p) => <option key={p} value={p} className="bg-indigo-900 text-white">📍 {p} (PAÍS COMPLETO)</option>)}
                        <optgroup label="ZONAS ESPECÍFICAS" className="bg-slate-800 text-slate-400">{Object.values(catalogs.zonas || {}).flat().map((z) => <option key={z} value={z} className="bg-slate-900 text-white">  ↳ {z}</option>)}</optgroup>
                    </select>
                    <input
          type="date"
          value={filterSpecificDate}
          onChange={(e) => {
            const val = e.target.value;
            setFilterSpecificDate(val);
            if (val) {
              // Máquina del tiempo: Ajusta el mes y año automáticamente
              const [y, m, d] = val.split('-');
              setFilterYear(y);
              setFilterMonth(parseInt(m, 10).toString());
            }
          }}
          className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 text-slate-300 border-l border-slate-700 pl-2 cursor-pointer flex-1 sm:flex-none"
          title="Filtrar por Día Exacto" />
                    <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none">{availableYears.map((y) => <option key={y} value={y} className="bg-slate-900">{y}{y === '2025' ? ' (CSV)' : ''}</option>)}</select>
                    <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none">{['all', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => <option key={m} value={m} className="bg-slate-900">{m === 'all' ? 'Año' : 'Mes ' + m}</option>)}</select>
                    <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 max-w-[120px] text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none"><option value="all" className="bg-slate-900">Todos</option>{Object.values(catalogs.transportistas || {}).flat().map((u) => <option key={u} value={u} className="bg-slate-900">{u}</option>)}</select>
                    <select value={filterSucursal} onChange={(e) => setFilterSucursal(e.target.value)} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 max-w-[120px] text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none"><option value="all" className="bg-slate-900">Sucursal</option>{Object.values(catalogs.sucursales || {}).flat().map((s) => <option key={s} value={s} className="bg-slate-900">{s}</option>)}</select>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <button onClick={() => setShowAvisoModal(true)} className="bg-blue-600 text-white px-4 py-3 md:py-2 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center justify-center gap-2 hover:bg-blue-500 transition-all flex-1 sm:flex-none"><Bell size={14} /> Aviso</button>
                      <button onClick={exportToCSV} className="bg-green-600 text-white px-4 py-3 md:py-2 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center justify-center gap-2 hover:bg-green-700 transition-all flex-1 sm:flex-none"><FileSpreadsheet size={14} /> Excel</button>
                      <button onClick={() => downloadReport()} className="bg-white text-black px-4 py-3 md:py-2 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center justify-center gap-2 hover:bg-slate-200 transition-all flex-1 sm:flex-none"><Download size={14} /> PDF</button>
                    {isFetchingHistory && <span className="text-[10px] text-blue-400 font-bold uppercase flex items-center gap-2 animate-pulse"><Loader2 size={14} className="animate-spin" /> Descargando Historial...</span>}
                  </div>
                </div>
             </div>
             {adminSection === 'catalogos' && <CatalogManager {...props} />}

             {adminSection === 'bi' && <Reports {...props} />}
             {adminSection === 'ops' &&
  <div className="animate-in fade-in print-hide">
                   <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden mb-6">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                   <h3 className="text-xl font-black text-white flex items-center gap-3"><PieChartIcon className="text-green-500" /> Estado Visual de Eficiencia Individual</h3>
                    <button
          onClick={() => {
            if (!window.confirm("⚠️ ¿Estás segura de apagar la flota? Esto cambiará el estatus de todos a 'INACTIVO'. Úsalo solo al cierre de operaciones.")) return;
            adminDashboardMetrics.transportistasStats.forEach((stat) => {
              if (stat.email && stat.estatus !== 'Inactivo') {
                setDoc(doc(db, "usuarios_perfiles", stat.email), { estatus: 'Inactivo' }, { merge: true });
              }
            });
            alert("Toda la flota ha sido marcada como INACTIVA.");
          }}
          className="bg-red-900/30 text-red-400 border border-red-500 hover:bg-red-600 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md flex items-center gap-2">
                     🛑 Apagar Flota (Fin de Día)
                     </button>
                     </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                           {adminDashboardMetrics.transportistasStats.map((stat) =>
        <div key={stat.name} onClick={() => setSelectedAdminProfile(stat)} className={cn("bg-[#0B1120] p-4 rounded-2xl border flex flex-col items-center justify-between gap-2 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg", stat.isDanger ? "border-red-500/50 shadow-md shadow-red-900/20" : "border-slate-700 hover:border-slate-500")}>
                                   
                                   {/* 🔥 ESTATUS BADGE Y CHISMOSO 🔥 */}
                                   <div className="w-full flex justify-between items-center mb-1">
                                       <span className={cn("text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-widest", stat.estatus === 'EN RUTA' ? "bg-green-900/50 text-green-400" : stat.estatus === 'INACTIVO' ? "bg-red-900/50 text-red-400" : stat.estatus === 'DESCONECTADO' ? "bg-slate-800 text-slate-400" : "bg-orange-900/50 text-orange-400")}>
                                           {stat.estatus}
                                       </span>
                                       {stat.inactivoMin > 0 &&
            <span className={cn("text-[10px] font-black flex items-center gap-1", stat.isDanger ? "text-red-400 animate-pulse" : "text-slate-500")}>
                                               <Clock size={12} /> {stat.inactivoMin}m
                                           </span>
            }
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
                                           <div style={{ width: `${stat.totalTrips > 0 ? stat.totalMuestras / stat.totalTrips * 100 : 0}%` }} className="bg-green-500 h-full"></div>
                                           <div style={{ width: `${stat.totalTrips > 0 ? stat.secundarias / stat.totalTrips * 100 : 0}%` }} className="bg-orange-500 h-full"></div>
                                       </div>
                                   </div>
                                   
                                   {/* 🔥 ÚLTIMO PUNTO VISITADO 🔥 */}
                                   <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 mt-1 truncate w-full justify-center">
                                       <MapPin size={10} /> {stat.ultimaUbicacion || 'SIN RECORRIDO HOY'}
                                   </span>
                               </div>
        )}
                       </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800"><p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">EFICIENCIA VITAL</p><h3 className="text-4xl font-black text-white">{metrics.efP}%</h3></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800"><p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2">EFICIENCIA SECUNDARIA</p><h3 className="text-4xl font-black text-white">{metrics.efS}%</h3></div>
                      <div className="bg-[#0B1120] p-6 rounded-[2rem] border border-slate-800"><p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-2">TOTAL VIAJES</p><h3 className="text-4xl font-black text-white">{metrics.total}</h3></div>
                   </div>
                   <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-sm border border-slate-800 mt-6">
                      <h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><TrendingUp size={16} className="text-green-500" /> Evolución Anual de Eficiencia (%)</h4>
                      <p className="text-[9px] text-slate-500 mb-2 italic">💡 Resumen global anual leído al instante desde la Nube.</p>
                      <div className="h-60 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.monthlyData}>
                               <defs><linearGradient id="colorEf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                               <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                               <YAxis hide domain={[0, 100]} />
                               <Tooltip contentStyle={{ backgroundColor: '#0B1120', border: '1px solid #1f2937', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#10b981' }} formatter={(value) => [`${value}%`, 'Eficiencia']} />
                               <Area type="monotone" dataKey="ef" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEf)" connectNulls={true} />
                            </AreaChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
                   <div className="bg-[#151F32] rounded-[2.5rem] shadow-xl border border-slate-800 p-6 mt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
    <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest flex items-center gap-2"><ShieldCheck className="text-green-500" size={18} /> Bitácora de Operación Reciente (Detalle)</h4>
    <div className="flex gap-2">
        <button onClick={handleSyncToCloud} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-lg" title="Forzar Robot a leer todo el mes"><RefreshCw size={14} /> Sincronizar Nube</button>
        <button onClick={abrirMapaDeRuta} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-lg"><Map size={14} /> Ver Mapa de Ruta Diaria</button>
    </div></div>
    <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Transportista</th><th className="px-4 py-3">Punto</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th><th className="px-4 py-3">Espera</th><th className="px-4 py-3 text-center">Tipo</th><th className="px-4 py-3">Obs.</th><th className="px-4 py-3 text-center">Foto</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead>
    <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
    {metrics.rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((r, i) =>
            <tr key={r.id || i} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 text-slate-300 font-bold">{getStrictDateString(r.createdAt)}</td>
                                    <td className="px-4 py-3 text-white">{r.recolector}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white">{r.sucursal}</span>
                                            {r.tiempoTransito > 0 && <span className="text-[9px] text-blue-400 font-bold flex items-center gap-1 mt-0.5" title="Tiempo de viaje desde la última parada"><Bike size={10} /> Tránsito: {r.tiempoTransito}m</span>}
                                            {r.ubicacion && r.ubicacion !== 'Sin GPS' && <a href={r.ubicacionAnterior ? `https://www.google.com/maps/dir/?api=1&origin=${r.ubicacionAnterior}&destination=${r.ubicacion}` : `https://www.google.com/maps/search/?api=1&query=${r.ubicacion}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[9px] font-bold mt-0.5"><MapPin size={10} /> {r.ubicacionAnterior ? 'Ver Ruta Trazada' : 'Ver Ubicación'}</a>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{r.hLlegada && r.mLlegada ? `${r.hLlegada}:${r.mLlegada} ${r.pLlegada || ''}` : '--'}</td>
                                    <td className="px-4 py-3 text-slate-500">{r.hSalida && r.mSalida ? `${r.hSalida}:${r.mSalida} ${r.pSalida || ''}` : '--'}</td>
                                    <td className={cn("px-4 py-3", r.tiempo > 5 ? "text-orange-400" : "text-green-400")}>{r.tiempo}m</td>
                                    <td className="px-4 py-3 text-center"><span className={cn("px-2 py-0.5 rounded-md text-[9px] border font-bold uppercase", r.categoria === "Principal" ? "bg-indigo-900/30 border-indigo-900 text-indigo-300" : "bg-orange-900/30 border-orange-900 text-orange-300")}>{r.categoria === "Principal" ? "Vital" : "Secundaria"}</span></td>
                                    <td className="px-4 py-3 text-xs italic text-slate-500 truncate max-w-[150px]" title={r.observaciones}>{r.observaciones || '--'}</td>
                                    <td className="px-4 py-3 text-center">{r.fotoData && r.fotoData.startsWith('http') ? <a href={r.fotoData} target="_blank" rel="noreferrer" className="inline-flex justify-center items-center bg-blue-900/30 text-blue-400 w-8 h-8 rounded-lg border border-blue-900"><ExternalLink size={14} /></a> : r.fotoData ? <img src={r.fotoData} className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-600 hover:border-white transition-all" onClick={() => setViewingPhoto(r.fotoData)} alt="evidencia" /> : <span className="text-slate-700">-</span>}</td>
                                    <td className="px-4 py-3 flex items-center justify-center gap-2">
                                        {filterYear !== '2025' && <><button onClick={() => openEditModal({ ...r, hLlegada: r.hLlegada || '', mLlegada: r.mLlegada || '', pLlegada: r.pLlegada || 'AM', hSalida: r.hSalida || '', mSalida: r.mSalida || '', pSalida: r.pSalida || 'AM' }, 'registros_produccion')} className="text-blue-400 hover:text-blue-200"><Edit3 size={16} /></button><button onClick={() => handleDelete('registros_produccion', r.id)} className="text-red-500 hover:text-red-300"><Trash2 size={16} /></button></>}
                                    </td>
                                </tr>
            )}
                        </tbody>
                    </table>
                    {/* 🔥 CONTROLES DE PAGINACIÓN REAL */}
                    <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between print-hide">
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                                Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, metrics.rows.length)} de {metrics.rows.length} viajes
                            </span>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 shadow-md">
                                    <ChevronLeft size={14} /> Anterior
                                </button>
                                <span className="bg-[#0B1120] text-slate-300 px-4 py-2 rounded-lg text-[10px] font-black border border-slate-700">
                                    Pág. {currentPage} de {Math.ceil(metrics.rows.length / itemsPerPage) || 1}
                                </span>
                                <button onClick={() => setCurrentPage((prev) => prev + 1)} disabled={currentPage >= Math.ceil(metrics.rows.length / itemsPerPage)} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 shadow-md">
                                    Siguiente <ChevronRight size={14} />
                                </button>
                            </div>
                       </div>
                    </div>
                   </div>
                </div>
  }
         {adminSection === 'fleet' &&
  <div className="animate-in fade-in space-y-6 print-hide">
                   
                   {/* 1. CORTE OPERATIVO */}
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3"><div className="p-3 bg-orange-900/30 rounded-xl text-orange-400"><Settings size={24} /></div><div><h3 className="text-sm font-black text-white uppercase">Corte Operativo de Flota (Combustible/Taller)</h3><p className="text-[10px] text-slate-400">Define el periodo activo para tu presupuesto.</p></div></div>
                        <div className="flex gap-2 w-full md:w-auto"><input type="date" value={sysConfig.flotaInicio || ''} onChange={(e) => setSysConfig({ ...sysConfig, flotaInicio: e.target.value })} className="p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold text-[10px] flex-1" /><input type="date" value={sysConfig.flotaFin || ''} onChange={(e) => setSysConfig({ ...sysConfig, flotaFin: e.target.value })} className="p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold text-[10px] flex-1" />
                        <button
          onClick={async () => {
            handleSaveConfig();

            const fInicio = sysConfig.flotaInicio;
            const fFin = sysConfig.flotaFin;
            if (!fInicio || !fFin) return alert("Por favor, selecciona las fechas en ambos calendarios.");

            try {
              const { collection, query, where, getDocs } = await import('firebase/firestore');
              const qFuel = query(collection(db, "registros_combustible"), where("fecha", ">=", fInicio), where("fecha", "<=", fFin));
              const snapFuel = await getDocs(qFuel);
              setFuelData(snapFuel.docs.map((d) => ({ id: d.id, ...d.data() })));

              const qMaint = query(collection(db, "registros_mantenimiento"), where("fecha", ">=", fInicio), where("fecha", "<=", fFin));
              const snapMaint = await getDocs(qMaint);
              setMaintData(snapMaint.docs.map((d) => ({ id: d.id, ...d.data() })));

              alert(`✅ Historial descargado correctamente del ${fInicio} al ${fFin}`);
            } catch (e) {
              console.error(e);
              alert("Error al descargar los datos de Firebase.");
            }
          }}
          className="bg-orange-600 hover:bg-orange-500 text-white px-4 rounded-xl font-bold text-[10px] uppercase transition-all shadow-md">

    Fijar
        </button></div>
                   </div>

                   {/* 2. KPI CARDS (Dólares y Galones) */}
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} className="text-green-500" /></div><p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-2">COMB. (MES)</p><h3 className="text-3xl font-black text-white">${fleetMetrics.totalFuelCost}</h3></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Wrench size={80} className="text-yellow-500" /></div><p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-2">TALLER (MES)</p><h3 className="text-3xl font-black text-white">${fleetMetrics.totalMaintCost}</h3></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Fuel size={80} className="text-orange-500" /></div><p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2">GALONES</p><h3 className="text-3xl font-black text-white">{fleetMetrics.totalGalones}</h3></div>
                      <div className="bg-[#0B1120] p-6 rounded-[2rem] border border-slate-800 flex flex-col justify-center"><p className="text-[10px] font-bold text-slate-500 uppercase">GASTO TOTAL FLOTA</p><h3 className="text-3xl font-black text-white">${(parseFloat(fleetMetrics.totalFuelCost) + parseFloat(fleetMetrics.totalMaintCost)).toFixed(2)}</h3></div>
                   </div>

                   {/* 3. GRÁFICA A ANCHO COMPLETO */}
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                        <h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-orange-500" /> Costo Operativo por Transportista ($)</h4>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={fleetMetrics.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(value) => { const parts = String(value).split(' ').filter(Boolean); return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : value; }} interval={0} angle={-45} textAnchor="end" height={90} />
                                    <Tooltip cursor={{ fill: '#1f2937' }} contentStyle={{ backgroundColor: '#0B1120', border: '1px solid #1f2937', color: '#fff' }} />
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
                            <h4 className="font-bold text-slate-300 text-xs uppercase mb-2 flex items-center gap-2 shrink-0"><Fuel size={14} className="text-orange-500" /> Cargas de Combustible</h4>
                            <div className="overflow-y-auto h-full pb-2 custom-scrollbar">
                                <table className="w-full text-left relative">
                                    <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] sticky top-0 z-10 shadow-sm"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Galones</th><th className="px-4 py-3">Costo</th><th className="px-4 py-3">Km</th><th className="px-4 py-3 text-center">Ticket</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead>
                                    <tbody className="text-[10px] text-slate-400 divide-y divide-slate-800">
                                     {fuelData.filter((d) => checkDate(d.fecha) && (filterUser === 'all' || (USUARIOS_EMAIL[d.usuario] || '').includes(filterUser)) && isUserInFilterZone(d.usuario, filterZona)).map((r) => <tr key={r.id} className="hover:bg-slate-800/50"><td className="px-2 py-3">{formatLocalDate(r.fecha)}</td><td className="px-2 py-3 text-white">{perfilesUsuarios[r.usuario]?.nombre?.split(' ')[0] || USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-2 py-3">{r.galones}</td><td className="px-2 py-3 text-green-400">${r.costo}</td><td className="px-2 py-3">{r.kilometraje}</td><td className="px-2 py-3 text-center">{r.foto && <button onClick={() => setViewingPhoto(r.foto)} className="bg-orange-900/50 text-orange-400 px-2 py-1 rounded border border-orange-900 text-[9px] uppercase hover:bg-orange-900">Ver</button>}</td><td className="px-2 py-3 flex justify-center gap-2"><button onClick={() => openEditModal(r, 'registros_combustible')}><Edit size={14} className="text-blue-500 hover:text-blue-300" /></button><button onClick={() => handleDelete('registros_combustible', r.id)}><Trash2 size={14} className="text-red-500 hover:text-red-300" /></button></td></tr>)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        {/* TABLA TALLER */}
                        <div className="bg-[#151F32] p-4 rounded-[2rem] border border-slate-800 flex flex-col h-[400px]">
                            <h4 className="font-bold text-slate-300 text-xs uppercase mb-2 flex items-center gap-2 shrink-0"><Wrench size={14} className="text-yellow-500" /> Servicios de Taller</h4>
                            <div className="overflow-y-auto h-full pb-2 custom-scrollbar">
                                <table className="w-full text-left relative">
                                    <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] sticky top-0 z-10 shadow-sm"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Taller</th><th className="px-4 py-3">Costo</th><th className="px-4 py-3 text-center">Evidencia</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead>
                                    <tbody className="text-[10px] text-slate-400 divide-y divide-slate-800">
                                    {maintData.filter((d) => checkDate(d.fecha) && (filterUser === 'all' || (USUARIOS_EMAIL[d.usuario] || '').includes(filterUser)) && isUserInFilterZone(d.usuario, filterZona)).map((r) => <tr key={r.id} className="hover:bg-slate-800/50"><td className="px-2 py-3">{formatLocalDate(r.fecha)}</td><td className="px-2 py-3 text-white">{perfilesUsuarios[r.usuario]?.nombre?.split(' ')[0] || USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-2 py-3 text-white">{r.tipo}</td><td className="px-2 py-3">{r.taller}</td><td className="px-2 py-3 text-yellow-400">${r.costo}</td><td className="px-2 py-3 text-center">{r.foto && <button onClick={() => setViewingPhoto(r.foto)} className="bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded border border-yellow-900 text-[9px] uppercase hover:bg-yellow-900">Ver Foto</button>}</td><td className="px-2 py-3 flex justify-center gap-2"><button onClick={() => openEditModal(r, 'registros_mantenimiento')}><Edit size={14} className="text-blue-500 hover:text-blue-300" /></button><button onClick={() => handleDelete('registros_mantenimiento', r.id)}><Trash2 size={14} className="text-red-500 hover:text-red-300" /></button></td></tr>)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                   </div>
                   
                </div>
  }
             {adminSection === 'hr' &&
  <div className="animate-in fade-in space-y-6 print-hide">
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3"><div className="p-3 bg-purple-900/30 rounded-xl text-purple-400"><Settings size={24} /></div><div><h3 className="text-sm font-black text-white uppercase">Corte de Quincena (Horas Extra)</h3><p className="text-[10px] text-slate-400">Define las fechas para la exportación y visualización del transportista.</p></div></div>
                        <div className="flex gap-2 w-full md:w-auto"><input type="date" value={sysConfig.heInicio || ''} onChange={(e) => setSysConfig({ ...sysConfig, heInicio: e.target.value })} className="p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold text-[10px] flex-1" /><input type="date" value={sysConfig.heFin || ''} onChange={(e) => setSysConfig({ ...sysConfig, heFin: e.target.value })} className="p-3 bg-[#0B1120] border border-slate-700 rounded-xl text-white font-bold text-[10px] flex-1" /><button onClick={handleSaveConfig} className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-xl font-bold text-[10px] uppercase transition-all shadow-md">Fijar</button></div>
                   </div>
                   <div className="flex justify-between items-center bg-[#151F32] p-6 rounded-[2rem] border border-slate-800">
                      <div><h3 className="text-2xl font-black text-white">Nómina de Horas Extras</h3><p className="text-xs text-slate-400">Mostrando el historial completo del mes actual</p></div>
                      <button onClick={exportPayrollCSV} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-md flex items-center gap-2 hover:bg-purple-700 transition-all" title="El Excel descargará solo la quincena configurada arriba"><FileSpreadsheet size={16} /> Exportar Excel (Quincena)</button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={100} className="text-purple-500" /></div><p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-2">HORAS EXTRAS (TODO EL MES)</p><h3 className="text-5xl font-black text-white">{hrMetrics.totalHoras} <span className="text-lg text-slate-500">hrs</span></h3><p className="text-xs text-slate-400 mt-2">Registros procesados: {hrMetrics.totalRegistros}</p></div>
                      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-purple-500" /> Ranking Horas Extra (Mes)</h4><div className="space-y-3">{hrMetrics.rankingOt.slice(0, 5).map((u, i) => <div key={i} className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold text-white">{i + 1}</div><span className="text-sm font-bold text-slate-300">{u.name}</span></div><div className="flex items-center gap-2"><div className="h-2 bg-purple-900 rounded-full w-24 overflow-hidden"><div className="h-full bg-purple-500" style={{ width: `${u.hours / (parseFloat(hrMetrics.totalHoras) || 1) * 100}%` }}></div></div><span className="text-xs font-bold text-white">{u.hours}h</span></div></div>)}</div></div>
                   </div>
                   <div className="bg-[#151F32] rounded-[2.5rem] shadow-xl border border-slate-800 p-6">
                      <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest mb-6 flex items-center gap-2"><ClipboardList className="text-purple-500" size={18} /> Detalle Mensual de Horas Extras</h4>
                      <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Inicio</th><th className="px-4 py-3">Fin</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3 text-center rounded-r-lg">Acciones</th></tr></thead>
                      <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                          {hrMetrics.rawData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((r, i) =>
            <tr key={r.id} className="hover:bg-slate-800/50">
                                  <td className="px-4 py-3 text-white font-bold">{getStrictDateString(r.fecha)}</td>
                                  <td className="px-4 py-3 text-white">{perfilesUsuarios[r.usuario?.toLowerCase().trim()]?.nombre?.toUpperCase() || USUARIOS_EMAIL[r.usuario?.toLowerCase().trim()] || r.usuario}</td>
                                  <td className="px-4 py-3">{r.horaInicio}</td>
                                  <td className="px-4 py-3">{r.horaFin}</td>
                                  <td className="px-4 py-3 text-purple-400 font-black">{r.horasCalculadas}h</td>
                                  <td className="px-4 py-3 italic text-slate-500">{r.motivo}</td>
                                  <td className="px-4 py-3 flex justify-center gap-2"><button onClick={() => openEditModal(r, 'registros_horas_extras')}><Edit size={14} className="text-blue-500 hover:text-blue-300" /></button><button onClick={() => handleDelete('registros_horas_extras', r.id)}><Trash2 size={14} className="text-red-500 hover:text-red-300" /></button></td>
                              </tr>
            )}
                      </tbody></table></div>
                      {/* 🔥 CONTROLES DE PAGINACIÓN */}
                      <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between print-hide">
                          <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                              Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, hrMetrics.rawData.length)} de {hrMetrics.rawData.length} registros
                          </span>
                          <div className="flex gap-2">
                              <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 shadow-md">
                                  <ChevronLeft size={14} /> Ant.
                              </button>
                              <span className="bg-[#0B1120] text-slate-300 px-4 py-2 rounded-lg text-[10px] font-black border border-slate-700">
                                  Pág. {currentPage} de {Math.ceil(hrMetrics.rawData.length / itemsPerPage) || 1}
                              </span>
                              <button onClick={() => setCurrentPage((prev) => prev + 1)} disabled={currentPage >= Math.ceil(hrMetrics.rawData.length / itemsPerPage)} className="bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 shadow-md">
                                  Sig. <ChevronRight size={14} />
                              </button>
                          </div>
                      </div>
                   </div>
                </div>
  }

           {adminSection === 'agenda' &&
  <div className="animate-in fade-in">
                    <div className="bg-[#151F32] p-4 rounded-xl border border-slate-800 mb-6 flex flex-col md:flex-row items-center justify-between shadow-sm gap-4 print-hide">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Globe size={14} /> Contexto Operativo:</span>
                            <select value={catalogCountry} onChange={(e) => setCatalogCountry(e.target.value)} className="bg-[#0B1120] text-blue-400 text-xs font-black uppercase px-4 py-2 rounded-lg outline-none border border-slate-700 cursor-pointer shadow-inner">
                                {catalogs.paises.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        
                        {/* 🔥 EL INTERRUPTOR MAESTRO DE PUBLICACIÓN 🔥 */}
                        <div className="flex items-center gap-3 w-full md:w-auto bg-[#0B1120] p-2 rounded-xl border border-slate-700">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visibilidad en App:</span>
                            <button
          onClick={async () => {
            try {await setDoc(doc(db, "configuraciones", "general"), { agendaPublicada: !(sysConfig.agendaPublicada !== false) }, { merge: true });} catch (e) {alert("Error de conexión");}
          }}
          className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-md", sysConfig.agendaPublicada !== false ? "bg-green-600 hover:bg-green-500 text-white" : "bg-red-600 hover:bg-red-500 text-white")}>

                                {sysConfig.agendaPublicada !== false ? '👁️ PÚBLICA (VISIBLE)' : '🙈 OCULTA (EN EDICIÓN)'}
                            </button>
                        </div>
                    </div>
 <FleetAgenda
      sucursalesObj={catalogs.sucursales}
      transportistasObj={catalogs.transportistas}
      countryContext={catalogCountry}
      readOnly={appMode === 'supervisor'}
      perfilesUsuarios={perfilesUsuarios}
      catalogs={catalogs}
      filtroZona={filterZona} />

                </div>
  }
          </div>
  );
}
