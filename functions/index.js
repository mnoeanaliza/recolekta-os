const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PRINCIPAL_KEYWORDS = ["muestras", "entrega", "recepción", "recolección"];

const round1 = (value) => parseFloat((Number(value) || 0).toFixed(1));
const round2 = (value) => parseFloat((Number(value) || 0).toFixed(2));
const toNumber = (value) => Number(value) || 0;

const getMonthIdFromDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthIdFromDateString = (value) => {
    if (!value || typeof value !== "string" || value.length < 7) return null;
    return value.substring(0, 7);
};

const getMonthBounds = (monthId) => {
    const [year, month] = monthId.split("-").map(Number);
    const start = new Date(year, month - 1, 1).toISOString();
    const end = new Date(year, month, 1).toISOString();
    return { start, end };
};

const getStringMonthBounds = (monthId) => {
    const [year, month] = monthId.split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return {
        start: `${year}-${String(month).padStart(2, "0")}-01`,
        end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
    };
};

const currentMonthId = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const isPrincipal = (data = {}) => {
    const tipo = String(data.tipo || "").toLowerCase();
    return data.categoria === "Principal" || PRINCIPAL_KEYWORDS.some((key) => tipo.includes(key));
};

const productionStats = (data = {}, meta) => {
    if (isPrincipal(data)) {
        return {
            vitales: 1,
            aTiempo: toNumber(data.tiempo) <= meta ? 1 : 0,
            secundarias: 0,
            total: 1
        };
    }

    return { vitales: 0, aTiempo: 0, secundarias: 1, total: 1 };
};

const emptyProductionStats = () => ({ vitales: 0, aTiempo: 0, secundarias: 0, total: 0 });

const addStats = (base, delta) => ({
    vitales: Math.max(0, toNumber(base.vitales) + toNumber(delta.vitales)),
    aTiempo: Math.max(0, toNumber(base.aTiempo) + toNumber(delta.aTiempo)),
    secundarias: Math.max(0, toNumber(base.secundarias) + toNumber(delta.secundarias)),
    total: Math.max(0, toNumber(base.total) + toNumber(delta.total))
});

const sumStats = (base, delta) => ({
    vitales: toNumber(base.vitales) + toNumber(delta.vitales),
    aTiempo: toNumber(base.aTiempo) + toNumber(delta.aTiempo),
    secundarias: toNumber(base.secundarias) + toNumber(delta.secundarias),
    total: toNumber(base.total) + toNumber(delta.total)
});

const efficiencyFromStats = (stats) => {
    if (!stats.vitales) return 100;
    return round1((stats.aTiempo / stats.vitales) * 100);
};

const getMeta = async () => {
    const snap = await db.collection("configuraciones").doc("general").get();
    return snap.exists ? Number(snap.data().metaMetro || 5) : 5;
};

const resolveEmail = async (data = {}) => {
    if (data.usuarioEmail) return String(data.usuarioEmail).toLowerCase().trim();
    if (!data.recolector) return null;

    let profiles = await db
        .collection("usuarios_perfiles")
        .where("nombre", "==", String(data.recolector).toUpperCase().trim())
        .limit(1)
        .get();

    // Compatibilidad con perfiles antiguos que usaban el campo recolector.
    if (profiles.empty) {
        profiles = await db
            .collection("usuarios_perfiles")
            .where("recolector", "==", data.recolector)
            .limit(1)
            .get();
    }

    return profiles.empty ? null : profiles.docs[0].id;
};

const getDeltaMap = (before, after, monthResolver, valueResolver) => {
    const changes = new Map();

    const apply = (data, sign) => {
        if (!data) return;
        const monthId = monthResolver(data);
        if (!monthId) return;
        const current = changes.get(monthId) || {};
        const values = valueResolver(data);

        Object.entries(values).forEach(([key, value]) => {
            current[key] = toNumber(current[key]) + (toNumber(value) * sign);
        });

        changes.set(monthId, current);
    };

    apply(before, -1);
    apply(after, 1);
    return changes;
};

const rebuildGlobalProductionStats = async (monthId, meta) => {
    const { start, end } = getMonthBounds(monthId);
    const snap = await db
        .collection("registros_produccion")
        .where("createdAt", ">=", start)
        .where("createdAt", "<", end)
        .get();

    let stats = emptyProductionStats();
    snap.forEach((doc) => {
        const data = doc.data();
        if (data._migracionSilenciosa) return;
        stats = addStats(stats, productionStats(data, meta));
    });

    return stats;
};

const rebuildUserProductionStats = async (email, monthId, meta) => {
    const { start, end } = getMonthBounds(monthId);
    const snap = await db
        .collection("registros_produccion")
        .where("usuarioEmail", "==", email)
        .where("createdAt", ">=", start)
        .where("createdAt", "<", end)
        .get();

    let stats = emptyProductionStats();
    snap.forEach((doc) => {
        const data = doc.data();
        if (data._migracionSilenciosa) return;
        stats = addStats(stats, productionStats(data, meta));
    });

    return stats;
};

const updateGlobalProductionSummary = async (monthId, delta, meta) => {
    const ref = db.collection("resumenes_operativos").doc(monthId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const hasCounters = Boolean(data._conteoProduccion);
        const base = hasCounters ? data._conteoProduccion : await rebuildGlobalProductionStats(monthId, meta);
        const next = hasCounters ? addStats(base, delta) : base;

        tx.set(ref, {
            _conteoProduccion: next,
            eficienciaGlobal: efficiencyFromStats(next),
            totalViajesMes: next.total,
            ultimaActualizacion: FieldValue.serverTimestamp()
        }, { merge: true });
    });
};

const updateUserProfileStats = async (email, monthId, delta, meta) => {
    const ref = db.collection("usuarios_perfiles").doc(email);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const monthlyStats = data._statsEficienciaNube || {};
        const hasCounters = Boolean(monthlyStats[monthId]);
        const base = hasCounters ? monthlyStats[monthId] : await rebuildUserProductionStats(email, monthId, meta);
        const next = hasCounters ? addStats(base, delta) : base;
        const nextMonthlyStats = { ...monthlyStats, [monthId]: next };
        const update = {
            _statsEficienciaNube: nextMonthlyStats,
            ultimaAuditoria: FieldValue.serverTimestamp()
        };

        if (monthId === currentMonthId()) {
            update.eficienciaNube = efficiencyFromStats(next);
            update.vitalesNube = next.vitales;
            update.secundariasNube = next.secundarias;
        }

        tx.set(ref, update, { merge: true });
    });
};

const updateFinancialSummary = async (monthId, delta) => {
    const ref = db.collection("resumenes_operativos").doc(monthId);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const update = { ultimaActualizacionFinanzas: FieldValue.serverTimestamp() };

        if (delta.gastoCombustible !== undefined) {
            update.gastoCombustible = Math.max(0, round2(toNumber(data.gastoCombustible) + toNumber(delta.gastoCombustible)));
        }

        if (delta.galonesCombustible !== undefined) {
            update.galonesCombustible = Math.max(0, round2(toNumber(data.galonesCombustible) + toNumber(delta.galonesCombustible)));
        }

        if (delta.gastoMantenimiento !== undefined) {
            update.gastoMantenimiento = Math.max(0, round2(toNumber(data.gastoMantenimiento) + toNumber(delta.gastoMantenimiento)));
        }

        tx.set(ref, update, { merge: true });
    });
};

exports.auditorDeEficiencia = functions.firestore
    .document("registros_produccion/{registroId}")
    .onWrite(async (change) => {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        if ((before && before._migracionSilenciosa) || (after && after._migracionSilenciosa)) return null;

        const meta = await getMeta();
        const updates = new Map();

        const apply = async (data, sign) => {
            if (!data) return;
            const email = await resolveEmail(data);
            const monthId = getMonthIdFromDate(data.createdAt);
            if (!email || !monthId) return;
            const key = `${email}|${monthId}`;
            const current = updates.get(key) || emptyProductionStats();
            const stats = productionStats(data, meta);
            updates.set(key, sumStats(current, {
                vitales: stats.vitales * sign,
                aTiempo: stats.aTiempo * sign,
                secundarias: stats.secundarias * sign,
                total: stats.total * sign
            }));
        };

        await apply(before, -1);
        await apply(after, 1);

        await Promise.all(Array.from(updates.entries()).map(([key, delta]) => {
            const [email, monthId] = key.split("|");
            return updateUserProfileStats(email, monthId, delta, meta);
        }));

        return null;
    });

exports.resumenGlobalMensual = functions.firestore
    .document("registros_produccion/{registroId}")
    .onWrite(async (change) => {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        if ((before && before._migracionSilenciosa) || (after && after._migracionSilenciosa)) return null;

        const meta = await getMeta();
        const deltas = getDeltaMap(
            before,
            after,
            (data) => getMonthIdFromDate(data.createdAt),
            (data) => productionStats(data, meta)
        );

        await Promise.all(Array.from(deltas.entries()).map(([monthId, delta]) => updateGlobalProductionSummary(monthId, delta, meta)));
        return null;
    });

exports.resumenCombustibleMensual = functions.firestore
    .document("registros_combustible/{registroId}")
    .onWrite(async (change) => {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        if ((before && before._migracionSilenciosa) || (after && after._migracionSilenciosa)) return null;

        const deltas = getDeltaMap(
            before,
            after,
            (data) => getMonthIdFromDateString(data.fecha),
            (data) => ({
                gastoCombustible: toNumber(data.costo),
                galonesCombustible: toNumber(data.galones)
            })
        );

        await Promise.all(Array.from(deltas.entries()).map(([monthId, delta]) => updateFinancialSummary(monthId, delta)));
        return null;
    });

exports.resumenMantenimientoMensual = functions.firestore
    .document("registros_mantenimiento/{registroId}")
    .onWrite(async (change) => {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        if ((before && before._migracionSilenciosa) || (after && after._migracionSilenciosa)) return null;

        const deltas = getDeltaMap(
            before,
            after,
            (data) => getMonthIdFromDateString(data.fecha),
            (data) => ({ gastoMantenimiento: toNumber(data.costo) })
        );

        await Promise.all(Array.from(deltas.entries()).map(([monthId, delta]) => updateFinancialSummary(monthId, delta)));
        return null;
    });
