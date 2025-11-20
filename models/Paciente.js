import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class Paciente {

  // Crear nuevo paciente
  static async crear(datos) {
    const query = `INSERT INTO pacientes (ci, nombres, apellidos, fecha_nacimiento, sexo, telefono, direccion, id_usuario) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;

    const values = [
      datos.ci,
      datos.nombres,
      datos.apellidos,
      datos.fecha_nacimiento,
      datos.sexo,
      datos.telefono || null,
      datos.direccion || null,
      datos.id_usuario || null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Obtener todos los pacientes con paginación y búsqueda
  static async obtenerTodos(filtros = {}) {
    let baseQuery = `SELECT p.ci, p.nombres, p.apellidos, p.fecha_nacimiento, p.telefono, p.direccion, p.sexo, p.fecha_registro, COUNT(DISTINCT pd.id_proyeccion) AS total_proyecciones, MAX(pd.fecha_generacion) AS ultima_proyeccion FROM pacientes p LEFT JOIN imagenes_paciente ip ON ip.id_paciente = p.ci LEFT JOIN proyecciones_dental pd ON pd.id_imagen = ip.id_imagen`;

    const conditions = [];
    const values = [];
    let paramCount = 1;

    // Filtros
    if (filtros.ci) {
      conditions.push(`p.ci::TEXT ILIKE $${paramCount}`);
      values.push(`%${filtros.ci}%`);
      paramCount++;
    }

    if (filtros.nombre) {
      conditions.push(`(p.nombres ILIKE $${paramCount} OR p.apellidos ILIKE $${paramCount})`);
      values.push(`%${filtros.nombre}%`);
      paramCount++;
    }

    if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    baseQuery += ` GROUP BY p.ci, p.nombres, p.apellidos, p.fecha_nacimiento, p.telefono, p.direccion, p.sexo, p.fecha_registro ORDER BY p.apellidos, p.nombres`;

    // Paginación
    if (filtros.limit) {
      baseQuery += ` LIMIT $${paramCount}`;
      values.push(filtros.limit);
      paramCount++;
    }

    if (filtros.offset) {
      baseQuery += ` OFFSET $${paramCount}`;
      values.push(filtros.offset);
    }

    const result = await pool.query(baseQuery, values);
    return result.rows;
  }

  static async obtenerPorId(ci) {
    const query = `SELECT p.*, json_agg(DISTINCT jsonb_build_object('id_imagen', ip.id_imagen, 'ruta_imagen', ip.ruta_imagen, 'tipo_imagen', ip.tipo_imagen, 'fecha_captura', ip.fecha_captura, 'descripcion', ip.descripcion)) FILTER (WHERE ip.id_imagen IS NOT NULL) AS imagenes, json_agg(DISTINCT jsonb_build_object('id_proyeccion', pd.id_proyeccion, 'tipo_tratamiento', pd.tipo_tratamiento, 'ruta_proyeccion', pd.ruta_proyeccion, 'parametros_ia', pd.parametros_ia::text, 'fecha_generacion', pd.fecha_generacion)) FILTER (WHERE pd.id_proyeccion IS NOT NULL) AS proyecciones FROM pacientes p LEFT JOIN imagenes_paciente ip ON p.ci = ip.id_paciente LEFT JOIN proyecciones_dental pd ON ip.id_imagen = pd.id_imagen WHERE p.ci = $1 GROUP BY p.ci`;

    const result = await pool.query(query, [ci]);
    return result.rows[0];
  }

  // Obtener paciente simple
  static async obtenerPorCI(ci) {
    const query = 'SELECT * FROM pacientes WHERE ci = $1';
    const result = await pool.query(query, [ci]);
    return result.rows[0];
  }

  static async findByCi(ci) {
    return this.obtenerPorCI(ci);
  }

  // Actualizar paciente
  static async actualizar(ci, datos) {
    const query = `UPDATE pacientes SET nombres = COALESCE($1, nombres), apellidos = COALESCE($2, apellidos), fecha_nacimiento = COALESCE($3, fecha_nacimiento), sexo = COALESCE($4, sexo), telefono = COALESCE($5, telefono), direccion = COALESCE($6, direccion) WHERE ci = $7 RETURNING *`;

    const values = [
      datos.nombres,
      datos.apellidos,
      datos.fecha_nacimiento,
      datos.sexo,
      datos.telefono,
      datos.direccion,
      ci
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Eliminar paciente (cascade por FK en DB)
  static async eliminar(ci) {
    const query = 'DELETE FROM pacientes WHERE ci = $1 RETURNING *';
    const result = await pool.query(query, [ci]);
    return result.rows[0];
  }

  // Calcular edad
  static calcularEdad(fechaNacimiento) {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }

  // Estadísticas de pacientes
  static async obtenerEstadisticas() {
    const query = `SELECT COUNT(*) AS total_pacientes, COUNT(*) FILTER (WHERE sexo ILIKE 'masculino' OR sexo ILIKE 'M') AS total_masculino, COUNT(*) FILTER (WHERE sexo ILIKE 'femenino' OR sexo ILIKE 'F') AS total_femenino, COUNT(DISTINCT pd.id_proyeccion) AS total_proyecciones, COUNT(DISTINCT p.ci) FILTER (WHERE pd.id_proyeccion IS NOT NULL) AS pacientes_con_proyecciones FROM pacientes p LEFT JOIN imagenes_paciente ip ON ip.id_paciente = p.ci LEFT JOIN proyecciones_dental pd ON pd.id_imagen = ip.id_imagen`;

    const result = await pool.query(query);
    return result.rows[0];
  }
}

export default Paciente; // ⬅️ CAMBIADO: module.exports a export default