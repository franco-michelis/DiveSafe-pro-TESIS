/*
  ============================================================
  DiveSafe Pro - Migración 03: Sitios de buceo
  Compatible con Microsoft SQL Server 2008
  ============================================================
  Se puede correr varias veces sin problema (no duplica nada) y
  NO borra datos existentes.

  Cómo correrlo:
  1. Abrí este archivo en SSMS
  2. Presioná "Ejecutar" (F5)
  ============================================================
*/

USE DiveSafeProDB;
GO

/* ============================================================
   TABLA: SitiosBuceo
   Lugares de buceo con su nombre y coordenadas. Las coordenadas
   son las que más adelante se le pasan a la API climática.
   ============================================================ */
IF OBJECT_ID('SitiosBuceo', 'U') IS NULL
BEGIN
    CREATE TABLE SitiosBuceo (
        SitioId         INT IDENTITY(1,1) PRIMARY KEY,
        Nombre          VARCHAR(150)  NOT NULL UNIQUE,
        Latitud         DECIMAL(9,6)  NOT NULL CHECK (Latitud  BETWEEN -90  AND 90),
        Longitud        DECIMAL(9,6)  NOT NULL CHECK (Longitud BETWEEN -180 AND 180),
        Activo          BIT           NOT NULL DEFAULT 1,
        FechaCreacion   DATETIME      NOT NULL DEFAULT GETDATE()
    );
END
GO

/* ============================================================
   Planificaciones.SitioId: vínculo con el sitio elegido.
   SitioBuceo (el nombre) se sigue guardando como "foto" del
   momento, para que el historial de auditoría no cambie si
   después se renombra un sitio. Es NULL en las planificaciones
   viejas, cargadas antes de existir este módulo.
   ============================================================ */
IF COL_LENGTH('Planificaciones', 'SitioId') IS NULL
BEGIN
    ALTER TABLE Planificaciones
        ADD SitioId INT NULL
        CONSTRAINT FK_Planificaciones_SitiosBuceo FOREIGN KEY REFERENCES SitiosBuceo(SitioId);
END
GO

PRINT 'Módulo de sitios de buceo listo (tabla SitiosBuceo y columna Planificaciones.SitioId).';
GO
