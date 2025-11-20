import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class Dashboard {
  // KPI 1: Stock Actual por Categoría
  static async getStockPorCategoria() {
    try {
      const result = await pool.query(
        `SELECT 
          c.nombre as categoria,
          COUNT(DISTINCT i.id_insumo) as total_insumos,
          COALESCE(SUM(l.aplicaciones_disponibles), 0) as total_aplicaciones
         FROM categorias_insumo c
         LEFT JOIN insumos i ON c.id_categoria_insumo = i.id_categoria
         LEFT JOIN lotes l ON i.id_insumo = l.id_insumo AND l.aplicaciones_disponibles > 0
         GROUP BY c.nombre, c.id_categoria_insumo
         ORDER BY c.nombre`
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo stock por categoría: ${error.message}`);
    }
  }

  // KPI 2: Tasa de Desabastecimiento
  static async getTasaDesabastecimiento() {
    try {
      const result = await pool.query(
        `SELECT 
          COUNT(DISTINCT i.id_insumo) as total_insumos,
          COUNT(DISTINCT i.id_insumo) FILTER (
            WHERE COALESCE(stock_total.total, 0) <= i.aplicaciones_minimas
          ) as insumos_bajo_stock,
          ROUND(
            (COUNT(DISTINCT i.id_insumo) FILTER (
              WHERE COALESCE(stock_total.total, 0) <= i.aplicaciones_minimas
            )::numeric / 
             NULLIF(COUNT(DISTINCT i.id_insumo), 0) * 100), 2
          ) as porcentaje_desabastecimiento
         FROM insumos i
         LEFT JOIN (
           SELECT id_insumo, SUM(aplicaciones_disponibles) as total
           FROM lotes
           WHERE aplicaciones_disponibles > 0
           GROUP BY id_insumo
         ) stock_total ON i.id_insumo = stock_total.id_insumo`
      );

      const data = result.rows[0];
      let nivel = 'success'; // verde
      if (data.porcentaje_desabastecimiento > 30) nivel = 'danger'; // rojo
      else if (data.porcentaje_desabastecimiento > 15) nivel = 'warning'; // amarillo

      return {
        ...data,
        nivel
      };
    } catch (error) {
      throw new Error(`Error calculando desabastecimiento: ${error.message}`);
    }
  }

  // KPI 3: Insumos Próximos a Vencer
  static async getInsumosProximosVencer() {
    try {
      const result = await pool.query(
        `SELECT 
          CASE 
            WHEN fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days' THEN '30'
            WHEN fecha_vencimiento <= CURRENT_DATE + INTERVAL '60 days' THEN '60'
            WHEN fecha_vencimiento <= CURRENT_DATE + INTERVAL '90 days' THEN '90'
          END as rango_dias,
          COUNT(DISTINCT l.id_lote) as cantidad_lotes,
          COUNT(DISTINCT l.id_insumo) as cantidad_insumos,
          COALESCE(SUM(l.aplicaciones_disponibles), 0) as aplicaciones_totales,
          COALESCE(SUM(l.costo_total), 0) as valor_total
         FROM lotes l
         WHERE l.aplicaciones_disponibles > 0
           AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '90 days'
           AND l.fecha_vencimiento > CURRENT_DATE
         GROUP BY rango_dias
         ORDER BY rango_dias`
      );

      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo insumos por vencer: ${error.message}`);
    }
  }

  // Detalle de insumos por vencer (para la tabla)
  static async getDetalleInsumosVencer(dias = 90) {
    try {
      const result = await pool.query(
        `SELECT 
          i.codigo,
          i.nombre_generico,
          l.numero_lote,
          l.fecha_vencimiento,
          l.aplicaciones_disponibles,
          l.costo_total as valor_lote,
          (l.fecha_vencimiento - CURRENT_DATE) as dias_restantes
         FROM lotes l
         JOIN insumos i ON l.id_insumo = i.id_insumo
         WHERE l.aplicaciones_disponibles > 0
           AND l.fecha_vencimiento <= CURRENT_DATE + ($1 || ' days')::INTERVAL
           AND l.fecha_vencimiento > CURRENT_DATE
         ORDER BY l.fecha_vencimiento ASC
         LIMIT 10`,
        [dias]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo detalle: ${error.message}`);
    }
  }

  // Estadísticas generales del dashboard
  static async getEstadisticasGenerales() {
    try {
      // Consulta optimizada y 100% segura
      const result = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM insumos) AS total_insumos,
          (SELECT COUNT(DISTINCT id_insumo) 
           FROM lotes 
           WHERE aplicaciones_disponibles > 0 
             AND fecha_vencimiento >= CURRENT_DATE
             AND (vencimiento_notificado IS NULL OR vencimiento_notificado = FALSE)
          ) AS en_stock,
          (SELECT COUNT(*) FROM alertas WHERE leida = FALSE) AS alertas,
          (SELECT COUNT(*) FROM proyecciones_dental WHERE DATE(fecha_generacion) = CURRENT_DATE) AS proyecciones_hoy,
          (SELECT COALESCE(SUM(dk.salidas), 0)
           FROM detalle_kardex dk
           JOIN kardex k ON dk.id_kardex = k.id_kardex
           WHERE k.abierto = TRUE
             AND DATE_TRUNC('month', dk.fecha) = DATE_TRUNC('month', CURRENT_DATE)
          ) AS consumo_mes
      `);

      // Debug: imprime exactamente lo que devuelve PostgreSQL
      console.log('Raw result from DB:', result.rows);

      if (!result.rows || result.rows.length === 0) {
        console.warn('No rows returned from stats query');
        return { total_insumos: 0, en_stock: 0, alertas: 0, proyecciones_hoy: 0, consumo_mes: 0 };
      }

      const row = result.rows[0];

      // Forzar conversión a número y fallback a 0
      return {
        total_insumos: parseInt(row.total_insumos, 10) || 0,
        en_stock: parseInt(row.en_stock, 10) || 0,
        alertas: parseInt(row.alertas, 10) || 0,
        proyecciones_hoy: parseInt(row.proyecciones_hoy, 10) || 0,
        consumo_mes: parseInt(row.consumo_mes, 10) || 0
      };
    } catch (error) {
      console.error('Error crítico en getEstadisticasGenerales:', error);
      return { total_insumos: 0, en_stock: 0, alertas: 0, proyecciones_hoy: 0, consumo_mes: 0 };
    }
  }
}

export default Dashboard; // ⬅️ CAMBIADO: module.exports a export default