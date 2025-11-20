import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class ProyeccionDental {

  // Crear nueva proyección dental
  static async crear(datos) {
    const query = `
      INSERT INTO proyecciones_dental 
      (id_imagen, tipo_tratamiento, diagnostico, duracion_estimada, 
       intensidad, ruta_imagen_original, ruta_proyeccion, 
       parametros_ia, id_usuario)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      datos.id_imagen, // ✅ correcto: referencia a imagenes_paciente
      datos.tipo_tratamiento,
      datos.diagnostico || null,
      datos.duracion_estimada || null,
      datos.intensidad || null,
      datos.ruta_imagen_original,
      datos.ruta_proyeccion,
      datos.parametros_ia ? JSON.stringify(datos.parametros_ia) : null,
      datos.id_usuario || null
    ];

    const result = await pool.query(query, values);
    console.log(result.rows[0])
    return result.rows[0];
  }

  // Obtener todas las proyecciones de un paciente
  static async obtenerPorPaciente(pacienteCi) {
    const query = `
      SELECT 
        pd.*,
        p.nombres || ' ' || p.apellidos AS nombre_paciente,
        p.ci
      FROM proyecciones_dental pd
      JOIN imagenes_paciente ip ON pd.id_imagen = ip.id_imagen
      JOIN pacientes p ON ip.id_paciente = p.ci
      WHERE p.ci = $1
      ORDER BY pd.fecha_generacion DESC
    `;

    const result = await pool.query(query, [pacienteCi]);
    return result.rows;
  }

  // Obtener proyección por ID
  static async obtenerPorId(id) {
    const query = `
      SELECT 
        pd.*,
        p.nombres,
        p.apellidos,
        p.ci,
        p.fecha_nacimiento,
        ip.ruta_imagen AS ruta_imagen_paciente
      FROM proyecciones_dental pd
      JOIN imagenes_paciente ip ON pd.id_imagen = ip.id_imagen
      JOIN pacientes p ON ip.id_paciente = p.ci
      WHERE pd.id_proyeccion = $1
    `;

    const result = await pool.query(query, [id]);
    console.log("respuesta de la base de datos:")
    console.log(result.rows[0])
    return result.rows[0];
  }

  // Actualizar proyección
  static async actualizar(id, datos) {
    const query = `
      UPDATE proyecciones_dental
      SET 
        diagnostico = COALESCE($1, diagnostico),
        duracion_estimada = COALESCE($2, duracion_estimada),
        parametros_ia = COALESCE($3, parametros_ia)
      WHERE id_proyeccion = $4
      RETURNING *
    `;

    const values = [
      datos.diagnostico,
      datos.duracion_estimada,
      datos.parametros_ia ? JSON.stringify(datos.parametros_ia) : null,
      id
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Eliminar proyección
  static async eliminar(id) {
    const query = 'DELETE FROM proyecciones_dental WHERE id_proyeccion = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Obtener historial completo (todas las proyecciones)
  static async obtenerHistorial(filtros = {}) {
    let query = `
      SELECT 
        pd.*,
        p.nombres || ' ' || p.apellidos AS nombre_paciente,
        p.ci,
        p.fecha_nacimiento
      FROM proyecciones_dental pd
      JOIN imagenes_paciente ip ON pd.id_imagen = ip.id_imagen
      JOIN pacientes p ON ip.id_paciente = p.ci
      WHERE 1=1
    `;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (filtros.tipo_tratamiento) {
      conditions.push(`pd.tipo_tratamiento = $${paramCount}`);
      values.push(filtros.tipo_tratamiento);
      paramCount++;
    }

    if (filtros.fecha_desde) {
      conditions.push(`pd.fecha_generacion >= $${paramCount}`);
      values.push(filtros.fecha_desde);
      paramCount++;
    }

    if (filtros.fecha_hasta) {
      conditions.push(`pd.fecha_generacion <= $${paramCount}`);
      values.push(filtros.fecha_hasta);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY pd.fecha_generacion DESC';

    if (filtros.limit) {
      query += ` LIMIT $${paramCount}`;
      values.push(filtros.limit);
      paramCount++;
    }

    if (filtros.offset) {
      query += ` OFFSET $${paramCount}`;
      values.push(filtros.offset);
    }

    const result = await pool.query(query, values);
    return result.rows;
  }

  // Obtener estadísticas de proyecciones
  static async obtenerEstadisticas() {
    const query = `
      SELECT 
        COUNT(*) AS total_proyecciones,
        COUNT(*) FILTER (WHERE tipo_tratamiento = 'ortodoncia') AS total_ortodoncia,
        COUNT(*) FILTER (WHERE tipo_tratamiento = 'carillas') AS total_carillas,
        AVG(intensidad::numeric) AS intensidad_promedio,
        COUNT(DISTINCT ip.id_paciente) AS pacientes_unicos
      FROM proyecciones_dental pd
      JOIN imagenes_paciente ip ON pd.id_imagen = ip.id_imagen
    `;

    const result = await pool.query(query);
    return result.rows[0];
  }

  // Obtener última proyección de un paciente
  static async obtenerUltima(pacienteCi) {
    const query = `
      SELECT pd.*
      FROM proyecciones_dental pd
      JOIN imagenes_paciente ip ON pd.id_imagen = ip.id_imagen
      WHERE ip.id_paciente = $1
      ORDER BY pd.fecha_generacion DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [pacienteCi]);
    return result.rows[0];
  }

  // Verificar si existe proyección para un paciente
  static async existeProyeccion(pacienteCi) {
    const query = `
      SELECT COUNT(*) AS total
      FROM proyecciones_dental pd
      JOIN imagenes_paciente ip ON pd.id_imagen = ip.id_imagen
      WHERE ip.id_paciente = $1
    `;
    const result = await pool.query(query, [pacienteCi]);
    return parseInt(result.rows[0].total) > 0;
  }
}

export default ProyeccionDental; // ⬅️ CAMBIADO: module.exports a export default