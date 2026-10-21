# DiveSafe Pro — Guía de instalación y ejecución

Esta guía te lleva paso a paso desde "tengo esta carpeta descomprimida"
hasta "tengo el sistema corriendo en mi navegador". Está pensada para
alguien que nunca usó Node.js, así que no te saltees pasos aunque te
parezcan obvios.

El proyecto tiene 3 partes:

1. **database/** → scripts SQL para crear la base en SSMS
2. **backend/** → API en Node.js/Express que habla con la base
3. **frontend/** → la aplicación web en React que ves en el navegador

---

## Parte 0 — Instalar lo necesario (una sola vez)

### 0.1. Instalar Node.js

1. Andá a **https://nodejs.org**
2. Descargá la versión **LTS** (la recomendada, no la "Current")
3. Instalá con las opciones por defecto (Next, Next, Next...)
4. Para confirmar que quedó instalado, abrí la **Símbolo del sistema** (cmd) o
   **PowerShell** y escribí:
   ```
   node --version
   npm --version
   ```
   Te tienen que aparecer números de versión (ej: `v20.11.0`). Si da error
   de "comando no reconocido", reiniciá la computadora y probá de nuevo.

### 0.2. Instalar un editor de código (Visual Studio Code)

1. Andá a **https://code.visualstudio.com**
2. Descargá e instalá con las opciones por defecto
3. Es donde vas a poder ver y tocar el código si hace falta

### 0.3. Verificar que tenés SQL Server Management Studio (SSMS)

Vos ya lo tenés instalado con SQL Server 2008. Si no lo encontrás, se
instala aparte de SQL Server, buscá "SQL Server Management Studio"
en el buscador de Windows.

---

## Parte 1 — Habilitar la autenticación de SQL Server (una sola vez)

Por defecto, SQL Server suele venir configurado con **Autenticación de
Windows** solamente. Nuestro backend necesita conectarse con un
**usuario y contraseña propios de SQL Server** (autenticación mixta).
Vamos a habilitarlo y crear ese usuario.

### 1.1. Habilitar el modo de autenticación mixta

1. Abrí **SSMS** y conectate a tu instancia con tu usuario de Windows
   (como siempre hacés)
2. En el panel izquierdo (Object Explorer), **clic derecho sobre el
   nombre del servidor** (el de arriba de todo) → **Properties**
3. En el panel de la izquierda de la ventana que se abre, hacé clic en
   **Security**
4. Donde dice "Server authentication", cambiá la opción a:
   **SQL Server and Windows Authentication mode**
5. Aceptá (OK)
6. **Este cambio requiere reiniciar el servicio de SQL Server.**
   Clic derecho sobre el nombre del servidor → **Restart**
   (Si te pide confirmación, aceptá. Puede tardar un minuto)

### 1.2. Crear un usuario de SQL Server para la aplicación

1. En Object Explorer, desplegá tu servidor → carpeta **Security** →
   clic derecho en **Logins** → **New Login...**
2. En "Login name" escribí: `divesafe_app`
3. Seleccioná **SQL Server authentication**
4. Poné una contraseña propia y segura (anotala, la vas a necesitar
   después). No uses una contraseña de ejemplo: este repositorio es
   público y ese usuario tiene permisos de administrador del servidor
5. Destildá **"Enforce password expiration"** (para que no te pida
   cambiarla cada tanto durante el desarrollo)
6. Andá a la sección **Server Roles** (panel izquierdo) y tildá
   **sysadmin** (para simplificar permisos durante el desarrollo del
   prototipo — en un sistema en producción real se restringiría más)
7. Aceptá (OK)

Con esto ya tenés el usuario `divesafe_app` con contraseña que usará
el backend para conectarse.

### 1.3. Habilitar TCP/IP (SQL Server Express)

Las instalaciones de SQL Server Express suelen traer el protocolo
**TCP/IP deshabilitado**, y el backend se conecta justamente por TCP.
Si tu servidor ya acepta conexiones por el puerto 1433, salteá este paso.

1. Apretá **Windows + R**, escribí `SQLServerManager10.msc` y Enter
   (abre "SQL Server Configuration Manager"; el número cambia según la
   versión: `10` es SQL Server 2008/2008 R2)
2. **SQL Server Network Configuration** → **Protocols for SQLEXPRESS**
   (o el nombre de tu instancia)
3. Clic derecho en **TCP/IP** → **Enable**
4. Doble clic en **TCP/IP** → pestaña **IP Addresses** → bajá hasta
   **IPAll**: poné `TCP Port = 1433` y dejá `TCP Dynamic Ports` vacío
5. **OK**, y después **SQL Server Services** → clic derecho en
   **SQL Server (SQLEXPRESS)** → **Restart**

---

## Parte 2 — Crear la base de datos

1. Abrí SSMS, conectate con tu login de Windows de siempre
2. Abrí el archivo **database/01_crear_base_y_tablas.sql**
   (Archivo → Abrir → Archivo... y buscalo en la carpeta que descomprimiste)
3. Presioná **Ejecutar** (F5, o el botón de play). Al final del panel de
   mensajes debería decir: `Base de datos DiveSafeProDB creada correctamente.`
4. Abrí el archivo **database/02_datos_semilla.sql**
5. Presioná **Ejecutar** (F5). Debería decir:
   `Usuarios semilla creados: Franco (Administrador) y Beto (Instructor).`

> **Ojo:** el script `01` **borra y recrea** la base `DiveSafeProDB` si ya
> existe. Corrélo solo en una instalación nueva.

Listo, ya tenés la base `DiveSafeProDB` con todas las tablas (usuarios,
sitios de buceo, planificaciones y alertas) y los 2 usuarios de prueba.
Los sitios de buceo los cargás después desde la app (módulo **Sitios**,
solo administrador) antes de poder planificar.

**¿Ya tenías la base creada antes de que existiera el módulo de sitios?**
No corras el `01` (perderías los datos). Corré solamente
**database/03_sitios_buceo.sql**: agrega la tabla `SitiosBuceo` y la columna
`Planificaciones.SitioId` sin borrar nada, y se puede ejecutar más de una vez
sin problema.

---

## Parte 3 — Configurar y correr el backend

### 3.1. Abrir la carpeta del backend

1. Abrí **Visual Studio Code**
2. Archivo → Abrir carpeta... → seleccioná la carpeta **backend**
   (la que está dentro de lo que descomprimiste)

### 3.2. Configurar la conexión a la base

1. Dentro de VS Code, buscá el archivo **.env.example**
2. Hacé una copia y renombrala a **.env** (sin ".example"). Podés
   hacerlo desde el explorador de archivos de Windows, o en VS Code
   con clic derecho → "Copy" y después "Paste", y renombrar.
3. Abrí el archivo **.env** y completá con tus datos reales:
   ```
   DB_SERVER=localhost
   DB_PORT=1433
   DB_DATABASE=DiveSafeProDB
   DB_USER=divesafe_app
   DB_PASSWORD=la-contraseña-que-elegiste-en-el-paso-1.2
   PORT=4000
   JWT_SECRET=un-texto-largo-y-aleatorio-que-solo-conozcas-vos
   ```
   (Reemplazá `DB_PASSWORD` con la contraseña que elegiste en el paso 1.2)

   > El archivo `.env` queda fuera del repositorio (está en `.gitignore`):
   > nunca lo subas, tiene tus contraseñas.

   > **Si tu SQL Server usa una instancia con nombre** (por ejemplo
   > `SQLEXPRESS`), dejá `DB_SERVER=localhost` y `DB_PORT=1433`, y asegurate
   > de haber hecho el paso 1.3 (puerto fijo 1433). Así no hace falta el
   > servicio "SQL Server Browser".

### 3.3. Instalar las dependencias y correr el servidor

1. En VS Code, abrí una terminal: **Terminal → New Terminal** (o `Ctrl + ñ`)
2. Escribí y ejecutá:
   ```
   npm install
   ```
   Esto descarga todas las librerías que necesita el backend (tarda
   uno o dos minutos, solo hace falta hacerlo la primera vez o cuando
   cambie algo en `package.json`)
3. Una vez que termine, escribí:
   ```
   npm run dev
   ```
4. Si todo salió bien vas a ver algo como:
   ```
   🚀 DiveSafe Pro API corriendo en http://localhost:4000
   ✅ Conectado a SQL Server: DiveSafeProDB
   ```

**Dejá esta terminal abierta** (el backend tiene que seguir corriendo
todo el tiempo que uses la app). Si la cerrás, el backend se apaga.

### Si da error de conexión a la base

- Revisá que el **servicio de SQL Server** esté corriendo (Windows: buscá
  "Servicios" → "SQL Server (MSSQLSERVER)" tiene que decir "En ejecución")
- Revisá usuario/contraseña/servidor en el `.env`
- Revisá que hayas hecho el paso 1.1 (autenticación mixta) y reiniciado
  el servicio de SQL Server después de cambiarlo
- Si tu instancia tiene un nombre especial, probá poniendo en `DB_SERVER`
  algo como `localhost\SQLEXPRESS` o el nombre que corresponda

---

## Parte 4 — Configurar y correr el frontend

### 4.1. Abrir una NUEVA ventana de VS Code para el frontend

Como el backend tiene que seguir corriendo, necesitás una segunda
terminal (o una segunda ventana de VS Code) para el frontend.

1. Abrí una nueva ventana de VS Code: Archivo → Nueva ventana
2. Archivo → Abrir carpeta... → seleccioná la carpeta **frontend**

### 4.2. Instalar dependencias y correr

1. Abrí una terminal en esa ventana (Terminal → New Terminal)
2. Ejecutá:
   ```
   npm install
   ```
3. Cuando termine, ejecutá:
   ```
   npm run dev
   ```
4. Vas a ver algo como:
   ```
   Local:   http://localhost:5173/
   ```
5. Abrí ese link (`http://localhost:5173`) en tu navegador (Chrome,
   Edge, el que uses)

---

## Parte 5 — Usar el sistema

Con el **backend corriendo** (terminal 1) y el **frontend corriendo**
(terminal 2), en el navegador vas a ver la pantalla de login.

Usuarios de prueba:

| Usuario | Contraseña | Rol |
|---|---|---|
| Franco | 123 | Administrador |
| Beto | 123 | Instructor |

- Con **Franco** vas a poder ver los módulos de **Sitios** (ubicaciones
  de buceo en el mapa) y **Usuarios** (crear instructores nuevos, resetear
  contraseñas), además de todo lo demás.
- Con **Beto** vas a poder planificar inmersiones y auditar registros,
  pero no vas a ver el módulo de Usuarios (queda oculto).

### Flujo típico de prueba

0. La primera vez, iniciá sesión con **Franco** (administrador), andá a
   **Sitios** y cargá al menos un sitio de buceo (nombre + latitud y
   longitud). Sin sitios cargados no se puede planificar. El menú principal
   muestra el mapa de riesgo por sitio.
1. Iniciá sesión
2. Andá a **Planificar** → completá el formulario (podés cambiar las
   variables ambientales para probar distintos escenarios)
3. Presioná **Evaluar riesgo** → vas a ver las alertas/recomendaciones
   que generó el motor de reglas
4. Si hay advertencias, escribí una justificación y presioná
   **Registrar planificación**
5. Andá a **Auditar** → vas a ver la planificación recién guardada en
   la lista, con su nivel de riesgo. Hacé clic en **Auditar** para ver
   el detalle completo con la línea de tiempo de alertas y decisiones

---

## Cada vez que quieras volver a usar el sistema (no la primera vez)

No hace falta repetir todo desde cero. Solo:

1. Asegurate de que el servicio de SQL Server esté corriendo
2. Abrí una terminal en la carpeta **backend** y ejecutá `npm run dev`
3. Abrí otra terminal en la carpeta **frontend** y ejecutá `npm run dev`
4. Abrí `http://localhost:5173` en el navegador

(`npm install` solo hace falta correrlo de nuevo si borraste la carpeta
`node_modules` o cambió algo en `package.json`)

---

## Qué falta para llegar al sistema final (fuera del alcance de este MVP)

Estas son las cosas que mencionás en tu tesis como pendientes, y que
podemos ir sumando en las próximas iteraciones:

- Conectar la sección de variables ambientales a una **API climática
  real** (OpenWeather, NOAA, Windy, etc.) en vez de carga manual
- Desplegar el sistema en un servidor en la nube (por ahora corre en
  tu computadora / "localhost")
- Migrar de SQL Server 2008 a una versión más nueva si en algún
  momento se vuelve un problema de compatibilidad
- Mejoras de seguridad adicionales para producción (por ejemplo,
  políticas de expiración de contraseña, rate limiting del login, etc.)

Cualquier error que te aparezca al seguir esta guía, mandame el mensaje
de error completo (captura de pantalla o texto) y lo resolvemos.
