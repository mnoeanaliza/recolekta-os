import React, { useState } from 'react';
import { db, storage } from '../config/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Wrench, Camera, Loader2, CheckCircle2, DollarSign, Gauge, ArrowLeft } from 'lucide-react';

export default function MaintenanceModule({ currentUser, onBack }) {
  const [loading, setLoading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [formData, setFormData] = useState({
    anio: '',
    kilometraje: '',
    tipo: 'Preventivo',
    descripcion: '',
    costo: '',
    taller: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProcessingImage(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          setImageFile(new File([blob], file.name, { type: 'image/jpeg' }));
          setPreview(URL.createObjectURL(blob));
          setProcessingImage(false);
        }, 'image/jpeg', 0.7);
      };
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) return alert("📸 La foto es obligatoria.");
    setLoading(true);
    try {
      const storageRef = ref(storage, `mantenimientos/${Date.now()}_${currentUser.email}`);
      await uploadBytes(storageRef, imageFile);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, "registros_mantenimiento"), {
        ...formData,
        fecha: new Date().toISOString(),
        usuario: currentUser.email,
        foto: url,
        mes: new Date().getMonth() + 1
      });

      alert("🔧 Mantenimiento registrado correctamente.");
      setFormData({ anio: '', kilometraje: '', tipo: 'Preventivo', descripcion: '', costo: '', taller: '' });
      setPreview(null);
      setImageFile(null);
      if (onBack) onBack(); 
    } catch (error) {
      console.error(error);
      alert("Error al guardar. Revisa tu conexión o permisos de Storage.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in duration-300">
      <div className="bg-[#151F32] p-6 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-500 to-orange-500"></div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black flex items-center gap-3 text-white">
            <Wrench className="text-yellow-500"/> Taller
            </h2>
            {onBack && (<button onClick={onBack} className="bg-slate-800 p-2 rounded-full text-slate-400 hover:text-white transition-all"><ArrowLeft size={18} /></button>)}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Año Moto</label>
                <input type="number" required placeholder="202X" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-yellow-500 text-center"
                    value={formData.anio} onChange={e => setFormData({...formData, anio: e.target.value})} />
            </div>
            <div>
                <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">KMS</label>
                <div className="relative">
                    <input type="number" required placeholder="00000" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-yellow-500 pl-8"
                        value={formData.kilometraje} onChange={e => setFormData({...formData, kilometraje: e.target.value})} />
                    <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Tipo</label>
                <select className="w-full p-4 bg-[#0B1120] rounded-2xl font-bold text-white outline-none border-2 border-slate-800 focus:border-yellow-500" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                    <option>Preventivo</option>
                    <option>Correctivo</option>
                    <option>Llantas/Frenos</option>
                    <option>Batería/Elec.</option>
                </select>
             </div>
             <div>
                <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Taller</label>
                <input type="text" placeholder="Nombre..." required className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-yellow-500"
                    value={formData.taller} onChange={e => setFormData({...formData, taller: e.target.value})} />
             </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Detalle</label>
            <textarea placeholder="Ej: Cambio aceite, fricciones..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white h-24 focus:border-yellow-500 outline-none resize-none"
                value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} required/>
          </div>

          <div className="relative">
            <label className="text-[10px] font-bold text-slate-400 ml-4 block uppercase mb-1">Total Pagado ($)</label>
            <div className="relative">
              <input type="number" step="0.01" required placeholder="0.00" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-green-500 pl-10"
                value={formData.costo} onChange={e => setFormData({...formData, costo: e.target.value})} />
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500" size={20}/>
            </div>
          </div>

          {preview && (
            <div className="w-full h-40 rounded-xl overflow-hidden border-2 border-yellow-500 relative bg-black">
              <img src={preview} className="w-full h-full object-contain" alt="Evidencia"/>
            </div>
          )}
          
          <label className={`w-full p-4 bg-[#0B1120] border-2 border-dashed ${preview ? 'border-green-500' : 'border-slate-700'} rounded-2xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-800 transition-all text-slate-400 font-bold uppercase text-xs`}>
            {processingImage ? <Loader2 className="animate-spin text-yellow-500"/> : <Camera size={18}/>}
            {processingImage ? 'Procesando...' : (preview ? 'Cambiar Foto' : 'Foto Factura')}
            <input type="file" accept="image/*" className="hidden" onChange={handleImage} disabled={processingImage} />
          </label>

          <button type="submit" disabled={loading || processingImage || !imageFile} className={`w-full py-4 rounded-2xl font-black uppercase text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${loading || processingImage || !imageFile ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-yellow-600 text-black hover:bg-yellow-500'}`}>
            {loading ? <Loader2 className="animate-spin"/> : <CheckCircle2 size={18}/>}
            {loading ? 'Subiendo...' : 'Registrar Mantenimiento'}
          </button>
        </form>
      </div>
    </div>
  );
}