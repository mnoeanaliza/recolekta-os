import React, { useState, useEffect } from 'react';
import { db, storage } from '../config/firebase';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Wrench, Camera, CheckCircle2, Loader2, FileText, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const getStrictDateString = (dateInput) => {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        if(isNaN(d.getTime())) return '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch(e) { return ''; }
};

export default function MaintenanceModule({ currentUser, sysConfig }) {
    const [history, setHistory] = useState([]);
    const [form, setForm] = useState({ fecha: new Date().toISOString().split('T')[0], tipo: 'Preventivo', taller: '', costo: '', descripcion: '' });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);

    useEffect(() => {
        if (!currentUser?.email) return;
        const q = query(collection(db, "registros_mantenimiento"), where("usuario", "==", currentUser.email));
        const unsub = onSnapshot(q, (snap) => {
            const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            arr.sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));
            setHistory(arr);
        });
        return () => unsub();
    }, [currentUser]);

    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                    }, 'image/jpeg', 0.7);
                };
            };
        });
    };

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (file) {
            setIsCompressing(true);
            try {
                const compressedFile = await compressImage(file);
                setImageFile(compressedFile);
                const reader = new FileReader();
                reader.onloadend = () => setImagePreview(reader.result);
                reader.readAsDataURL(compressedFile);
            } catch (e) { alert("Error procesando imagen"); } 
            finally { setIsCompressing(false); }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!imageFile) return alert("Sube una foto de la factura o evidencia");
        setIsUploading(true);
        try {
            const storageRef = ref(storage, `mantenimiento/${Date.now()}_${currentUser.email}`);
            await uploadBytes(storageRef, imageFile);
            const photoURL = await getDownloadURL(storageRef);

            await addDoc(collection(db, "registros_mantenimiento"), {
                ...form,
                usuario: currentUser.email,
                foto: photoURL,
                createdAt: new Date().toISOString()
            });

            alert("¡Registro enviado con éxito!");
            setForm({ fecha: new Date().toISOString().split('T')[0], tipo: 'Preventivo', taller: '', costo: '', descripcion: '' });
            setImageFile(null);
            setImagePreview(null);
        } catch (error) {
            console.error(error);
            alert("Error al guardar.");
        } finally {
            setIsUploading(false);
        }
    };

    const periodHistory = history.filter(d => {
        if (!sysConfig || !sysConfig.flotaInicio || !sysConfig.flotaFin) return true;
        return d.fecha >= sysConfig.flotaInicio && d.fecha <= sysConfig.flotaFin;
    });

    const totalMantenimiento = periodHistory.reduce((acc, curr) => acc + parseFloat(curr.costo || 0), 0).toFixed(2);

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300 pb-20">
            <div className="bg-[#151F32] p-6 md:p-10 rounded-[2rem] shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-500 to-amber-400"></div>
                <h2 className="text-xl font-black mb-6 flex items-center gap-3 text-white"><Wrench className="text-yellow-500"/> Registro de Taller</h2>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Fecha</label>
                            <input type="date" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-yellow-500" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} required />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Tipo</label>
                            <select className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-yellow-500" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                                <option>Preventivo</option>
                                <option>Correctivo / Falla</option>
                                <option>Cambio de Llantas</option>
                                <option>Lavado / Limpieza</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Taller / Local</label>
                            <input type="text" placeholder="Ej. Taller Excel" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-yellow-500" value={form.taller} onChange={e => setForm({...form, taller: e.target.value})} required />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Costo Total ($)</label>
                            <input type="number" step="0.01" placeholder="Ej. 120.00" className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-yellow-500" value={form.costo} onChange={e => setForm({...form, costo: e.target.value})} required />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Detalle del servicio</label>
                        <textarea placeholder="Ej. Cambio de aceite, filtro y pastillas..." className="w-full p-4 bg-[#0B1120] border-2 border-slate-800 rounded-2xl font-bold text-white outline-none focus:border-yellow-500 resize-none h-24" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <label className="col-span-1 p-4 bg-[#0B1120] border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-800 transition-all text-slate-400 font-bold uppercase text-[9px]">
                            <Camera size={24}/>
                            <p>Foto Evidencia</p>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
                        </label>
                        
                        <button type="submit" disabled={!imagePreview || isUploading || isCompressing} className={cn("col-span-1 rounded-2xl font-black text-sm shadow-lg transition-all uppercase flex flex-col items-center justify-center gap-2", imagePreview && !isUploading && !isCompressing ? "bg-yellow-600 text-black hover:bg-yellow-500" : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700")}>
                            {isCompressing ? <Loader2 className="animate-spin" size={24}/> : (isUploading ? <Loader2 className="animate-spin" size={24}/> : <CheckCircle2 size={24}/>)}
                            {isCompressing ? '...' : (isUploading ? '...' : 'Enviar')}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-[#151F32] rounded-[2.5rem] shadow-xl border border-slate-800 p-6">
                <div className="flex flex-col mb-4">
                    <h4 className="font-black text-slate-300 uppercase text-xs tracking-widest flex items-center gap-2"><FileText className="text-yellow-500" size={18}/> Mis Servicios</h4>
                    {sysConfig && sysConfig.flotaInicio && (
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1"><Info size={12}/> Periodo activo: {getStrictDateString(sysConfig.flotaInicio)} al {getStrictDateString(sysConfig.flotaFin)}</p>
                    )}
                </div>

                <div className="bg-[#0B1120] p-3 rounded-xl border border-slate-800 text-center mb-4 w-1/2">
                    <p className="text-[9px] text-slate-500 uppercase font-bold">Total Invertido</p>
                    <p className="text-lg font-black text-yellow-500">${totalMantenimiento}</p>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[9px] font-black text-slate-500 uppercase bg-[#0B1120] rounded-lg">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Fecha</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Taller</th>
                                <th className="px-4 py-3 rounded-r-lg">Costo</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs font-bold text-slate-400 divide-y divide-slate-800">
                            {periodHistory.length > 0 ? periodHistory.map((r) => (
                                <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3 text-white font-black">{getStrictDateString(r.fecha)}</td>
                                    <td className="px-4 py-3 text-slate-300">{r.tipo}</td>
                                    <td className="px-4 py-3 text-slate-500 text-[10px] truncate max-w-[100px]">{r.taller}</td>
                                    <td className="px-4 py-3 text-yellow-400 font-bold">${r.costo}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-600 italic text-xs">No hay servicios en este periodo.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
