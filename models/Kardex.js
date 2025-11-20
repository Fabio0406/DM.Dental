import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class Kardex {
  // Listar insumos con su kardex activo
  static async listarInsumosConKardex(limite = 50) {
    try {
      const result = await pool.query(
        `SELECT 
          i.id_insumo,
          i.codigo,
          i.nombre_generico,
          i.presentacion,
          i.aplicaciones_minimas,
          -- Total de aplicaciones disponibles (suma de lotes)
          COALESCE(SUM(l.aplicaciones_disponibles), 0) as aplicaciones_disponibles,
          -- Porcentaje de stock
          CASE 
            WHEN COALESCE(SUM(l.aplicaciones_disponibles), 0) = 0 THEN 0
            ELSE ROUND((COALESCE(SUM(l.aplicaciones_disponibles), 0)::numeric / 
                       NULLIF(i.aplicaciones_minimas, 0) * 100), 2)
          END as porcentaje_stock,
          -- Kardex activo
          k.id_kardex,
          k.numero_kardex,
          k.gestion,
          k.ubicacion,
          k.fecha_apertura,
          k.abierto,
          -- Último saldo del kardex
          ultimo.saldo as saldo_actual_kardex,
          ultimo.saldo_valorado as valor_actual_kardex,
          -- Prioridad para ordenamiento
          CASE 
            WHEN COALESCE(SUM(l.aplicaciones_disponibles), 0) <= i.aplicaciones_minimas * 0.1 THEN 1
            WHEN COALESCE(SUM(l.aplicaciones_disponibles), 0) <= i.aplicaciones_minimas * 0.3 THEN 2
            ELSE 3
          END as prioridad
         FROM insumos i
         LEFT JOIN lotes l ON i.id_insumo = l.id_insumo AND l.aplicaciones_disponibles > 0
         LEFT JOIN kardex k ON i.id_insumo = k.id_insumo AND k.abierto = TRUE
         LEFT JOIN LATERAL (
           SELECT dk.saldo, dk.saldo_valorado
           FROM detalle_kardex dk
           WHERE dk.id_kardex = k.id_kardex
           ORDER BY dk.fecha DESC, dk.id_detalle DESC
           LIMIT 1
         ) ultimo ON TRUE
         GROUP BY i.id_insumo, k.id_kardex, k.numero_kardex, k.gestion, k.ubicacion, 
                  k.fecha_apertura, k.abierto, ultimo.saldo, ultimo.saldo_valorado
         ORDER BY prioridad ASC, COALESCE(SUM(l.aplicaciones_disponibles), 0) ASC, i.nombre_generico ASC
         LIMIT $1`,
        [limite]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error listando insumos: ${error.message}`);
    }
  }

  // Buscar insumos por código o nombre
  static async buscarInsumos(termino) {
    try {
      const result = await pool.query(
        `SELECT 
          i.id_insumo,
          i.codigo,
          i.nombre_generico,
          i.presentacion,
          COALESCE(SUM(l.aplicaciones_disponibles), 0) as aplicaciones_disponibles,
          k.id_kardex,
          k.numero_kardex,
          k.gestion,
          k.abierto
         FROM insumos i
         LEFT JOIN lotes l ON i.id_insumo = l.id_insumo AND l.aplicaciones_disponibles > 0
         LEFT JOIN kardex k ON i.id_insumo = k.id_insumo AND k.abierto = TRUE
         WHERE LOWER(i.codigo) LIKE LOWER($1) OR LOWER(i.nombre_generico) LIKE LOWER($1)
         GROUP BY i.id_insumo, k.id_kardex, k.numero_kardex, k.gestion, k.abierto
         ORDER BY i.nombre_generico
         LIMIT 20`,
        [`%${termino}%`]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error buscando insumos: ${error.message}`);
    }
  }

  // Obtener Kardex actual de un insumo (con detalles)
  static async obtenerKardexActual(idInsumo) {
    try {
      // Obtener info del Kardex activo
      const kardexInfo = await pool.query(
        `SELECT 
          k.id_kardex,
          k.numero_kardex,
          k.gestion,
          k.ubicacion,
          k.fecha_apertura,
          k.fecha_cierre,
          k.abierto,
          i.codigo,
          i.nombre_generico,
          i.presentacion
         FROM kardex k
         INNER JOIN insumos i ON k.id_insumo = i.id_insumo
         WHERE k.id_insumo = $1 AND k.abierto = TRUE
         ORDER BY k.fecha_apertura DESC
         LIMIT 1`,
        [idInsumo]
      );

      if (kardexInfo.rows.length === 0) {
        return null;
      }

      const kardex = kardexInfo.rows[0];

      // Obtener movimientos del Kardex (detalles)
      const movimientos = await pool.query(
        `SELECT 
          dk.id_detalle,
          dk.fecha,
          dk.entradas,
          dk.salidas,
          dk.ajustes,
          dk.saldo,
          dk.clave_doc,
          dk.recibido_de,
          dk.recepcionado_por,
          dk.costo_unitario,
          dk.saldo_valorado,
          u.nombres || ' ' || u.apellidos as usuario,
          l.numero_lote,
          l.fecha_vencimiento
         FROM detalle_kardex dk
         LEFT JOIN usuarios u ON dk.recepcionado_por = u.ci
         LEFT JOIN lotes l ON dk.id_lote = l.id_lote
         WHERE dk.id_kardex = $1
         ORDER BY dk.fecha ASC, dk.id_detalle ASC`,
        [kardex.id_kardex]
      );

      return {
        ...kardex,
        movimientos: movimientos.rows
      };
    } catch (error) {
      throw new Error(`Error obteniendo Kardex actual: ${error.message}`);
    }
  }

  // Obtener historial de Kardex cerrados de un insumo
  static async obtenerHistorialKardex(idInsumo) {
    try {
      const result = await pool.query(
        `SELECT 
          k.id_kardex,
          k.numero_kardex,
          k.gestion,
          k.ubicacion,
          k.fecha_apertura,
          k.fecha_cierre,
          (SELECT COUNT(*) FROM detalle_kardex WHERE id_kardex = k.id_kardex) as total_movimientos,
          (SELECT saldo FROM detalle_kardex WHERE id_kardex = k.id_kardex 
           ORDER BY fecha DESC, id_detalle DESC LIMIT 1) as saldo_final,
          (SELECT saldo_valorado FROM detalle_kardex WHERE id_kardex = k.id_kardex 
           ORDER BY fecha DESC, id_detalle DESC LIMIT 1) as valor_final
         FROM kardex k
         WHERE k.id_insumo = $1 AND k.abierto = FALSE
         ORDER BY k.gestion DESC, k.fecha_apertura DESC`,
        [idInsumo]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo historial: ${error.message}`);
    }
  }

  // Obtener movimientos de un Kardex específico (histórico)
  static async obtenerMovimientosKardex(idKardex) {
    try {
      const result = await pool.query(
        `SELECT 
          dk.id_detalle,
          dk.fecha,
          dk.entradas,
          dk.salidas,
          dk.ajustes,
          dk.saldo,
          dk.clave_doc,
          dk.recibido_de,
          dk.costo_unitario,
          dk.saldo_valorado,
          u.nombres || ' ' || u.apellidos as usuario,
          l.numero_lote,
          l.fecha_vencimiento
         FROM detalle_kardex dk
         LEFT JOIN usuarios u ON dk.recepcionado_por = u.ci
         LEFT JOIN lotes l ON dk.id_lote = l.id_lote
         WHERE dk.id_kardex = $1
         ORDER BY dk.fecha ASC, dk.id_detalle ASC`,
        [idKardex]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo movimientos: ${error.message}`);
    }
  }

  // Obtener gestiones disponibles para un insumo
  static async obtenerGestionesDisponibles(idInsumo) {
    try {
      const result = await pool.query(
        `SELECT DISTINCT gestion
         FROM kardex
         WHERE id_insumo = $1
         ORDER BY gestion DESC`,
        [idInsumo]
      );
      return result.rows.map(r => r.gestion);
    } catch (error) {
      throw new Error(`Error obteniendo gestiones: ${error.message}`);
    }
  }

  // Crear nuevo kardex para un insumo (cuando inicia una gestión)
  static async crearKardex(idInsumo, gestion, ubicacion) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Generar número de kardex (ej: K-2025-001)
      const countResult = await client.query(
        'SELECT COUNT(*) as total FROM kardex WHERE gestion = $1',
        [gestion]
      );
      const numeroKardex = `K-${gestion}-${String(parseInt(countResult.rows[0].total) + 1).padStart(3, '0')}`;

      // Crear kardex
      const result = await client.query(
        `INSERT INTO kardex (id_insumo, numero_kardex, ubicacion, gestion)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [idInsumo, numeroKardex, ubicacion, gestion]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error creando kardex: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Cerrar kardex (cuando termina una gestión o se agota stock)
  static async cerrarKardex(idKardex) {
    try {
      const result = await pool.query(
        `UPDATE kardex 
         SET abierto = FALSE, fecha_cierre = CURRENT_TIMESTAMP
         WHERE id_kardex = $1
         RETURNING *`,
        [idKardex]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error cerrando kardex: ${error.message}`);
    }
  }
}

export default Kardex; // ⬅️ CAMBIADO: module.exports a export default