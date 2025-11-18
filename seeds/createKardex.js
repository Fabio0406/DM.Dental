const { pool } = require('../config/database');

const createKardex = async () => {
  const client = await pool.connect();
  
  try {
    console.log('📋 Creando Kardex para insumos...');
    
    await client.query('BEGIN');

    const gestionActual = new Date().getFullYear();
    const ubicacion = 'CONSULTORIO ODONTOLOGÍA - DM5';

    // Obtener todos los insumos
    const insumosResult = await client.query(
      'SELECT id_insumo, codigo, nombre_generico FROM insumos ORDER BY codigo'
    );

    for (const insumo of insumosResult.rows) {
      // Verificar si ya existe kardex activo
      const existeKardex = await client.query(
        'SELECT id_kardex FROM kardex WHERE id_insumo = $1 AND abierto = TRUE',
        [insumo.id_insumo]
      );

      if (existeKardex.rows.length > 0) {
        console.log(`ℹ️  Kardex ya existe para: ${insumo.codigo} - ${insumo.nombre_generico}`);
        continue;
      }

      // Generar número de kardex
      const countResult = await client.query(
        'SELECT COUNT(*) as total FROM kardex WHERE gestion = $1',
        [gestionActual]
      );
      const numeroKardex = parseInt(countResult.rows[0].total) + 1;

      // Crear kardex (SIN id_usuario)
      const kardexResult = await client.query(
        `INSERT INTO kardex (id_insumo, numero_kardex, ubicacion, gestion, abierto)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id_kardex`,
        [insumo.id_insumo, numeroKardex, ubicacion, gestionActual]
      );

      const idKardex = kardexResult.rows[0].id_kardex;
      console.log(`✅ Kardex creado: K-${gestionActual}-${String(numeroKardex).padStart(3, '0')} - ${insumo.nombre_generico}`);

      // Obtener lotes de este insumo y crear entradas
      const lotesResult = await client.query(
        `SELECT * FROM lotes 
         WHERE id_insumo = $1 
         ORDER BY fecha_vencimiento ASC`,
        [insumo.id_insumo]
      );

      let saldoAcumulado = 0;
      let saldoValoradoAcumulado = 0;

      for (const lote of lotesResult.rows) {
        const aplicacionesLote = lote.aplicaciones_disponibles;
        const costoUnitario = Math.round(lote.costo_total / aplicacionesLote);
        
        saldoAcumulado += aplicacionesLote;
        saldoValoradoAcumulado += lote.costo_total;

        // Obtener usuario que procesó el formulario (si existe)
        let recepcionadoPor = null;
        if (lote.id_formulario) {
          const formularioResult = await client.query(
            'SELECT representante FROM formularios_salmi WHERE id_formulario = $1',
            [lote.id_formulario]
          );
          if (formularioResult.rows.length > 0) {
            recepcionadoPor = formularioResult.rows[0].representante;
          }
        }

        // Crear movimiento de ENTRADA
        await client.query(
          `INSERT INTO detalle_kardex 
           (id_kardex, id_lote, fecha, entradas, salidas, ajustes, saldo, 
            clave_doc, recibido_de, recepcionado_por, costo_unitario, saldo_valorado)
           VALUES ($1, $2, CURRENT_DATE, $3, 0, 0, $4, $5, $6, $7, $8, $9)`,
          [
            idKardex,
            lote.id_lote,
            aplicacionesLote,
            saldoAcumulado,
            `LOTE-${lote.numero_lote}`,
            'FIM',
            recepcionadoPor, // Puede ser NULL si no hay formulario
            costoUnitario,
            saldoValoradoAcumulado
          ]
        );

        console.log(`   📥 Entrada: Lote ${lote.numero_lote} - ${aplicacionesLote} aplicaciones`);
      }
    }

    await client.query('COMMIT');
    console.log('\n🎉 Kardex creados exitosamente');
    
    // Mostrar resumen
    const resumen = await client.query(`
      SELECT 
        COUNT(*) as total_kardex,
        COUNT(*) FILTER (WHERE abierto = TRUE) as kardex_activos,
        (SELECT COUNT(*) FROM detalle_kardex) as total_movimientos
      FROM kardex
    `);

    console.log('\n📊 Resumen:');
    console.log(`   Total Kardex: ${resumen.rows[0].total_kardex}`);
    console.log(`   Kardex Activos: ${resumen.rows[0].kardex_activos}`);
    console.log(`   Total Movimientos: ${resumen.rows[0].total_movimientos}`);

    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creando kardex:', error);
    process.exit(1);
  } finally {
    client.release();
  }
};

createKardex();