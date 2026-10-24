/*
  ============================================================
  DiveSafe Pro - Script de creación de base de datos
  Compatible con Microsoft SQL Server 2008
  ============================================================
  Cómo correr este script:
  1. Abrí SQL Server Management Studio (SSMS)
  2. Conectate a tu instancia local
  3. Abrí este archivo (Archivo > Abrir > Archivo...)
  4. Presioná "Ejecutar" (F5)
  ============================================================
*/

USE master;
GO

-- Si la base ya existe, la eliminamos para empezar de cero
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'DiveSafeProDB')
BEGIN
    ALTER DATABASE DiveSafeProDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE DiveSafeProDB;
END
GO

CREATE DATABASE DiveSafeProDB;
GO

USE DiveSafeProDB;
GO

/* ============================================================
   TABLA: Usuarios
   Guarda instructores y administradores del sistema
   ============================================================ */
CREATE TABLE Usuarios (
    UsuarioId           INT IDENTITY(1,1) PRIMARY KEY,
    NombreUsuario        VARCHAR(50)  NOT NULL UNIQUE,
    PasswordHash         VARCHAR(200) NOT NULL,
    NombreCompleto        VARCHAR(150) NOT NULL,
    Rol                  VARCHAR(20)  NOT NULL CHECK (Rol IN ('Administrador','Instructor')),
    Certificacion        VARCHAR(100) NULL,          -- Ej: "PADI Instructor", "Divemaster"
    Activo               BIT          NOT NULL DEFAULT 1,
    FechaCreacion         DATETIME     NOT NULL DEFAULT GETDATE()
);
GO

/* ============================================================
   TABLA: SitiosBuceo
   Lugares de buceo con su nombre y coordenadas. Las coordenadas
   son las que más adelante se le pasan a la API climática.
   Los sitios no se borran: se desactivan (Activo = 0).
   ============================================================ */
CREATE TABLE SitiosBuceo (
    SitioId         INT IDENTITY(1,1) PRIMARY KEY,
    Nombre          VARCHAR(150)  NOT NULL UNIQUE,
    Latitud         DECIMAL(9,6)  NOT NULL CHECK (Latitud  BETWEEN -90  AND 90),
    Longitud        DECIMAL(9,6)  NOT NULL CHECK (Longitud BETWEEN -180 AND 180),
    Activo          BIT           NOT NULL DEFAULT 1,
    FechaCreacion   DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

/* ============================================================
   TABLA: Planificaciones
   Cada fila = una inmersión planificada y evaluada.
   Guarda: variables técnicas + variables ambientales (a mano
   por ahora) + resultado de la evaluación + justificación.
   ============================================================ */
CREATE TABLE Planificaciones (
    PlanificacionId       INT IDENTITY(1,1) PRIMARY KEY,
    UsuarioId             INT NOT NULL FOREIGN KEY REFERENCES Usuarios(UsuarioId),

    -- Sitio y tipo
    -- SitioBuceo (nombre) es una "foto" del momento: el historial de auditoría no cambia si
    -- después se renombra el sitio. SitioId es NULL en planificaciones anteriores al módulo de sitios.
    SitioId               INT NULL CONSTRAINT FK_Planificaciones_SitiosBuceo FOREIGN KEY REFERENCES SitiosBuceo(SitioId),
    SitioBuceo            VARCHAR(150) NOT NULL,
    TipoInmersion          VARCHAR(50)  NOT NULL,   -- Recreativo, Curso de iniciación, Advanced OW, Divemaster
    TipoEntradaAgua        VARCHAR(50)  NOT NULL,   -- Costa, Giant stride, Back roll, Descenso negativo
    ProfundidadMaxima      DECIMAL(5,1) NOT NULL,   -- metros
    TiempoEstimado         INT          NOT NULL,   -- minutos
    FechaHoraEntrada       DATETIME     NOT NULL,
    EsBuceoNocturno        BIT          NOT NULL DEFAULT 0,

    -- Instructor y alumnos
    CantidadAlumnos        INT          NOT NULL,
    RatioInstructorAlumno  INT          NOT NULL,   -- ej: 4 significa 1:4
    CertificacionPromedio  VARCHAR(50)  NOT NULL,   -- Sin certificación, Open Water, Advanced OW, Rescue Diver, Dive Master
    InmersionesPrevias     VARCHAR(50)  NULL,       -- rango: "0-5", "6-20", "21-50", "+50"
    AsistenteApoyo         VARCHAR(150) NULL,

    -- Equipo y tanque
    TamanoTanque           VARCHAR(30)  NOT NULL,   -- "10L","12L","15L","2x12L"
    MezclaTanque           VARCHAR(30)  NOT NULL,   -- "Aire","Nitrox32","Nitrox36","Trimix"
    PresionInicial         INT          NOT NULL,   -- bar
    ReservaMinima          INT          NOT NULL DEFAULT 50, -- bar
    TipoTraje              VARCHAR(30)  NOT NULL,   -- "Humedo3mm","Humedo5mm","Humedo7mm","Semiseco","Seco","SinTraje"
    EquipoBoya             BIT          NOT NULL DEFAULT 0,
    EquipoComputadora      BIT          NOT NULL DEFAULT 0,
    EquipoLinterna         BIT          NOT NULL DEFAULT 0,
    EquipoCuchillo         BIT          NOT NULL DEFAULT 0,
    EquipoCamara           BIT          NOT NULL DEFAULT 0,
    EquipoSilbato          BIT          NOT NULL DEFAULT 0,

    -- Notas
    NotasAdicionales       VARCHAR(4000) NULL,
    BriefingRealizado      VARCHAR(50)  NULL,

    -- Variables ambientales: las trae la API Open-Meteo según las coordenadas del sitio.
    -- Oleaje, Corriente y TempAgua son NULL cuando la API no tiene datos (lagos y lagunas).
    -- Visibilidad (bajo el agua) no existe en ninguna API gratuita: la carga el instructor.
    Viento                 DECIMAL(5,1) NOT NULL,   -- km/h
    DireccionViento        VARCHAR(10)  NULL,       -- de dónde sopla (ej: NNE)
    Oleaje                 DECIMAL(4,1) NULL,       -- m
    Corriente              DECIMAL(4,2) NULL,       -- nudos
    DireccionCorriente     VARCHAR(20)  NULL,       -- hacia dónde va (ej: ESE)
    Visibilidad            DECIMAL(4,1) NOT NULL,   -- m
    Marea                  DECIMAL(4,1) NULL,       -- m sobre el nivel medio del mar
    EstadoMarea            VARCHAR(20)  NULL,       -- Subiendo, Bajando
    TempAgua               DECIMAL(4,1) NULL,       -- °C
    Clima                  VARCHAR(30)  NOT NULL,   -- Soleado, Nublado, Lluvia/Tormenta
    CoberturaNubes         DECIMAL(4,1) NOT NULL,   -- %

    -- Auditoría del origen de los datos ambientales (NULL en planificaciones viejas, cargadas a mano)
    AmbienteFuente         VARCHAR(100) NULL,       -- ej: 'Open-Meteo'
    AmbienteFechaHora      DATETIME     NULL,       -- momento al que corresponde el dato de la API
    AmbienteManual         VARCHAR(100) NULL,       -- variables cargadas por el instructor, ej: 'Visibilidad'

    -- Resultado de la evaluación
    NivelRiesgo            VARCHAR(20)  NOT NULL,   -- Bajo, Medio, Alto
    CantidadAdvertencias   INT          NOT NULL DEFAULT 0,
    CantidadRecomendaciones INT         NOT NULL DEFAULT 0,
    Justificacion          VARCHAR(4000) NULL,
    HashIntegridad         VARCHAR(64)  NULL,

    FechaRegistro          DATETIME     NOT NULL DEFAULT GETDATE()
);
GO

/* ============================================================
   TABLA: AlertasGeneradas
   Cada fila = una alerta/recomendación/info que generó el
   motor de reglas para una planificación puntual.
   ============================================================ */
CREATE TABLE AlertasGeneradas (
    AlertaId          INT IDENTITY(1,1) PRIMARY KEY,
    PlanificacionId    INT NOT NULL FOREIGN KEY REFERENCES Planificaciones(PlanificacionId),
    Tipo               VARCHAR(20) NOT NULL CHECK (Tipo IN ('Alerta','Recomendacion','Info')),
    ReglaAplicada      VARCHAR(50) NOT NULL,   -- ej: "Regla 1"
    Mensaje            VARCHAR(500) NOT NULL,
    Orden              INT NOT NULL DEFAULT 0
);
GO

-- Índices útiles para el módulo de auditoría (filtros y búsquedas)
CREATE INDEX IX_Planificaciones_UsuarioId ON Planificaciones(UsuarioId);
CREATE INDEX IX_Planificaciones_NivelRiesgo ON Planificaciones(NivelRiesgo);
CREATE INDEX IX_Planificaciones_FechaRegistro ON Planificaciones(FechaRegistro);
CREATE INDEX IX_AlertasGeneradas_PlanificacionId ON AlertasGeneradas(PlanificacionId);
GO

PRINT 'Base de datos DiveSafeProDB creada correctamente.';
GO
