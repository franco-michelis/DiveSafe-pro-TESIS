/**
 * Configuración de conexión a Microsoft SQL Server 2008.
 * Los datos de conexión se leen del archivo .env (ver .env.example).
 *
 * NOTA IMPORTANTE sobre SQL Server 2008:
 * Al ser una versión vieja, necesitamos forzar la versión del
 * protocolo TDS a 7_1 para que el driver "tedious" (usado por
 * el paquete "mssql") pueda conectarse sin problemas.
 */
const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE || 'DiveSafeProDB',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,               // SQL Server 2008 local no usa SSL
    trustServerCertificate: true,
    enableArithAbort: true,
    tdsVersion: '7_1',            // Compatibilidad con SQL Server 2008
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then(pool => {
        console.log('✅ Conectado a SQL Server:', config.database);
        return pool;
      })
      .catch(err => {
        console.error('❌ Error al conectar a SQL Server:', err.message);
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
