import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class Alerta {
  // Crear una nueva alerta
  static async crear(alertaData) {
    const { titulo, mensaje, id_usuario, id_insumo } = alertaData;
    try {
      const result = await pool.query(
        `INSERT INTO alertas (titulo, mensaje, id_usuario, id_insumo)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [titulo, mensaje, id_usuario, id_insumo || null]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creando alerta: ${error.message}`);
    }
  }

  // Obtener alertas no leídas de un usuario
  static async getNoLeidas(idUsuario) {
    try {
      const result = await pool.query(
        `SELECT 
          a.*,
          i.codigo,
          i.nombre_generico
         FROM alertas a
         LEFT JOIN insumos i ON a.id_insumo = i.id_insumo
         WHERE a.id_usuario = $1 AND a.leida = FALSE
         ORDER BY a.fecha_creacion DESC`,
        [idUsuario]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo alertas no leídas: ${error.message}`);
    }
  }

  // Contar alertas no leídas
  static async contarNoLeidas(idUsuario) {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as total
         FROM alertas
         WHERE id_usuario = $1 AND leida = FALSE`,
        [idUsuario]
      );
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new Error(`Error contando alertas: ${error.message}`);
    }
  }

  // Marcar alerta como leída
  static async marcarLeida(idAlerta) {
    try {
      const result = await pool.query(
        `UPDATE alertas SET leida = TRUE WHERE id_alerta = $1 RETURNING *`,
        [idAlerta]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error marcando alerta como leída: ${error.message}`);
    }
  }

  // Marcar todas las alertas como leídas
  static async marcarTodasLeidas(idUsuario) {
    try {
      const result = await pool.query(
        `UPDATE alertas SET leida = TRUE 
         WHERE id_usuario = $1 AND leida = FALSE
         RETURNING *`,
        [idUsuario]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error marcando alertas como leídas: ${error.message}`);
    }
  }

  // Obtener historial de alertas
  static async getHistorial(idUsuario, limite = 50) {
    try {
      const result = await pool.query(
        `SELECT 
          a.*,
          i.codigo,
          i.nombre_generico
         FROM alertas a
         LEFT JOIN insumos i ON a.id_insumo = i.id_insumo
         WHERE a.id_usuario = $1
         ORDER BY a.fecha_creacion DESC
         LIMIT $2`,
        [idUsuario, limite]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo historial: ${error.message}`);
    }
  }

  // Generar alertas de desabastecimiento (HU07)
  static async generarAlertasDesabastecimiento(idUsuario) {
    try {
      const result = await pool.query(
        `SELECT 
          i.id_insumo,
          i.codigo,
          i.nombre_generico,
          i.aplicaciones_minimas,
          COALESCE(SUM(l.aplicaciones_disponibles), 0) as stock_actual
         FROM insumos i
         LEFT JOIN lotes l ON i.id_insumo = l.id_insumo 
           AND l.aplicaciones_disponibles > 0
           AND l.fecha_vencimiento >= CURRENT_DATE
         GROUP BY i.id_insumo
         HAVING COALESCE(SUM(l.aplicaciones_disponibles), 0) <= i.aplicaciones_minimas`
      );

      const alertasGeneradas = [];

      for (const insumo of result.rows) {
        // Verificar si ya existe una alerta no leída para este insumo
        const alertaExistente = await pool.query(
          `SELECT id_alerta FROM alertas 
           WHERE id_usuario = $1 AND id_insumo = $2 AND leida = FALSE
           AND titulo LIKE '%Desabastecimiento%'`,
          [idUsuario, insumo.id_insumo]
        );

        if (alertaExistente.rows.length === 0) {
          const diferencia = insumo.aplicaciones_minimas - parseInt(insumo.stock_actual);
          const alerta = await this.crear({
            titulo: 'Alerta de Desabastecimiento',
            mensaje: `El insumo ${insumo.codigo} - ${insumo.nombre_generico} está en nivel crítico. Stock actual: ${insumo.stock_actual} aplicaciones, Mínimo requerido: ${insumo.aplicaciones_minimas}, Diferencia: ${diferencia}`,
            id_usuario: idUsuario,
            id_insumo: insumo.id_insumo
          });
          alertasGeneradas.push(alerta);
        }
      }

      return alertasGeneradas;
    } catch (error) {
      throw new Error(`Error generando alertas de desabastecimiento: ${error.message}`);
    }
  }

  // Generar alertas de vencimiento (HU08)
  static async generarAlertasVencimiento(idUsuario) {
    try {
      const result = await pool.query(
        `SELECT 
          l.id_lote,
          l.numero_lote,
          l.fecha_vencimiento,
          l.aplicaciones_disponibles,
          i.id_insumo,
          i.codigo,
          i.nombre_generico,
          (l.fecha_vencimiento - CURRENT_DATE) as dias_restantes
         FROM lotes l
         INNER JOIN insumos i ON l.id_insumo = i.id_insumo
         WHERE l.aplicaciones_disponibles > 0
           AND l.fecha_vencimiento >= CURRENT_DATE
           AND l.fecha_vencimiento <= CURRENT_DATE + INTERVAL '60 days'
         ORDER BY l.fecha_vencimiento ASC`
      );

      const alertasGeneradas = [];

      for (const lote of result.rows) {
        const diasRestantes = parseInt(lote.dias_restantes);
        let nivelUrgencia = '';
        let titulo = '';

        if (diasRestantes <= 0) {
          nivelUrgencia = 'VENCIDO';
          titulo = 'Lote VENCIDO';
        } else if (diasRestantes <= 10) {
          nivelUrgencia = 'URGENTE';
          titulo = 'Vencimiento URGENTE (10 días)';
        } else if (diasRestantes <= 30) {
          nivelUrgencia = 'MODERADO';
          titulo = 'Vencimiento Moderado (30 días)';
        } else if (diasRestantes <= 60) {
          nivelUrgencia = 'PREVENTIVO';
          titulo = 'Vencimiento Preventivo (60 días)';
        }

        // Verificar si ya existe alerta para este lote
        const alertaExistente = await pool.query(
          `SELECT id_alerta FROM alertas 
           WHERE id_usuario = $1 AND leida = FALSE
           AND mensaje LIKE $2`,
          [idUsuario, `%Lote: ${lote.numero_lote}%`]
        );

        if (alertaExistente.rows.length === 0 && nivelUrgencia) {
          const fechaVenc = new Date(lote.fecha_vencimiento).toLocaleDateString('es-BO');
          const alerta = await this.crear({
            titulo: titulo,
            mensaje: `${lote.codigo} - ${lote.nombre_generico}. Lote: ${lote.numero_lote}, Vence: ${fechaVenc}, Días restantes: ${diasRestantes}, Stock: ${lote.aplicaciones_disponibles} aplicaciones. Nivel: ${nivelUrgencia}`,
            id_usuario: idUsuario,
            id_insumo: lote.id_insumo
          });
          alertasGeneradas.push(alerta);
        }
      }

      return alertasGeneradas;
    } catch (error) {
      throw new Error(`Error generando alertas de vencimiento: ${error.message}`);
    }
  }

  // Obtener resumen de alertas por tipo
  static async getResumenAlertas(idUsuario) {
    try {
      const result = await pool.query(
        `SELECT 
          CASE 
            WHEN titulo LIKE '%Desabastecimiento%' THEN 'desabastecimiento'
            WHEN titulo LIKE '%Vencimiento%' OR titulo LIKE '%VENCIDO%' THEN 'vencimiento'
            ELSE 'otro'
          END as tipo,
          COUNT(*) as cantidad
         FROM alertas
         WHERE id_usuario = $1 AND leida = FALSE
         GROUP BY tipo`,
        [idUsuario]
      );

      return {
        desabastecimiento: parseInt(result.rows.find(r => r.tipo === 'desabastecimiento')?.cantidad || 0),
        vencimiento: parseInt(result.rows.find(r => r.tipo === 'vencimiento')?.cantidad || 0),
        total: result.rows.reduce((sum, r) => sum + parseInt(r.cantidad), 0)
      };
    } catch (error) {
      throw new Error(`Error obteniendo resumen: ${error.message}`);
    }
  }
}

export default Alerta; // ⬅️ CAMBIADO: module.exports a export default