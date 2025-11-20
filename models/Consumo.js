import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class Consumo {
  // Crear consumo con FIFO - Todo se registra en detalle_kardex
  static async createConsumo(consumoData) {
    const {
      id_usuario,
      id_tipo_servicio,
      insumos, // Array de {id_insumo, cantidad (aplicaciones)}
      numero_recibo // Número del recibo recetario (clave_doc)
    } = consumoData;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let lotesAgotados = [];
      const movimientosCreados = [];

      // Obtener nombre del usuario para registros
      const usuarioResult = await client.query(
        'SELECT nombres, apellidos FROM usuarios WHERE ci = $1',
        [id_usuario]
      );

      if (usuarioResult.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const nombreUsuario = `${usuarioResult.rows[0].nombres} ${usuarioResult.rows[0].apellidos}`;

      // Procesar cada insumo
      for (const insumo of insumos) {
        const { id_insumo, cantidad } = insumo; // cantidad = aplicaciones a consumir

        // Verificar que existe kardex activo para el insumo
        const kardexResult = await client.query(
          'SELECT id_kardex FROM kardex WHERE id_insumo = $1 AND abierto = TRUE LIMIT 1',
          [id_insumo]
        );

        if (kardexResult.rows.length === 0) {
          throw new Error(`No hay kardex activo para insumo ${id_insumo}`);
        }

        const idKardex = kardexResult.rows[0].id_kardex;

        // MODIFICADO: Obtener lotes disponibles usando FIFO, excluyendo vencidos
        const lotesResult = await client.query(
          `SELECT * FROM lotes 
           WHERE id_insumo = $1 
             AND aplicaciones_disponibles > 0
             AND fecha_vencimiento >= CURRENT_DATE
           ORDER BY fecha_vencimiento ASC, id_lote ASC`,
          [id_insumo]
        );

        if (lotesResult.rows.length === 0) {
          throw new Error(`No hay stock disponible para insumo ${id_insumo}`);
        }

        let aplicacionesPendientes = cantidad;

        // Consumir aplicaciones usando FIFO
        for (const lote of lotesResult.rows) {
          if (aplicacionesPendientes <= 0) break;

          const aplicacionesAConsumir = Math.min(aplicacionesPendientes, lote.aplicaciones_disponibles);

          // Actualizar aplicaciones del lote
          const nuevasAplicacionesLote = lote.aplicaciones_disponibles - aplicacionesAConsumir;

          await client.query(
            'UPDATE lotes SET aplicaciones_disponibles = $1 WHERE id_lote = $2',
            [nuevasAplicacionesLote, lote.id_lote]
          );

          // Calcular nuevo saldo total del insumo (suma de todos los lotes)
          const saldoResult = await client.query(
            'SELECT COALESCE(SUM(aplicaciones_disponibles), 0) as saldo_total FROM lotes WHERE id_insumo = $1',
            [id_insumo]
          );
          const nuevoSaldo = parseInt(saldoResult.rows[0].saldo_total);

          // Obtener último saldo valorado del kardex
          const ultimoMovimiento = await client.query(
            `SELECT saldo_valorado, costo_unitario 
             FROM detalle_kardex 
             WHERE id_kardex = $1 
             ORDER BY fecha DESC, id_detalle DESC 
             LIMIT 1`,
            [idKardex]
          );
          console.log(ultimoMovimiento)

          // Calcular costo unitario y saldo valorado
          // Nota: Aquí se asume que el costo unitario por aplicación es el último registrado, siguiendo la metodología
          const costoUnitario = ultimoMovimiento.rows[0].costo_unitario;
          const nuevoSaldoValorizado = nuevoSaldo * costoUnitario;
          
            // Crear movimiento de SALIDA en detalle_kardex
          const movimientoResult = await client.query(
            `INSERT INTO detalle_kardex 
             (id_kardex, id_lote, fecha, entradas, salidas, ajustes, saldo, 
              clave_doc, recibido_de, recepcionado_por, costo_unitario, saldo_valorado) 
             VALUES ($1, $2, CURRENT_TIMESTAMP, 0, $3, 0, $4, $5, $6, $7, $8, $9)
             RETURNING id_detalle`,
            [
              idKardex,
              lote.id_lote,
              aplicacionesAConsumir, // SALIDAS
              nuevoSaldo, // SALDO actual
              numero_recibo, // CLAVE_DOC (número de recibo)
              nombreUsuario, // RECIBIDO_DE (quien recibe/usa)
              id_usuario, // RECEPCIONADO_POR
              costoUnitario, // COSTO UNITARIO
              nuevoSaldoValorizado // SALDO VALORIZADO
            ]
          );

          movimientosCreados.push({
            id_detalle: movimientoResult.rows[0].id_detalle,
            id_insumo: id_insumo,
            id_lote: lote.id_lote,
            aplicaciones: aplicacionesAConsumir
          });

          aplicacionesPendientes -= aplicacionesAConsumir;

          // Verificar si el lote se agotó
          if (nuevasAplicacionesLote === 0) {
            // Obtener nombre del insumo
            const insumoInfo = await client.query(
              'SELECT nombre_generico FROM insumos WHERE id_insumo = $1',
              [id_insumo]
            );

            lotesAgotados.push({
              id_lote: lote.id_lote,
              numero_lote: lote.numero_lote,
              id_insumo: id_insumo,
              nombre_insumo: insumoInfo.rows[0].nombre_generico,
              cantidad_fisica: lote.cantidad_insumos
            });
          }
        }

        if (aplicacionesPendientes > 0) {
          throw new Error(`Stock insuficiente para insumo ${id_insumo}. Faltaron ${aplicacionesPendientes} aplicaciones`);
        }
      }

      await client.query('COMMIT');

      return {
        success: true,
        numero_recibo: numero_recibo,
        movimientos: movimientosCreados,
        requiere_ajuste: lotesAgotados.length > 0,
        lotes_agotados: lotesAgotados
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error creando consumo: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Registrar ajuste de lote (cuando se agota y sobra producto físico)
  static async registrarAjuste(ajusteData) {
    const { id_lote, id_usuario, aplicaciones_ajuste, motivo } = ajusteData;
    console.log(ajusteData)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Obtener info del lote
      const loteResult = await client.query(
        'SELECT * FROM lotes WHERE id_lote = $1',
        [id_lote]
      );

      if (loteResult.rows.length === 0) {
        throw new Error('Lote no encontrado');
      }

      const lote = loteResult.rows[0];

      // Obtener kardex activo del insumo
      const kardexResult = await client.query(
        'SELECT id_kardex FROM kardex WHERE id_insumo = $1 AND abierto = TRUE LIMIT 1',
        [lote.id_insumo]
      );

      if (kardexResult.rows.length === 0) {
        throw new Error('No hay kardex activo para este insumo');
      }

      const idKardex = kardexResult.rows[0].id_kardex;
      // Calcular ajuste
      const aplicacionesActuales = lote.aplicaciones_disponibles;
      let ajusteFinal = parseInt(aplicaciones_ajuste);

      // Si es 0, significa que se agotó manualmente (ajuste negativo)
      if (aplicaciones_ajuste == 0) {
        ajusteFinal = -aplicacionesActuales;
      }

      const nuevasAplicaciones = Math.max(0, aplicacionesActuales + ajusteFinal);
      // Actualizar lote

      await client.query(
        'UPDATE lotes SET aplicaciones_disponibles = $1 WHERE id_lote = $2',
        [nuevasAplicaciones, id_lote]
      );

      // Actualizar total del insumo
      const saldoResult = await client.query(
        'SELECT COALESCE(SUM(aplicaciones_disponibles), 0) as saldo_total FROM lotes WHERE id_insumo = $1',
        [lote.id_insumo]
      );
      const nuevoSaldo = parseInt(saldoResult.rows[0].saldo_total);

      // Obtener último saldo valorado
      const ultimoMovimiento = await client.query(
        `SELECT saldo, saldo_valorado, costo_unitario 
         FROM detalle_kardex 
         WHERE id_kardex = $1 
         ORDER BY fecha DESC, id_detalle DESC 
         LIMIT 1`,
        [idKardex]
      );

      const costoUnitario = ultimoMovimiento.rows[0].costo_unitario;
      const valorAjuste = Math.abs(ajusteFinal) * costoUnitario;
      const saldoValoradoAnterior = ultimoMovimiento.rows.length > 0 ?
        parseInt(ultimoMovimiento.rows[0].saldo_valorado) : 0;

      // Si es positivo suma, si es negativo resta
      const nuevoSaldoValorizado = nuevoSaldo*costoUnitario;

      // Obtener nombre del usuario
      const usuarioResult = await client.query(
        'SELECT nombres, apellidos FROM usuarios WHERE ci = $1',
        [id_usuario]
      );
      const nombreUsuario = `${usuarioResult.rows[0].nombres} ${usuarioResult.rows[0].apellidos}`;

      // Registrar en detalle_kardex
      await client.query(
        `INSERT INTO detalle_kardex 
         (id_kardex, id_lote, fecha, entradas, salidas, ajustes, saldo, 
          clave_doc, recibido_de, recepcionado_por, costo_unitario, saldo_valorado) 
         VALUES ($1, $2, CURRENT_TIMESTAMP, 0, 0, $3, $4, $5, $6, $7, $8, $9)`,
        [
          idKardex,
          id_lote,
          Math.abs(ajusteFinal), // AJUSTES (siempre positivo, el signo está implícito)
          nuevoSaldo,
          `AJUSTE-${id_lote}`,
          nombreUsuario,
          id_usuario,
          costoUnitario,
          nuevoSaldoValorizado
        ]
      );

      await client.query('COMMIT');
      return { success: true, nuevo_saldo: nuevoSaldo };

    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error registrando ajuste: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // NUEVO: Obtener detalles de un consumo específico
  static async getDetallesConsumo(idDetalle) {
    try {
      const result = await pool.query(
        `SELECT 
          dk.id_detalle,
          dk.fecha,
          dk.salidas as cantidad,
          dk.clave_doc as numero_recibo,
          dk.saldo,
          dk.saldo_valorado,
          dk.costo_unitario,
          i.id_insumo,
          i.codigo,
          i.nombre_generico,
          i.presentacion,
          l.numero_lote,
          l.fecha_vencimiento,
          k.numero_kardex,
          k.gestion,
          u.nombres || ' ' || u.apellidos as usuario
        FROM detalle_kardex dk
        INNER JOIN kardex k ON dk.id_kardex = k.id_kardex
        INNER JOIN insumos i ON k.id_insumo = i.id_insumo
        LEFT JOIN lotes l ON dk.id_lote = l.id_lote
        LEFT JOIN usuarios u ON dk.recepcionado_por = u.ci
        WHERE dk.id_detalle = $1`,
        [idDetalle]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error obteniendo detalles: ${error.message}`);
    }
  }

  // Obtener historial de consumos (movimientos de salida de un período)
  static async findByUserAndDate(userId, fechaInicio = null, fechaFin = null) {
    try {
      let query = `
        SELECT 
          dk.id_detalle,
          dk.fecha,
          dk.salidas as cantidad,
          dk.clave_doc as numero_recibo,
          dk.saldo_valorado,
          i.codigo,
          i.nombre_generico,
          l.numero_lote
        FROM detalle_kardex dk
        INNER JOIN kardex k ON dk.id_kardex = k.id_kardex
        INNER JOIN insumos i ON k.id_insumo = i.id_insumo
        LEFT JOIN lotes l ON dk.id_lote = l.id_lote
        WHERE dk.recepcionado_por = $1 AND dk.salidas > 0
      `;

      const params = [userId];
      let paramCount = 2;

      if (fechaInicio) {
        query += ` AND dk.fecha >= $${paramCount}`;
        params.push(fechaInicio);
        paramCount++;
      }

      if (fechaFin) {
        query += ` AND dk.fecha <= $${paramCount}`;
        params.push(fechaFin);
      }

      query += ' ORDER BY dk.fecha DESC, dk.id_detalle DESC LIMIT 100';

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo historial: ${error.message}`);
    }
  }

  // Obtener estadísticas de consumo
  static async getStats(userId, fechaInicio, fechaFin) {
    try {
      const result = await pool.query(
        `SELECT 
          COUNT(DISTINCT dk.clave_doc) as total_servicios,
          SUM(dk.salidas) as total_aplicaciones_consumidas,
          COUNT(DISTINCT k.id_insumo) as insumos_diferentes_usados,
          SUM(CASE WHEN dk.salidas > 0 THEN 
            (SELECT costo_unitario FROM detalle_kardex 
             WHERE id_kardex = dk.id_kardex AND fecha <= dk.fecha 
             ORDER BY fecha DESC LIMIT 1) * dk.salidas 
          ELSE 0 END) as valor_total_consumido
         FROM detalle_kardex dk
         INNER JOIN kardex k ON dk.id_kardex = k.id_kardex
         INNER JOIN insumos i ON k.id_insumo = i.id_insumo
         WHERE dk.recepcionado_por = $1 
           AND dk.salidas > 0
           AND dk.fecha >= $2 
           AND dk.fecha <= $3`,
        [userId, fechaInicio, fechaFin]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error obteniendo estadísticas: ${error.message}`);
    }
  }
}

export default Consumo; // ⬅️ CAMBIADO: module.exports a export default