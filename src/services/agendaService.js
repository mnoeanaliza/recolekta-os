import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const subscribeFleetAgenda = (onChange, onError) => {
  return onSnapshot(
    collection(db, 'agenda_flota'),
    (snap) => {
      onChange(snap.docs.map((item) => ({ id: item.id, ...item.data() })));
    },
    onError
  );
};

export const saveFleetAgendaAssignments = async ({ agendaData, selectedUsers, form, appendMode }) => {
  return Promise.all(
    selectedUsers.map(async (id) => {
      const currentUserData = agendaData.find((user) => user.id === id) || {};
      const updateData = {};

      const horarioTrim = (form.horario || '').trim();
      if (horarioTrim) {
        if (horarioTrim.toUpperCase() === 'NINGUNO' || horarioTrim.toUpperCase() === 'BORRAR') {
          updateData.horario = '';
        } else {
          updateData.horario = horarioTrim;
        }
      }

      const zonaTrim = (form.zona || '').trim();
      if (zonaTrim) {
        if (zonaTrim.toUpperCase() === 'NINGUNO' || zonaTrim.toUpperCase() === 'BORRAR') {
          updateData.zona = '';
        } else {
          updateData.zona = zonaTrim;
        }
      }

      const maintTrim = (form.mantenimiento || '').trim();
      if (maintTrim) {
        if (maintTrim.toUpperCase() === 'NINGUNO' || maintTrim.toUpperCase() === 'BORRAR') {
          updateData.mantenimiento = '';
        } else {
          updateData.mantenimiento = maintTrim;
        }
      }

      const puntosTrim = (form.puntos || '').trim();
      if (puntosTrim) {
        if (puntosTrim.toUpperCase() === 'NINGUNO' || puntosTrim.toUpperCase() === 'BORRAR') {
          updateData.puntos = '';
        } else if (appendMode && currentUserData.puntos && currentUserData.puntos !== 'Ninguno') {
          const existing = currentUserData.puntos.split('/').map((item) => item.trim()).filter(Boolean);
          const incoming = puntosTrim.split('/').map((item) => item.trim()).filter(Boolean);
          updateData.puntos = [...new Set([...existing, ...incoming])].join(' / ');
        } else {
          updateData.puntos = puntosTrim;
        }
      }

      const turnosTrim = (form.turnos || '').trim();
      if (turnosTrim) {
        if (turnosTrim.toUpperCase() === 'NINGUNO' || turnosTrim.toUpperCase() === 'BORRAR') {
          updateData.turnos = 'Ninguno';
        } else if (appendMode && currentUserData.turnos && currentUserData.turnos !== 'Ninguno') {
          const existing = currentUserData.turnos.split('-').map((item) => item.trim()).filter(Boolean);
          const incoming = turnosTrim.split('-').map((item) => item.trim()).filter(Boolean);
          const merged = [...new Set([...existing, ...incoming])].sort((a, b) => {
            const [da, ma, ya] = a.split('/');
            const [db, mb, yb] = b.split('/');
            return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
          });
          updateData.turnos = merged.join(' - ');
        } else {
          updateData.turnos = turnosTrim;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await setDoc(doc(db, 'agenda_flota', id), updateData, { merge: true });
      }
    })
  );
};

export const deleteFleetAgendaEntry = (id) => {
  return deleteDoc(doc(db, 'agenda_flota', id));
};

