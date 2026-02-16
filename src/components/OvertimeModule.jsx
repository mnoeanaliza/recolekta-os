import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Clock, Save, Loader2, Calendar, Briefcase, History } from 'lucide-react';

export default function OvertimeModule({ currentUser, history = [] }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0], 
    horarioTurno: '06:00 AM - 04:00 PM', 
    horaInicio: '16:00', 
    horaFin: '18:30',
    motivo: ''
  });
  const [totalHoras, setTotalHoras] = useState(0);

  // --- LÓGICA DE CORTES DE PLANILLA (5-20 y 21-4) ---
  const currentPeriod = useMemo(() => {
      const today = new Date();
      const day = today.getDate();
      const month = today.getMonth();
      const year = today.getFullYear();

      let startDate, endDate, periodName;

      // Si estamos entre el 5 y el 20 del mes actual
      if (day >= 5 && day <= 20) {
          startDate = new Date(year, month, 5);
          endDate = new Date(year, month, 20);
          periodName = "Quincena Actual (5 al 20)";
      } 
      // Si estamos entre el 21 y fin de mes (o inicio del siguiente hasta el 4)
      else {
          if (day >= 21) {
              // Estamos a fin de mes (ej: 25 de Feb) -> Corte es 21 Feb al 4 Mar
              startDate = new Date(year, month, 21);
              endDate = new Date(year, month + 1, 4);
          } else {
              // Estamos a inicio de mes (ej: 2 de Mar) -> Corte es 21 Feb al 4 Mar
              startDate = new Date(year, month - 1, 21);
              endDate = new Date(year, month, 4);
          }
          periodName = "Cierre de Mes (21 al 4)";
      }
      return { startDate, endDate, periodName };
  }, []);

  // Filtrar el historial según el periodo calculado
  const periodHistory = useMemo(() => {
      return history.filter(r => {
          const recDate = new Date(r.fecha);
          // Ajustamos horas para evitar problemas de zona horaria al comparar solo fechas
          recDate.setHours(12,0,0,0); 
          const start = new Date(currentPeriod.startDate); start.setHours(0,0,0,0);
          const end = new Date(currentPeriod.endDate); end.setHours(23,59,59,999);
          
          return recDate >= start && recDate <= end;
      });
  }, [history, currentPeriod]);

  const totalPeriodo = periodHistory.reduce((acc, curr) => acc + parseFloat(curr.horasCalculadas || 0), 0);

  useEffect(() => {
    const start = new Date(`2000-01-01T${formData.horaInicio}`);
    const end = new Date(`2000-01-01T${formData.horaFin}`);
    if (end < start) end.setDate(end.getDate() + 1);
    const diffMs = end - start;
    const diffHrs = diffMs / (1000 * 60 * 60);
    setTotalHoras(diffHrs.toFixed(2));
  }, [formData.horaInicio, formData.horaFin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalHoras <= 0) return alert("Revisa las horas.");
    setLoading(true);
    try {
      await addDoc(collection(db, "registros_horas_extras"), {
        ...formData,
        horasCalculadas: parseFloat(totalHoras),
        usuario: currentUser.email,
        createdAt: new Date().toISOString(),
        mes: new Date().getMonth() + 1,
        estado: 'Pendiente'
      });
      alert("⏱️ Enviado correctamente.");
      setFormData(prev => ({ ...prev, motivo: '' })); 
    } catch (error) {
      console.error(error);
      alert("Error al registrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300 pb-20">
      
      {/* FORMULARIO */}
      <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 to-pink-500"></div>
        <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-white">
          <Clock className="text-purple-500"/> Reporte Horas Extras
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                 <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Fecha</label>
                 <input type="date" required className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-purple-500"
                    value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
             </div>
             <div>
                 <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Tu Horario Normal</label>
                 <div className="relative">
                    <input type="text" placeholder="Ej: 6:00 AM - 4:00 PM" required className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-purple-500"
                        value={formData.horarioTurno} onChange={e => setFormData({...formData, horarioTurno: e.target.value})} />
                    <Briefcase className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                 </div>
             </div>
          </div>

          <div className="bg-[#0B1120] p-4 rounded-2xl border border-slate-800">
             <p className="text-[10px] text-purple-400 font-bold uppercase mb-2 text-center">Horario de Horas Extras</p>
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[9px] text-slate-500 block mb-1 ml-2">INICIO HE</label>
                    <input type="time" required className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl font-bold text-white text-center"
                        value={formData.horaInicio} onChange={e => setFormData({...formData, horaInicio: e.target.value})} />
                </div>
                <div>
                    <label className="text-[9px] text-slate-500 block mb-1 ml-2">FIN HE</label>
                    <input type="time" required className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl font-bold text-white text-center"
                        value={formData.horaFin} onChange={e => setFormData({...formData, horaFin: e.target.value})} />
                </div>
             </div>
             <div className="mt-3 text-center">
                 <span className="text-xs text-slate-400">Total a pagar: </span>
                 <span className="text-lg font-black text-white">{totalHoras} hrs</span>
             </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Actividad Realizada</label>
            <textarea placeholder="Ej: Revisión de rutas extraordinarias..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white h-24 focus:border-purple-500 outline-none resize-none"
                value={formData.motivo} onChange={e => setFormData({...formData, motivo: e.target.value})} required/>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black uppercase text-sm shadow-lg hover:bg-purple-700 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin"/> : <Save size={18}/>}
            {loading ? 'Enviando...' : 'Registrar en Planilla'}
          </button>
        </form>
      </div>

      {/* HISTORIAL DEL PERIODO ACTUAL */}
      <div className="bg-[#151F32] p-6 rounded-[2rem] border border-slate-800">
          <div className="flex justify-between items-center mb-4">
              <div>
                  <h3 className="font-black text-white flex items-center gap-2"><History size={18} className="text-purple-500"/> Mi Planilla Actual</h3>
                  <p className="text-[10px] text-slate-400 uppercase mt-1">{currentPeriod.periodName}</p>
              </div>
              <div className="bg-purple-900/30 px-4 py-2 rounded-xl text-purple-300 font-black text-xl border border-purple-900">
                  {totalPeriodo.toFixed(2)}h
              </div>
          </div>

          <div className="overflow-hidden">
              <table className="w-full text-left">
                  <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg">
                      <tr><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Horas</th><th className="px-4 py-2">Actividad</th></tr>
                  </thead>
                  <tbody className="text-xs text-slate-400 divide-y divide-slate-800">
                      {periodHistory.length > 0 ? periodHistory.map((r, i) => (
                          <tr key={i}>
                              <td className="px-4 py-2">{new Date(r.fecha).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})}</td>
                              <td className="px-4 py-2 text-white font-bold">{r.horasCalculadas}h</td>
                              <td className="px-4 py-2 truncate max-w-[150px]">{r.motivo}</td>
                          </tr>
                      )) : (
                          <tr><td colSpan="3" className="px-4 py-4 text-center text-slate-600 italic">No tienes horas en este corte.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}