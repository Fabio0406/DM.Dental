import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class Formulario {
  // Crear nuevo formulario SALMI
  static async create(formularioData) {
    const { nro_formulario, fecha_elaboracion, imagen_path, representante } = formularioData;

    try {
      const result = await pool.query(
        `INSERT INTO formularios_salmi (nro_formulario, fecha_elaboracion, imagen_path, representante, procesado) VALUES ($1, $2, $3, $4, FALSE) RETURNING *`,
        [
          nro_formulario || 'SALMI-TEMP',
          fecha_elaboracion || new Date().toISOString().split('T')[0],
          imagen_path,
          representante
        ]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creando formulario: ${error.message}`);
    }
  }

  // Buscar formulario por ID
  static async findById(id) {
    try {
      const result = await pool.query(
        'SELECT * FROM formularios_salmi WHERE id_formulario = $1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error buscando formulario: ${error.message}`);
    }
  }

  // Actualizar estado de procesamiento
  static async updateStatus(id, procesado) {
    try {
      const result = await pool.query(
        'UPDATE formularios_salmi SET procesado = $1 WHERE id_formulario = $2 RETURNING *',
        [procesado, id]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error actualizando estado: ${error.message}`);
    }
  }

  // Actualizar datos OCR (número de formulario y fecha)
  static async updateDatos(id, datos) {
    try {
      const result = await pool.query(
        `UPDATE formularios_salmi SET nro_formulario = COALESCE($1, nro_formulario), fecha_elaboracion = COALESCE($2, fecha_elaboracion), responsable = COALESCE($3, responsable) WHERE id_formulario = $4 RETURNING *`,
        [datos.numero_formulario, datos.fecha_documento, datos.responsable_nombre, id]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error actualizando datos: ${error.message}`);
    }
  }

  // Listar formularios por usuario
  static async findByUser(userId, limit = 10) {
    try {
      const result = await pool.query(
        `SELECT * FROM formularios_salmi WHERE representante = $1 ORDER BY fecha_entrega DESC LIMIT $2`,
        [userId, limit]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error listando formularios: ${error.message}`);
    }
  }

  // Obtener todos los formularios
  static async findAll(limit = 50) {
    try {
      const result = await pool.query(
        `SELECT * FROM formularios_salmi ORDER BY fecha_entrega DESC LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo formularios: ${error.message}`);
    }
  }
}

export default Formulario; // ⬅️ CAMBIADO: module.exports a export