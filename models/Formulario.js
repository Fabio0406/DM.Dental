import { pool } from '../config/database.js';

// Campos del encabezado que se leen por OCR y se pueden corregir en la revisión
const CAMPOS_ENCABEZADO = [
  'tipo_formulario', 'nro_formulario', 'nro_documento', 'fecha_elaboracion', 'sede',
  'establecimiento', 'botiquin', 'responsable', 'representante', 'elaborado_por',
  'observaciones', 'total_formulario'
];

// Estados desde los que todavía se puede cancelar o volver a leer
const ESTADOS_ABIERTOS = ['procesando', 'pendiente', 'error'];

const vacioANull = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : v);

class Formulario {
  static ESTADOS_ABIERTOS = ESTADOS_ABIERTOS;

  // Registrar una imagen recién subida (queda "procesando" hasta que termine el OCR)
  static async create({ imagen_path, id_usuario }) {
    const result = await pool.query(
      `INSERT INTO formularios_salmi (imagen_path, id_usuario, estado, procesado, fecha_escaneo)
       VALUES ($1, $2, 'procesando', FALSE, CURRENT_TIMESTAMP) RETURNING *`,
      [imagen_path, id_usuario]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM formularios_salmi WHERE id_formulario = $1', [id]);
    return result.rows[0];
  }

  static async findByUser(idUsuario, limit = 50) {
    const result = await pool.query(
      `SELECT f.*, (SELECT COUNT(*) FROM detalles_formulario_salmi d WHERE d.id_formulario = f.id_formulario) AS items_leidos
       FROM formularios_salmi f
       WHERE f.id_usuario = $1
       ORDER BY f.fecha_escaneo DESC NULLS LAST, f.id_formulario DESC
       LIMIT $2`,
      [idUsuario, limit]
    );
    return result.rows;
  }

  static async getDetalles(idFormulario, client = pool) {
    const result = await client.query(
      'SELECT * FROM detalles_formulario_salmi WHERE id_formulario = $1 ORDER BY linea_numero, id_detalle',
      [idFormulario]
    );
    return result.rows;
  }

  static async marcarProcesando(id) {
    const result = await pool.query(
      `UPDATE formularios_salmi SET estado = 'procesando', error_ocr = NULL
       WHERE id_formulario = $1 AND estado = ANY($2) RETURNING *`,
      [id, ESTADOS_ABIERTOS]
    );
    return result.rows[0];
  }

  static async marcarError(id, mensaje) {
    await pool.query(
      `UPDATE formularios_salmi SET estado = 'error', error_ocr = $2
       WHERE id_formulario = $1 AND estado = 'procesando'`,
      [id, mensaje]
    );
  }

  // Guarda el resultado del OCR: encabezado + ítems leídos (reemplaza lecturas previas)
  static async guardarLectura(id, { encabezado, items, advertencias, texto }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const actual = await client.query(
        'SELECT estado FROM formularios_salmi WHERE id_formulario = $1 FOR UPDATE', [id]
      );
      // Si mientras se leía el formulario fue cancelado, no se pisa su estado
      if (!actual.rows[0] || actual.rows[0].estado !== 'procesando') {
        await client.query('ROLLBACK');
        return false;
      }

      const valores = CAMPOS_ENCABEZADO.map(c => vacioANull(encabezado[c]));
      await client.query(
        `UPDATE formularios_salmi SET
           ${CAMPOS_ENCABEZADO.map((c, i) => `${c} = $${i + 2}`).join(', ')},
           texto_ocr = $${CAMPOS_ENCABEZADO.length + 2},
           avisos_ocr = $${CAMPOS_ENCABEZADO.length + 3},
           estado = 'pendiente', error_ocr = NULL
         WHERE id_formulario = $1`,
        [id, ...valores, texto || null, advertencias?.length ? JSON.stringify(advertencias) : null]
      );
      await Formulario.reemplazarDetalles(id, items, client);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Guarda lo corregido por el usuario en la revisión (borrador)
  static async guardarRevision(id, encabezado, items, client = pool) {
    const valores = CAMPOS_ENCABEZADO.map(c => vacioANull(encabezado[c]));
    const result = await client.query(
      `UPDATE formularios_salmi SET ${CAMPOS_ENCABEZADO.map((c, i) => `${c} = $${i + 2}`).join(', ')}
       WHERE id_formulario = $1 AND estado = ANY($${CAMPOS_ENCABEZADO.length + 2}) RETURNING *`,
      [id, ...valores, ESTADOS_ABIERTOS]
    );
    if (!result.rows[0]) return null;
    await Formulario.reemplazarDetalles(id, items, client);
    return result.rows[0];
  }

  static async reemplazarDetalles(id, items, client = pool) {
    await client.query('DELETE FROM detalles_formulario_salmi WHERE id_formulario = $1', [id]);
    let linea = 1;
    for (const it of items) {
      await client.query(
        `INSERT INTO detalles_formulario_salmi
           (id_formulario, id_insumo, linea_numero, codigo, nombre_generico, forma_farmaceutica, concentracion,
            numero_lote, fecha_vencimiento, cantidad, costo_unitario, costo_total, confianza, dudoso, observacion, procesado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          id,
          vacioANull(it.id_insumo),
          linea++,
          vacioANull(it.codigo),
          vacioANull(it.nombre_generico),
          vacioANull(it.forma_farmaceutica),
          vacioANull(it.concentracion),
          vacioANull(it.numero_lote),
          vacioANull(it.fecha_vencimiento),
          vacioANull(it.cantidad),
          vacioANull(it.costo_unitario),
          vacioANull(it.costo_total),
          vacioANull(it.confianza),
          !!it.dudoso,
          vacioANull(it.observacion),
          !!it.procesado
        ]
      );
    }
  }

  // Cancelar antes de importar: el inventario no se toca
  static async cancelar(id, idUsuario, motivo) {
    const result = await pool.query(
      `UPDATE formularios_salmi
       SET estado = 'cancelado', motivo_cancelacion = $2, fecha_cancelacion = CURRENT_TIMESTAMP, cancelado_por = $3
       WHERE id_formulario = $1 AND estado = ANY($4) RETURNING *`,
      [id, motivo, idUsuario, ESTADOS_ABIERTOS]
    );
    return result.rows[0];
  }

  // Formularios ya importados que podrían ser la misma entrega
  static async buscarPosiblesDuplicados(formulario) {
    const referencias = String(formulario.observaciones || '').match(/\d{4,}/g) || [];
    const result = await pool.query(
      `SELECT id_formulario, tipo_formulario, nro_formulario, nro_documento, fecha_entrega
       FROM formularios_salmi
       WHERE estado = 'importado' AND id_formulario <> $1 AND (
         ($2::text IS NOT NULL AND nro_formulario = $2 AND COALESCE(tipo_formulario, '') = COALESCE($3, ''))
         OR ($4::text IS NOT NULL AND (nro_documento = $4 OR observaciones LIKE '%' || $4 || '%'))
         OR nro_documento = ANY($5)
       )`,
      [formulario.id_formulario, formulario.nro_formulario, formulario.tipo_formulario, formulario.nro_documento, referencias]
    );
    return result.rows;
  }
}

export default Formulario;
