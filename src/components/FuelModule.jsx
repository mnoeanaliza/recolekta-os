import React, { useState } from 'react';
import { db, storage } from '../config/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Fuel, Camera, Save, Loader2, DollarSign, Gauge } from 'lucide-react';

export default function FuelModule({ currentUser }) {
  const [loading, setLoading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [form, setForm] = useState({
    galones: '',
    costo: '',
    kilometraje: '',
    full: 'No',
    foto: null
  });
  const [preview, setPreview] = useState(null);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProcessingImage(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
          setForm(prev => ({ ...prev, foto: compressedFile }));
          setPreview(URL.createObjectURL(blob));
          setProcessingImage(false);
        }, 'image/jpeg', 0.7);
      };
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.foto) return alert("📸 La foto es obligatoria.");
    
    setLoading(true);
    try {
      // Subir Foto
      const storageRef = ref(storage, `combustible/${Date.now()}_${currentUser.email}`);
      await uploadBytes(storageRef, form.foto);
      const url = await getDownloadURL(storageRef);

      // Guardar en Firestore
      await addDoc(collection(db, "registros_combustible"), {
        usuario: currentUser.email,
        galones: parseFloat(form.galones),
        costo: parseFloat(form.costo), // Total pagado
        kilometraje: parseInt(form.kilometraje),
        full: form.full,
        foto: url,
        fecha: new Date().toISOString(),
        mes: new Date().getMonth() + 1
      });

      alert("⛽ Carga registrada con éxito.");
      setForm({ galones: '', costo: '', kilometraje: '', full: 'No', foto: null });
      setPreview(null);
    } catch (error) {
      console.error("Error al subir:", error);
      alert("Error al subir. Revisa tu conexión o permisos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in duration-300">
      <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-red-500"></div>
        <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-white">
          <Fuel className="text-orange-500"/> Registro Combustible
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
             <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Galones</label>
                <div className="relative">
                    <input type="number" step="0.01" required placeholder="0.00" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-orange-500 pl-10"
                        value={form.galones} onChange={e => setForm({...form, galones: e.target.value})} />
                    <Fuel className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                </div>
             </div>
             <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Total Pagado ($)</label>
                <div className="relative">
                    <input type="number" step="0.01" required placeholder="$0.00" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-green-500 pl-10"
                        value={form.costo} onChange={e => setForm({...form, costo: e.target.value})} />
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500" size={18}/>
                </div>
             </div>
          </div>

          <div className="relative">
             <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Kilometraje Actual</label>
             <div className="relative">
                <input type="number" required placeholder="000000" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-blue-500 pl-10"
                    value={form.kilometraje} onChange={e => setForm({...form, kilometraje: e.target.value})} />
                <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={18}/>
             </div>
          </div>

          <div className="flex items-center gap-3 bg-[#0B1120] p-4 rounded-2xl border border-slate-800">
             <input type="checkbox" className="w-5 h-5 accent-orange-500" checked={form.full === 'Si'} onChange={e => setForm({...form, full: e.target.checked ? 'Si' : 'No'})} />
             <span className="text-sm font-bold text-slate-300">¿Se llenó el tanque (Full)?</span>
          </div>

          {preview && (
            <div className="w-full h-40 rounded-xl overflow-hidden border-2 border-orange-500 relative bg-black">
               <img src={preview} className="w-full h-full object-contain" alt="Ticket" />
            </div>
          )}

          <label className={`w-full p-4 bg-[#0B1120] border-2 border-dashed ${preview ? 'border-green-500' : 'border-slate-700'} rounded-2xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-800 transition-all text-slate-400 font-bold uppercase text-xs`}>
             {processingImage ? <Loader2 className="animate-spin text-orange-500"/> : <Camera size={18}/>}
             {processingImage ? 'Procesando imagen...' : (preview ? 'Cambiar Foto' : 'Foto Ticket / Bomba')}
             <input type="file" accept="image/*" className="hidden" onChange={handleImage} disabled={processingImage} />
          </label>

          <button type="submit" disabled={loading || processingImage || !form.foto} className={`w-full py-4 rounded-2xl font-black uppercase text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${loading || processingImage || !form.foto ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-500'}`}>
            {loading ? <Loader2 className="animate-spin"/> : <Save size={18}/>}
            {loading ? 'Subiendo...' : 'Registrar Carga'}
          </button>
        </form>
      </div>
    </div>
  );
}