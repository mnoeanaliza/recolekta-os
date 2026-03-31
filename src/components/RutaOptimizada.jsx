import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Loader2, AlertTriangle } from 'lucide-react';

// Corrección nativa para los íconos de Leaflet en React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// TU CLAVE DE OPENROUTESERVICE (Asegúrate de pegar aquí la clave larga que sacaste de su web)
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImZhMTU3N2JjYTdhZjRkMjBiZjc1ZGJhZWZlZmQ4ZmVjIiwiaCI6Im11cm11cjY0In0='; 

export default function RutaOptimizada({ puntos = [] }) {
  const [ruta, setRuta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!puntos || puntos.length < 2) {
      setRuta(null);
      return;
    }

    const trazarRuta = async () => {
      setCargando(true);
      setError(null);
      try {
        const coordinates = puntos.map(p => [p.lng, p.lat]);

        const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
          method: 'POST',
          headers: {
            'Authorization': ORS_API_KEY,
            // 🛡️ SOLUCIÓN AL ERROR 406: Le decimos a la API que aceptamos formato GeoJSON
            'Content-Type': 'application/json; charset=utf-8',
            'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8'
          },
          body: JSON.stringify({ coordinates })
        });

        if (!response.ok) throw new Error('Error al conectar con el motor de rutas. Mostrando solo puntos de visita.');

        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const coords = data.features[0].geometry.coordinates;
          const leafletCoords = coords.map(coord => [coord[1], coord[0]]);
          setRuta(leafletCoords);
        } else {
          throw new Error('No se pudo trazar la ruta');
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setCargando(false);
      }
    };

    trazarRuta();
  }, [puntos]);

  if (!puntos || puntos.length === 0) {
    return <div className="flex flex-col items-center justify-center h-[500px] bg-[#0B1120] rounded-xl border border-slate-700 text-slate-500"><AlertTriangle size={32} className="mb-2"/> <p>No hay puntos GPS registrados.</p></div>;
  }

  const center = [puntos[0].lat, puntos[0].lng];

  return (
    <div className="relative w-full h-[500px] rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl">
      {cargando && (
        <div className="absolute inset-0 z-[1000] bg-[#0B1120]/80 backdrop-blur-sm flex flex-col items-center justify-center text-blue-400 font-bold">
          <Loader2 size={48} className="animate-spin mb-4" />
          <p>Optimizando e intersectando ruta satelital...</p>
        </div>
      )}
      
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-900/90 text-white px-6 py-3 rounded-xl shadow-lg border border-red-500 flex items-center gap-2 text-[10px] uppercase font-bold">
          <AlertTriangle size={14}/> {error}
        </div>
      )}

      <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
        
       {/* Dibuja los marcadores con un micro-desplazamiento en forma de espiral */}
        {puntos.map((punto, index) => {
          // El multiplicador 0.0001 mueve el pin unos 10 metros para evitar que se oculten
          const offsetLat = punto.lat + (index * 0.00002 * Math.sin(index));
          const offsetLng = punto.lng + (index * 0.00002 * Math.cos(index));
          
          return (
            <Marker key={index} position={[offsetLat, offsetLng]}>
              <Popup>
                <div className="text-center">
                  <p className="font-black text-slate-800 text-sm m-0 uppercase">{punto.name}</p>
                  <p className="text-xs text-slate-500 m-0">Visita #{index + 1} - {punto.time}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Mágicamente, aquí se dibujará la línea azul siguiendo las calles */}
        {ruta && <Polyline positions={ruta} color="#3b82f6" weight={5} opacity={0.8} dashArray="10, 10" />}
      </MapContainer>
    </div>
  );
}