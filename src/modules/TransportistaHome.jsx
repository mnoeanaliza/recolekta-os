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

export default function TransportistaHome(props) {
  const { SmallGauge, abrirMapaDeRuta, activeInput, activeUserCountry, adminDashboardMetrics, adminSection, agendaData, alertasData, appMode, availableYears, avisoForm, biMetrics, catalogCountry, catalogs, checkDate, compressImage, convertToMinutes, csvData, currentPage, currentUser, cycleCategory, dataSource, dismissAlert, downloadReport, editFormData, editingItem, exportPayrollCSV, exportToCSV, extractDateInfo, filterMonth, filterSpecificDate, filterSucursal, filterUser, filterUserTableZone, filterYear, filterZona, fleetMetrics, form, fuelData, gamificationStats, getMetaEspera, getUserCountry, getUserZone, getWait, gpsLocation, handleAddCatalogItem, handleAssignCategory, handleAssignZone, handleDelete, handleEditFormChange, handleFile, handleInput, handleMotoPhotoUpload, handleProfilePhotoUpload, handleRemoveCatalogItem, handleSaveConfig, handleStartOperation, handleSyncToCloud, handleUpdate, hiddenAlerts, hrMetrics, imageFile, imagePreview, isCompressing, isFetchingHistory, isGettingGps, isOperating, isUploading, isUserInFilterZone, itemsPerPage, liveData, liveWaitMins, logout, maintData, mapaModalData, metrics, newCatalogItems, openEditModal, operationStartTime, otData, perfilesUsuarios, previousGps, queryLimit, regionalMetrics, resumenesMensualesNube, selectedAdminProfile, setActiveInput, setAdminSection, setAgendaData, setAlertasData, setAppMode, setAvisoForm, setCatalogCountry, setCatalogs, setCsvData, setCurrentPage, setDataSource, setEditFormData, setEditingItem, setFilterMonth, setFilterSpecificDate, setFilterSucursal, setFilterUser, setFilterUserTableZone, setFilterYear, setFilterZona, setForm, setFuelData, setGpsLocation, setHiddenAlerts, setImageFile, setImagePreview, setIsCompressing, setIsFetchingHistory, setIsGettingGps, setIsOperating, setIsUploading, setLiveData, setLiveWaitMins, setMaintData, setMapaModalData, setNewCatalogItems, setOperationStartTime, setOtData, setPerfilesUsuarios, setPreviousGps, setQueryLimit, setResumenesMensualesNube, setSelectedAdminProfile, setShowAvisoModal, setShowWelcome, setSupervisorSection, setSysConfig, setTransitTimeMins, setUserProfile, setUserView, setViewingPhoto, showAvisoModal, showWelcome, supervisorSection, sysConfig, transitTimeMins, transportistaOtData, userAlerts, userMetrics, userProfile, userView, viewingPhoto } = props;

  return (
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
              <div className="lg:col-span-2">
              {userAlerts.length > 0 &&
    <div className="mb-6 space-y-3 animate-in slide-in-from-top-4">
                      {userAlerts.map((alerta, idx) =>
      <div key={idx} className={cn("p-4 rounded-xl flex flex-col gap-3 shadow-lg border", alerta.type === 'kpi_danger' ? "bg-red-900/50 border-red-500 text-white" : alerta.type === 'turno' ? "bg-purple-900/30 border-purple-500 text-purple-200" : alerta.type === 'maint' ? "bg-yellow-900/30 border-yellow-500 text-yellow-200" : alerta.tipo === 'confirm' ? "bg-red-900/30 border-red-500 text-red-200" : "bg-blue-900/30 border-blue-500 text-blue-200")}>
                              <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className={cn("p-2 rounded-lg shrink-0", alerta.type === 'kpi_danger' ? "bg-red-600 text-white" : "bg-black/30")}>{alerta.type === 'turno' ? <Clock size={20} className="text-purple-400" /> : alerta.type === 'maint' || alerta.type === 'kpi_danger' ? <Wrench size={20} className={alerta.type === 'kpi_danger' ? "" : "text-yellow-400"} /> : <Bell size={20} className={alerta.tipo === 'confirm' ? "text-red-400" : "text-blue-400"} />}</div><div><h4 className="font-black uppercase text-xs opacity-80 mb-0.5">{alerta.title}</h4><p className="text-sm font-bold leading-tight">{alerta.msg}</p></div></div>{alerta.tipo !== 'confirm' && <button onClick={(e) => {e.preventDefault();dismissAlert(alerta);}} className="text-slate-400 hover:text-white shrink-0"><X size={18} /></button>}</div>
                              {alerta.tipo === 'confirm' && <div className="flex gap-2 justify-end mt-1 border-t border-white/10 pt-3"><button onClick={(e) => {e.preventDefault();dismissAlert(alerta, 'Enterado');}} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-[10px] shadow-md uppercase transition-all">Enterado</button><button onClick={(e) => {e.preventDefault();dismissAlert(alerta, 'En camino');}} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold text-[10px] shadow-md uppercase transition-all">En camino</button><button onClick={(e) => {e.preventDefault();dismissAlert(alerta, 'Listo');}} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-[10px] shadow-md uppercase transition-all flex items-center gap-1"><Check size={12} /> Listo</button></div>}
                          </div>
      )}
                  </div>
    }
              <div className="flex gap-2 mb-6 p-1 bg-[#151F32] rounded-xl w-full border border-slate-800 overflow-x-auto md:flex-wrap md:overflow-visible custom-scrollbar">
                 <button onClick={() => setUserView('ruta')} className={cn("shrink-0 px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", userView === 'ruta' ? "bg-green-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Bike size={16} /> Ruta</button>
                 <button onClick={() => setUserView('combustible')} className={cn("shrink-0 px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", userView === 'combustible' ? "bg-orange-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Fuel size={16} /> Combustible</button>
                 <button onClick={() => setUserView('agenda')} className={cn("shrink-0 px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", userView === 'agenda' || userView === 'mantenimiento' ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Calendar size={16} /> Horarios</button>
                 <button onClick={() => setUserView('extras')} className={cn("shrink-0 px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", userView === 'extras' ? "bg-purple-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Clock size={16} /> H. Extra</button>
                 <button onClick={() => setUserView('perfil')} className={cn("shrink-0 px-6 py-3 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2", userView === 'perfil' ? "bg-pink-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}><Award size={16} /> Mi Perfil</button>
              </div>

              {userView === 'ruta' ?
    <div className="bg-[#151F32] p-6 md:p-10 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-500 to-emerald-400"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-slate-800 pb-4">
                        <h2 className="text-xl font-black flex items-center gap-3 text-white"><ClipboardList className="text-green-500" /> Registro de Ruta</h2>
                        {/* 🔥 SELECTOR INTELIGENTE DE ESTATUS */}
                        <div className="flex items-center gap-2 bg-[#0B1120] p-1.5 rounded-xl border border-slate-700 shadow-inner">
                            <div className={cn("w-2.5 h-2.5 rounded-full ml-2", userProfile.estatus === 'Standby' ? "bg-green-500 animate-pulse" : userProfile.estatus === 'En Ruta' ? "bg-blue-500" : "bg-slate-500")}></div>
                            <select
            value={userProfile.estatus || 'Inactivo'}
            onChange={async (e) => await setDoc(doc(db, "usuarios_perfiles", currentUser.email), { estatus: e.target.value }, { merge: true })}
            className={cn("bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer pr-2", userProfile.estatus === 'Standby' ? "text-green-400" : userProfile.estatus === 'En Ruta' ? "text-blue-400" : "text-slate-500")}>

                                <option value="Inactivo" className="bg-slate-900 text-slate-400">⚫ OFFLINE / FIN DE TURNO</option>
                                <option value="Esperando Asignacion de Ruta" className="bg-slate-900 text-green-400">🟢 DISPONIBLE (SEDE)</option>
                                <option value="En Ruta" className="bg-slate-900 text-blue-400">🔵 EN RUTA</option>
                                <option value="Almuerzo" className="bg-slate-900 text-yellow-400">🟡 HORA DE ALMUERZO</option>
                            </select>
                        </div>
                    </div>
                    <form onSubmit={async (e) => {
        e.preventDefault();
        if (!isOperating) return alert("Debes INICIAR LA OPERACIÓN primero.");
        if (!imageFile) return alert("FOTO REQUERIDA PARA FINALIZAR");
        if (!(catalogs.transportistas[activeUserCountry] || catalogs.transportistas || []).includes(form.recolector)) return alert("TRANSPORTISTA NO VÁLIDO");

        // 🟢 CANDADO 2: Doble verificación antes de guardar en la base de datos
        const sucursalesValidas = catalogs.sucursales[activeUserCountry] || [];
        if (!sucursalesValidas.includes(form.sucursal)) {
          return alert("⚠️ ERROR: La sucursal fue alterada y no es válida. Selecciona una de la lista.");
        }
        setIsUploading(true);
        try {
          const now = new Date();
          let h = now.getHours();let m = String(now.getMinutes()).padStart(2, '0');let p = h >= 12 ? 'PM' : 'AM';
          h = h % 12;h = h ? h : 12;h = String(h).padStart(2, '0');
          const finalForm = { ...form, hSalida: h, mSalida: m, pSalida: p };
          const storageRef = ref(storage, `evidencias/${Date.now()}_${form.recolector.replace(/\s+/g, '_')}`);
          await uploadBytes(storageRef, imageFile);
          const photoURL = await getDownloadURL(storageRef);
          const isP = PRINCIPAL_KEYWORDS.some((k) => form.tipo.toLowerCase().includes(k));
          const safeTransit = isNaN(Number(transitTimeMins)) || transitTimeMins === null ? 0 : Number(transitTimeMins);
          const safeWait = isNaN(Number(liveWaitMins)) || liveWaitMins === null ? 0 : Number(liveWaitMins);
          await addDoc(collection(db, "registros_produccion"), {
            ...finalForm,
            tiempo: safeWait,
            tiempoTransito: safeTransit,
            createdAt: new Date().toISOString(),
            categoria: isP ? "Principal" : "Secundaria",
            fotoData: photoURL || '',
            month: new Date().getMonth() + 1,
            usuarioEmail: currentUser.email || '',
            ubicacion: gpsLocation || 'Sin GPS',
            ubicacionAnterior: previousGps || null
          });
          alert("¡Operación y Recorrido Registrados Exitosamente! ✅");
          //await setDoc(doc(db, "usuarios_perfiles", currentUser.email), { estatusLive: "DISPONIBLE", ultimaActividad: new Date().toISOString() }, { merge: true }).catch(()=>{});
          setForm((prev) => ({ ...prev, sucursal: '', observaciones: '' }));
          setImagePreview(null);setImageFile(null);setIsOperating(false);setOperationStartTime(null);setLiveWaitMins(0);setGpsLocation(null);setTransitTimeMins(0);setPreviousGps(null);
        } catch (e) {console.error(e);alert("Error de conexión al enviar.");} finally {setIsUploading(false);}
      }} className="space-y-5">
                      <div className="relative"><label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Responsable</label><div className="relative"><input type="text" className={cn("w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase text-slate-400 cursor-not-allowed")} value={form.recolector} disabled /><User size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" /></div></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><select className="p-4 bg-[#0B1120] rounded-2xl font-bold outline-none border-2 border-slate-800 focus:border-blue-500 text-slate-300" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} disabled={isOperating} required><option value="">-- DILIGENCIA --</option>{(catalogs.diligencias[activeUserCountry] || catalogs.diligencias || []).map((d) => <option key={d} value={d}>{d}</option>)}</select><select className="p-4 bg-[#0B1120] rounded-2xl font-bold outline-none border-2 border-slate-800 focus:border-indigo-500 text-slate-300" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} disabled={isOperating} required><option value="">-- ÁREA --</option>{(catalogs.areas[activeUserCountry] || catalogs.areas || []).map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
                      <div className="relative" onClick={(e) => e.stopPropagation()}><input type="text" placeholder="SUCURSAL A LA QUE LLEGASTE..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase focus:border-blue-500 outline-none text-white placeholder-slate-600" value={form.sucursal} onChange={(e) => handleInput('sucursal', e.target.value)} onFocus={() => setActiveInput('sucursal')} disabled={isOperating} required />{activeInput === 'sucursal' && form.sucursal.length > 0 && !isOperating && <div className="absolute z-30 w-full mt-2 bg-[#1F2937] shadow-xl rounded-xl border border-slate-700 max-h-40 overflow-y-auto">{(catalogs.sucursales[activeUserCountry] || catalogs.sucursales || []).filter((t) => t && typeof t === 'string' && t.toUpperCase().includes(form.sucursal.toUpperCase())).map((s) => <div key={s} onClick={() => {setForm({ ...form, sucursal: s });setActiveInput(null);}} className="p-3 hover:bg-slate-700 cursor-pointer text-xs font-bold border-b border-slate-800 text-slate-300">{s}</div>)}</div>}</div>
                      <div className="bg-[#0B1120] p-6 rounded-[2rem] text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-inner border border-slate-800">
                          {!isOperating ?
          <button type="button" onClick={handleStartOperation} disabled={isGettingGps} className="w-full sm:w-auto flex-1 py-4 bg-green-600 hover:bg-green-500 rounded-xl font-black uppercase text-sm shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2">
                                  {isGettingGps ? <Loader2 className="animate-spin" size={20} /> : <MapPin size={20} />}
                                  {isGettingGps ? 'OBTENIENDO GPS...' : 'INICIAR OPERACIÓN'}
                              </button> :

          <div className="w-full sm:w-auto flex-1 py-4 bg-blue-900/20 border border-blue-500/50 rounded-xl font-black uppercase text-sm text-blue-400 flex items-center justify-center gap-2">
                                  <Clock className="animate-pulse" size={20} /> OPERACIÓN EN CURSO...
                              </div>
          }
                          <div className="text-center sm:border-l border-slate-800 sm:pl-6 flex flex-col justify-center min-w-[120px]">
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Minutos de Espera</p>
                              <h4 className={cn("text-5xl font-black tabular-nums transition-colors duration-500", liveWaitMins > 5 ? "text-orange-400" : "text-green-400")}>
                                  {Math.floor(liveWaitMins)}m
                              </h4>
                          </div>
                      </div>
                      <textarea placeholder="OBSERVACIONES..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold uppercase focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600 resize-none h-24" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} disabled={!isOperating && form.recolector !== ''} />
                      <div className="grid grid-cols-2 gap-4">
                          <label className={cn("col-span-1 p-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all font-bold uppercase text-[9px]", isOperating ? "bg-[#151F32] border-blue-500 text-blue-400 cursor-pointer hover:bg-blue-900/20" : "bg-[#0B1120] border-slate-700 text-slate-600 cursor-not-allowed")}>
                              <Camera size={24} /><p>{imageFile ? 'FOTO LISTA' : 'TOMA FOTO TESTIGO'}</p><input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFile} disabled={!isOperating} />
                          </label>
                          <button type="button" onClick={() => downloadReport()} className="col-span-1 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-xs text-slate-300 uppercase flex flex-col items-center justify-center gap-2 hover:bg-slate-700 transition-all"><Download size={24} />Mi Reporte Hoy</button>
                      </div>
                      <button type="submit" disabled={!isOperating || !imagePreview || isUploading || isCompressing} className={cn("w-full py-5 rounded-2xl font-black text-sm shadow-xl transition-all uppercase flex items-center justify-center gap-2", isOperating && imagePreview && !isUploading && !isCompressing ? "bg-red-600 text-white hover:bg-red-500 hover:shadow-red-900/30 hover:-translate-y-1" : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700")}>
                          {isCompressing ? <Loader2 className="animate-spin" size={20} /> : isUploading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                          {isCompressing ? 'PROCESANDO FOTO...' : isUploading ? 'ENVIANDO...' : 'FINALIZAR Y ENVIAR'}
                      </button>
                    </form>
                 </div> :
    userView === 'combustible' ? <FuelModule currentUser={currentUser} sysConfig={sysConfig} /> : userView === 'extras' ? <OvertimeModule currentUser={currentUser} history={transportistaOtData} sysConfig={sysConfig} /> : userView === 'mantenimiento' ? <MaintenanceModule currentUser={currentUser} onBack={() => setUserView('agenda')} sysConfig={sysConfig} /> : userView === 'perfil' ?
    <div className="bg-[#151F32] p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-rose-400"></div>
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-8 border-b border-slate-800 pb-8">
                        <div className="flex gap-4">
                            <div className="relative group"><div className="w-28 h-28 rounded-full border-4 border-slate-700 overflow-hidden bg-[#0B1120] flex items-center justify-center shadow-2xl">{userProfile.foto ? <img src={userProfile.foto} alt="Perfil" className="w-full h-full object-cover" /> : <User size={48} className="text-slate-500" />}</div><label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><UploadCloud size={20} className="text-white mb-1" /><span className="text-[8px] font-black uppercase text-white tracking-widest text-center leading-tight">Subir<br />Perfil</span><input type="file" className="hidden" accept="image/*" onChange={handleProfilePhotoUpload} /></label></div>
                            <div className="relative group"><div className="w-28 h-28 rounded-2xl border-4 border-slate-700 overflow-hidden bg-[#0B1120] flex items-center justify-center shadow-2xl">{userProfile.fotoMoto ? <img src={userProfile.fotoMoto} alt="Moto" className="w-full h-full object-cover" /> : <Bike size={48} className="text-slate-500" />}</div><label className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Camera size={20} className="text-white mb-1" /><span className="text-[8px] font-black uppercase text-white tracking-widest text-center leading-tight">Subir<br />Moto</span><input type="file" className="hidden" accept="image/*" onChange={handleMotoPhotoUpload} /></label></div>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-1">{form.recolector}</h2><p className="text-xs font-bold text-slate-500 mb-2">{currentUser.email}</p>
                            <div className="flex items-center gap-2 justify-center md:justify-start">
                                <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 shadow-lg", userProfile.categoria === 'Coordinador' ? "bg-yellow-900/40 border-yellow-500 text-yellow-400" : userProfile.categoria === 'Técnico' ? "bg-slate-700/50 border-slate-400 text-slate-300" : "bg-orange-900/40 border-orange-600 text-orange-400")}>{userProfile.categoria === 'Coordinador' ? <Award size={20} /> : userProfile.categoria === 'Técnico' ? <ShieldCheck size={20} /> : <Star size={20} />}<span className="font-black uppercase text-xs tracking-widest">{userProfile.categoria || 'Operador'}</span></div>
                                <div className="bg-indigo-900/50 border border-indigo-600 text-indigo-400 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2"><Map size={16} /><span className="font-black uppercase text-xs tracking-widest">{userProfile.zona || 'Sin Asignar'}</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* GRÁFICA DE PASTEL (Izquierda) */}
                        <div className="bg-[#0B1120] rounded-[2rem] p-6 border border-slate-700 shadow-inner flex flex-col items-center justify-center relative">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest absolute top-6">Eficiencia del Mes</h4>
                            <div className="mt-8 -mb-10 w-full flex justify-center">
                                <PieChart width={220} height={120}>
                                    <Pie data={[{ value: gamificationStats.eficiencia, fill: gamificationStats.eficiencia >= 95 ? '#10b981' : gamificationStats.eficiencia >= 80 ? '#f59e0b' : '#ef4444' }, { value: 100 - gamificationStats.eficiencia, fill: '#1f2937' }]} cx={110} cy={110} startAngle={180} endAngle={0} innerRadius={80} outerRadius={110} dataKey="value" stroke="none" />
                                </PieChart>
                            </div>
                            <div className="text-center z-10">
                                <span className={cn("text-5xl font-black", gamificationStats.eficiencia >= 95 ? "text-green-400" : gamificationStats.eficiencia >= 80 ? "text-yellow-400" : "text-red-400")}>{gamificationStats.eficiencia}%</span>
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Tu Meta es 95%</p>
                            </div>
                        </div>

                        {/* LAS 3 TARJETAS (Derecha) */}
                        <div className="space-y-4">
                            {/* 🔥 1. HORAS EXTRAS (CORTE OFICIAL) 🔥 */}
                            <div className="bg-purple-900/20 border border-purple-800/40 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-purple-600 rounded-xl text-white shadow-lg"><Clock size={20} /></div>
                                    <div>
                                        <h4 className="text-[10px] font-black text-purple-400 uppercase">Horas Extras (Corte)</h4>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                                            {sysConfig.heInicio ? `${formatLocalDate(sysConfig.heInicio)} al ${formatLocalDate(sysConfig.heFin)}` : 'Sin fechas definidas'}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-2xl font-black text-white">{gamificationStats.totalOT}h</span>
                            </div>

                            {/* 🔥 2. TOTAL VIAJES 🔥 */}
                            <div className="bg-blue-900/20 border border-blue-800/40 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3"><div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg"><Target size={20} /></div><div><h4 className="text-[10px] font-black text-blue-400 uppercase">Total Viajes (Mes)</h4><p className="text-xs text-slate-300 font-bold">Recolecciones y Entregas</p></div></div>
                                <span className="text-2xl font-black text-white">{gamificationStats.totalOps}</span>
                            </div>
                            {/* 🔥 3. META DE SECUNDARIAS 🔥 */}
                            <div className="bg-indigo-900/20 border border-indigo-800/40 p-4 rounded-2xl">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3"><div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg"><ListChecks size={16} /></div><div><h4 className="text-[10px] font-black text-indigo-400 uppercase">Meta Secundarias</h4><p className="text-[9px] text-slate-400 font-bold uppercase">Mínimo {sysConfig.metaSecundarias || 60} al mes</p></div></div>
                                    <span className="text-xl font-black text-white">
                                        {gamificationStats.totalSecundarias || 0}
                                        <span className="text-sm text-slate-500"> / {sysConfig.metaSecundarias || 60}</span>
                                    </span>
                                </div>
                                <div className="w-full bg-slate-900 rounded-full h-2.5 border border-slate-700 overflow-hidden">
                                    <div className={cn("h-2.5 rounded-full transition-all duration-1000", (gamificationStats.totalSecundarias || 0) >= Number(sysConfig.metaSecundarias || 60) ? "bg-green-500" : "bg-indigo-500")} style={{ width: `${Math.min((gamificationStats.totalSecundarias || 0) / Number(sysConfig.metaSecundarias || 60) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div> :
    <div className="space-y-4"><button onClick={() => setUserView('mantenimiento')} className="w-full bg-yellow-600/90 border-b-4 border-yellow-800 text-white py-4 rounded-2xl font-black uppercase shadow-xl hover:bg-yellow-500 transition-all flex items-center justify-center gap-3"><div className="bg-black/20 p-2 rounded-full"><Wrench size={20} /></div><span>Registrar Mantenimiento</span></button><ScheduleModule
        currentUser={currentUser}
        userName={form.recolector || perfilesUsuarios[currentUser?.email]?.nombre?.toUpperCase() || USUARIOS_EMAIL[currentUser?.email] || currentUser?.email} />
    </div>}
              </div>
              <div className="space-y-6">
                 <div className="bg-[#151F32] p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">{userMetrics.label === 'HOY (GLOBAL)' ? 'EFICIENCIA DIARIA (HOY)' : `EFICIENCIA: ${userMetrics.label}`}</p>
                    <h4 className="text-6xl font-black text-green-400 mb-2 leading-none">{userMetrics.ef}%</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase italic">{userMetrics.count > 0 ? `Basado en ${userMetrics.count} Registros de Hoy` : 'Esperando datos del día...'}</p>
                    <TrendingUp className="absolute -right-6 -bottom-6 text-slate-800 opacity-50" size={180} />
                 </div>
              </div>
           </div>
  );
}
