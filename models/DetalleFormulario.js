import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class DetalleFormulario {
  // Crear detalle de formulario
  static async create(detalleData) {
    const {
      id_formulario,
      id_insumo,
      cantidad_detectada,
      fecha_vencimiento_detectada,
      lote_detectado,
      codigo,
      nombre_generico
    } = detalleData;

    try {
      // Nota: Se corrige la tabla a 'detalles_formulario_salmi' y se ajusta la sintaxis del INSERT para 8 columnas/valores.
      const result = await pool.query(
        `INSERT INTO detalles_formulario_salmi (id_formulario, id_insumo, cantidad, numero_lote, fecha_vencimiento, codigo, nombre_generico, linea_numero) VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(linea_numero), 0) + 1 FROM detalles_formulario_salmi WHERE id_formulario = $1)) RETURNING *`,
        [id_formulario, id_insumo, cantidad_detectada, lote_detectado, fecha_vencimiento_detectada, codigo, nombre_generico]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creando detalle: ${error.message}`);
    }
  }

  // Crear múltiples detalles
  static async createBatch(detalles) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];

      for (const detalle of detalles) {
        const result = await client.query(
          `INSERT INTO detalles_formulario_salmi (id_formulario, id_insumo, linea_numero, codigo, nombre_generico, numero_lote, fecha_vencimiento, cantidad, costo_unitario, costo_total) VALUES ($1, $2, (SELECT COALESCE(MAX(linea_numero), 0) + 1 FROM detalles_formulario_salmi WHERE id_formulario = $1), $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            detalle.id_formulario,
            detalle.id_insumo,
            detalle.codigo,
            detalle.nombre_generico,
            detalle.lote_detectado,
            detalle.fecha_vencimiento_detectada,
            detalle.cantidad_detectada,
            detalle.costo_unitario,
            (detalle.cantidad_detectada * detalle.costo_unitario)
          ]
        );
        results.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error creando detalles: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Buscar detalles por formulario
  static async findByFormulario(idFormulario) {
    try {
      const result = await pool.query(
        `SELECT d.id_detalle, d.id_formulario, d.id_insumo, COALESCE(d.codigo, i.codigo) AS codigo, COALESCE(d.nombre_generico, i.nombre_generico) AS nombre_generico, i.presentacion, d.cantidad, d.numero_lote, d.fecha_vencimiento, d.costo_unitario, d.procesado, d.linea_numero FROM detalles_formulario_salmi d LEFT JOIN insumos i ON d.id_insumo = i.id_insumo WHERE d.id_formulario = $1 ORDER BY d.linea_numero`,
        [idFormulario]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error buscando detalles: ${error.message}`);
    }
  }

  // Confirmar detalle (marcar como procesado)
  static async confirmar(idDetalle) {
    try {
      const result = await pool.query(
        `UPDATE detalles_formulario_salmi SET procesado = true WHERE id_detalle = $1 RETURNING *`,
        [idDetalle]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error confirmando detalle: ${error.message}`);
    }
  }
}

export default DetalleFormulario; // ⬅️ CAMBIADO: module.exports a export default