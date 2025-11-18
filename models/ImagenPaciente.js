const { pool } = require('../config/database');

class ImagenPaciente {
  
  // Guardar imagen del paciente
  static async crear(datos) {
    const query = `
      INSERT INTO imagenes_paciente 
      (id_paciente, ruta_imagen, tipo_imagen, descripcion, id_usuario)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    console.log("estos datos me llegan para crear imagen")
    console.log(datos)
    const values = [
      datos.ci_paciente,
      datos.ruta_imagen,
      datos.tipo_imagen || 'frontal',
      datos.descripcion || null,
      datos.id_usuario || null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Obtener todas las imágenes de un paciente
  static async obtenerPorPaciente(pacienteId) {
    const query = `
      SELECT * FROM imagenes_paciente
      WHERE id_paciente = $1
      ORDER BY fecha_captura DESC
    `;
    
    const result = await pool.query(query, [pacienteId]);
    return result.rows;
  }

  // Obtener imagen más reciente del paciente (simula "principal")
  static async obtenerPrincipal(pacienteId) {
    const query = `
      SELECT * FROM imagenes_paciente
      WHERE id_paciente = $1
      ORDER BY fecha_captura DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [pacienteId]);
    return result.rows[0];
  }

  // Obtener imagen por ID
  static async obtenerPorId(id) {
    const query = 'SELECT * FROM imagenes_paciente WHERE id_imagen = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Eliminar imagen
  static async eliminar(id) {
    const query = 'DELETE FROM imagenes_paciente WHERE id_imagen = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Verificar si existe imagen para el paciente
  static async existeImagenPaciente(pacienteId) {
    const query = 'SELECT COUNT(*) as total FROM imagenes_paciente WHERE id_paciente = $1';
    const result = await pool.query(query, [pacienteId]);
    return parseInt(result.rows[0].total) > 0;
  }
}

module.exports = ImagenPaciente;