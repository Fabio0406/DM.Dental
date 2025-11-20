// 1. Configuración de .env
import 'dotenv/config'; 

// 2. Importación de pg
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

// Función para probar la conexión
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conexión a PostgreSQL exitosa');
    
    // Probar una consulta simple
    const result = await client.query('SELECT NOW()');
    console.log('🕒 Hora del servidor:', result.rows[0].now);
    
    client.release();
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err);
  }
};

// ============================================
// EXPORTACIÓN (Compatible con ambos estilos)
// ============================================
module.exports = pool; // Exportación por defecto (para Sprint 2)
module.exports.pool = pool; // Named export (para compatibilidad)
module.exports.testConnection = testConnection; // Para test-db.js