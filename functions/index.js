const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// 🤖 ROBOT 1: AUDITOR INDIVIDUAL BLINDADO
exports.auditorDeEficiencia = functions.firestore
    .document('registros_produccion/{registroId}')
    .onWrite(async (change, context) => {
        const data = change.after.exists ? change.after.data() : change.before.data();
        if (!data) return null;

        // 🛡️ ESCUDO ANTI-AVALANCHAS: Si es una migración masiva, el robot se apaga y no hace nada.
        if (data._migracionSilenciosa) return null;

        const email = data.usuarioEmail;
        const nombreTransportista = data.recolector; 
        if (!email && !nombreTransportista) return null; 

        const date = new Date(data.createdAt || new Date());
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const endOfMonth = new Date(year, month, 1).toISOString();

        try {
            const configSnap = await db.collection("configuraciones").doc("general").get();
            const metaMetro = configSnap.exists ? Number(configSnap.data().metaMetro || 5) : 5;
            let targetEmail = email;

            if (!email) {
                const profiles = await db.collection("usuarios_perfiles").where("recolector", "==", nombreTransportista).limit(1).get();
                if (!profiles.empty) targetEmail = profiles.docs[0].id;
            }
            if (!targetEmail) return null;

            const viajesSnap = await db.collection("registros_produccion").where("usuarioEmail", "==", targetEmail).where("createdAt", ">=", startOfMonth).where("createdAt", "<", endOfMonth).get();
            let vitales = 0; let aTiempo = 0; let secundarias = 0;
            const PRINCIPAL_KEYWORDS = ["muestras", "entrega", "recepción", "recolección"];

            viajesSnap.forEach(doc => {
                const v = doc.data();
                const isP = v.categoria === "Principal" || PRINCIPAL_KEYWORDS.some(k => (v.tipo || '').toLowerCase().includes(k));
                if (isP) { vitales++; if ((v.tiempo || 0) <= metaMetro) aTiempo++; } else { secundarias++; }
            });

            let ef = 100; if (vitales > 0) ef = parseFloat(((aTiempo / vitales) * 100).toFixed(1));
            return await db.collection("usuarios_perfiles").doc(targetEmail).set({ eficienciaNube: ef, secundariasNube: secundarias, vitalesNube: vitales, ultimaAuditoria: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } catch (error) { return null; }
    });

// 🤖 ROBOT 2: RESUMEN GLOBAL BLINDADO
exports.resumenGlobalMensual = functions.firestore
    .document('registros_produccion/{registroId}')
    .onWrite(async (change, context) => {
        const data = change.after.exists ? change.after.data() : change.before.data();
        if (!data || data._migracionSilenciosa) return null; // 🛡️ ESCUDO ACTIVO

        const date = new Date(data.createdAt);
        const year = date.getFullYear().toString();
        const monthNum = (date.getMonth() + 1).toString().padStart(2, '0');
        const documentId = `${year}-${monthNum}`; 
        const startOfMonth = new Date(year, date.getMonth(), 1).toISOString();
        const endOfMonth = new Date(year, date.getMonth() + 1, 1).toISOString();

        try {
            const viajesSnap = await db.collection("registros_produccion").where("createdAt", ">=", startOfMonth).where("createdAt", "<", endOfMonth).get();
            let vitales = 0; let aTiempo = 0;
            const configSnap = await db.collection("configuraciones").doc("general").get();
            const metaGeneral = configSnap.exists ? Number(configSnap.data().metaMetro || 5) : 5;
            const PRINCIPAL_KEYWORDS = ["muestras", "entrega", "recepción", "recolección"];

            viajesSnap.forEach(doc => {
                const v = doc.data();
                const isP = v.categoria === "Principal" || PRINCIPAL_KEYWORDS.some(k => (v.tipo || '').toLowerCase().includes(k));
                if (isP) { vitales++; if ((v.tiempo || 0) <= metaGeneral) aTiempo++; }
            });

            let efGlobal = 100; if (vitales > 0) efGlobal = parseFloat(((aTiempo / vitales) * 100).toFixed(1));
            return await db.collection("resumenes_operativos").doc(documentId).set({ eficienciaGlobal: efGlobal, totalViajesMes: viajesSnap.size, ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } catch (error) { return null; }
    });
    // 🤖 ROBOT 3: AUDITOR FINANCIERO (COMBUSTIBLE)
exports.resumenCombustibleMensual = functions.firestore
    .document('registros_combustible/{registroId}')
    .onWrite(async (change, context) => {
        const data = change.after.exists ? change.after.data() : change.before.data();
        if (!data || data._migracionSilenciosa) return null; // 🛡️ Escudo activo

        // Extraemos el año y mes de la fecha del ticket (Ej: "2026-03-25" -> "2026-03")
        const fechaStr = data.fecha;
        if (!fechaStr || typeof fechaStr !== 'string') return null;
        
        const year = fechaStr.substring(0, 4);
        const month = fechaStr.substring(5, 7);
        const documentId = `${year}-${month}`;

        try {
            // Buscamos todos los tickets de ese mes específico
            const startOfMonth = `${year}-${month}-01`;
            const nextMonthNum = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
            const nextYearNum = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
            const endOfMonth = `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}-01`;

            const ticketsSnap = await db.collection("registros_combustible")
                .where("fecha", ">=", startOfMonth)
                .where("fecha", "<", endOfMonth)
                .get();

            let gastoCombustible = 0;
            let galonesCombustible = 0;

            // Sumamos los montos
            ticketsSnap.forEach(doc => {
                const t = doc.data();
                gastoCombustible += parseFloat(t.costo || 0);
                galonesCombustible += parseFloat(t.galones || 0);
            });

            // Guardamos el dinero en el mismo documento de la eficiencia (Ej: "2026-03")
            return await db.collection("resumenes_operativos").doc(documentId).set({ 
                gastoCombustible: parseFloat(gastoCombustible.toFixed(2)), 
                galonesCombustible: parseFloat(galonesCombustible.toFixed(2)),
                ultimaActualizacionFinanzas: admin.firestore.FieldValue.serverTimestamp() 
            }, { merge: true }); // merge: true es CLAVE para no borrar la eficiencia!
        } catch (error) { return null; }
    });

// 🤖 ROBOT 4: AUDITOR FINANCIERO (TALLER)
exports.resumenMantenimientoMensual = functions.firestore
    .document('registros_mantenimiento/{registroId}')
    .onWrite(async (change, context) => {
        const data = change.after.exists ? change.after.data() : change.before.data();
        if (!data || data._migracionSilenciosa) return null;

        const fechaStr = data.fecha;
        if (!fechaStr || typeof fechaStr !== 'string') return null;
        
        const year = fechaStr.substring(0, 4);
        const month = fechaStr.substring(5, 7);
        const documentId = `${year}-${month}`;

        try {
            const startOfMonth = `${year}-${month}-01`;
            const nextMonthNum = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
            const nextYearNum = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
            const endOfMonth = `${nextYearNum}-${String(nextMonthNum).padStart(2, '0')}-01`;

            const ticketsSnap = await db.collection("registros_mantenimiento")
                .where("fecha", ">=", startOfMonth)
                .where("fecha", "<", endOfMonth)
                .get();

            let gastoMantenimiento = 0;

            ticketsSnap.forEach(doc => {
                const t = doc.data();
                gastoMantenimiento += parseFloat(t.costo || 0);
            });

            return await db.collection("resumenes_operativos").doc(documentId).set({ 
                gastoMantenimiento: parseFloat(gastoMantenimiento.toFixed(2)),
                ultimaActualizacionFinanzas: admin.firestore.FieldValue.serverTimestamp() 
            }, { merge: true });
        } catch (error) { return null; }
    });