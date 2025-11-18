const { pool } = require('../config/database');

const lotes = [
  // Lidocaína (código IA111)
  { 
    codigo_insumo: 'IA111', 
    numero_lote: 'LID2024001', 
    fecha_vencimiento: '2025-12-31', 
    cantidad_insumos: 2, // 2 cajas
    aplicaciones_disponibles: 100, // 2 cajas x 50 cartuchos
    costo_total: 1200 // 100 cartuchos x 12 Bs
  },
  
  // Ionómero (código IM201)
  { 
    codigo_insumo: 'IM201', 
    numero_lote: 'ION2024001', 
    fecha_vencimiento: '2025-08-15', 
    cantidad_insumos: 3, // 3 frascos
    aplicaciones_disponibles: 45, // 3 frascos x 15 aplicaciones
    costo_total: 135 // 3 frascos x 45 Bs
  },
  
  // Resina (código IM202)
  { 
    codigo_insumo: 'IM202', 
    numero_lote: 'RES2024001', 
    fecha_vencimiento: '2025-10-20', 
    cantidad_insumos: 5, // 5 jeringas
    aplicaciones_disponibles: 40, // 5 jeringas x 8 aplicaciones
    costo_total: 180 // 5 jeringas x 36 Bs
  },
  
  // Flúor (código IP301)
  { 
    codigo_insumo: 'IP301', 
    numero_lote: 'FLU2024001', 
    fecha_vencimiento: '2026-03-15', 
    cantidad_insumos: 4, // 4 tubos
    aplicaciones_disponibles: 120, // 4 tubos x 30 aplicaciones
    costo_total: 116 // 4 tubos x 29 Bs
  },
  
  // Pasta profiláctica (código IP302)
  { 
    codigo_insumo: 'IP302', 
    numero_lote: 'PAS2024001', 
    fecha_vencimiento: '2025-11-30', 
    cantidad_insumos: 3, // 3 frascos
    aplicaciones_disponibles: 150, // 3 frascos x 50 aplicaciones
    costo_total: 66 // 3 frascos x 22 Bs
  }
];

const createLotes = async () => {
  const client = await pool.connect();
  
  try {
    console.log('📦 Creando lotes de insumos...');
    
    await client.query('BEGIN');

    for (const lote of lotes) {
      // Obtener ID del insumo por código
      const insumo = await client.query(
        'SELECT id_insumo FROM insumos WHERE codigo = $1',
        [lote.codigo_insumo]
      );

      if (insumo.rows.length === 0) {
        console.warn(`⚠️  Insumo no encontrado: ${lote.codigo_insumo}`);
        continue;
      }

      const idInsumo = insumo.rows[0].id_insumo;

      // Verificar si ya existe
      const existe = await client.query(
        'SELECT id_lote FROM lotes WHERE id_insumo = $1 AND numero_lote = $2',
        [idInsumo, lote.numero_lote]
      );

      if (existe.rows.length === 0) {
        // Crear lote
        const resultado = await client.query(
          `INSERT INTO lotes 
           (id_insumo, numero_lote, fecha_vencimiento, cantidad_insumos, 
            aplicaciones_disponibles, costo_total) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           RETURNING id_lote`,
          [
            idInsumo,
            lote.numero_lote,
            lote.fecha_vencimiento,
            lote.cantidad_insumos,
            lote.aplicaciones_disponibles,
            lote.costo_total
          ]
        );

        console.log(`✅ Lote creado: ${lote.numero_lote} - ${lote.aplicaciones_disponibles} aplicaciones`);
      } else {
        console.log(`ℹ️  Lote ya existe: ${lote.numero_lote}`);
      }
    }

    await client.query('COMMIT');
    console.log('🎉 Lotes creados exitosamente');
    
    // Mostrar resumen
    const resumen = await client.query(`
      SELECT 
        i.codigo,
        i.nombre_generico,
        COUNT(l.id_lote) as total_lotes,
        SUM(l.aplicaciones_disponibles) as total_aplicaciones
      FROM insumos i
      LEFT JOIN lotes l ON i.id_insumo = l.id_insumo
      GROUP BY i.id_insumo, i.codigo, i.nombre_generico
      ORDER BY i.codigo
    `);

    console.log('\n📊 Resumen de stock:');
    resumen.rows.forEach(row => {
      console.log(`   ${row.codigo} - ${row.nombre_generico}: ${row.total_aplicaciones} aplicaciones en ${row.total_lotes} lote(s)`);
    });

    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creando lotes:', error);
    process.exit(1);
  } finally {
    client.release();
  }
};

createLotes();