import { pool } from '../config/database.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class Solicitud {
  // Generar número de solicitud correlativo por mes
  static async generarNumeroSolicitud() {
    try {
      const ahora = new Date();
      const anio = ahora.getFullYear();
      const mes = String(ahora.getMonth() + 1).padStart(2, '0');
      
      // Contar solicitudes del mes actual
      const result = await pool.query(
        `SELECT COUNT(*) as total 
         FROM solicitudes_pedido 
         WHERE EXTRACT(YEAR FROM fecha) = $1 
         AND EXTRACT(MONTH FROM fecha) = $2`,
        [anio, ahora.getMonth() + 1]
      );
      
      const correlativo = parseInt(result.rows[0].total) + 1;
      return `PED-${anio}-${mes}-${String(correlativo).padStart(3, '0')}`;
    } catch (error) {
      throw new Error(`Error generando número de solicitud: ${error.message}`);
    }
  }

  // Crear nueva solicitud con sus detalles
  static async crear(idUsuario, detalles) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Generar número de solicitud
      const nroSolicitud = await this.generarNumeroSolicitud();

      // Crear solicitud
      const solicitudResult = await client.query(
        `INSERT INTO solicitudes_pedido (id_usuario, nro_solicitud, material)
         VALUES ($1, $2, 'ODONTOLOGICO')
         RETURNING *`,
        [idUsuario, nroSolicitud]
      );

      const solicitud = solicitudResult.rows[0];

      // Insertar detalles
      for (const detalle of detalles) {
        await client.query(
          `INSERT INTO detalles_solicitud (id_solicitud, id_insumo, cantidad, costo_total)
           VALUES ($1, $2, $3, $4)`,
          [solicitud.id_solicitud, detalle.id_insumo, detalle.cantidad, detalle.costo_total]
        );
      }

      await client.query('COMMIT');
      return solicitud;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error creando solicitud: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Listar solicitudes de un usuario
  static async listarPorUsuario(idUsuario) {
    try {
      const result = await pool.query(
        `SELECT 
          sp.id_solicitud,
          sp.nro_solicitud,
          sp.fecha,
          sp.material,
          u.nombres || ' ' || u.apellidos as solicitante,
          COUNT(ds.id_detalle_solicitud) as total_items,
          COALESCE(SUM(ds.costo_total), 0) as total_general
         FROM solicitudes_pedido sp
         INNER JOIN usuarios u ON sp.id_usuario = u.ci
         LEFT JOIN detalles_solicitud ds ON sp.id_solicitud = ds.id_solicitud
         WHERE sp.id_usuario = $1
         GROUP BY sp.id_solicitud, sp.nro_solicitud, sp.fecha, sp.material, u.nombres, u.apellidos
         ORDER BY sp.fecha DESC`,
        [idUsuario]
      );
      return result.rows;
    } catch (error) {
      throw new Error(`Error listando solicitudes: ${error.message}`);
    }
  }

  // Obtener solicitud por ID con sus detalles
  static async obtenerPorId(idSolicitud) {
    try {
      // Obtener solicitud
      const solicitudResult = await pool.query(
        `SELECT 
          sp.*,
          u.nombres || ' ' || u.apellidos as solicitante,
          u.ci as ci_solicitante
         FROM solicitudes_pedido sp
         INNER JOIN usuarios u ON sp.id_usuario = u.ci
         WHERE sp.id_solicitud = $1`,
        [idSolicitud]
      );

      if (solicitudResult.rows.length === 0) {
        return null;
      }

      const solicitud = solicitudResult.rows[0];

      // Obtener detalles
      const detallesResult = await pool.query(
        `SELECT 
          ds.id_detalle_solicitud,
          ds.cantidad,
          ds.costo_total,
          i.id_insumo,
          i.codigo,
          i.nombre_generico,
          i.presentacion,
          i.costo_unitario
         FROM detalles_solicitud ds
         INNER JOIN insumos i ON ds.id_insumo = i.id_insumo
         WHERE ds.id_solicitud = $1
         ORDER BY ds.id_detalle_solicitud`,
        [idSolicitud]
      );

      return {
        ...solicitud,
        detalles: detallesResult.rows
      };
    } catch (error) {
      throw new Error(`Error obteniendo solicitud: ${error.message}`);
    }
  }

  // Actualizar solicitud (eliminar detalles antiguos e insertar nuevos)
  static async actualizar(idSolicitud, detalles) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Eliminar detalles anteriores
      await client.query(
        'DELETE FROM detalles_solicitud WHERE id_solicitud = $1',
        [idSolicitud]
      );

      // Insertar nuevos detalles
      for (const detalle of detalles) {
        await client.query(
          `INSERT INTO detalles_solicitud (id_solicitud, id_insumo, cantidad, costo_total)
           VALUES ($1, $2, $3, $4)`,
          [idSolicitud, detalle.id_insumo, detalle.cantidad, detalle.costo_total]
        );
      }

      await client.query('COMMIT');
      
      // Retornar solicitud actualizada
      return await this.obtenerPorId(idSolicitud);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error actualizando solicitud: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Eliminar solicitud
  static async eliminar(idSolicitud) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Eliminar detalles primero
      await client.query(
        'DELETE FROM detalles_solicitud WHERE id_solicitud = $1',
        [idSolicitud]
      );

      // Eliminar solicitud
      const result = await client.query(
        'DELETE FROM solicitudes_pedido WHERE id_solicitud = $1 RETURNING *',
        [idSolicitud]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error eliminando solicitud: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Verificar si la solicitud pertenece al usuario
  static async perteneceAUsuario(idSolicitud, idUsuario) {
    try {
      const result = await pool.query(
        'SELECT id_solicitud FROM solicitudes_pedido WHERE id_solicitud = $1 AND id_usuario = $2',
        [idSolicitud, idUsuario]
      );
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Error verificando propiedad: ${error.message}`);
    }
  }
}

export default Solicitud;