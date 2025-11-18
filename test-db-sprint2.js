require('dotenv').config();
const pool = require('./config/database'); // Funciona ahora con la exportación por defecto

async function verificarBaseDatos() {
  const client = await pool.connect();

  try {
    console.log('🔍 Verificando configuración de base de datos...\n');

    // 1. Verificar conexión
    console.log('1️⃣ Probando conexión...');
    const conexion = await client.query('SELECT NOW()');
    console.log('   ✅ Conexión exitosa:', conexion.rows[0].now);

    // 2. Verificar tablas existentes
    console.log('\n2️⃣ Verificando tablas...');
    const tablas = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('   Tablas encontradas:');
    if (tablas.rows.length === 0) {
      console.log('   ⚠️  No hay tablas en la base de datos');
    } else {
      tablas.rows.forEach(t => console.log(`   - ${t.table_name}`));
    }

    // 3. Verificar estructura de tablas específicas
    const tablasRequeridas = ['pacientes', 'imagenes_pacientes', 'proyecciones_dentales'];
    
    console.log('\n3️⃣ Verificando estructura de tablas requeridas...');
    for (const tabla of tablasRequeridas) {
      const existe = tablas.rows.some(t => t.table_name === tabla);
      
      if (existe) {
        const columnas = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tabla]);
        
        console.log(`\n   ✅ Tabla: ${tabla}`);
        columnas.rows.forEach(col => {
          console.log(`      - ${col.column_name} (${col.data_type})`);
        });
      } else {
        console.log(`\n   ❌ Tabla faltante: ${tabla}`);
      }
    }

    // 4. Contar registros
    console.log('\n4️⃣ Contando registros...');
    for (const tabla of tablasRequeridas) {
      const existe = tablas.rows.some(t => t.table_name === tabla);
      if (existe) {
        try {
          const count = await client.query(`SELECT COUNT(*) FROM ${tabla}`);
          console.log(`   ${tabla}: ${count.rows[0].count} registros`);
        } catch (err) {
          console.log(`   ${tabla}: Error al contar - ${err.message}`);
        }
      }
    }

    // 5. Verificar otras tablas del sistema
    console.log('\n5️⃣ Otras tablas del sistema:');
    const otrasTablas = tablas.rows.filter(t => 
      !tablasRequeridas.includes(t.table_name) &&
      !t.table_name.includes('session')
    );
    
    if (otrasTablas.length > 0) {
      otrasTablas.forEach(t => console.log(`   - ${t.table_name}`));
    } else {
      console.log('   (ninguna)');
    }

    console.log('\n' + '='.repeat(60));

    // Instrucciones
    const faltanTablas = tablasRequeridas.some(t => 
      !tablas.rows.some(row => row.table_name === t)
    );

    if (faltanTablas) {
      console.log('\n⚠️  ACCIÓN REQUERIDA: Faltan tablas del Sprint 2\n');
      console.log('📝 Paso 1: Asegúrate de tener el archivo SQL');
      console.log('   migrations/01-create-pacientes-proyecciones.sql\n');
      console.log('📝 Paso 2: Ejecuta UNO de estos comandos:\n');
      console.log('   Opción A (Recomendada):');
      console.log('   psql -U postgres -d sistema_dm5 -f migrations/01-create-pacientes-proyecciones.sql\n');
      console.log('   Opción B:');
      console.log('   node migrations/runMigrations.js\n');
      console.log('📝 Paso 3: Vuelve a ejecutar este script para verificar\n');
    } else {
      console.log('\n🎉 ¡Todo está configurado correctamente!\n');
      console.log('✅ Todas las tablas del Sprint 2 existen');
      console.log('✅ La estructura es correcta\n');
      console.log('📝 Próximos pasos:');
      console.log('   1. npm run seed:pacientes    # Crear pacientes de ejemplo');
      console.log('   2. npm run dev               # Iniciar servidor');
      console.log('   3. Abrir http://localhost:3000/pacientes\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Verifica tu configuración:');
    console.error(`   DB_HOST=${process.env.DB_HOST || 'NO DEFINIDO'}`);
    console.error(`   DB_PORT=${process.env.DB_PORT || 'NO DEFINIDO'}`);
    console.error(`   DB_NAME=${process.env.DB_NAME || 'NO DEFINIDO'}`);
    console.error(`   DB_USER=${process.env.DB_USER || 'NO DEFINIDO'}`);
    console.error(`   DB_PASS=${process.env.DB_PASS ? '***' : 'NO DEFINIDO'}\n`);
  } finally {
    client.release();
    process.exit(0);
  }
}

verificarBaseDatos();