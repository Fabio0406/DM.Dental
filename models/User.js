import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js
import bcrypt from 'bcryptjs';               // ⬅️ CAMBIADO: require() a import

class User {
  // Buscar usuario por username
  static async findByUsername(username) {
    try {
      const result = await pool.query(
        'SELECT * FROM usuarios WHERE username = $1',
        [username]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error buscando usuario: ${error.message}`);
    }
  }

  // Buscar usuario por CI (nuevo PK)
  static async findByCi(ci) {
    try {
      const result = await pool.query(
        'SELECT ci, username, email, nombres, apellidos, telefono, numero_licencia, fecha_creacion, ultimo_acceso FROM usuarios WHERE ci = $1',
        [ci]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error buscando usuario por CI: ${error.message}`);
    }
  }

  // Crear nuevo usuario
  static async create(userData) {
    const { username, password, email, nombres, apellidos, ci, telefono, numero_licencia } = userData;

    try {
      // Hashear contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `INSERT INTO usuarios (ci, username, password_hash, email, nombres, apellidos, telefono, numero_licencia) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING ci, username, email, nombres, apellidos`,
        [ci, username, hashedPassword, email, nombres, apellidos, telefono, numero_licencia]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creando usuario: ${error.message}`);
    }
  }

  // Actualizar último acceso
  static async updateLastLogin(ci) {
    try {
      await pool.query(
        'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE ci = $1',
        [ci]
      );
    } catch (error) {
      throw new Error(`Error actualizando último acceso: ${error.message}`);
    }
  }

  // Actualizar perfil de usuario
  static async updateProfile(ci, data) {
    const { nombres, apellidos, telefono, password } = data;

    try {
      let query, params;

      if (password) {
        // Si incluye contraseña, actualizar también el hash
        const hashedPassword = await bcrypt.hash(password, 10);
        query = `UPDATE usuarios 
                 SET nombres = $1, apellidos = $2, telefono = $3, password_hash = $4 
                 WHERE ci = $5 
                 RETURNING ci, username, nombres, apellidos, telefono`;
        params = [nombres, apellidos, telefono, hashedPassword, ci];
      } else {
        // Solo datos de perfil
        query = `UPDATE usuarios 
                 SET nombres = $1, apellidos = $2, telefono = $3 
                 WHERE ci = $4 
                 RETURNING ci, username, nombres, apellidos, telefono`;
        params = [nombres, apellidos, telefono, ci];
      }

      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error actualizando perfil: ${error.message}`);
    }
  }

  // Verificar contraseña
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

export default User; // ⬅️ CAMBIADO: module.exports a export default