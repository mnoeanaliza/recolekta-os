# Operacion Firebase, costos y GitHub

Este proyecto ya separa configuracion sensible en variables `VITE_*` y agrega reglas base para Firestore y Storage.

## Que se optimizo

- Un transportista ya no descarga los registros de los demas usuarios.
- Produccion del transportista se limita a sus registros del dia actual.
- Combustible y mantenimiento se consultan solo al abrir su modulo y tienen limite.
- Horas extras se consultan solo al abrir `H. Extra` o `Mi perfil`.
- Administracion y supervision cargan datos operativos solo en el modulo visible.
- Analitica consulta como maximo 24 resumenes mensuales, no historicos anuales completos.
- Los avisos se limitan a los 10 mas recientes para transportistas y 20 para responsables.
- Las Cloud Functions actualizan contadores mensuales en forma incremental e idempotente.
- El historico 2025 se toma del CSV existente y no vuelve a descargarse de Firestore.

| Accion | Lectura esperada |
| --- | --- |
| Iniciar como transportista | perfil propio, 2 configuraciones, avisos recientes, agenda propia, registros propios del dia y ultimo mantenimiento |
| Abrir combustible | hasta 30 registros propios, o hasta 60 dentro del corte configurado |
| Abrir mantenimiento | hasta 30 registros propios, o hasta 60 dentro del corte configurado |
| Abrir perfil | horas extras propias desde el inicio del corte |
| Iniciar como administrador o supervisor | pantalla inicial sin descargar bitacora, combustible, taller ni agenda completa |
| Abrir Operaciones o Bitacora | 50 registros recientes; cada `Cargar 50 mas` es una accion voluntaria |
| Pulsar Sincronizar nube | una lectura controlada del mes actual y solo las escrituras de perfiles que cambiaron |
| Abrir Analitica | hasta 24 documentos de resumen mensual |
| Abrir Flota como responsable | combustible y mantenimiento del mes actual |

La vista previa de Vercel no despliega reglas, indices ni Functions. Esos cambios se publican por separado en Firebase.

## Despliegue controlado en Firebase

No mezclar este procedimiento con el merge a `main`. Primero se prueba la rama en Vercel y luego se publica Firebase en este orden.

### 1. Revisar lo que existe

Desde una terminal autenticada, en la raiz del proyecto:

```powershell
firebase use recolekta-app
firebase functions:list
```

Antes de continuar, guardar la lista. Las funciones antiguas `auditorDeEficiencia` y `resumenGlobalMensual` no deben permanecer activas porque vuelven a leer el mes completo con cada registro.

### 2. Publicar reglas e indices

1. Revisa `firestore.rules` y `storage.rules`.
2. Confirma que los correos admin/supervisor coincidan con tu equipo real.
3. Ejecuta:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,storage
```

4. Espera hasta que todos los indices aparezcan como `Habilitado` en Firebase.

### 3. Publicar las funciones nuevas

```powershell
firebase deploy --only functions:resumenProduccionMensual,functions:resumenCombustibleMensual,functions:resumenMantenimientoMensual,functions:reconstruirResumenesHistoricos
```

Si Firebase avisa que las funciones antiguas van a eliminarse, confirmar solamente estos nombres:

- `auditorDeEficiencia`
- `resumenGlobalMensual`

No eliminar una funcion desconocida sin revisarla primero.

### 4. Crear la base de resumenes una sola vez

1. Abrir la app con un administrador.
2. Entrar en `Analitica`.
3. Seleccionar el año actual.
4. Pulsar `Resumir <año>` y confirmar.
5. Repetir solo para otro año que realmente se necesite consultar.

Esta accion hace una lectura controlada del año para crear 12 documentos. No se ejecuta al iniciar sesion ni al abrir Analitica.

### 5. Prueba funcional

Prueba con un usuario transportista:
   - Puede crear sus propios registros.
   - No puede editar/borrar registros de otros.
   - Puede leer su agenda y sus datos.
   - Sus valores de perfil solo cambian al usar `Sincronizar nube`.

Prueba con admin:
   - Puede editar agenda, catalogos, configuracion y registros.
   - Analitica muestra meses anteriores sin descargar registros detallados.

Prueba con supervisor:
   - Cada modulo muestra su informacion sin errores de indices.
   - Cambiar de modulo cierra la consulta del modulo anterior.

### 6. Verificar consumo real

En Firebase Console revisar durante 3 a 7 dias:

1. `Firestore Database > Uso`: lecturas, escrituras y eliminaciones por dia.
2. `Firestore Database > Estadisticas de consultas`: consultas con mas documentos leidos.
3. `Functions > Uso`: invocaciones, tiempo y errores por funcion.
4. `Google Cloud Billing > Reports`: agrupar por `SKU` y filtrar el proyecto `recolekta-app`.

Comparar estos datos con una semana anterior de actividad similar. El cambio evita el crecimiento cuadratico de las funciones, pero no puede corregir cargos de otros servicios o proyectos que aparezcan en el informe por SKU.

### 7. Plan de reversa

Si una funcion nueva presenta errores:

1. No ejecutar otra reconstruccion anual.
2. Revisar `Functions > Logs` y el nombre exacto de la funcion.
3. Mantener la rama de GitHub sin fusionar hasta corregirla.
4. No restaurar las funciones que recalculaban el mes completo; corregir la funcion incremental en la rama.

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
