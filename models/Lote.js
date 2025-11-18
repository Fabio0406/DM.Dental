const { pool } = require('../config/database');

class Lote {
  // Obtener lotes de un insumo con FIFO (solo activos y no vencidos)
  static async getLotesFIFO(idInsumo) {
    try {
      const result = await pool.query(
        `SELECT 
          l.*,
          i.nombre_generico,
          i.codigo,
          CASE 
            WHEN l.fecha_vencimiento < CURRENT_DATE THEN TRUE
            ELSE FALSE
          END as esta_vencido,
          (l.fecha_vencimiento - CURRENT_DATE) as dias_hasta_vencimiento
         FROM lotes l
         INNER JOIN insumos i ON l.id_insumo = i.id_insumo
         WHERE l.id_insumo = $1 
           AND l.aplicaciones_disponibles > 0
           AND l.fecha_vencimiento >= CURRENT_DATE
         ORDER BY l.fecha_vencimiento ASC, l.id_lote ASC`,
        [idInsumo]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo lotes FIFO: ${error.message}`);
    }
  }

  // Obtener lotes vencidos no notificados de un insumo
  static async getLotesVencidosNoNotificados(idInsumo = null) {
    try {
      let query = `
        SELECT 
          l.*,
          i.nombre_generico,
          i.codigo,
          i.presentacion,
          (CURRENT_DATE - l.fecha_vencimiento) as dias_vencido
         FROM lotes l
         INNER JOIN insumos i ON l.id_insumo = i.id_insumo
         WHERE l.fecha_vencimiento < CURRENT_DATE
           AND l.aplicaciones_disponibles > 0
           AND l.vencimiento_notificado = FALSE
      `;
      
      const params = [];
      if (idInsumo) {
        query += ' AND l.id_insumo = $1';
        params.push(idInsumo);
      }
      
      query += ' ORDER BY l.fecha_vencimiento ASC';
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo lotes vencidos: ${error.message}`);
    }
  }

  // Marcar lotes vencidos como notificados
  static async marcarVencimientoNotificado(idLotes) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Asegurar que idLotes sea un array
      const lotes = Array.isArray(idLotes) ? idLotes : [idLotes];

      // Marcar como notificado
      await client.query(
        `UPDATE lotes 
         SET vencimiento_notificado = TRUE 
         WHERE id_lote = ANY($1::int[])`,
        [lotes]
      );

      await client.query('COMMIT');
      return { success: true, lotes_actualizados: lotes.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error marcando lotes como notificados: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Obtener todos los lotes de un insumo (incluyendo vencidos)
  static async getLotesByInsumo(idInsumo) {
    try {
      const result = await pool.query(
        `SELECT 
          l.*,
          CASE 
            WHEN l.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDO'
            WHEN l.aplicaciones_disponibles = 0 THEN 'AGOTADO'
            ELSE 'ACTIVO'
          END as estado_lote,
          (l.fecha_vencimiento - CURRENT_DATE) as dias_hasta_vencimiento
         FROM lotes l
         WHERE l.id_insumo = $1
         ORDER BY 
           CASE WHEN l.aplicaciones_disponibles > 0 THEN 0 ELSE 1 END,
           l.fecha_vencimiento ASC`,
        [idInsumo]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo lotes: ${error.message}`);
    }
  }

  // Obtener información de un lote específico
  static async getLoteById(idLote) {
    try {
      const result = await pool.query(
        `SELECT 
          l.*,
          i.nombre_generico,
          i.codigo,
          i.presentacion,
          u.nombres || ' ' || u.apellidos as registrado_por,
          CASE 
            WHEN l.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDO'
            WHEN l.aplicaciones_disponibles = 0 THEN 'AGOTADO'
            ELSE 'ACTIVO'
          END as estado_lote
         FROM lotes l
         INNER JOIN insumos i ON l.id_insumo = i.id_insumo
         LEFT JOIN usuarios u ON l.id_usuario = u.ci
         WHERE l.id_lote = $1`,
        [idLote]
      );
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error obteniendo lote: ${error.message}`);
    }
  }

  // Actualizar aplicaciones disponibles de un lote
  static async actualizarAplicaciones(idLote, aplicacionesNuevas) {
    try {
      const result = await pool.query(
        `UPDATE lotes 
         SET aplicaciones_disponibles = $1
         WHERE id_lote = $2
         RETURNING *`,
        [aplicacionesNuevas, idLote]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error actualizando aplicaciones: ${error.message}`);
    }
  }

  // Obtener estadísticas de lotes próximos a vencer (30 días)
  static async getLotesProximosVencer(dias = 30) {
    try {
      const result = await pool.query(
        `SELECT 
          l.id_lote,
          l.numero_lote,
          l.fecha_vencimiento,
          l.aplicaciones_disponibles,
          i.codigo,
          i.nombre_generico,
          i.presentacion,
          (l.fecha_vencimiento - CURRENT_DATE) as dias_restantes
         FROM lotes l
         INNER JOIN insumos i ON l.id_insumo = i.id_insumo
         WHERE l.aplicaciones_disponibles > 0
           AND l.fecha_vencimiento >= CURRENT_DATE
           AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '${dias} days'
         ORDER BY l.fecha_vencimiento ASC`,
        []
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo lotes próximos a vencer: ${error.message}`);
    }
  }

  // Crear nuevo lote
  static async crearLote(loteData) {
    const {
      id_insumo,
      id_formulario,
      numero_lote,
      fecha_vencimiento,
      cantidad_insumos,
      aplicaciones_disponibles,
      costo_total,
      id_usuario
    } = loteData;

    try {
      const result = await pool.query(
        `INSERT INTO lotes 
         (id_insumo, id_formulario, numero_lote, fecha_vencimiento, 
          cantidad_insumos, aplicaciones_disponibles, costo_total, id_usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          id_insumo,
          id_formulario || null,
          numero_lote,
          fecha_vencimiento,
          cantidad_insumos,
          aplicaciones_disponibles,
          costo_total,
          id_usuario
        ]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creando lote: ${error.message}`);
    }
  }
}

module.exports = Lote;