# Operacion Firebase y GitHub

Este proyecto ya separa configuracion sensible en variables `VITE_*` y agrega reglas base para Firestore y Storage.

## Firebase: reglas

1. Revisa `firestore.rules` y `storage.rules`.
2. Confirma que los correos admin/supervisor coincidan con tu equipo real.
3. Desde una terminal autenticada con Firebase CLI ejecuta:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,storage
```

4. Prueba con un usuario transportista:
   - Puede crear sus propios registros.
   - No puede editar/borrar registros de otros.
   - Puede leer su agenda y sus datos.

5. Prueba con admin:
   - Puede editar agenda, catalogos, configuracion y registros.

## Firebase: roles recomendados

La app mantiene respaldo por correo para no romper accesos, pero la ruta recomendada es usar custom claims.

Ejemplo con Admin SDK:

```js
await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
await admin.auth().setCustomUserClaims(uid, { role: 'supervisor' });
await admin.auth().setCustomUserClaims(uid, { role: 'user' });
```

Despues de asignar claims, el usuario debe cerrar sesion y volver a entrar.

## OpenRouteService

La clave anterior estaba en el frontend. Ahora se lee desde:

```env
VITE_ORS_API_KEY=...
```

Como esa clave ya estuvo expuesta, conviene:

1. Entrar a OpenRouteService.
2. Revocar la clave anterior.
3. Crear una nueva.
4. Pegar la nueva en `.env.local`.

## GitHub

1. Verifica que `.env.local` no se suba al repositorio.
2. Si `.env.local` ya fue subido antes, elimina el archivo del historial o rota todas las claves.
3. Sube solo estos archivos de reglas/configuracion:
   - `firestore.rules`
   - `storage.rules`
   - `firebase.json`
   - archivos dentro de `src/`
   - `docs/`

## Verificacion local

```powershell
npm.cmd run check
```

Si PowerShell bloquea `npm`, usa siempre `npm.cmd`.

## Dependencias de Functions

Se quitaron dependencias frontend del backend. Al actualizar el lockfile, npm reporto vulnerabilidades en dependencias transitivas de `functions`.

Revisa antes de produccion:

```powershell
cd functions
npm.cmd audit
```

Evita `npm audit fix --force` sin probar, porque puede introducir cambios mayores.
