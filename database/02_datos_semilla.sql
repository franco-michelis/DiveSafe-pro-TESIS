/*
  ============================================================
  DiveSafe Pro - Datos semilla (usuarios iniciales)
  Correr DESPUÉS de 01_crear_base_y_tablas.sql
  ============================================================
  Usuarios creados:
    - Franco / 123  -> Rol: Administrador
    - Beto   / 123  -> Rol: Instructor
  Las contraseñas están guardadas hasheadas con bcrypt
  (nunca en texto plano), tal como corresponde.
  ============================================================
*/

USE DiveSafeProDB;
GO

INSERT INTO Usuarios (NombreUsuario, PasswordHash, NombreCompleto, Rol, Certificacion, Activo)
VALUES
('Franco', '$2b$10$J4SHanklal1/wZ5bmNKl/OI1FRKZvnN0U3yX9AaIkLL9.2Wqggcwa', 'Franco Michelis', 'Administrador', 'Divemaster', 1),
('Beto',   '$2b$10$PqMdHMayVm2XdQUJmcsGvu93BJoffRVfx6DLnHHeeRffy3B8NWIga', 'Beto Fernández',  'Instructor',    'PADI Instructor', 1);
GO

PRINT 'Usuarios semilla creados: Franco (Administrador) y Beto (Instructor).';
GO
