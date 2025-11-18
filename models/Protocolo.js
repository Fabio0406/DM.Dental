const { pool } = require('../config/database');

class Protocolo {
  // Obtener protocolo por servicio con información de lotes (FIFO)
  static async getByTipoServicio(idServicio) {
    try {
      // MODIFICADO: Agregar filtro de fecha_vencimiento >= CURRENT_DATE
      const result = await pool.query(
        `SELECT 
          si.id_servicio,
          si.id_insumo,
          si.aplicaciones_por_servicio,
          i.codigo,
          i.nombre_generico,
          i.presentacion,
          i.unidad_medida,
          i.imagen_url,
          i.rendimiento_teorico,
          i.aplicaciones_minimas,
          l.id_lote,
          l.numero_lote,
          l.fecha_vencimiento,
          l.aplicaciones_disponibles as stock_lote,
          l.cantidad_insumos as cantidad_fisica,
          l.costo_total,
          ROW_NUMBER() OVER (PARTITION BY si.id_insumo ORDER BY l.fecha_vencimiento ASC, l.id_lote ASC) as lote_orden
         FROM servicio_insumos si
         INNER JOIN insumos i ON si.id_insumo = i.id_insumo
         LEFT JOIN lotes l ON i.id_insumo = l.id_insumo 
           AND l.aplicaciones_disponibles > 0
           AND l.fecha_vencimiento >= CURRENT_DATE
         WHERE si.id_servicio = $1
         ORDER BY i.nombre_generico, l.fecha_vencimiento ASC`,
        [idServicio]
      );

      // Agrupar por insumo, manteniendo solo el primer lote (FIFO)
      const protocolos = new Map();
      var aplicaciones_totales = 0

      result.rows.forEach(row => {
        const key = row.id_insumo;
        result.rows.forEach(row2 => {
          if(key == row2.id_insumo)
          aplicaciones_totales = aplicaciones_totales + row2.stock_lote
        })
        if (!protocolos.has(key)) {
          // Solo guardar el PRIMER lote (FIFO - lote_orden = 1)
          protocolos.set(key, {
            id_insumo: row.id_insumo,
            codigo: row.codigo,
            nombre_generico: row.nombre_generico,
            presentacion: row.presentacion,
            unidad_medida: row.unidad_medida,
            imagen_url: row.imagen_url,
            cantidad_por_uso: row.aplicaciones_por_servicio,
            rendimiento_teorico: row.rendimiento_teorico,
            aplicaciones_minimas: row.aplicaciones_minimas,
            // Solo datos del PRIMER lote (FIFO)
            lote_actual: row.lote_orden == 1 && row.id_lote ? {
              id_lote: row.id_lote,
              numero_lote: row.numero_lote,
              fecha_vencimiento: row.fecha_vencimiento,
              aplicaciones_disponibles: row.stock_lote,
              cantidad_fisica: row.cantidad_fisica,
              costo_total: row.costo_total,
              aplicaciones_total: aplicaciones_totales
            } : null
          });
        aplicaciones_totales = 0;
        }
      });
      return Array.from(protocolos.values());
    } catch (error) {
      throw new Error(`Error obteniendo protocolo: ${error.message}`);
    }
  }

  // NUEVO: Obtener lotes vencidos no notificados para insumos de un servicio
  static async getLotesVencidosServicio(idServicio) {
    try {
      const result = await pool.query(
        `SELECT DISTINCT
          l.id_lote,
          l.numero_lote,
          l.fecha_vencimiento,
          l.aplicaciones_disponibles,
          i.id_insumo,
          i.codigo,
          i.nombre_generico,
          i.presentacion,
          (CURRENT_DATE - l.fecha_vencimiento) as dias_vencido
         FROM servicio_insumos si
         INNER JOIN insumos i ON si.id_insumo = i.id_insumo
         INNER JOIN lotes l ON i.id_insumo = l.id_insumo
         WHERE si.id_servicio = $1
           AND l.fecha_vencimiento < CURRENT_DATE
           AND l.aplicaciones_disponibles > 0
           AND l.vencimiento_notificado = FALSE
         ORDER BY l.fecha_vencimiento ASC`,
        [idServicio]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo lotes vencidos: ${error.message}`);
    }
  }

  // Verificar disponibilidad de stock para un servicio
  static async verificarDisponibilidad(idServicio) {
    try {
      const protocolos = await this.getByTipoServicio(idServicio);
      const disponibilidad = [];

      for (const protocolo of protocolos) {
        // MODIFICADO: Calcular stock total del insumo (solo lotes NO vencidos)
        const stockTotal = await pool.query(
          `SELECT COALESCE(SUM(aplicaciones_disponibles), 0) as total
           FROM lotes
           WHERE id_insumo = $1 
             AND aplicaciones_disponibles > 0
             AND fecha_vencimiento >= CURRENT_DATE`,
          [protocolo.id_insumo]
        );

        const stockDisponible = parseInt(stockTotal.rows[0].total);
        const disponible = stockDisponible >= protocolo.cantidad_por_uso;

        disponibilidad.push({
          id_insumo: protocolo.id_insumo,
          nombre: protocolo.nombre_generico,
          requerido: protocolo.cantidad_por_uso,
          disponible: stockDisponible,
          suficiente: disponible,
          obligatorio: true // Todos los insumos del protocolo son necesarios
        });
      }

      return disponibilidad;
    } catch (error) {
      throw new Error(`Error verificando disponibilidad: ${error.message}`);
    }
  }

  // Obtener total de aplicaciones disponibles para un insumo (solo NO vencidos)
  static async getTotalAplicaciones(idInsumo) {
    try {
      const result = await pool.query(
        `SELECT COALESCE(SUM(aplicaciones_disponibles), 0) as total
         FROM lotes
         WHERE id_insumo = $1 
           AND aplicaciones_disponibles > 0
           AND fecha_vencimiento >= CURRENT_DATE`,
        [idInsumo]
      );
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new Error(`Error obteniendo total aplicaciones: ${error.message}`);
    }
  }
}

module.exports = Protocolo;