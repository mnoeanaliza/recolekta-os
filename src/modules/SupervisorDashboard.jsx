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
import { cn, formatLocalDate, formatTurnosVisually, formatWithDay, getStrictDateString, PRINCIPAL_KEYWORDS, USUARIOS_EMAIL } from '../utils/constants';

export default function SupervisorDashboard(props) {
  const { SmallGauge, abrirMapaDeRuta, activeInput, activeUserCountry, adminDashboardMetrics, adminSection, agendaData, alertasData, appMode, availableYears, avisoForm, biMetrics, catalogCountry, catalogs, checkDate, compressImage, convertToMinutes, csvData, currentPage, currentUser, cycleCategory, dataSource, dismissAlert, downloadReport, editFormData, editingItem, exportPayrollCSV, exportToCSV, extractDateInfo, filterMonth, filterSpecificDate, filterSucursal, filterUser, filterUserTableZone, filterYear, filterZona, fleetMetrics, form, fuelData, gamificationStats, getMetaEspera, getUserCountry, getUserZone, getWait, gpsLocation, handleAddCatalogItem, handleAssignCategory, handleAssignZone, handleDelete, handleEditFormChange, handleFile, handleInput, handleMotoPhotoUpload, handleProfilePhotoUpload, handleRemoveCatalogItem, handleSaveConfig, handleStartOperation, handleSyncToCloud, handleUpdate, hiddenAlerts, hrMetrics, imageFile, imagePreview, isCompressing, isFetchingHistory, isGettingGps, isOperating, isUploading, isUserInFilterZone, itemsPerPage, liveData, liveWaitMins, logout, maintData, mapaModalData, metrics, newCatalogItems, openEditModal, operationStartTime, otData, perfilesUsuarios, previousGps, queryLimit, regionalMetrics, resumenesMensualesNube, selectedAdminProfile, setActiveInput, setAdminSection, setAgendaData, setAlertasData, setAppMode, setAvisoForm, setCatalogCountry, setCatalogs, setCsvData, setCurrentPage, setDataSource, setEditFormData, setEditingItem, setFilterMonth, setFilterSpecificDate, setFilterSucursal, setFilterUser, setFilterUserTableZone, setFilterYear, setFilterZona, setForm, setFuelData, setGpsLocation, setHiddenAlerts, setImageFile, setImagePreview, setIsCompressing, setIsFetchingHistory, setIsGettingGps, setIsOperating, setIsUploading, setLiveData, setLiveWaitMins, setMaintData, setMapaModalData, setNewCatalogItems, setOperationStartTime, setOtData, setPerfilesUsuarios, setPreviousGps, setQueryLimit, setResumenesMensualesNube, setSelectedAdminProfile, setShowAvisoModal, setShowWelcome, setSupervisorSection, setSysConfig, setTransitTimeMins, setUserProfile, setUserView, setViewingPhoto, showAvisoModal, showWelcome, supervisorSection, sysConfig, transitTimeMins, transportistaOtData, userAlerts, userMetrics, userProfile, userView, viewingPhoto } = props;

  return (
<div className="space-y-6 md:space-y-8 animate-in fade-in print-p-0">
             <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-800 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 print-hide">
                <div className="w-full xl:w-auto overflow-hidden">
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white mb-4 xl:mb-0 flex items-center gap-2"><Eye className="text-blue-500" /> Visor Operativo supervision</h2>
                    <div className="flex gap-2 mt-0 xl:mt-4 bg-[#0B1120] p-1 rounded-xl w-full border border-slate-800 overflow-x-auto md:flex-wrap md:overflow-visible custom-scrollbar">
                        <button onClick={() => setSupervisorSection('inicio')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all", supervisorSection === 'inicio' ? "bg-slate-200 text-black shadow-md" : "text-slate-500 hover:bg-slate-800")}>Inicio</button>
                        <button onClick={() => setSupervisorSection('bitacora')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all", supervisorSection === 'bitacora' ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-800")}>Bitácora</button>
                        <button onClick={() => setSupervisorSection('combustible')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all", supervisorSection === 'combustible' ? "bg-orange-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-800")}>Combustible</button>
                        <button onClick={() => setSupervisorSection('taller')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all", supervisorSection === 'taller' ? "bg-yellow-600 text-black shadow-md" : "text-slate-500 hover:bg-slate-800")}>Taller</button>
                        <button onClick={() => setSupervisorSection('agenda')} className={cn("shrink-0 px-4 py-3 md:py-2 rounded-lg text-[10px] font-black uppercase transition-all", supervisorSection === 'agenda' ? "bg-purple-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-800")}>Horarios</button>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center w-full xl:w-auto">
                  <div className="flex flex-wrap bg-[#0B1120] p-2 rounded-xl border border-slate-800 items-center gap-2 w-full sm:w-auto">
                    <Filter size={14} className="text-slate-500 hidden sm:block" />
                    <input type="date" value={filterSpecificDate} onChange={(e) => { setFilterSpecificDate(e.target.value); setCurrentPage(1); }} className="bg-transparent font-bold text-[10px] uppercase outline-none px-2 text-slate-300 border-l border-slate-700 pl-2 cursor-pointer flex-1 sm:flex-none" title="Filtrar por Día Exacto" />
                    <select value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setCurrentPage(1); }} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none">{availableYears.map((y) => <option key={y} value={y} className="bg-slate-900">{y}{y === '2025' ? ' (CSV)' : ''}</option>)}</select>
                    <select value={filterUser} onChange={(e) => { setFilterUser(e.target.value); setCurrentPage(1); }} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none"><option value="all">Toda la Flota</option>{Object.values(catalogs.transportistas || {}).flat().map((u) => <option key={u} value={u} className="bg-slate-900">{u}</option>)}</select>
                    <select value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setCurrentPage(1); }} className="bg-transparent font-bold text-[10px] uppercase outline-none text-slate-300 border-l border-slate-700 pl-2 flex-1 sm:flex-none"><option value="all" className="bg-slate-900">Año</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => <option key={m} value={m} className="bg-slate-900">Mes {m}</option>)}</select>
                    {filterUser !== 'all' && (
                        <button onClick={() => { setFilterUser('all'); setCurrentPage(1); }} className="text-[9px] bg-red-900/30 text-red-400 border border-red-800 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-red-900/50">
                            <X size={10} /> Quitar filtro ({filterUser.split(' ')[0]})
                        </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <button onClick={() => setShowAvisoModal(true)} className="bg-blue-600 text-white px-4 py-3 md:py-2 rounded-lg text-[9px] font-black uppercase hover:bg-blue-500 transition-all flex items-center gap-1 shadow-md"><Send size={12} /> AVISO</button>
                      <button onClick={() => downloadReport()} className="bg-white text-black px-4 py-3 md:py-2 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 transition-all flex items-center gap-1"><Download size={12} /> PDF</button>
                  </div>
                </div>
             </div>
            {supervisorSection === 'inicio' &&
            <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-xl print-hide">
                <div className="flex items-center gap-3 mb-6"><Eye className="text-blue-500" /><h3 className="text-xl font-black text-white uppercase">Visor listo</h3></div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <button onClick={() => setSupervisorSection('bitacora')} className="bg-[#0B1120] border border-slate-700 p-5 rounded-xl text-left hover:border-blue-500 transition-colors"><ClipboardList className="text-blue-500 mb-3" /><span className="text-xs font-black text-white uppercase">Bitácora</span></button>
                    <button onClick={() => setSupervisorSection('combustible')} className="bg-[#0B1120] border border-slate-700 p-5 rounded-xl text-left hover:border-orange-500 transition-colors"><Fuel className="text-orange-500 mb-3" /><span className="text-xs font-black text-white uppercase">Combustible</span></button>
                    <button onClick={() => setSupervisorSection('agenda')} className="bg-[#0B1120] border border-slate-700 p-5 rounded-xl text-left hover:border-purple-500 transition-colors"><Calendar className="text-purple-400 mb-3" /><span className="text-xs font-black text-white uppercase">Horarios</span></button>
                </div>
            </div>}
             
            {supervisorSection === 'bitacora' &&
  <div className="space-y-6">
                    <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 print-hide">
                        <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest mb-4 flex items-center gap-2"><Users className="text-blue-500" size={18} /> Monitor de Estatus en Vivo</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                             {adminDashboardMetrics.transportistasStats.map((stat) =>
                                <div
                                    key={stat.name}
                                    onClick={() => {
                                        setFilterUser(filterUser === stat.name ? 'all' : stat.name);
                                        setCurrentPage(1);
                                    }}
                                    className={cn(
                                        "px-3 py-2 rounded-xl flex items-center gap-3 border shadow-sm transition-all cursor-pointer select-none hover:border-blue-400",
                                        filterUser === stat.name ? "ring-2 ring-blue-500 bg-blue-950/50 border-blue-500 shadow-blue-500/20" : (
                                            stat.estatus === 'Standby' ? "bg-green-900/20 border-green-500/50" :
                                            stat.estatus === 'En Ruta' ? "bg-blue-900/20 border-blue-500/30" :
                                            stat.estatus === 'Almuerzo' ? "bg-yellow-900/20 border-yellow-500/50" :
                                            "bg-slate-800/40 border-slate-700"
                                        )
                                    )}
                                    title={filterUser === stat.name ? "Clic para ver toda la flota" : `Clic para filtrar bitácora por ${stat.name}`}
                                >
                                    <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", stat.estatus === 'Standby' ? "bg-green-500 animate-pulse" : stat.estatus === 'En Ruta' ? "bg-blue-500" : stat.estatus === 'Almuerzo' ? "bg-yellow-500" : "bg-slate-600")}></div>
                                    <div className="flex flex-col flex-1">
                                        <span className={cn("text-[10px] font-black uppercase leading-tight", stat.estatus === 'Inactivo' ? "text-slate-500" : "text-white")}>{stat.name.split(' ')[0]}</span>
                                        <span className={cn("text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md w-fit mt-0.5", stat.estatus === 'Standby' ? "bg-green-600 text-white" : stat.estatus === 'En Ruta' ? "bg-blue-600 text-white" : stat.estatus === 'Almuerzo' ? "bg-yellow-600 text-black" : "bg-slate-700 text-slate-400")}>
                                            {stat.estatus === 'Standby' ? 'DISPONIBLE' : stat.estatus === 'En Ruta' ? 'EN RUTA' : stat.estatus === 'Almuerzo' ? 'ALMORZANDO' : 'INACTIVO'}
                                        </span>
                                    </div>
                                    
                                    {/* ⏱️ EL CHISMOSO: Solo aparece en ruta, ignorando la hora de almuerzo */}
                                    {stat.estatus === 'En Ruta' && stat.minutosInactivo !== null &&
                                        <div className="text-right">
                                            <p className="text-[7px] text-slate-500 uppercase font-bold leading-none mb-0.5">Últ. Parada</p>
                                            <span className={cn("text-[9px] font-mono font-black", stat.minutosInactivo >= 60 ? "text-red-400 animate-pulse" : "text-blue-300")}>
                                                {stat.minutosInactivo > 120 ? '+2 hrs' : `${stat.minutosInactivo}m`}
                                            </span>
                                        </div>
                                    }
                                </div>
                            )}
                        </div>
                    </div>

                    {/* TABLA DE BITÁCORA ORIGINAL */}
                    <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 overflow-x-auto print-hide">
                       <table className="w-full text-left">
                          <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Transportista</th><th className="px-4 py-3">Punto</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Salida</th><th className="px-4 py-3">Espera</th><th className="px-4 py-3 text-center">Tipo</th><th className="px-4 py-3">Obs.</th><th className="px-4 py-3 text-center rounded-r-lg">Foto</th></tr></thead>
                          <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800 overflow-y-auto h-full custom-scrollbar">
                             {metrics.rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((r, i) => <tr key={r.id || i} className="hover:bg-slate-800/50 transition-colors"><td className="px-4 py-3 text-slate-300 font-bold">{getStrictDateString(r.createdAt)}</td><td className="px-4 py-3 text-white">{r.recolector}</td><td className="px-4 py-3"><div className="flex flex-col"><span className="font-bold text-white">{r.sucursal}</span>{r.tiempoTransito > 0 && <span className="text-[9px] text-blue-400 font-bold flex items-center gap-1 mt-0.5" title="Tiempo de viaje desde la última parada"><Bike size={10} /> Tránsito: {r.tiempoTransito}m</span>}{r.ubicacion && r.ubicacion !== 'Sin GPS' && <a href={r.ubicacionAnterior ? `https://www.google.com/maps/dir/?api=1&origin=${r.ubicacionAnterior}&destination=${r.ubicacion}` : `https://www.google.com/maps/search/?api=1&query=${r.ubicacion}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[9px] font-bold mt-0.5" title="Ver en mapa real"><MapPin size={10} /> {r.ubicacionAnterior ? 'Ver Ruta Trazada' : 'Ver Ubicación'}</a>}</div></td><td className="px-4 py-3 text-slate-500">{r.hLlegada && r.mLlegada ? `${r.hLlegada}:${r.mLlegada} ${r.pLlegada || ''}` : '--'}</td><td className="px-4 py-3 text-slate-500">{r.hSalida && r.mSalida ? `${r.hSalida}:${r.mSalida} ${r.pSalida || ''}` : '--'}</td><td className={cn("px-4 py-3", r.tiempo > 5 ? "text-orange-400" : "text-green-400")}>{r.tiempo}m</td><td className="px-4 py-3 text-center"><span className={cn("px-2 py-0.5 rounded-md text-[9px] border font-bold uppercase", r.categoria === "Principal" ? "bg-indigo-900/30 border-indigo-900 text-indigo-300" : "bg-orange-900/30 border-orange-900 text-orange-300")}>{r.categoria === "Principal" ? "Vital" : "Secundaria"}</span></td><td className="px-4 py-3 text-xs italic text-slate-500 truncate max-w-[150px]" title={r.observaciones}>{r.observaciones || '--'}</td><td className="px-4 py-3 text-center">{r.fotoData && r.fotoData.startsWith('http') ? <a href={r.fotoData} target="_blank" rel="noreferrer" className="inline-flex justify-center items-center bg-blue-900/30 text-blue-400 w-8 h-8 rounded-lg border border-blue-900"><ExternalLink size={14} /></a> : r.fotoData ? <img src={r.fotoData} className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-600 hover:border-white transition-all" onClick={() => setViewingPhoto(r.fotoData)} alt="evidencia" /> : <span className="text-slate-700">-</span>}</td></tr>)}
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
                                <button onClick={() => setQueryLimit((value) => value + 50)} className="bg-blue-900/40 border border-blue-700 text-blue-300 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all hover:bg-blue-900 shadow-md">Cargar 50 más</button>
                            </div>
                       </div>
                    </div>
                </div>
  }

             {supervisorSection === 'combustible' &&
  <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 overflow-x-auto print-hide">
                   <table className="w-full text-left">
                      <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Galones</th><th className="px-4 py-3">Costo Total</th><th className="px-4 py-3">Km</th><th className="px-4 py-3 text-center rounded-r-lg">Ticket</th></tr></thead>
                      <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800 overflow-y-auto h-full custom-scrollbar">
                         {fuelData.filter((d) => checkDate(d.fecha) && (filterUser === 'all' || (USUARIOS_EMAIL[d.usuario] || '').includes(filterUser))).map((r, i) => <tr key={r.id || i} className="hover:bg-slate-800/50"><td className="px-4 py-3">{formatLocalDate(r.fecha)}</td><td className="px-4 py-3 text-white">{USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-4 py-3">{r.galones}</td><td className="px-4 py-3 text-green-400">${r.costo}</td><td className="px-4 py-3">{r.kilometraje}</td><td className="px-4 py-3 text-center">{r.foto && <button onClick={() => setViewingPhoto(r.foto)} className="bg-orange-900/50 text-orange-400 px-2 py-1 rounded border border-orange-900 text-[9px] uppercase hover:bg-orange-900">Ver Ticket</button>}</td></tr>)}
                      </tbody>
                   </table>
                </div>
  }

             {supervisorSection === 'taller' &&
  <div className="bg-[#151F32] rounded-[2rem] shadow-xl border border-slate-800 p-6 overflow-x-auto print-hide">
                   <table className="w-full text-left">
                      <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg"><tr><th className="px-4 py-3 rounded-l-lg">Fecha</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Taller</th><th className="px-4 py-3">Costo</th><th className="px-4 py-3 text-center rounded-r-lg">Evidencia</th></tr></thead>
                      <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800 overflow-y-auto h-full custom-scrollbar">
                         {maintData.filter((d) => checkDate(d.fecha) && (filterUser === 'all' || (USUARIOS_EMAIL[d.usuario] || '').includes(filterUser))).map((r, i) => <tr key={r.id || i} className="hover:bg-slate-800/50"><td className="px-4 py-3">{formatLocalDate(r.fecha)}</td><td className="px-4 py-3 text-white">{USUARIOS_EMAIL[r.usuario]?.split(' ')[0] || 'User'}</td><td className="px-4 py-3">{r.tipo}</td><td className="px-4 py-3">{r.taller}</td><td className="px-4 py-3 text-yellow-400">${r.costo}</td><td className="px-4 py-3 text-center">{r.foto && <button onClick={() => setViewingPhoto(r.foto)} className="bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded border border-yellow-900 text-[9px] uppercase hover:bg-yellow-900">Ver Foto</button>}</td></tr>)}
                      </tbody>
                   </table>
                </div>
  }

             {supervisorSection === 'agenda' && (
  <div className="animate-in fade-in print-hide">
                    <div className="bg-[#151F32] p-4 rounded-xl border border-slate-800 mb-6 flex items-center justify-between shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Globe size={14} /> Contexto Operativo:</span>
                        <select value={catalogCountry} onChange={(e) => setCatalogCountry(e.target.value)} className="bg-[#0B1120] text-blue-400 text-xs font-black uppercase px-4 py-2 rounded-lg outline-none border border-slate-700 cursor-pointer shadow-inner">
                            {catalogs.paises.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {sysConfig?.agendaPublicada === false ? (
                      <div className="bg-[#151F32] p-10 rounded-[2.5rem] border border-slate-800 text-center animate-in zoom-in-95 duration-300 shadow-2xl relative overflow-hidden mt-4">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><HardHat size={150} className="text-yellow-500"/></div>
                        <div className="w-20 h-20 bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/30 relative z-10">
                          <HardHat className="text-yellow-500" size={36} strokeWidth={1.5}/>
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2 relative z-10">Agenda Oculta (En Edición)</h3>
                        <p className="text-slate-400 text-sm font-bold max-w-md mx-auto relative z-10">
                          La administración se encuentra realizando ajustes de último momento a los horarios y turnos de la flota. La visualización e impresión estará habilitada cuando la administración la haga pública.
                        </p>
                      </div>
                    ) : (
                      <FleetAgenda
                        sucursalesObj={catalogs.sucursales}
                        transportistasObj={catalogs.transportistas}
                        countryContext={catalogCountry}
                        agendaData={agendaData}
                        readOnly={true}
                        perfilesUsuarios={perfilesUsuarios}
                        catalogs={catalogs}
                        filtroZona={filterZona}
                      />
                    )}
                </div>
             )}
          </div>
  );
}
