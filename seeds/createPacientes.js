import 'dotenv/config'; // ⬅️ CAMBIADO: require('dotenv').config() a import 'dotenv/config'
import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import

// CORRECCIÓN: Importar y definir __filename y __dirname para ESM
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Seed de Pacientes de Ejemplo
 * Crea pacientes de prueba para el sistema de proyecciones dentales
 */

const pacientesEjemplo = [
  {
    ci: 12345678,
    nombres: 'Juan Carlos',
    apellidos: 'Pérez Gómez',
    fecha_nacimiento: '1990-05-15',
    sexo: 'masculino',
    telefono: '79012345',
    direccion: 'Av. 6 de Agosto #1234, La Paz'
  },
  {
    ci: 87654321,
    nombres: 'María Elena',
    apellidos: 'Rodríguez López',
    fecha_nacimiento: '1985-08-22',
    sexo: 'femenino',
    telefono: '79123456',
    direccion: 'Calle Murillo #567, La Paz'
  },
  {
    ci: 11223344,
    nombres: 'Carlos Alberto',
    apellidos: 'Mamani Quispe',
    fecha_nacimiento: '1995-03-10',
    sexo: 'masculino',
    telefono: '79234567',
    direccion: 'Av. Buenos Aires #890, La Paz'
  },
  {
    ci: 55667788,
    nombres: 'Ana Sofía',
    apellidos: 'Vargas Flores',
    fecha_nacimiento: '2000-11-30',
    sexo: 'femenino',
    telefono: '79345678',
    direccion: 'Calle Comercio #123, La Paz'
  },
  {
    ci: 99887766,
    nombres: 'Roberto',
    apellidos: 'Gutiérrez Silva',
    fecha_nacimiento: '1988-07-18',
    sexo: 'masculino',
    telefono: '79456789',
    direccion: 'Av. Arce #456, La Paz'
  },
  {
    ci: 13301101,
    nombres: 'Julio Cesar',
    apellidos: 'Martinez Condori',
    fecha_nacimiento: '1992-01-25',
    sexo: 'masculino',
    telefono: '79567890',
    direccion: 'Zona Sur, Calacoto'
  },
  {
    ci: 19301080,
    nombres: 'Juan Carlos',
    apellidos: 'Fernandez Apaza',
    fecha_nacimiento: '1991-06-12',
    sexo: 'masculino',
    telefono: '79678901',
    direccion: 'Sopocachi, La Paz'
  },
  {
    ci: 19301076,
    nombres: 'Leonora',
    apellidos: 'Rojas Mamani',
    fecha_nacimiento: '2004-04-08',
    sexo: 'femenino',
    telefono: '79789012',
    direccion: 'Villa Copacabana, La Paz'
  }
];

async function crearPacientes() {
  const client = await pool.connect();

  try {
    console.log('🚀 Iniciando creación de pacientes de ejemplo...\n');

    await client.query('BEGIN');

    for (const paciente of pacientesEjemplo) {
      // Verificar si el paciente ya existe
      const existente = await client.query(
        'SELECT ci FROM pacientes WHERE ci = $1',
        [paciente.ci]
      );

      if (existente.rows.length > 0) {
        console.log(`⚠️  Paciente con CI ${paciente.ci} ya existe, omitiendo...`);
        continue;
      }

      // Insertar paciente
      const result = await client.query(
        `INSERT INTO pacientes (ci, nombres, apellidos, fecha_nacimiento, sexo, telefono, direccion)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ci, nombres, apellidos`,
        [
          paciente.ci,
          paciente.nombres,
          paciente.apellidos,
          paciente.fecha_nacimiento,
          paciente.sexo,
          paciente.telefono,
          paciente.direccion
        ]
      );

      console.log(`✅ Paciente creado: ${result.rows[0].nombres} ${result.rows[0].apellidos} (CI: ${result.rows[0].ci})`);
    }

    await client.query('COMMIT');
    console.log('\n✨ Pacientes de ejemplo creados exitosamente!');
    console.log(`📊 Total: ${pacientesEjemplo.length} pacientes`);

    // Mostrar estadísticas
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE sexo = 'masculino' OR sexo = 'M') as masculino,
        COUNT(*) FILTER (WHERE sexo = 'femenino' OR sexo = 'F') as femenino
      FROM pacientes
    `);

    console.log('\n📈 Estadísticas del sistema:');
    console.log(`   Total de pacientes: ${stats.rows[0].total}`);
    console.log(`   Masculino: ${stats.rows[0].masculino}`);
    console.log(`   Femenino: ${stats.rows[0].femenino}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creando pacientes:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Ejecutar si se llama directamente (Adaptación para ESM)
// Si el script se ejecuta como archivo principal (node script.js)
if (process.argv[1] === __filename) {
  crearPacientes()
    .then(() => {
      console.log('\n🎉 Proceso completado!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

export default crearPacientes; // ⬅️ CAMBIADO: module.exports a export default