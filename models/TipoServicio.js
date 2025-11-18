const { pool } = require('../config/database');

class TipoServicio {
  // Listar todos los servicios
  static async findAll() {
    try {
      const result = await pool.query(
        `SELECT 
          s.id_servicio,
          s.nombre,
          c.id_categoria_servicio,
          c.nombre as categoria_nombre
         FROM servicio s
         LEFT JOIN categorias_servicio c ON s.id_categoria = c.id_categoria_servicio
         ORDER BY s.nombre`
      );
      console.log(result.rows)
      return result.rows;
    } catch (error) {
      throw new Error(`Error listando servicios: ${error.message}`);
    }
  }

  // Buscar por ID
  static async findById(id) {
    try {
      const result = await pool.query(
        `SELECT 
          s.id_servicio,
          s.nombre,
          c.id_categoria_servicio,
          c.nombre as categoria_nombre
         FROM servicio s
         LEFT JOIN categorias_servicio c ON s.id_categoria = c.id_categoria_servicio
         WHERE s.id_servicio = $1`,
        [id]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error buscando servicio: ${error.message}`);
    }
  }

  // Buscar por categoría
  static async findByCategoria(idCategoria) {
    try {
      const result = await pool.query(
        `SELECT 
          s.id_servicio,
          s.nombre,
          c.id_categoria_servicio,
          c.nombre as categoria_nombre
         FROM servicio s
         LEFT JOIN categorias_servicio c ON s.id_categoria = c.id_categoria_servicio
         WHERE s.id_categoria = $1
         ORDER BY s.nombre`,
        [idCategoria]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error buscando servicios por categoría: ${error.message}`);
    }
  }

  // Listar todas las categorías de servicio
  static async findAllCategorias() {
    try {
      const result = await pool.query(
        'SELECT * FROM categorias_servicio ORDER BY nombre'
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error listando categorías: ${error.message}`);
    }
  }
}

module.exports = TipoServicio;