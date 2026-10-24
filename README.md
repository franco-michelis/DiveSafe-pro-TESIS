# DiveSafe Pro

Sistema web de evaluación de riesgo y auditoría de inmersiones de buceo.
Proyecto Final de Ingeniería en Informática 2026.

## Índice

- [Qué es](#qué-es)
- [Qué hace](#qué-hace)
- [Requisitos](#requisitos)
- [Cómo instalarlo](#cómo-instalarlo)
- [Cómo ejecutarlo](#cómo-ejecutarlo)
- [Variables de entorno](#variables-de-entorno)
- [Solución de problemas](#solución-de-problemas)
- [Autor](#autor)

---

## Qué es

**DiveSafe Pro** es una aplicación web pensada para escuelas e instructores de buceo. Antes de cada inmersión, el
instructor carga los datos del plan (sitio, profundidad, alumnos, equipo, etc.) y el sistema los cruza con las
**condiciones ambientales en tiempo real** del lugar. Un **motor de reglas** basado en estándares de PADI, SNSI y NAUI
asigna un nivel de riesgo (**Bajo, Medio o Alto**), emite advertencias y recomendaciones y, si hay advertencias,
exige que el instructor justifique su decisión. Todo queda registrado con un hash de integridad para poder
**auditarlo** después.

Estado: **MVP**. Funciona de punta a punta; el despliegue en la nube y algunas mejoras de seguridad para producción
quedan como trabajo futuro.

Está formado por tres partes:

| Carpeta | Contenido | Tecnología |
|---|---|---|
| `database/` | Scripts SQL de la base de datos | Microsoft SQL Server (2008 en adelante) |
| `backend/` | API REST y motor de reglas | Node.js, Express, `mssql`, JWT, bcrypt |
| `frontend/` | Aplicación web | React, Vite, Leaflet |

El repositorio incluye además `prototipo/`, con el prototipo HTML inicial del diseño.

## Qué hace

Hay dos roles: **Administrador** e **Instructor**.

| Módulo | Quién lo usa | Qué permite |
|---|---|---|
| **Menú** | Todos | Mapa de Argentina con los sitios de buceo. Cada pin se colorea según el riesgo más frecuente de sus planificaciones (verde, naranja o rojo; en caso de empate se muestra el más grave) y una tarjeta indica el porcentaje y la cantidad por nivel. Muestra además totales y la última planificación. |
| **Planificar** | Todos | Formulario de inmersión con validaciones. Al elegir el sitio muestra, solo para consulta, las condiciones ambientales en tiempo real. Evalúa el riesgo con el motor de reglas y registra la planificación. |
| **Auditar** | Todos ven el listado; solo el administrador abre el detalle | Historial con filtros y estadísticas. El detalle muestra todas las variables, el origen de los datos ambientales, la línea de tiempo de alertas y decisiones, y el hash de integridad. |
| **Sitios** | Administrador | Alta, edición y baja lógica de los sitios de buceo con nombre y coordenadas, con vista previa del punto en el mapa mientras se escriben. |
| **Usuarios** | Administrador | Alta de instructores, reseteo de contraseña, activación y desactivación. |

**Datos ambientales.** Las trae el backend de la API gratuita [Open-Meteo](https://open-meteo.com) a partir de las
coordenadas del sitio: clima, viento, cobertura de nubes, oleaje, corriente, temperatura del agua y marea. No se pueden
modificar desde la pantalla. Hay dos excepciones, porque ninguna API gratuita los cubre:

- **Visibilidad bajo el agua:** la carga siempre el instructor.
- **Lagos y lagunas:** la API no tiene datos del agua (oleaje, corriente, temperatura, marea). El sistema lo indica, permite
  cargar a mano oleaje, corriente y temperatura de forma opcional y, si quedan vacíos, avisa qué reglas no pudieron
  evaluarse.

Cada planificación guarda las variables ambientales junto con su fuente, la hora del dato y cuáles cargó el instructor.
Si la API no responde, no se puede evaluar ni registrar (el sistema no inventa condiciones).

## Requisitos

- **Windows** (la instalación está descripta para Windows; el backend y el frontend también corren en otros sistemas).
- **Node.js 18 o superior** (versión LTS recomendada; probado con v24) y **npm**, que viene con Node.js.
  Descarga: <https://nodejs.org>
- **Microsoft SQL Server 2008 o superior** (probado con SQL Server 2008 R2 Express) y **SQL Server Management Studio
  (SSMS)** para ejecutar los scripts.
- **Git** para clonar el repositorio (o descargar el ZIP desde GitHub).
- **Conexión a internet:** hace falta para las condiciones ambientales (Open-Meteo) y para los mosaicos del mapa
  (OpenStreetMap).
- Un navegador moderno (Chrome, Edge, Firefox).

## Cómo instalarlo

### 1. Obtener el código

```bash
git clone https://github.com/franco-michelis/usal-DiveSafe-pro.git
cd usal-DiveSafe-pro
```

### 2. Preparar SQL Server

El backend se conecta con un usuario y contraseña de SQL Server (no con el usuario de Windows), por TCP.

**2.1. Habilitar la autenticación mixta**

1. Abrí SSMS y conectate con tu usuario de Windows.
2. Clic derecho sobre el servidor → **Properties** → **Security**.
3. En "Server authentication" elegí **SQL Server and Windows Authentication mode** y aceptá.
4. Clic derecho sobre el servidor → **Restart** (el cambio lo requiere).

**2.2. Crear el usuario de la aplicación**

1. En SSMS: **Security** → clic derecho en **Logins** → **New Login...**
2. *Login name*: `divesafe_app`. Elegí **SQL Server authentication** y una contraseña propia y segura (la vas a
   necesitar para el `.env`). Destildá "Enforce password expiration".
3. En **Server Roles** tildá `sysadmin` (simplifica el desarrollo; en un sistema en producción se restringirían los
   permisos).

**2.3. Habilitar TCP/IP (SQL Server Express)**

Las instalaciones de SQL Server Express suelen traer TCP/IP deshabilitado. Si tu servidor ya acepta conexiones por el
puerto 1433, salteá este paso.

1. Apretá **Windows + R**, escribí `SQLServerManager10.msc` y Enter. Abre "SQL Server Configuration Manager" (el número
   depende de la versión: `10` es SQL Server 2008/2008 R2).
2. **SQL Server Network Configuration** → **Protocols for SQLEXPRESS** (o el nombre de tu instancia).
3. Clic derecho en **TCP/IP** → **Enable**.
4. Doble clic en **TCP/IP** → pestaña **IP Addresses** → bajá hasta **IPAll**: `TCP Port = 1433` y dejá
   `TCP Dynamic Ports` vacío.
5. Aceptá, y en **SQL Server Services** reiniciá **SQL Server (SQLEXPRESS)**.

**2.4. Crear la base de datos**

En SSMS, conectado con tu usuario de Windows, abrí y ejecutá (F5) en este orden:

1. `database/01_crear_base_y_tablas.sql` crea la base `DiveSafeProDB` con todas las tablas. Debe terminar con
   `Base de datos DiveSafeProDB creada correctamente.`
2. `database/02_datos_semilla.sql` crea los usuarios de prueba (ver [Cómo ejecutarlo](#cómo-ejecutarlo)).

> **Ojo:** el script `01` **borra y recrea** `DiveSafeProDB` si ya existe. Usalo solo en una instalación nueva.

**¿Ya tenías una base creada con una versión anterior?** No ejecutes el `01`. Ejecutá solo los scripts de actualización
que te falten, en este orden. Ninguno borra datos y todos se pueden ejecutar más de una vez:

- `database/03_sitios_buceo.sql` agrega los sitios de buceo.
- `database/04_ambiente_api.sql` prepara las planificaciones para los datos de la API y agrega columnas de auditoría.

### 3. Instalar el backend

```bash
cd backend
npm install
```

Después creá el archivo de configuración: copiá `backend/.env.example` como `backend/.env` y completalo con tus datos
(ver [Variables de entorno](#variables-de-entorno)). **No subas nunca el `.env` al repositorio**: está en el
`.gitignore` porque contiene contraseñas.

### 4. Instalar el frontend

```bash
cd frontend
npm install
```

## Cómo ejecutarlo

Hacen falta **dos terminales abiertas a la vez**, una para el backend y otra para el frontend. (En el PowerShell de
Windows el operador `&&` no funciona: ejecutá cada comando por separado.)

**Terminal 1: backend** (API en <http://localhost:4000>)

```bash
cd backend
npm run dev
```

Tiene que aparecer `DiveSafe Pro API corriendo en http://localhost:4000`. La conexión a la base se confirma la primera
vez que se usa (`Conectado a SQL Server: DiveSafeProDB`).

**Terminal 2: frontend** (aplicación en <http://localhost:5173>)

```bash
cd frontend
npm run dev
```

Abrí <http://localhost:5173> en el navegador. Si cerrás las terminales, la aplicación se apaga; la próxima vez solo
repetí estos dos comandos (`npm install` no hace falta de nuevo).

**Usuarios de prueba** (creados por `02_datos_semilla.sql`, solo para el prototipo; las contraseñas se guardan con
bcrypt):

| Usuario | Contraseña | Rol |
|---|---|---|
| Franco | 123 | Administrador |
| Beto | 123 | Instructor |

**Primer uso:** entrá con **Franco**, andá a **Sitios** y cargá al menos un sitio de buceo (nombre, latitud y longitud;
en Argentina ambas son negativas). Sin sitios cargados no se puede planificar. Después, en **Planificar**, elegí el
sitio, completá el formulario, cargá la visibilidad bajo el agua, presioná **Evaluar riesgo** y **Registrar
planificación**. El resultado se revisa en **Auditar**.

## Variables de entorno

Se configuran en `backend/.env` (plantilla: `backend/.env.example`). El frontend no usa variables de entorno: la
dirección del backend (`http://localhost:4000/api`) está en `frontend/src/api.js`.

| Variable | Descripción | Valor de ejemplo |
|---|---|---|
| `DB_SERVER` | Servidor de SQL Server. Con instancia con nombre (por ejemplo `SQLEXPRESS`) dejá `localhost` y usá el puerto fijo del paso 2.3. | `localhost` |
| `DB_PORT` | Puerto TCP de SQL Server. | `1433` |
| `DB_DATABASE` | Nombre de la base de datos. | `DiveSafeProDB` |
| `DB_USER` | Usuario de SQL Server creado en el paso 2.2. | `divesafe_app` |
| `DB_PASSWORD` | Contraseña de ese usuario. | *(la que elegiste)* |
| `PORT` | Puerto en el que escucha el backend. Si lo cambiás, actualizá también `frontend/src/api.js`. | `4000` |
| `JWT_SECRET` | Texto largo y aleatorio con el que se firman las sesiones. Cualquiera que lo conozca puede falsificar sesiones: no lo compartas. | *(texto largo y aleatorio)* |

La API de Open-Meteo **no necesita ninguna clave**.

## Solución de problemas

- **El backend no conecta a la base** (`Failed to connect to localhost:1433`): revisá que el servicio de SQL Server esté
  en ejecución (Windows → Servicios → "SQL Server (...)"), que hayas hecho los pasos 2.1 y 2.3 y reiniciado el servicio,
  y que usuario, contraseña y puerto del `.env` sean correctos.
- **`node` o `npm` "no se reconoce como comando"**: reiniciá la terminal (o la computadora) después de instalar Node.js.
- **El panel de condiciones ambientales muestra un error**: no hay conexión con Open-Meteo. Revisá tu conexión a
  internet y usá el botón **Reintentar**.
- **No aparecen sitios al planificar**: un administrador tiene que cargarlos en el módulo **Sitios**.

## Datos de terceros y licencias

- Datos ambientales: [Open-Meteo](https://open-meteo.com), licencia CC BY 4.0 (modelo de oleaje: DWD). El uso gratuito
  es **solo para fines no comerciales**; para un uso comercial hay que contratar su licencia. El sistema muestra la
  atribución en pantalla.
- Mapa: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright), mostrado con Leaflet.
- El código de este repositorio está bajo licencia **MIT** (ver [LICENSE](LICENSE)).

## Autor

**Franco Michelis**, estudiante de Ingeniería en Informática de la Universidad del Salvador (USAL).
Proyecto Final de Ingeniería en Informática 2026.

GitHub: [@franco-michelis](https://github.com/franco-michelis)
