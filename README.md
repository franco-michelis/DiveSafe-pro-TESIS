# DiveSafe-pro-TESIS
Repositorio de Franco Michelis para el Proyecto Final de Ingenieria en Informatica 2026.

## DiveSafe Pro

Sistema web de **evaluación de riesgo y auditoría de inmersiones de buceo**. El instructor planifica una
inmersión y un motor de reglas (basado en estándares de PADI, SNSI y NAUI) cruza los datos técnicos con las
condiciones ambientales para asignar un nivel de riesgo (Bajo / Medio / Alto), emitir advertencias y
recomendaciones y exigir una justificación cuando corresponde. Todo queda registrado con un hash de integridad
para su posterior auditoría.

> Estado: **MVP**. Las variables ambientales se cargan a mano; está previsto conectarlas a una API climática
> usando las coordenadas de cada sitio de buceo.

### Funcionalidades

- **Inicio de sesión** con roles (Administrador / Instructor).
- **Menú:** mapa de Argentina con los sitios de buceo, coloreados según el riesgo más frecuente de sus
  planificaciones, con el porcentaje y la cantidad por nivel.
- **Planificar:** formulario de inmersión con validaciones, evaluación automática de riesgo y registro.
- **Auditar:** historial con filtros, estadísticas y detalle completo de cada planificación (solo el
  administrador abre el detalle).
- **Sitios** (administrador): alta, edición y baja lógica de sitios de buceo con nombre y coordenadas, con
  vista previa en el mapa.
- **Usuarios** (administrador): alta de instructores, reseteo de contraseña, activación y desactivación.

### Tecnologías

| Capa | Tecnología |
|---|---|
| Base de datos | Microsoft SQL Server (2008 en adelante) |
| Backend | Node.js + Express, `mssql`, JWT, bcrypt |
| Frontend | React + Vite, Leaflet (mapa con OpenStreetMap) |

### Estructura

```
backend/     API REST (Node.js/Express) y motor de reglas
frontend/    Aplicación web (React)
database/    Scripts SQL de la base de datos
prototipo/   Prototipo HTML inicial del diseño
GUIA_DE_INSTALACION.md   Instalación paso a paso
```

### Cómo ponerlo en marcha

La guía completa, pensada para quien nunca usó Node.js, está en
[GUIA_DE_INSTALACION.md](GUIA_DE_INSTALACION.md). En resumen:

1. Crear la base de datos con los scripts de `database/` (en este orden: `01_crear_base_y_tablas.sql` y
   `02_datos_semilla.sql`). `03_sitios_buceo.sql` solo hace falta si la base se creó con una versión anterior;
   se puede ejecutar más de una vez sin riesgo.
2. Backend: copiar `backend/.env.example` a `backend/.env`, completar los datos y correr `npm install` y
   `npm run dev` (puerto 4000).
3. Frontend: `npm install` y `npm run dev` (puerto 5173), y abrir <http://localhost:5173>.

### Usuarios de prueba

Cargados por `02_datos_semilla.sql` (solo para el prototipo; las contraseñas se guardan con bcrypt):

| Usuario | Contraseña | Rol |
|---|---|---|
| Franco | 123 | Administrador |
| Beto | 123 | Instructor |

> El archivo `backend/.env` (credenciales de la base y secreto JWT) **no se sube al repositorio**.
