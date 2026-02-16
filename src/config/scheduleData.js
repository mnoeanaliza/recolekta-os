// src/config/scheduleData.js

// 1. RUTAS FIJAS (Basado en RutaFebrero.pdf)
export const BASE_SCHEDULE = {
    "ANTONIO RIVAS": { zona: "La Libertad", puntos: "Santa Elena / Plaza Soma", horario: "6:30 AM - 6:30 PM" },
    "GIOVANNI CALLEJAS": { zona: "San Salvador Este", puntos: "Soyapango", horario: "7:30 AM - 4:30 PM" },
    "TEODORO PÉREZ": { zona: "San Salvador Oeste", puntos: "San Gabriel / Constitución / Valle Dulce", horario: "7:00 AM - 5:00 PM" },
    "FLOR CARDOZA": { zona: "Chalatenango", puntos: "Chalatenango / Aguilares", horario: "6:30 AM - 3:30 PM" },
    "WALTER RIVAS": { zona: "General", puntos: "Rutas Varias", horario: "8:00 AM - 5:00 PM" },
    "JAIRO GIL": { zona: "San Salvador Centro", puntos: "Médica 1, 2, 3, 4", horario: "6:30 AM - 3:30 PM" },
    "FELIX VASQUEZ": { zona: "Merliot", puntos: "Merliot 2 / Santa Tecla", horario: "6:30 AM - 5:00 PM" },
    "DAVID ALVARADO": { zona: "Casco / La Libertad", puntos: "Lourdes / San Juan Opico", horario: "8:00 AM - 5:00 PM" },
    "EDWIN FLORES": { zona: "Cojutepeque", puntos: "Cojutepeque", horario: "7:30 AM - 4:30 PM" },
    "ROGELIO MAZARIEGO": { zona: "Escalón", puntos: "Escalón / Médica 3", horario: "7:00 AM - 4:00 PM" },
    "CARLOS SOSA": { zona: "Cortes Médica", puntos: "Externos / Escalón 2", horario: "8:00 AM - 5:00 PM" },
    "JASON BARRERA": { zona: "La Libertad", puntos: "Puerto de La Libertad", horario: "7:30 AM - 4:30 PM" },
    "BRAYAN REYES": { zona: "San Martín", puntos: "San Martín / Plaza Venecia", horario: "7:00 AM - 4:00 PM" },
    "HILDEBRANDO MENJIVAR": { zona: "Escalón", puntos: "Domicilios", horario: "8:00 AM - 5:00 PM" },
    "USUARIO PRUEBA": { zona: "Test", puntos: "Ruta de Prueba", horario: "24/7" }
};

// 2. TURNOS DE FIN DE SEMANA (Basado en Turnos_mantenimientos_Febrero.pdf)
// Formato: "DÍA/MES/AÑO": ["Array de Nombres que trabajan ese día"]
export const WEEKEND_SHIFTS = {
    "1/2/2026": ["EDWIN FLORES", "ROGELIO MAZARIEGO", "DAVID ALVARADO", "JASON BARRERA"], // Domingo
    "7/2/2026": ["ANTONIO RIVAS", "HILDEBRANDO MENJIVAR", "TEODORO PÉREZ", "GIOVANNI CALLEJAS"], // Sábado
    "8/2/2026": ["BRAYAN REYES", "ANTONIO RIVAS", "GIOVANNI CALLEJAS", "FELIX VASQUEZ"], // Domingo
    "14/2/2026": ["JASON BARRERA", "EDWIN FLORES", "DAVID ALVARADO", "ROGELIO MAZARIEGO"], // Sábado
    "15/2/2026": ["JASON BARRERA", "WALTER RIVAS", "ROGELIO MAZARIEGO", "TEODORO PÉREZ"], // Domingo
    "21/2/2026": ["BRAYAN REYES", "HILDEBRANDO MENJIVAR", "CARLOS SOSA", "GIOVANNI CALLEJAS"], // Sábado
    "22/2/2026": ["BRAYAN REYES", "EDWIN FLORES", "FELIX VASQUEZ", "DAVID ALVARADO"], // Domingo
    "28/2/2026": ["JASON BARRERA", "EDWIN FLORES", "DAVID ALVARADO", "ROGELIO MAZARIEGO"] // Sábado
};

// 3. MANTENIMIENTOS (Tarde)
export const MAINTENANCE_DAYS = {
    "2/2/2026": "HILDEBRANDO MENJIVAR",
    "3/2/2026": "WALTER RIVAS",
    "4/2/2026": "GIOVANNI CALLEJAS",
    "5/2/2026": "ROGELIO MAZARIEGO",
    "6/2/2026": "ANTONIO RIVAS",
    "7/2/2026": "FELIX VASQUEZ",
    "10/2/2026": "JAIRO GIL",
    "11/2/2026": "BRAYAN REYES",
    "12/2/2026": "DAVID ALVARADO",
    "13/2/2026": "FLOR CARDOZA",
    "17/2/2026": "EDWIN FLORES",
    "18/2/2026": "CARLOS SOSA",
    "19/2/2026": "JASON BARRERA",
    "20/2/2026": "TEODORO PÉREZ"
};