const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const ADMIN_EMAILS = [
    "admin@recolekta.com",
    "nuevo_admin@recolekta.com",
    "gerencia@recolekta.com",
    "ing.admin@recolekta.com"
];
const PRINCIPAL_KEYWORDS = ["muestras", "entrega", "recepción", "recolección"];
const EVENT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

const round1 = (value) => parseFloat((Number(value) || 0).toFixed(1));
const round2 = (value) => parseFloat((Number(value) || 0).toFixed(2));
const toNumber = (value) => Number(value) || 0;
const normalizeEmail = (value) => String(value || "").toLowerCase().trim();
const normalizeName = (value) => String(value || "").toUpperCase().trim();

const monthIdFromTimestamp = (data = {}) => {
    if (data.periodoMes && /^\d{4}-\d{2}$/.test(data.periodoMes)) return data.periodoMes;
    const value = data.createdAt;
    if (!value) return null;
    if (typeof value === "string" && /^\d{4}-\d{2}/.test(value)) return value.substring(0, 7);
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const monthIdFromDate = (data = {}) => {
    const value = data.fecha;
    return typeof value === "string" && /^\d{4}-\d{2}/.test(value) ? value.substring(0, 7) : null;
};

const countryFromZone = (zone, explicitCountry) => {
    if (explicitCountry) return String(explicitCountry).trim();
    const normalizedZone = String(zone || "Sin Asignar").trim();
    if (normalizedZone === "Sin Asignar") return normalizedZone;
    return normalizedZone.includes("-") ? normalizedZone.split("-")[0].trim() : normalizedZone;
};

const emptyStats = () => ({
    vitales: 0,
    aTiempo: 0,
    secundarias: 0,
    total: 0,
    gastoCombustible: 0,
    galonesCombustible: 0,
    gastoMantenimiento: 0
});

const addStats = (base = {}, delta = {}) => ({
    vitales: Math.max(0, toNumber(base.vitales) + toNumber(delta.vitales)),
    aTiempo: Math.max(0, toNumber(base.aTiempo) + toNumber(delta.aTiempo)),
    secundarias: Math.max(0, toNumber(base.secundarias) + toNumber(delta.secundarias)),
    total: Math.max(0, toNumber(base.total) + toNumber(delta.total)),
    gastoCombustible: Math.max(0, round2(toNumber(base.gastoCombustible) + toNumber(delta.gastoCombustible))),
    galonesCombustible: Math.max(0, round2(toNumber(base.galonesCombustible) + toNumber(delta.galonesCombustible))),
    gastoMantenimiento: Math.max(0, round2(toNumber(base.gastoMantenimiento) + toNumber(delta.gastoMantenimiento)))
});

const sumStats = (base = {}, delta = {}) => ({
    vitales: toNumber(base.vitales) + toNumber(delta.vitales),
    aTiempo: toNumber(base.aTiempo) + toNumber(delta.aTiempo),
    secundarias: toNumber(base.secundarias) + toNumber(delta.secundarias),
    total: toNumber(base.total) + toNumber(delta.total),
    gastoCombustible: round2(toNumber(base.gastoCombustible) + toNumber(delta.gastoCombustible)),
    galonesCombustible: round2(toNumber(base.galonesCombustible) + toNumber(delta.galonesCombustible)),
    gastoMantenimiento: round2(toNumber(base.gastoMantenimiento) + toNumber(delta.gastoMantenimiento))
});

const efficiencyFromStats = (stats = {}) => {
    if (!toNumber(stats.vitales)) return 100;
    return round1((toNumber(stats.aTiempo) / toNumber(stats.vitales)) * 100);
};

let configCache = null;
let configCacheExpiresAt = 0;

const getConfig = async () => {
    if (configCache && Date.now() < configCacheExpiresAt) return configCache;
    const snap = await db.collection("configuraciones").doc("general").get();
    configCache = snap.exists ? snap.data() : {};
    configCacheExpiresAt = Date.now() + 5 * 60 * 1000;
    return configCache;
};

const getMetaForZone = (zone, config = {}) => {
    const metro = Number(config.metaMetro || 5);
    const interior = Number(config.metaInterior || 10);
    const frontera = Number(config.metaFrontera || 20);
    const normalizedZone = String(zone || "").toLowerCase();
    if (normalizedZone.includes("oriente") || normalizedZone.includes("occidente")) return interior;
    if (normalizedZone.includes("guatemala") || normalizedZone.includes("honduras") || normalizedZone.includes("costa rica")) return frontera;
    return metro;
};

const isPrincipal = (data = {}) => {
    const type = String(data.tipo || "").toLowerCase();
    return data.categoria === "Principal" || PRINCIPAL_KEYWORDS.some((keyword) => type.includes(keyword));
};

const productionStats = (data, meta) => {
    if (!isPrincipal(data)) return { secundarias: 1, total: 1 };
    return { vitales: 1, aTiempo: toNumber(data.tiempo) <= meta ? 1 : 0, total: 1 };
};

const buildProfileLookup = (profileDocs) => {
    const byEmail = new Map();
    const byName = new Map();
    profileDocs.forEach((profileDoc) => {
        const profile = profileDoc.data();
        const email = normalizeEmail(profileDoc.id);
        byEmail.set(email, profile);
        if (profile.nombre) byName.set(normalizeName(profile.nombre), { email, profile });
        if (profile.recolector) byName.set(normalizeName(profile.recolector), { email, profile });
    });
    return { byEmail, byName };
};

const resolveIdentity = async (data = {}, lookup = null) => {
    let email = normalizeEmail(data.usuarioEmail || data.usuario);
    let profile = email && lookup ? lookup.byEmail.get(email) : null;

    if (!email && data.recolector && lookup) {
        const match = lookup.byName.get(normalizeName(data.recolector));
        email = match?.email || "";
        profile = match?.profile || null;
    }

    if (!email && data.recolector && !lookup) {
        let profiles = await db.collection("usuarios_perfiles").where("nombre", "==", normalizeName(data.recolector)).limit(1).get();
        if (profiles.empty) profiles = await db.collection("usuarios_perfiles").where("recolector", "==", data.recolector).limit(1).get();
        if (!profiles.empty) {
            email = normalizeEmail(profiles.docs[0].id);
            profile = profiles.docs[0].data();
        }
    }

    const hasLocationSnapshot = Boolean(data.zona || data.pais);
    if (email && !profile && !hasLocationSnapshot && !lookup) {
        const profileSnap = await db.collection("usuarios_perfiles").doc(email).get();
        if (profileSnap.exists) profile = profileSnap.data();
    }

    const name = normalizeName(data.recolector || profile?.nombre || email || "Desconocido");
    const zone = String(data.zona || profile?.zona || "Sin Asignar").trim();
    const country = countryFromZone(zone, data.pais);
    return { email: email || `nombre:${name}`, name, zone, country };
};

const emptyDelta = () => ({ global: emptyStats(), users: {}, zones: {}, countries: {} });

const addDimensionDelta = (delta, identity, stats, sign) => {
    const signed = Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, toNumber(value) * sign]));
    delta.global = sumStats(delta.global, signed);
    delta.users[identity.email] = sumStats(delta.users[identity.email], signed);
    delta.zones[identity.zone] = sumStats(delta.zones[identity.zone], signed);
    delta.countries[identity.country] = sumStats(delta.countries[identity.country], signed);
};

const mergeDimensionMap = (current = {}, changes = {}) => {
    const next = { ...current };
    Object.entries(changes).forEach(([key, delta]) => { next[key] = addStats(next[key], delta); });
    return next;
};

const markerRefFor = (handlerName, eventId) => {
    const safeId = `${handlerName}_${eventId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    return db.collection("_eventos_funciones").doc(safeId);
};

const applySummaryDeltasOnce = async (handlerName, eventId, deltasByMonth) => {
    if (deltasByMonth.size === 0) return;
    const markerRef = markerRefFor(handlerName, eventId);
    const entries = Array.from(deltasByMonth.entries());

    await db.runTransaction(async (tx) => {
        const markerSnap = await tx.get(markerRef);
        if (markerSnap.exists) return;

        const snapshots = [];
        for (const [monthId] of entries) {
            const ref = db.collection("resumenes_operativos").doc(monthId);
            snapshots.push({ ref, snap: await tx.get(ref) });
        }

        entries.forEach(([monthId, delta], index) => {
            const { ref, snap } = snapshots[index];
            const current = snap.exists ? snap.data() : {};
            const update = {
                porUsuario: mergeDimensionMap(current.porUsuario, delta.users),
                porZona: mergeDimensionMap(current.porZona, delta.zones),
                porPais: mergeDimensionMap(current.porPais, delta.countries),
                ultimaActualizacion: FieldValue.serverTimestamp()
            };

            const canInitializeProduction = !current._conteoProduccion && current.totalViajesMes === undefined;
            if (handlerName === "produccion" && (current._conteoProduccion || canInitializeProduction)) {
                const nextProduction = addStats(current._conteoProduccion || emptyStats(), delta.global);
                update._conteoProduccion = nextProduction;
                update.eficienciaGlobal = efficiencyFromStats(nextProduction);
                update.totalViajesMes = nextProduction.total;
            } else if (handlerName === "produccion") {
                update.requiereReconstruccion = true;
            }

            if (handlerName !== "produccion") {
                update.gastoCombustible = Math.max(0, round2(toNumber(current.gastoCombustible) + toNumber(delta.global.gastoCombustible)));
                update.galonesCombustible = Math.max(0, round2(toNumber(current.galonesCombustible) + toNumber(delta.global.galonesCombustible)));
                update.gastoMantenimiento = Math.max(0, round2(toNumber(current.gastoMantenimiento) + toNumber(delta.global.gastoMantenimiento)));
                update.ultimaActualizacionFinanzas = FieldValue.serverTimestamp();
            }

            tx.set(ref, update, { merge: true });
        });

        tx.create(markerRef, {
            handler: handlerName,
            eventId,
            processedAt: FieldValue.serverTimestamp(),
            expiresAt: Timestamp.fromMillis(Date.now() + EVENT_RETENTION_MS)
        });
    });
};

const buildDeltas = async ({ before, after, monthResolver, valueResolver, config }) => {
    const deltasByMonth = new Map();
    const apply = async (record, sign) => {
        if (!record || record._migracionSilenciosa) return;
        const monthId = monthResolver(record);
        if (!monthId) return;
        const identity = await resolveIdentity(record);
        const stats = valueResolver(record, identity, config);
        const delta = deltasByMonth.get(monthId) || emptyDelta();
        addDimensionDelta(delta, identity, stats, sign);
        deltasByMonth.set(monthId, delta);
    };
    await apply(before, -1);
    await apply(after, 1);
    return deltasByMonth;
};

exports.resumenProduccionMensual = functions.firestore
    .document("registros_produccion/{registroId}")
    .onWrite(async (change, context) => {
        const config = await getConfig();
        const deltas = await buildDeltas({
            before: change.before.exists ? change.before.data() : null,
            after: change.after.exists ? change.after.data() : null,
            monthResolver: monthIdFromTimestamp,
            valueResolver: (record, identity) => productionStats(record, getMetaForZone(identity.zone, config)),
            config
        });
        await applySummaryDeltasOnce("produccion", context.eventId, deltas);
    });

exports.resumenCombustibleMensual = functions.firestore
    .document("registros_combustible/{registroId}")
    .onWrite(async (change, context) => {
        const deltas = await buildDeltas({
            before: change.before.exists ? change.before.data() : null,
            after: change.after.exists ? change.after.data() : null,
            monthResolver: monthIdFromDate,
            valueResolver: (record) => ({ gastoCombustible: toNumber(record.costo), galonesCombustible: toNumber(record.galones) })
        });
        await applySummaryDeltasOnce("combustible", context.eventId, deltas);
    });

exports.resumenMantenimientoMensual = functions.firestore
    .document("registros_mantenimiento/{registroId}")
    .onWrite(async (change, context) => {
        const deltas = await buildDeltas({
            before: change.before.exists ? change.before.data() : null,
            after: change.after.exists ? change.after.data() : null,
            monthResolver: monthIdFromDate,
            valueResolver: (record) => ({ gastoMantenimiento: toNumber(record.costo) })
        });
        await applySummaryDeltasOnce("mantenimiento", context.eventId, deltas);
    });

const accumulateHistoricalRecord = async (summary, record, type, config, lookup) => {
    const identity = await resolveIdentity(record, lookup);
    let stats;
    if (type === "produccion") stats = productionStats(record, getMetaForZone(identity.zone, config));
    else if (type === "combustible") stats = { gastoCombustible: toNumber(record.costo), galonesCombustible: toNumber(record.galones) };
    else stats = { gastoMantenimiento: toNumber(record.costo) };

    summary.global = addStats(summary.global, stats);
    summary.users[identity.email] = addStats(summary.users[identity.email], stats);
    summary.zones[identity.zone] = addStats(summary.zones[identity.zone], stats);
    summary.countries[identity.country] = addStats(summary.countries[identity.country], stats);
};

exports.reconstruirResumenesHistoricos = functions
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .https.onCall(async (data, context) => {
        const callerEmail = normalizeEmail(context.auth?.token?.email);
        if (!context.auth || !ADMIN_EMAILS.includes(callerEmail)) {
            throw new functions.https.HttpsError("permission-denied", "Solo un administrador puede reconstruir resúmenes.");
        }

        const year = Number(data?.year);
        const currentYear = new Date().getUTCFullYear();
        if (!Number.isInteger(year) || year < 2025 || year > currentYear + 1) {
            throw new functions.https.HttpsError("invalid-argument", "El año solicitado no es válido.");
        }

        const config = await getConfig();
        const profileSnap = await db.collection("usuarios_perfiles").get();
        const lookup = buildProfileLookup(profileSnap.docs);
        const startTimestamp = `${year}-01-01`;
        const endTimestamp = `${year + 1}-01-01`;

        const [productionSnap, fuelSnap, maintenanceSnap] = await Promise.all([
            db.collection("registros_produccion").where("createdAt", ">=", startTimestamp).where("createdAt", "<", endTimestamp).get(),
            db.collection("registros_combustible").where("fecha", ">=", startTimestamp).where("fecha", "<", endTimestamp).get(),
            db.collection("registros_mantenimiento").where("fecha", ">=", startTimestamp).where("fecha", "<", endTimestamp).get()
        ]);

        const summaries = new Map();
        for (let month = 1; month <= 12; month += 1) {
            summaries.set(`${year}-${String(month).padStart(2, "0")}`, emptyDelta());
        }

        for (const recordDoc of productionSnap.docs) {
            const record = recordDoc.data();
            if (record._migracionSilenciosa) continue;
            const monthId = monthIdFromTimestamp(record);
            if (summaries.has(monthId)) await accumulateHistoricalRecord(summaries.get(monthId), record, "produccion", config, lookup);
        }
        for (const recordDoc of fuelSnap.docs) {
            const record = recordDoc.data();
            if (record._migracionSilenciosa) continue;
            const monthId = monthIdFromDate(record);
            if (summaries.has(monthId)) await accumulateHistoricalRecord(summaries.get(monthId), record, "combustible", config, lookup);
        }
        for (const recordDoc of maintenanceSnap.docs) {
            const record = recordDoc.data();
            if (record._migracionSilenciosa) continue;
            const monthId = monthIdFromDate(record);
            if (summaries.has(monthId)) await accumulateHistoricalRecord(summaries.get(monthId), record, "mantenimiento", config, lookup);
        }

        const batch = db.batch();
        summaries.forEach((summary, monthId) => {
            const production = summary.global;
            batch.set(db.collection("resumenes_operativos").doc(monthId), {
                _conteoProduccion: production,
                eficienciaGlobal: efficiencyFromStats(production),
                totalViajesMes: production.total,
                gastoCombustible: production.gastoCombustible,
                galonesCombustible: production.galonesCombustible,
                gastoMantenimiento: production.gastoMantenimiento,
                porUsuario: summary.users,
                porZona: summary.zones,
                porPais: summary.countries,
                requiereReconstruccion: false,
                reconstruidoPor: callerEmail,
                ultimaActualizacion: FieldValue.serverTimestamp(),
                ultimaActualizacionFinanzas: FieldValue.serverTimestamp()
            });
        });
        await batch.commit();

        return {
            year,
            productionReads: productionSnap.size,
            fuelReads: fuelSnap.size,
            maintenanceReads: maintenanceSnap.size,
            summaryWrites: summaries.size
        };
    });
