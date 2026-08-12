import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));

export const GITHUB_CSV_URL = "https://raw.githubusercontent.com/mnoeanaliza/recolekta-os/refs/heads/main/Datos.csv";

export const USUARIOS_EMAIL = {
  "brayan@recolekta.com": "BRAYAN REYES", "edwin@recolekta.com": "EDWIN FLORES", "teodoro@recolekta.com": "TEODORO PÉREZ",
  "giovanni@recolekta.com": "GIOVANNI CALLEJAS", "jairo@recolekta.com": "JAIRO GIL", "jason@recolekta.com": "JASON BARRERA",
  "antonio@recolekta.com": "ANTONIO RIVAS", "walter@recolekta.com": "WALTER RIVAS", "rogelio@recolekta.com": "ROGELIO MAZARIEGO",
  "david@recolekta.com": "DAVID ALVARADO", "carlos@recolekta.com": "CARLOS SOSA", "felix@recolekta.com": "FELIX VASQUEZ",
  "flor@recolekta.com": "FLOR CARDOZA", "hildebrando@recolekta.com": "HILDEBRANDO MENJIVAR", "test@admin.com": "USUARIO PRUEBA",
  "chofer@recolekta.com": "TRANSPORTISTA PRUEBA", "admin@recolekta.com": "ADMINISTRADOR", "supervision@recolekta.com": "SUPERVISOR",
  "supervisor@recolekta.com": "SUPERVISOR", "nuevo_admin@recolekta.com": "NUEVO ADMIN", "ing.admin@recolekta.com": "INGENIERÍA ADMIN",
  "mauricio.alfaro@recolekta.com":"MAURICIO ALFARO","jose.rigoberto@recolekta.com":"RIGOBERTO CRUZ", "ernesto.recinos@recolekta.com":"ERNESTO RECINOS",
  "jose.recinos@recolekta.com":"JOSE RECINOS","tino@recolekta.com":"MAURICIO TINO","josue.hernandez@recolekta.com":"JOSUE HERNANDEZ","mario.coto@recolekta":"MARIO COTO"
};

export const ADMIN_EMAILS = [
  'admin@recolekta.com',
  'nuevo_admin@recolekta.com',
  'gerencia@recolekta.com',
  'ing.admin@recolekta.com'
];

export const SUPERVISOR_EMAILS = [
  'supervision@recolekta.com',
  'supervisor@recolekta.com'
];

export const DEFAULT_CATALOGS = {
  paises: ["El Salvador", "Guatemala", "Honduras", "Costa Rica"],
  zonas: {
      "El Salvador": ["El Salvador - Metropolitana Centro", "El Salvador - Oriente", "El Salvador - Occidente"],
      "Guatemala": ["Guatemala - Capital"],
      "Honduras": ["Honduras - Tegucigalpa"],
      "Costa Rica": ["Costa Rica - San José"]
  },
  transportistas: { "El Salvador": [ "BRAYAN REYES", "EDWIN FLORES", "TEODORO PÉREZ", "GIOVANNI CALLEJAS", "JAIRO GIL", "JASON BARRERA", "ANTONIO RIVAS", "WALTER RIVAS", "ROGELIO MAZARIEGO", "DAVID ALVARADO", "CARLOS SOSA", "FELIX VASQUEZ", "FLOR CARDOZA", "HILDEBRANDO MENJIVAR", "USUARIO PRUEBA", "TRANSPORTISTA PRUEBA" ] },
  sucursales: { "El Salvador": [ "Constitución", "Soyapango", "San Miguel", "Lourdes", "Valle Dulce", "Venecia", "San Miguel 2", "Sonsonate 1", "Puerto", "San Martín", "San Miguel 3", "Sonsonate 2", "San Gabriel", "Casco", "La Unión", "Sonsonate 3", "Cojutepeque", "Zacatecoluca", "Santa Ana 1", "Merliot 1", "Santa Ana 2", "Merliot 2", "Ramblas", "Escalón 1", "Metapán", "Escalón 2", "Marsella", "Medica 1", "Opico", "Medica 2", "Medica 3", "Medica 4", "Santa Tecla", "Plaza Soma", "Plaza Sur", "Santa Elena", "Chalatenango", "Aguilares" ] },
  areas: { "El Salvador": ["LABORATORIO / PROCESAMIENTO", "TUVET", "Imágenes Escalón", "Centro de Distribución", "LAB. Externo", "Contabilidad", "RRHH", "Contac Center", "Empresas", "Fisioterapia", "Cuentas por cobrar", "Mercadeo", "Fidelizacion", "IT", "LOGÍSTICA / RUTA"] },
  diligencias: { "El Salvador": ["Recolección de muestras", "Entrega de Muestras", "Traslado de toallas", "Traslado de reactivo", "Traslado de insumos", "Traslado de cortes", "Traslado de documentos", "Pago de aseguradora", "Pago o tramite bancario", "Tramite o diligencia extraordinaria", "INCIDENCIA EN RUTA"] }
};

export const PRINCIPAL_KEYWORDS = ["muestras", "entrega", "recepción", "recolección", "recoleccion"];
export const isPrincipalData = (d) => { if (d.categoria === "Principal") return true; const txt = (d.tipo || d.originalTipo || '').toLowerCase(); return PRINCIPAL_KEYWORDS.some(k => txt.includes(k)); };

export const getStrictDateString = (dateInput) => {
    if (!dateInput) return '';
    if (typeof dateInput === 'string' && dateInput.includes('-') && !dateInput.includes('T')) {
        const parts = dateInput.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    try {
        const d = new Date(dateInput);
        if(isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch(e) { return ''; }
};

export const formatLocalDate = (dateStr) => getStrictDateString(dateStr);

export const formatWithDay = (dateStr) => {
    if (!dateStr || dateStr === '--') return '--';
    try {
        let parts = dateStr.split('/');
        let dateObj;
        if (parts.length === 3) {
            dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
        } else {
            parts = dateStr.split('-');
            if (parts.length === 3) dateObj = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00`);
            else return dateStr;
        }
        if (isNaN(dateObj.getTime())) return dateStr;
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return `${days[dateObj.getDay()]} ${dateStr}`;
    } catch(e) { return dateStr; }
};

export const formatTurnosVisually = (turnosStr) => {
    if (!turnosStr || turnosStr === 'Ninguno') return 'Ninguno';
    return turnosStr.split('-').map(t => formatWithDay(t.trim())).join(' - ');
};
