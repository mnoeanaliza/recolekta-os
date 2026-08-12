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

      if (form.horario) updateData.horario = form.horario;
      if (form.zona) updateData.zona = form.zona;
      if (form.mantenimiento) updateData.mantenimiento = form.mantenimiento;

      if (form.puntos) {
        if (form.puntos.toUpperCase() === 'NINGUNO') {
          updateData.puntos = '';
        } else if (appendMode && currentUserData.puntos && currentUserData.puntos !== 'Ninguno') {
          const existing = currentUserData.puntos.split('/').map((item) => item.trim()).filter(Boolean);
          const incoming = form.puntos.split('/').map((item) => item.trim()).filter(Boolean);
          updateData.puntos = [...new Set([...existing, ...incoming])].join(' / ');
        } else {
          updateData.puntos = form.puntos;
        }
      }

      if (form.turnos) {
        if (form.turnos.toUpperCase() === 'NINGUNO') {
          updateData.turnos = 'Ninguno';
        } else if (appendMode && currentUserData.turnos && currentUserData.turnos !== 'Ninguno') {
          const existing = currentUserData.turnos.split('-').map((item) => item.trim()).filter(Boolean);
          const incoming = form.turnos.split('-').map((item) => item.trim()).filter(Boolean);
          const merged = [...new Set([...existing, ...incoming])].sort((a, b) => {
            const [da, ma, ya] = a.split('/');
            const [db, mb, yb] = b.split('/');
            return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
          });
          updateData.turnos = merged.join(' - ');
        } else {
          updateData.turnos = form.turnos;
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
