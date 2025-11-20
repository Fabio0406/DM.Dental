import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class Insumo {
  // Buscar insumo por código
  static async findByCode(codigo) {
    try {
      const result = await pool.query(
        'SELECT * FROM insumos WHERE codigo = $1',
        [codigo]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error buscando insumo: ${error.message}`);
    }
  }

  // Buscar insumo por ID con total de aplicaciones disponibles
  static async findById(idInsumo) {
    try {
      const result = await pool.query(
        `SELECT 
          i.*,
          c.nombre as categoria_nombre,
          COALESCE(SUM(l.aplicaciones_disponibles), 0) as aplicaciones_totales
         FROM insumos i
         LEFT JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
         LEFT JOIN lotes l ON i.id_insumo = l.id_insumo AND l.aplicaciones_disponibles > 0
         WHERE i.id_insumo = $1
         GROUP BY i.id_insumo, c.nombre`,
        [idInsumo]
      );
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error buscando insumo por ID: ${error.message}`);
    }
  }

  // Buscar insumo por nombre (para matching difuso)
  static async findByName(nombre) {
    try {
      const result = await pool.query(
        `SELECT 
          i.*,
          COALESCE(SUM(l.aplicaciones_disponibles), 0) as aplicaciones_totales
         FROM insumos i
         LEFT JOIN lotes l ON i.id_insumo = l.id_insumo AND l.aplicaciones_disponibles > 0
         WHERE LOWER(i.nombre_generico) LIKE LOWER($1)
         GROUP BY i.id_insumo
         ORDER BY LENGTH(i.nombre_generico)
         LIMIT 5`,
        [`%${nombre}%`]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error buscando insumo por nombre: ${error.message}`);
    }
  }

  // Listar todos los insumos con sus aplicaciones totales
  static async findAll() {
    try {
      const result = await pool.query(
        `SELECT 
          i.*,
          c.nombre as categoria_nombre,
          COALESCE(SUM(l.aplicaciones_disponibles), 0) as aplicaciones_totales
         FROM insumos i
         LEFT JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
         LEFT JOIN lotes l ON i.id_insumo = l.id_insumo AND l.aplicaciones_disponibles > 0
         GROUP BY i.id_insumo, c.nombre
         ORDER BY i.nombre_generico`
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error listando insumos: ${error.message}`);
    }
  }

  // Crear nuevo insumo
  static async create(insumoData) {
    const {
      codigo,
      nombre_generico,
      forma_farmaceutica,
      concentracion,
      presentacion,
      unidad_medida,
      aplicaciones_minimas,
      rendimiento_teorico,
      costo_unitario,
      id_categoria,
      imagen_url
    } = insumoData;

    try {
      const result = await pool.query(
        `INSERT INTO insumos 
         (codigo, nombre_generico, forma_farmaceutica, concentracion, presentacion, 
          unidad_medida, aplicaciones_minimas, rendimiento_teorico, costo_unitario, 
          id_categoria, imagen_url) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING *`,
        [
          codigo,
          nombre_generico,
          forma_farmaceutica,
          concentracion,
          presentacion,
          unidad_medida,
          aplicaciones_minimas || 10,
          rendimiento_teorico || 1,
          costo_unitario,
          id_categoria,
          imagen_url
        ]
      );

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creando insumo: ${error.message}`);
    }
  }

  // Obtener aplicaciones disponibles de un insumo (suma de todos los lotes)
  static async getAplicacionesDisponibles(idInsumo) {
    try {
      const result = await pool.query(
        `SELECT COALESCE(SUM(aplicaciones_disponibles), 0) as total
         FROM lotes
         WHERE id_insumo = $1 AND aplicaciones_disponibles > 0`,
        [idInsumo]
      );
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new Error(`Error obteniendo aplicaciones: ${error.message}`);
    }
  }

  // Obtener lotes disponibles de un insumo (FIFO)
  static async getLotesFIFO(idInsumo) {
    try {
      const result = await pool.query(
        `SELECT *
         FROM lotes
         WHERE id_insumo = $1 AND aplicaciones_disponibles > 0
         ORDER BY fecha_vencimiento ASC, id_lote ASC`,
        [idInsumo]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error obteniendo lotes FIFO: ${error.message}`);
    }
  }

  // Verificar stock disponible (por aplicaciones)
  static async checkStock(idInsumo, aplicacionesRequeridas) {
    try {
      const aplicacionesDisponibles = await this.getAplicacionesDisponibles(idInsumo);

      const insumo = await pool.query(
        'SELECT nombre_generico FROM insumos WHERE id_insumo = $1',
        [idInsumo]
      );

      if (insumo.rows.length === 0) {
        return { disponible: false, error: 'Insumo no encontrado' };
      }

      const { nombre_generico } = insumo.rows[0];

      if (aplicacionesDisponibles >= aplicacionesRequeridas) {
        return {
          disponible: true,
          aplicacionesDisponibles: aplicacionesDisponibles
        };
      } else {
        return {
          disponible: false,
          error: `Stock insuficiente. Disponible: ${aplicacionesDisponibles}, Requerido: ${aplicacionesRequeridas}`,
          aplicacionesDisponibles: aplicacionesDisponibles,
          nombreInsumo: nombre_generico
        };
      }
    } catch (error) {
      throw new Error(`Error verificando stock: ${error.message}`);
    }
  }

  // Buscar insumos con stock bajo
  static async findLowStock() {
    try {
      const result = await pool.query(
        `SELECT 
          i.*,
          c.nombre as categoria_nombre,
          COALESCE(SUM(l.aplicaciones_disponibles), 0) as aplicaciones_totales
         FROM insumos i
         LEFT JOIN categorias_insumo c ON i.id_categoria = c.id_categoria
         LEFT JOIN lotes l ON i.id_insumo = l.id_insumo AND l.aplicaciones_disponibles > 0
         GROUP BY i.id_insumo, c.nombre
         HAVING COALESCE(SUM(l.aplicaciones_disponibles), 0) <= i.aplicaciones_minimas
         ORDER BY COALESCE(SUM(l.aplicaciones_disponibles), 0) ASC`
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error buscando stock bajo: ${error.message}`);
    }
  }
}

export default Insumo; // ⬅️ CAMBIADO: module.exports a export default