import path from 'path';
import { fileURLToPath } from 'url';

import Formulario from '../models/Formulario.js';
import Insumo from '../models/Insumo.js';
import { pool } from '../config/database.js';
import { leerFormulario } from '../services/salmiParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '../public');

const redondear = (v, dec = 2) => Math.round(v * 10 ** dec) / 10 ** dec;
const texto = (v) => (v === undefined || v === null ? '' : String(v).trim());
const numero = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const entero = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const hoyISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Lee el formulario en segundo plano y guarda el resultado
function iniciarLectura(idFormulario, imagenPath) {
  const ruta = path.join(PUBLIC_DIR, imagenPath);
  leerFormulario(ruta)
    .then(resultado => Formulario.guardarLectura(idFormulario, resultado))
    .then(() => console.log(`📄 Formulario ${idFormulario} leído`))
    .catch(async error => {
      console.error(`❌ Error leyendo formulario ${idFormulario}:`, error);
      await Formulario.marcarError(idFormulario, 'No se pudo leer la imagen: ' + error.message).catch(() => {});
    });
}

// Encabezado e ítems enviados desde la pantalla de revisión
function leerRevision(body) {
  const encabezado = {
    tipo_formulario: texto(body.tipo_formulario),
    nro_formulario: texto(body.nro_formulario),
    nro_documento: texto(body.nro_documento),
    fecha_elaboracion: texto(body.fecha_elaboracion),
    sede: texto(body.sede),
    establecimiento: texto(body.establecimiento),
    botiquin: texto(body.botiquin),
    responsable: texto(body.responsable),
    representante: texto(body.representante),
    elaborado_por: texto(body.elaborado_por),
    observaciones: texto(body.observaciones),
    total_formulario: numero(body.total_formulario)
  };

  // items[i][campo]: con muchos índices el parser entrega un objeto, no un arreglo
  const filas = Object.values(body.items || {}).filter(f => f && typeof f === 'object');
  const items = filas.map(f => {
    const cantidad = entero(f.cantidad);
    const costo = numero(f.costo_unitario);
    return {
      id_insumo: /^\d+$/.test(texto(f.id_insumo)) ? parseInt(f.id_insumo, 10) : null,
      codigo: texto(f.codigo).toUpperCase(),
      nombre_generico: texto(f.nombre_generico),
      forma_farmaceutica: texto(f.forma_farmaceutica),
      concentracion: texto(f.concentracion),
      numero_lote: texto(f.numero_lote),
      fecha_vencimiento: texto(f.fecha_vencimiento),
      cantidad,
      costo_unitario: costo,
      costo_total: cantidad && costo !== null ? redondear(cantidad * costo) : null,
      confianza: numero(f.confianza),
      dudoso: f.dudoso === 'true',
      observacion: texto(f.observacion),
      // Solo para insumos nuevos
      nuevo: {
        id_categoria: entero(f.nuevo_categoria),
        rendimiento: entero(f.nuevo_rendimiento),
        minimo: entero(f.nuevo_minimo)
      }
    };
  });
  return { encabezado, items };
}

class OCRController {
  // GET /ocr/upload
  static showUpload = (req, res) => {
    const error = req.session.error || null;
    const success = req.session.success || null;
    req.session.error = null;
    req.session.success = null;
    res.render('ocr/upload', { title: 'Escanear Formulario SALMI - Sistema DM-5', error, success });
  };

  // POST /ocr/upload
  static processUpload = async (req, res) => {
    try {
      if (!req.file) {
        req.session.error = 'No se seleccionó ningún archivo';
        return res.redirect('/ocr/upload');
      }
      const formulario = await Formulario.create({
        imagen_path: `/uploads/formularios/${req.file.filename}`,
        id_usuario: req.session.userId
      });
      iniciarLectura(formulario.id_formulario, formulario.imagen_path);
      res.redirect(`/ocr/review/${formulario.id_formulario}`);
    } catch (error) {
      console.error('Error procesando upload:', error);
      req.session.error = 'Error procesando archivo: ' + error.message;
      res.redirect('/ocr/upload');
    }
  };

  // GET /ocr/estado/:id  (consulta periódica mientras se lee)
  static estado = async (req, res) => {
    const formulario = await Formulario.findById(parseInt(req.params.id));
    if (!formulario) return res.status(404).json({ error: 'Formulario no encontrado' });
    res.json({ estado: formulario.estado, error: formulario.error_ocr });
  };

  // GET /ocr/review/:id
  static showReview = async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const formulario = await Formulario.findById(id);
      if (!formulario) {
        req.session.error = 'Formulario no encontrado';
        return res.redirect('/ocr');
      }

      const flash = { success: req.session.success || null, error: req.session.error || null };
      req.session.success = null;
      req.session.error = null;

      const detalles = await Formulario.getDetalles(id);
      const [insumos, categorias, duplicados] = await Promise.all([
        Insumo.findAll(),
        pool.query('SELECT id_categoria_insumo, nombre FROM categorias_insumo ORDER BY nombre').then(r => r.rows),
        formulario.estado === 'pendiente' ? Formulario.buscarPosiblesDuplicados(formulario) : []
      ]);

      // Lotes que ya existen en el inventario (mismo código y número de lote)
      const lotesExistentes = new Set();
      if (detalles.length) {
        const r = await pool.query(
          `SELECT UPPER(i.codigo) AS codigo, UPPER(l.numero_lote) AS lote
           FROM lotes l JOIN insumos i ON i.id_insumo = l.id_insumo
           WHERE UPPER(i.codigo) = ANY($1)`,
          [detalles.map(d => String(d.codigo || '').toUpperCase())]
        );
        r.rows.forEach(row => lotesExistentes.add(`${row.codigo}|${row.lote}`));
      }

      const porCodigo = new Map(insumos.map(i => [String(i.codigo).toUpperCase(), i]));
      const hoy = hoyISO();
      const items = detalles.map(d => {
        const codigo = String(d.codigo || '').toUpperCase();
        const vence = d.fecha_vencimiento ? new Date(d.fecha_vencimiento) : null;
        const venceISO = vence ? `${vence.getFullYear()}-${String(vence.getMonth() + 1).padStart(2, '0')}-${String(vence.getDate()).padStart(2, '0')}` : '';
        return {
          ...d,
          fecha_vencimiento: venceISO,
          insumo_catalogo: d.id_insumo ? insumos.find(i => i.id_insumo === d.id_insumo) : porCodigo.get(codigo) || null,
          vencido: venceISO && venceISO < hoy,
          duplicado: lotesExistentes.has(`${codigo}|${String(d.numero_lote || '').toUpperCase()}`)
        };
      });

      let avisos = [];
      try { avisos = formulario.avisos_ocr ? JSON.parse(formulario.avisos_ocr) : []; } catch (e) { avisos = []; }

      res.render('ocr/review', {
        title: 'Revisar Formulario SALMI - Sistema DM-5',
        formulario,
        items,
        insumos,
        categorias,
        duplicados,
        avisos,
        ...flash
      });
    } catch (error) {
      console.error('Error mostrando revisión:', error);
      req.session.error = 'Error cargando el formulario';
      res.redirect('/ocr');
    }
  };

  // GET /ocr
  static listFormularios = async (req, res) => {
    try {
      const formularios = await Formulario.findByUser(req.session.userId, 50);
      const flash = { success: req.session.success || null, error: req.session.error || null };
      req.session.success = null;
      req.session.error = null;
      res.render('ocr/list', { title: 'Formularios SALMI - Sistema DM-5', formularios, ...flash });
    } catch (error) {
      console.error('Error listando formularios:', error);
      res.render('ocr/list', { title: 'Formularios SALMI - Sistema DM-5', formularios: [], error: 'Error cargando formularios' });
    }
  };

  // POST /ocr/guardar/:id  (borrador de la revisión)
  static guardarBorrador = async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const { encabezado, items } = leerRevision(req.body);
      const ok = await Formulario.guardarRevision(id, encabezado, items);
      req.session[ok ? 'success' : 'error'] = ok ? 'Cambios guardados. Puedes continuar la revisión cuando quieras.' : 'Este formulario ya no se puede modificar.';
    } catch (error) {
      console.error('Error guardando borrador:', error);
      req.session.error = 'No se pudieron guardar los cambios: ' + error.message;
    }
    res.redirect(`/ocr/review/${id}`);
  };

  // POST /ocr/releer/:id
  static releer = async (req, res) => {
    const id = parseInt(req.params.id);
    const formulario = await Formulario.marcarProcesando(id);
    if (!formulario) {
      req.session.error = 'Este formulario ya no se puede volver a leer.';
    } else {
      iniciarLectura(id, formulario.imagen_path);
    }
    res.redirect(`/ocr/review/${id}`);
  };

  // POST /ocr/cancelar/:id
  static cancelar = async (req, res) => {
    const id = parseInt(req.params.id);
    const motivo = texto(req.body.motivo);
    if (motivo.length < 3) {
      req.session.error = 'Indica el motivo de la cancelación.';
      return res.redirect(`/ocr/review/${id}`);
    }
    const formulario = await Formulario.cancelar(id, req.session.userId, motivo);
    if (!formulario) {
      req.session.error = 'Solo se puede cancelar un formulario que aún no fue importado.';
      return res.redirect(`/ocr/review/${id}`);
    }
    req.session.success = `Importación del formulario ${formulario.nro_formulario ? 'N° ' + formulario.nro_formulario : '#' + id} cancelada. El inventario no se modificó.`;
    res.redirect('/ocr');
  };

  // POST /ocr/confirmar/:id
  static confirmarImportar = async (req, res) => {
    const id = parseInt(req.params.id);
    const { encabezado, items } = leerRevision(req.body);

    // Lo revisado se guarda primero: si la importación falla no se pierden los cambios
    try {
      await Formulario.guardarRevision(id, encabezado, items);
    } catch (error) {
      console.error('Error guardando revisión:', error);
    }

    const errores = [];
    if (!items.length) errores.push('El formulario no tiene ítems.');
    items.forEach((it, i) => {
      const fila = `Fila ${i + 1}`;
      if (!it.codigo) errores.push(`${fila}: falta el código.`);
      if (!it.nombre_generico) errores.push(`${fila}: falta el nombre.`);
      if (!it.numero_lote) errores.push(`${fila}: falta el lote.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(it.fecha_vencimiento)) errores.push(`${fila}: fecha de vencimiento inválida.`);
      if (!it.cantidad || it.cantidad <= 0) errores.push(`${fila}: cantidad inválida.`);
      if (it.costo_unitario === null || it.costo_unitario <= 0) errores.push(`${fila}: costo unitario inválido.`);
    });
    if (errores.length) {
      req.session.error = 'No se importó. ' + errores.slice(0, 5).join(' ') + (errores.length > 5 ? ` (+${errores.length - 5} más)` : '');
      return res.redirect(`/ocr/review/${id}`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const actual = await client.query('SELECT * FROM formularios_salmi WHERE id_formulario = $1 FOR UPDATE', [id]);
      const formulario = actual.rows[0];
      if (!formulario) throw new Error('Formulario no encontrado');
      if (formulario.estado !== 'pendiente' && formulario.estado !== 'error') {
        throw new Error(formulario.estado === 'importado' ? 'Este formulario ya fue importado.' : 'Este formulario fue cancelado.');
      }

      const gestion = new Date().getFullYear();
      const claveDoc = encabezado.nro_formulario
        ? `SALMI N° ${encabezado.nro_formulario}`
        : encabezado.nro_documento ? `D-5 N° ${encabezado.nro_documento}` : `SALMI #${id}`;

      for (const [i, it] of items.entries()) {
        // 1. Insumo: el elegido en la revisión, el del mismo código, o uno nuevo
        let insumo = null;
        if (it.id_insumo) {
          insumo = (await client.query('SELECT * FROM insumos WHERE id_insumo = $1', [it.id_insumo])).rows[0];
        }
        if (!insumo) {
          insumo = (await client.query('SELECT * FROM insumos WHERE UPPER(codigo) = $1', [it.codigo])).rows[0];
        }
        if (!insumo) {
          if (!it.nuevo.id_categoria || !it.nuevo.rendimiento || it.nuevo.rendimiento < 1) {
            throw new Error(`Fila ${i + 1}: para el insumo nuevo ${it.codigo} indica categoría y aplicaciones por unidad.`);
          }
          insumo = (await client.query(
            `INSERT INTO insumos (codigo, nombre_generico, forma_farmaceutica, concentracion, presentacion,
                                  unidad_medida, aplicaciones_minimas, rendimiento_teorico, costo_unitario, id_categoria)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [it.codigo, it.nombre_generico, it.forma_farmaceutica || null, it.concentracion || null,
             it.forma_farmaceutica || null, it.concentracion || null, it.nuevo.minimo ?? 10,
             it.nuevo.rendimiento, it.costo_unitario, it.nuevo.id_categoria]
          )).rows[0];
        }

        // 2. Aplicaciones y costos (costo del formulario, con decimales)
        const rendimiento = insumo.rendimiento_teorico || 1;
        const aplicaciones = it.cantidad * rendimiento;
        const costoTotal = redondear(it.cantidad * it.costo_unitario);
        const costoPorAplicacion = redondear(costoTotal / aplicaciones);

        // 3. Kardex abierto de la gestión
        let kardex = (await client.query(
          'SELECT id_kardex FROM kardex WHERE id_insumo = $1 AND gestion = $2 AND abierto = TRUE ORDER BY id_kardex DESC LIMIT 1',
          [insumo.id_insumo, gestion]
        )).rows[0];
        if (!kardex) {
          kardex = (await client.query(
            `INSERT INTO kardex (id_insumo, numero_kardex, gestion, ubicacion, abierto, fecha_apertura)
             VALUES ($1, (SELECT COALESCE(MAX(numero_kardex), 0) + 1 FROM kardex WHERE id_insumo = $1), $2, $3, TRUE, CURRENT_TIMESTAMP)
             RETURNING id_kardex`,
            [insumo.id_insumo, gestion, encabezado.botiquin || 'Almacén Principal']
          )).rows[0];
        }

        // 4. Lote
        const lote = (await client.query(
          `INSERT INTO lotes (id_insumo, id_formulario, numero_lote, fecha_vencimiento, cantidad_insumos,
                              aplicaciones_disponibles, costo_total, id_usuario)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_lote`,
          [insumo.id_insumo, id, it.numero_lote, it.fecha_vencimiento, it.cantidad, aplicaciones, costoTotal, req.session.userId]
        )).rows[0];

        // 5. Movimiento de entrada en el kardex
        const saldo = parseInt((await client.query(
          'SELECT COALESCE(SUM(aplicaciones_disponibles), 0) AS total FROM lotes WHERE id_insumo = $1',
          [insumo.id_insumo]
        )).rows[0].total);
        const previo = (await client.query(
          'SELECT saldo_valorado FROM detalle_kardex WHERE id_kardex = $1 ORDER BY fecha DESC, id_detalle DESC LIMIT 1',
          [kardex.id_kardex]
        )).rows[0];
        const saldoValorado = redondear((previo ? parseFloat(previo.saldo_valorado) : 0) + costoTotal);

        await client.query(
          `INSERT INTO detalle_kardex (id_kardex, id_lote, fecha, entradas, salidas, ajustes, saldo,
                                       clave_doc, recibido_de, recepcionado_por, costo_unitario, saldo_valorado)
           VALUES ($1, $2, CURRENT_TIMESTAMP, $3, 0, 0, $4, $5, 'FIM', $6, $7, $8)`,
          [kardex.id_kardex, lote.id_lote, aplicaciones, saldo, claveDoc, req.session.userId, costoPorAplicacion, saldoValorado]
        );

        it.id_insumo = insumo.id_insumo;
        it.procesado = true;
      }

      // 6. Cerrar el formulario
      await Formulario.guardarRevision(id, encabezado, items, client);
      await client.query(
        `UPDATE formularios_salmi
         SET estado = 'importado', procesado = TRUE, total = $2, fecha_entrega = CURRENT_TIMESTAMP
         WHERE id_formulario = $1`,
        [id, items.length]
      );

      await client.query('COMMIT');
      const total = redondear(items.reduce((s, it) => s + it.costo_total, 0));
      req.session.success = `Formulario importado: ${items.length} ítem(s) por Bs ${total.toFixed(2)} ingresaron al kardex.`;
      res.redirect(`/ocr/review/${id}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en importación:', error);
      req.session.error = 'No se importó: ' + error.message;
      res.redirect(`/ocr/review/${id}`);
    } finally {
      client.release();
    }
  };
}

export default OCRController;
