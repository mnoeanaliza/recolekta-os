import React from 'react';
import { addDoc, collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Award, BarChart3, Bell, Bike, Briefcase, Calendar, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Database, DollarSign, Download, Edit, Edit3, Eraser, Eye, ExternalLink, FileSpreadsheet, Filter, Fuel, Globe, Image as ImageIcon, Layers, ListChecks, Loader2, Map, MapPin, MessageSquare, PieChart as PieChartIcon, Plus, Printer, RefreshCw, Save, Search, Send, Settings, ShieldCheck, Smartphone, Star, Target, Trash2, TrendingUp, Trophy, UploadCloud, User, Users, Wrench, X, XCircle } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, storage } from '../config/firebase';
import FleetAgenda from './FleetAgenda';
import { cn, formatLocalDate, formatTurnosVisually, formatWithDay, getStrictDateString, PRINCIPAL_KEYWORDS, USUARIOS_EMAIL } from '../utils/constants';

export default function Reports(props) {
  const { SmallGauge, abrirMapaDeRuta, activeInput, activeUserCountry, adminDashboardMetrics, adminSection, agendaData, alertasData, appMode, availableYears, avisoForm, biMetrics, catalogCountry, catalogs, checkDate, compressImage, convertToMinutes, csvData, currentPage, currentUser, cycleCategory, dataSource, dismissAlert, downloadReport, editFormData, editingItem, exportPayrollCSV, exportToCSV, extractDateInfo, filterMonth, filterSpecificDate, filterSucursal, filterUser, filterUserTableZone, filterYear, filterZona, fleetMetrics, form, fuelData, gamificationStats, getMetaEspera, getUserCountry, getUserZone, getWait, gpsLocation, handleAddCatalogItem, handleAssignCategory, handleAssignZone, handleDelete, handleEditFormChange, handleFile, handleInput, handleMotoPhotoUpload, handleProfilePhotoUpload, handleRemoveCatalogItem, handleSaveConfig, handleStartOperation, handleSyncToCloud, handleUpdate, hiddenAlerts, hrMetrics, imageFile, imagePreview, isCompressing, isFetchingHistory, isGettingGps, isOperating, isUploading, isUserInFilterZone, itemsPerPage, liveData, liveWaitMins, logout, maintData, mapaModalData, metrics, newCatalogItems, openEditModal, operationStartTime, otData, perfilesUsuarios, previousGps, queryLimit, regionalMetrics, resumenesMensualesNube, selectedAdminProfile, setActiveInput, setAdminSection, setAgendaData, setAlertasData, setAppMode, setAvisoForm, setCatalogCountry, setCatalogs, setCsvData, setCurrentPage, setDataSource, setEditFormData, setEditingItem, setFilterMonth, setFilterSpecificDate, setFilterSucursal, setFilterUser, setFilterUserTableZone, setFilterYear, setFilterZona, setForm, setFuelData, setGpsLocation, setHiddenAlerts, setImageFile, setImagePreview, setIsCompressing, setIsFetchingHistory, setIsGettingGps, setIsOperating, setIsUploading, setLiveData, setLiveWaitMins, setMaintData, setMapaModalData, setNewCatalogItems, setOperationStartTime, setOtData, setPerfilesUsuarios, setPreviousGps, setQueryLimit, setResumenesMensualesNube, setSelectedAdminProfile, setShowAvisoModal, setShowWelcome, setSupervisorSection, setSysConfig, setTransitTimeMins, setUserProfile, setUserView, setViewingPhoto, showAvisoModal, showWelcome, supervisorSection, sysConfig, transitTimeMins, transportistaOtData, userAlerts, userMetrics, userProfile, userView, viewingPhoto } = props;

  return (
<div className="animate-in fade-in space-y-6 print-hide">
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-5"><Globe size={150} className="text-blue-500" /></div>
                       <h3 className="text-xl font-black text-white flex items-center gap-2 mb-2"><Globe className="text-blue-400" /> Tabla de Posiciones Global</h3>
                       <p className="text-xs text-slate-400 mb-6">Comparativa de rendimiento entre países y sub-zonas operativas.</p>
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
                           <div className="bg-[#0B1120] rounded-2xl border border-slate-700 overflow-hidden shadow-inner"><h4 className="bg-blue-900/20 p-4 text-xs font-black text-blue-300 uppercase tracking-widest border-b border-blue-900/50 flex items-center gap-2"><Trophy size={14} /> Comparativa por Países</h4><table className="w-full text-left"><thead className="text-[9px] font-bold text-slate-500 uppercase bg-slate-900/50"><tr><th className="px-4 py-3">País</th><th className="px-4 py-3 text-center">Eficiencia</th><th className="px-4 py-3 text-center">Viajes Vitales</th><th className="px-4 py-3 text-center">Total Viajes</th></tr></thead><tbody className="text-xs font-bold text-slate-300 divide-y divide-slate-800">{regionalMetrics.paises.length === 0 && <tr><td colSpan="4" className="text-center py-4 text-slate-600">Sin datos</td></tr>}{regionalMetrics.paises.map((p, i) => <tr key={p.nombre} className="hover:bg-slate-800/50"><td className="px-4 py-3 flex items-center gap-2"><span className="text-[10px] bg-slate-800 w-5 h-5 flex items-center justify-center rounded text-slate-400">{i + 1}</span> {p.nombre}</td><td className="px-4 py-3 text-center"><span className={cn("px-2 py-1 rounded-md text-[10px] font-black", p.eficiencia >= 95 ? "bg-green-900/30 text-green-400" : p.eficiencia >= 80 ? "bg-yellow-900/30 text-yellow-400" : "bg-red-900/30 text-red-400")}>{p.eficiencia}%</span></td><td className="px-4 py-3 text-center text-blue-300">{p.vitales}</td><td className="px-4 py-3 text-center">{p.total}</td></tr>)}</tbody></table></div>
                           <div className="bg-[#0B1120] rounded-2xl border border-slate-700 overflow-hidden shadow-inner"><h4 className="bg-indigo-900/20 p-4 text-xs font-black text-indigo-300 uppercase tracking-widest border-b border-indigo-900/50 flex items-center gap-2"><MapPin size={14} /> Rendimiento por Sub-Zonas</h4><table className="w-full text-left"><thead className="text-[9px] font-bold text-slate-500 uppercase bg-slate-900/50"><tr><th className="px-4 py-3">Zona / Región</th><th className="px-4 py-3 text-center">Eficiencia</th><th className="px-4 py-3 text-center">Viajes Vitales</th><th className="px-4 py-3 text-center">Total Viajes</th></tr></thead><tbody className="text-xs font-bold text-slate-300 divide-y divide-slate-800">{regionalMetrics.zonas.length === 0 && <tr><td colSpan="4" className="text-center py-4 text-slate-600">Sin datos</td></tr>}{regionalMetrics.zonas.map((z, i) => <tr key={z.nombre} className="hover:bg-slate-800/50"><td className="px-4 py-3 flex items-center gap-2"><span className="text-[10px] bg-slate-800 w-5 h-5 flex items-center justify-center rounded text-slate-400">{i + 1}</span> <span className="truncate max-w-[120px]" title={z.nombre}>{z.nombre}</span></td><td className="px-4 py-3 text-center"><span className={cn("px-2 py-1 rounded-md text-[10px] font-black", z.eficiencia >= 95 ? "bg-green-900/30 text-green-400" : z.eficiencia >= 80 ? "bg-yellow-900/30 text-yellow-400" : "bg-red-900/30 text-red-400")}>{z.eficiencia}%</span></td><td className="px-4 py-3 text-center text-blue-300">{z.vitales}</td><td className="px-4 py-3 text-center">{z.total}</td></tr>)}</tbody></table></div>
                       </div>
                   </div>
                   <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><div><h3 className="text-xl font-black text-white flex items-center gap-2"><PieChartIcon className="text-indigo-500" /> Inteligencia de Negocios (YoY)</h3><p className="text-xs text-slate-400">Comparativa Anual Mensualizada ({biMetrics.yPrev} vs {biMetrics.yCurrent})</p></div>{appMode === 'admin' && <button type="button" onClick={props.handleRebuildHistoricalSummaries} disabled={props.isRebuildingSummaries} title="Reconstruir los 12 resúmenes del año seleccionado" className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shrink-0">{props.isRebuildingSummaries ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} {props.isRebuildingSummaries ? 'Procesando año' : `Resumir ${filterYear}`}</button>}</div>
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><TrendingUp size={16} className="text-green-500" /> Eficiencia Operativa (%)</h4><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={biMetrics.dataYoY}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{
              fontSize: 10,
              fill: '#64748b'
            }} /><YAxis domain={[0, 100]} hide /><Tooltip contentStyle={{
              backgroundColor: '#0B1120',
              border: '1px solid #1f2937',
              borderRadius: '8px',
              color: '#fff'
            }} /><Legend iconType="circle" wrapperStyle={{
              fontSize: '10px'
            }} /><Line type="monotone" name={`Año ${biMetrics.yPrev}`} dataKey={`ef${biMetrics.yPrev}`} stroke="#64748b" strokeWidth={2} dot={false} /><Line type="monotone" name={`Año ${biMetrics.yCurrent}`} dataKey={`ef${biMetrics.yCurrent}`} stroke="#10b981" strokeWidth={4} connectNulls={true} /></LineChart></ResponsiveContainer></div></div>
                       <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><Fuel size={16} className="text-orange-500" /> Inversión Combustible ($)</h4><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={biMetrics.dataYoY}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{
              fontSize: 10,
              fill: '#64748b'
            }} /><Tooltip cursor={{
              fill: '#1f2937'
            }} contentStyle={{
              backgroundColor: '#0B1120',
              border: '1px solid #1f2937',
              borderRadius: '8px',
              color: '#fff'
            }} /><Legend iconType="circle" wrapperStyle={{
              fontSize: '10px'
            }} /><Bar name={`Año ${biMetrics.yPrev}`} dataKey={`fuel${biMetrics.yPrev}`} fill="#64748b" radius={[4, 4, 0, 0]} /><Bar name={`Año ${biMetrics.yCurrent}`} dataKey={`fuel${biMetrics.yCurrent}`} fill="#f97316" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
                       <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800 shadow-xl lg:col-span-2"><h4 className="font-bold text-slate-300 text-xs uppercase mb-6 flex items-center gap-2"><Wrench size={16} className="text-yellow-500" /> Costos de Mantenimiento Taller ($)</h4><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={biMetrics.dataYoY}><CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{
              fontSize: 10,
              fill: '#64748b'
            }} /><Tooltip cursor={{
              fill: '#1f2937'
            }} contentStyle={{
              backgroundColor: '#0B1120',
              border: '1px solid #1f2937',
              borderRadius: '8px',
              color: '#fff'
            }} /><Legend iconType="circle" wrapperStyle={{
              fontSize: '10px'
            }} /><Bar name={`Año ${biMetrics.yPrev}`} dataKey={`maint${biMetrics.yPrev}`} fill="#64748b" radius={[4, 4, 0, 0]} /><Bar name={`Año ${biMetrics.yCurrent}`} dataKey={`maint${biMetrics.yCurrent}`} fill="#eab308" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
                   </div>
                </div>
  );
}
