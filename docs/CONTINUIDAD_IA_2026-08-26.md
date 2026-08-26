# Continuidad de Recolekta OS

Documento de entrega para continuar el proyecto con otra IA. No contiene credenciales ni valores de `.env.local`.

## Estado actual

- Carpeta de trabajo: `C:\Users\AcerNitroV\Desktop\recolekta-app_Modulos`
- Rama activa: `mejora-modular-2026`
- Rama remota: `origin/mejora-modular-2026`
- Producción de GitHub/Vercel: `main`, sin fusionar con la rama de mejora.
- Último commit de la rama: `402d3d7 Restaura indice de viajes diarios`.
- La aplicación local se inicia con:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 3001
```

- URL local: `http://127.0.0.1:3001/`
- URL de vista previa de la rama: `https://recolekta-os-git-mejora-modular-2026-noe-martinezs-projects.vercel.app/`
- URL de producción actual: `https://recolekta-os.vercel.app/`
- Proyecto Firebase: `recolekta-app`.

## Decisiones de negocio importantes

1. Recolekta debe mantener el costo de Firebase bajo. No se acepta descargar históricos completos cada vez que un usuario inicia sesión.
2. Los transportistas deben leer solamente sus datos y los módulos deben consultar datos solo cuando el usuario los abre.
3. El botón `Sincronizar nube`, usado por administración, debe ser la acción controlada que recalcula los contadores mensuales de perfiles. No debe transformarse en actualización automática al abrir la app.
4. Las gráficas de analítica deben mostrar meses disponibles del año actual sin descargar todos los registros detallados. Se decidió usar resúmenes mensuales.
5. La configuración de corte de horas extra (`configuraciones/general`, campos `heInicio` y `heFin`) la fija el administrador y debe controlar tanto el perfil del transportista como el historial de H. Extra y los reportes de RRHH.
6. El usuario quiere preservar el flujo actual de tres perfiles: administrador, supervisor y transportista.

## Arquitectura actual

- Frontend: React + Vite + Firebase Web SDK.
- Datos: Cloud Firestore.
- Archivos: Firebase Storage.
- Backend: Cloud Functions de primera generación en `functions/index.js`.
- Despliegue web: Vercel conectado al repositorio GitHub `mnoeanaliza/recolekta-os`.
- Configuración web: variables `VITE_*` en `.env.local` para desarrollo y en Vercel para Preview/Production. Nunca guardar valores secretos en Git.
- La rama modular separó los grandes paneles de `App.jsx` en `src/modules/` y componentes reutilizables.

## Trabajo ya realizado

### Refactor y seguridad

- Commit base: `890b362 Refactor modular y optimizacion de consultas`.
- Se separaron paneles de administrador, supervisor y transportista.
- Se agregó `.env.example`, `.gitignore`, `firebase.json`, reglas de Firestore y Storage, índices y documentación.
- Se corrigió el error `ListChecks is not defined` que dejaba en blanco `Mi Perfil`.
- Se corrigió el error de Recharts `Map is not a constructor` usando el objeto nativo sin colisión con el icono `Map`.
- Se agregó un favicon para evitar el error visual de `vite.svg`/`favicon.ico` 404.

### Optimización de costos

- Commit principal: `7254121 Reduce lecturas y hace resumenes idempotentes`.
- Transportista: producción diaria propia, no registros de toda la flota.
- Combustible y mantenimiento: se cargan en sus módulos y tienen límite de resultados.
- Administración y supervisión: cada módulo carga su propia información, en lugar de escuchar todas las colecciones al entrar.
- Analítica: lee documentos de `resumenes_mensuales` para el consolidado anual, no todo el histórico de producción.
- Avisos: se limitaron y se añadió vigencia para no mostrar alertas antiguas permanentemente.
- Funciones: se reemplazó el cálculo mensual global repetitivo por resúmenes incrementales e idempotentes.
- La lista detallada está en `docs/OPERACION_FIREBASE_GITHUB.md`.

### Firebase desplegado

Se desplegaron al proyecto `recolekta-app` estas funciones:

- `resumenProduccionMensual`
- `resumenCombustibleMensual`
- `resumenMantenimientoMensual`
- `reconstruirResumenesHistoricos`

Se eliminaron las funciones costosas antiguas:

- `auditorDeEficiencia`
- `resumenGlobalMensual`

También se ejecutó una reconstrucción histórica controlada una vez desde administración. Las funciones y los índices son compartidos por producción y por la vista previa: no dependen de que la rama haya sido fusionada en GitHub.

## Índices Firestore actuales

El último chequeo remoto confirmó estos índices compuestos:

| Colección | Campos |
| --- | --- |
| `registros_produccion` | `recolector ASC`, `createdAt DESC` |
| `registros_produccion` | `recolector ASC`, `createdAt ASC` |
| `registros_produccion` | `usuarioEmail ASC`, `createdAt DESC` |
| `registros_combustible` | `usuario ASC`, `fecha DESC` |
| `registros_mantenimiento` | `usuario ASC`, `fecha DESC` |
| `registros_horas_extras` | `usuario ASC`, `fecha DESC` |
| `registros_horas_extras` | `usuario ASC`, `fecha ASC` |

El último índice de horas extra se creó con el commit `42195de`. Es una compatibilidad necesaria para el código antiguo de `main`, que ejecuta una consulta por `usuario` y `fecha >= inicioCorte` sin `orderBy`. Sin ese índice la producción mostró vacíos en horas extra aunque el código de `main` no hubiera cambiado.

TTL también está habilitado para `_eventos_funciones.expiresAt`.

## Incidencias recientes y situación real

### 1. La aplicación principal dejó de mostrar horas extra

**Causa probable confirmada:** producción y la rama comparten Firestore. Al desplegar el primer archivo de índices se reemplazó un índice manual antiguo. El código antiguo de `main` requiere `registros_horas_extras(usuario ASC, fecha ASC)`.

**Acción aplicada:** se agregó y desplegó el índice ascendente. La aplicación de producción debe recuperarse con una recarga dura (`Ctrl + F5`). Verificar con un transportista real y revisar consola por si aparece otro enlace de creación de índice.

### 2. Horarios quedaba en blanco en local

**Error:** `ScheduleModule.jsx:63 ReferenceError: userName is not defined`.

**Causa:** el refactor eliminó el listener interno del componente, pero dejó el texto que usa `userName`.

**Acción aplicada:** [ScheduleModule.jsx](../src/components/ScheduleModule.jsx) recibe `userName` con un valor seguro; [TransportistaHome.jsx](../src/modules/TransportistaHome.jsx) se lo entrega. Compilación comprobada con `npm.cmd run check`.

### 3. Horas extra aún no se comportan como el usuario espera

**Este punto sigue abierto y debe investigarse antes de darlo por resuelto.**

El usuario reportó que:

- el perfil de algunos transportistas muestra `0.0h` aunque había registros en el corte;
- el módulo H. Extra mostró solo fechas 20, 21 y 22 de agosto, pero se esperaban fechas hasta el 25;
- el resultado no vuelve a ser el histórico basado exactamente en el corte quincenal definido por el administrador.

El commit `42195de` cambió la lectura del transportista para hacer una lectura puntual de hasta 100 documentos propios y filtrar localmente el rango con `isDateInRange`. La intención fue evitar un listener permanente y tolerar fechas antiguas `DD/MM/AAAA` e ISO. Sin embargo, el usuario reporta que la visualización sigue incompleta.

La siguiente IA debe:

1. Abrir Firestore Console y revisar documentos reales de `registros_horas_extras` de un usuario afectado: `usuario`, `fecha`, `createdAt`, `horasCalculadas` y formato exacto de fecha.
2. Confirmar si las fechas 23-25 son documentos de horas extra o solamente registros de ruta. Los viajes no deben crear horas extra automáticamente.
3. Confirmar que `configuraciones/general.heInicio` y `heFin` sean fechas ISO válidas y que incluyan esos días.
4. Usar una consulta eficiente que mantenga el corte en Firestore cuando los datos sean ISO. Si hay datos antiguos con distintos formatos, implementar una migración administrativa única hacia `fechaISO`, no depender indefinidamente de filtros locales.
5. Mantener la regla de costo: no cargar horas extra al iniciar sesión; hacerlo al abrir Perfil/H. Extra y, de ser posible, con una acción explícita de refresco.
6. Añadir una prueba visual con al menos Antonio y un transportista creado recientemente.

No afirmar que el problema de horas extra está resuelto hasta validar documentos reales y ambos perfiles.

### 4. El contador diario de producción mostró 0% en producción

**Síntoma:** en `recolekta-os.vercel.app`, un transportista podía ver sus acumulados mensuales en el perfil pero el panel lateral mostraba `0%` y `Esperando datos del día` aun cuando ya había registrado recolecciones.

**Causa confirmada:** el código antiguo de `main` consulta `registros_produccion` con `recolector == nombre` y `createdAt >= inicioDelDía`, sin `orderBy`. Esto requiere el índice compuesto `recolector ASC + createdAt ASC`. Solo estaba disponible el índice descendente usado por la rama optimizada.

**Acción aplicada:** se agregó y desplegó el índice ascendente con el commit `402d3d7`. El índice fue verificado mediante Firebase CLI. Recargar producción con `Ctrl + F5` y validar con un transportista que ya haya creado registros hoy. Si aún no aparecen, revisar la consola por un enlace de índice y comparar `recolector` del documento con el nombre almacenado en su perfil.

### 5. El servidor local mostró `ERR_CONNECTION_REFUSED`

No fue un cambio de datos: Vite se había detenido. Se reactivó con:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 3001
```

El servidor queda disponible en `http://127.0.0.1:3001/` mientras siga abierto ese proceso. Si vuelve a aparecer la pantalla de conexión rechazada, iniciar ese comando desde la raíz del proyecto.

## Otros requerimientos ya solicitados por el usuario

- El panel Flota tenía dos usuarios llamados Mauricio y la gráfica sumaba ambos por nombre corto. Se corrigió en `e587b0e Separa costos de transportistas con nombres repetidos`, usando identidad completa para cada transportista.
- El usuario preguntó cómo escalar la gráfica de costos a 20 o 30 transportistas. Pendiente proponer una experiencia con ranking, búsqueda, filtros por país/zona y vista detallada, sin intentar mostrar todas las etiquetas simultáneamente.
- El usuario desea una evolución futura de Recolekta a bajo costo:
  - mapa del transportista con paradas realizadas, entregas, próxima parada sugerida y listado de ruta;
  - fotos como evidencia de paquete enviado, recolectado y entregado;
  - flujo de solicitudes de recolección/envío, seguimiento e historial;
  - por ahora, el supervisor asignaría rutas mientras se diseña una solución apropiada para sucursales solicitantes;
  - antes de implementar esa evolución se debe presentar diseño, costos y fases, no comenzar a programarla directamente.
- No se ha usado OpenRouteService en la app. No rotar ni crear una clave sin necesidad. Si se adopta para rutas, evitar exponer una clave con permisos amplios en el frontend.

## GitHub y Vercel

- Repositorio: `https://github.com/mnoeanaliza/recolekta-os`
- Pull request: `Refactor modular y optimizacion de consultas #1`.
- El PR sigue como borrador y no debe fusionarse hasta que se corrija y pruebe por completo horas extra.
- Cada `git push` a `mejora-modular-2026` genera vista previa en Vercel.
- Las variables de entorno de Firebase ya se agregaron en Vercel para Preview de esa rama. Revisar antes de fusionar que los mismos nombres/valores necesarios existan en Production para `main`.
- La vista previa de Vercel no despliega Functions, reglas ni índices de Firebase. Eso se hace explícitamente con Firebase CLI.

## Verificación mínima antes de fusionar a main

1. `npm.cmd run check` debe finalizar correctamente.
2. Probar localmente los tres roles: admin, supervisor, transportista.
3. Transportista: Ruta, Combustible, Horarios, H. Extra y Mi Perfil, sin errores en consola.
4. Validar el corte de horas extra con dos usuarios antiguos y dos recientes, comparando Firestore con interfaz.
5. Producción `main`: recarga dura y prueba de horas extra, ya que comparte la base Firebase.
6. Firebase Console: verificar que todos los índices estén en estado `Habilitado`.
7. Revisar `Firestore Database > Uso` y `Estadísticas de consultas` durante varios días; comparar con el periodo previo.
8. Revisar `Google Cloud Billing > Reports`, agrupado por SKU, antes de atribuir todo el costo a Firestore.
9. Solo después de lo anterior marcar el PR como listo para revisión y fusionarlo.

## Comandos útiles

```powershell
# Compilación
npm.cmd run check

# Servidor local
npm.cmd run dev -- --host 127.0.0.1 --port 3001

# Estado de Git
git status --short --branch
git log --oneline -10

# Índices remotos, solo lectura
npx.cmd --yes firebase-tools firestore:indexes --project recolekta-app

# Despliegue deliberado de solo índices
npx.cmd --yes firebase-tools deploy --only firestore:indexes --project recolekta-app
```

No usar `git reset --hard`, `git checkout --`, ni desplegar `--only functions` o reglas sin revisar el diff y el objetivo exacto.
