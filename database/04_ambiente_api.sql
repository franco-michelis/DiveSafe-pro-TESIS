/*
  ============================================================
  DiveSafe Pro - Migración 04: variables ambientales desde API
  Compatible con Microsoft SQL Server 2008
  ============================================================
  Las variables ambientales de cada planificación ahora las trae
  la API Open-Meteo según las coordenadas del sitio de buceo.

  Cambios:
  - Oleaje, Corriente y TempAgua admiten NULL: la API no tiene datos
    del agua para lagos y lagunas (sin dato = no se evalúan las reglas
    que dependen de ellos, y el sistema lo avisa).
  - Se agregan columnas para auditar el origen de los datos:
      AmbienteFuente     de dónde vinieron ('Open-Meteo'); NULL en las
                         planificaciones viejas, cargadas a mano
      AmbienteFechaHora  momento al que corresponde el dato de la API
      AmbienteManual     variables cargadas por el instructor (por
                         ejemplo 'Visibilidad'), porque la API no las tiene

  Se puede correr varias veces sin problema y NO borra datos existentes.
  ============================================================
*/

USE DiveSafeProDB;
GO

ALTER TABLE Planificaciones ALTER COLUMN Oleaje    DECIMAL(4,1) NULL;
ALTER TABLE Planificaciones ALTER COLUMN Corriente DECIMAL(4,2) NULL;
ALTER TABLE Planificaciones ALTER COLUMN TempAgua  DECIMAL(4,1) NULL;
GO

IF COL_LENGTH('Planificaciones', 'AmbienteFuente') IS NULL
    ALTER TABLE Planificaciones ADD AmbienteFuente VARCHAR(100) NULL;
GO

IF COL_LENGTH('Planificaciones', 'AmbienteFechaHora') IS NULL
    ALTER TABLE Planificaciones ADD AmbienteFechaHora DATETIME NULL;
GO

IF COL_LENGTH('Planificaciones', 'AmbienteManual') IS NULL
    ALTER TABLE Planificaciones ADD AmbienteManual VARCHAR(100) NULL;
GO

PRINT 'Migración 04 lista: variables ambientales desde API y columnas de auditoría.';
GO
