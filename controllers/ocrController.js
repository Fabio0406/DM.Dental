// 1. Importaciones de módulos externos y nativos (Convertidas a ESM)
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import * as fs from 'fs'; // Usamos import * as fs para usar fs.existsSync, fs.unlinkSync, etc.

// 2. Importaciones de modelos locales (Convertidas a ESM y añadido .js)
import Formulario from '../models/Formulario.js';
import Insumo from '../models/Insumo.js';
import Kardex from '../models/Kardex.js';

// 3. Importación del Pool de Base de Datos (Convertida y movida al inicio)
import { pool } from '../config/database.js';


class OCRController {
  // Mostrar página de upload
  static showUpload = (req, res) => {
    const error = req.session.error || null;
    const success = req.session.success || null;
    req.session.error = null;
    req.session.success = null;

    res.render('ocr/upload', {
      title: 'Escanear Formulario SALMI - Sistema DM-5',
      error,
      success
    });
  };

  // Procesar upload y OCR
  static processUpload = async (req, res) => {
    try {
      if (!req.file) {
        req.session.error = 'No se seleccionó ningún archivo';
        return res.redirect('/ocr/upload');
      }

      console.log('📄 Procesando archivo:', req.file.filename);

      // Crear registro del formulario
      const formulario = await Formulario.create({
        nro_formulario: 98,
        fecha_elaboracion: null,
        imagen_path: `/uploads/formularios/${req.file.filename}`,
        representante: req.session.userId
      });

      console.log('✅ Formulario creado ID:', formulario.id_formulario);

      // Actualizar estado a procesando
      await Formulario.updateStatus(formulario.id_formulario, false);

      // Procesar imagen en background
      OCRController.processImageOCR(formulario.id_formulario, req.file.path);

      res.redirect(`/ocr/review/${formulario.id_formulario}`);
      req.session.success = 'Formulario subido correctamente. Procesando con IA...';

    } catch (error) {
      console.error('Error procesando upload:', error);
      req.session.error = 'Error procesando archivo: ' + error.message;
      res.redirect('/ocr/upload');
    }
  };

  // Procesar OCR en background
  static processImageOCR = async (formularioId, imagePath) => {
    try {
      console.log('🔍 Iniciando OCR para formulario:', formularioId);

      // Preprocesar imagen con Sharp
      const processedImagePath = imagePath.replace(path.extname(imagePath), '_processed' + path.extname(imagePath));

      await sharp(imagePath)
        .greyscale()
        .normalize()
        .sharpen()
        .png()
        .toFile(processedImagePath);

      // Ejecutar OCR con Tesseract
      const { data: { text } } = await Tesseract.recognize(processedImagePath, 'spa', {
        logger: m => console.log('OCR:', m.status, m.progress)
      });

      console.log('📝 Texto extraído:', text.substring(0, 200) + '...');

      // Procesar y extraer datos del texto
      const datosExtraidos = await OCRController.extractFormularioData(text);

      // Actualizar datos del formulario
      if (datosExtraidos.numero_formulario || datosExtraidos.fecha_documento) {
        await Formulario.updateDatos(formularioId, {
          numero_formulario: datosExtraidos.numero_formulario || '98',
          fecha_documento: datosExtraidos.fecha_documento || new Date().toISOString().split('T')[0],
          responsable_nombre: datosExtraidos.responsable_nombre || 'Sin especificar'
        });
      }

      // Limpiar archivo procesado temporal
      if (fs.existsSync(processedImagePath)) {
        fs.unlinkSync(processedImagePath);
      }

      console.log('✅ OCR completado para formulario:', formularioId);

    } catch (error) {
      console.error('❌ Error en OCR:', error);
      await Formulario.updateStatus(formularioId, 'error');
    }
  };

  // Extraer datos (método comentado - dejar como está)
  static extractFormularioData = async (text) => {
    return {
      numero_formulario: null,
      fecha_documento: null,
      items: []
    };
  };

  // Mostrar revisión de datos (DATOS HARDCODEADOS)
  static showReview = async (req, res) => {
    try {
      const formulario = await Formulario.findById(req.params.id);

      if (!formulario) {
        req.session.error = 'Formulario no encontrado';
        return res.redirect('/ocr/upload');
      }

      // Datos hardcodeados para demostración
      const detalles = [
        { codigo: 'N0111', nombre: 'Lidocaina con epinefrina', cantidad: 40, lote: '1401G23057', vencimiento: '2027-03-31', costo: 100.00, id_insumo: 1, forma_farmaceutica: 'Cartucho dental', concentracion: '2% + 1:200000', presentacion: 'Caja x 50 cartuchos', unidad_medida: 'Cartucho', rendimiento_teorico: 1, aplicaciones_minimas: 10, id_categoria: 1 },
        { codigo: 'IA117', nombre: 'Aguja larga para carpule', cantidad: 30, lote: '202309', vencimiento: '2028-09-30', costo: 55.00, id_insumo: 2, forma_farmaceutica: 'Pieza', concentracion: '27G x 35mm', presentacion: 'Caja x 100', unidad_medida: 'Unidad', rendimiento_teorico: 1, aplicaciones_minimas: 20, id_categoria: 1 },
        { codigo: 'IC036', nombre: 'Cinta testigo humedo', cantidad: 60, lote: 'SUS', vencimiento: '2030-12-31', costo: 90.00, id_insumo: 3, forma_farmaceutica: 'Pieza', concentracion: 'N/A', presentacion: 'Caja x 200', unidad_medida: 'Unidad', rendimiento_teorico: 1, aplicaciones_minimas: 20, id_categoria: 6 },
        { codigo: 'IE018', nombre: 'Esponja hemostatica 10 x 10 cm', cantidad: 40, lote: '918423', vencimiento: '2026-01-31', costo: 130.00, id_insumo: 4, forma_farmaceutica: 'Pieza', concentracion: 'Gelatina absorbible', presentacion: 'Caja x 10', unidad_medida: 'Unidad', rendimiento_teorico: 1, aplicaciones_minimas: 10, id_categoria: 1 },
        { codigo: 'II001', nombre: 'Ionomero de vidrio de obturacion', cantidad: 30, lote: '2312221', vencimiento: '2028-12-31', costo: 220.00, id_insumo: 5, forma_farmaceutica: 'Polvo/Líquido', concentracion: '12.5 g', presentacion: 'Frasco 12.5g', unidad_medida: 'Frasco', rendimiento_teorico: 58, aplicaciones_minimas: 10, id_categoria: 2 },
        { codigo: 'IO002', nombre: 'Oxido de zinc', cantidad: 1, lote: 'OXD0565', vencimiento: '2025-11-30', costo: 30.00, id_insumo: 6, forma_farmaceutica: 'Polvo', concentracion: '50 g', presentacion: 'Sobre 50g', unidad_medida: 'Sobre', rendimiento_teorico: 110, aplicaciones_minimas: 20, id_categoria: 2 },
        { codigo: 'IS005', nombre: 'Sellador de fosas y fisuras', cantidad: 70, lote: '190424', vencimiento: '2026-04-30', costo: 90.00, id_insumo: 7, forma_farmaceutica: 'Pasta', concentracion: '5 g', presentacion: 'Frasco 5g', unidad_medida: 'Frasco', rendimiento_teorico: 70, aplicaciones_minimas: 10, id_categoria: 3 },
        { codigo: 'OM42', nombre: 'Acido destilada 10 litros', cantidad: 20, lote: 'LB', vencimiento: '2028-07-31', costo: 45.00, id_insumo: 8, forma_farmaceutica: 'Líquido', concentracion: '10 L', presentacion: 'Galón 10L', unidad_medida: 'Galón', rendimiento_teorico: 1, aplicaciones_minimas: 1, id_categoria: 7 },
        { codigo: 'OM19', nombre: 'Anestesico topico gel', cantidad: 60, lote: '2306T0054', vencimiento: '2025-05-30', costo: 30.00, id_insumo: 9, forma_farmaceutica: 'Gel', concentracion: '12 g', presentacion: 'Frasco 12g', unidad_medida: 'Frasco', rendimiento_teorico: 50, aplicaciones_minimas: 10, id_categoria: 1 },
        { codigo: 'OM45', nombre: 'Eugenol', cantidad: 70, lote: '200301', vencimiento: '2025-12-31', costo: 180.00, id_insumo: 10, forma_farmaceutica: 'Líquido', concentracion: '20 ml', presentacion: 'Frasco 20ml', unidad_medida: 'Frasco', rendimiento_teorico: 110, aplicaciones_minimas: 20, id_categoria: 2 },
        { codigo: 'OM22', nombre: 'Lidocaina clorhidrato sin epinefrina', cantidad: 70, lote: '2209A-1013-MEPIV', vencimiento: '2025-09-30', costo: 180.00, id_insumo: 11, forma_farmaceutica: 'Cartucho dental', concentracion: '3%', presentacion: 'Caja x 50', unidad_medida: 'Cartucho', rendimiento_teorico: 1, aplicaciones_minimas: 10, id_categoria: 1 },
        { codigo: 'OM37', nombre: 'Pasta diamantada', cantidad: 90, lote: '12427', vencimiento: '2025-06-30', costo: 70.00, id_insumo: 12, forma_farmaceutica: 'Pasta', concentracion: '2 g', presentacion: 'Tubo 2g', unidad_medida: 'Tubo', rendimiento_teorico: 50, aplicaciones_minimas: 10, id_categoria: 2 },
        { codigo: 'OM21', nombre: 'Removedor de manchas', cantidad: 70, lote: '021123', vencimiento: '2026-11-30', costo: 220.00, id_insumo: 13, forma_farmaceutica: 'Líquido', concentracion: '30 ml', presentacion: 'Frasco 30ml', unidad_medida: 'Frasco', rendimiento_teorico: 28, aplicaciones_minimas: 5, id_categoria: 3 },
        { codigo: 'OM11', nombre: 'Resina fotopolimerizable A1', cantidad: 20, lote: '301123', vencimiento: '2026-11-30', costo: 220.00, id_insumo: 14, forma_farmaceutica: 'Pasta', concentracion: '3.5 g', presentacion: 'Tubo 3.5g', unidad_medida: 'Tubo', rendimiento_teorico: 23, aplicaciones_minimas: 5, id_categoria: 2 },
        { codigo: 'OM12', nombre: 'Resina fotopolimerizable A2', cantidad: 10, lote: 'L0005D822', vencimiento: '2027-08-31', costo: 90.00, id_insumo: 15, forma_farmaceutica: 'Pasta', concentracion: '3.5 g', presentacion: 'Tubo 3.5g', unidad_medida: 'Tubo', rendimiento_teorico: 23, aplicaciones_minimas: 5, id_categoria: 2 },
        { codigo: 'OI23', nombre: 'Aceite para limpiar turbinas', cantidad: 10, lote: '90124', vencimiento: '2027-08-31', costo: 188.00, id_insumo: 16, forma_farmaceutica: 'Líquido', concentracion: '200 ml', presentacion: 'Frasco 200ml', unidad_medida: 'Frasco', rendimiento_teorico: 50, aplicaciones_minimas: 10, id_categoria: 7 },
        { codigo: 'OI19', nombre: 'Adhesivo dental', cantidad: 10, lote: '290023', vencimiento: '2025-08-31', costo: 46.00, id_insumo: 17, forma_farmaceutica: 'Líquido', concentracion: '5 ml', presentacion: 'Frasco 5ml', unidad_medida: 'Frasco', rendimiento_teorico: 55, aplicaciones_minimas: 10, id_categoria: 2 },
        { codigo: 'OI28', nombre: 'Cariostatic', cantidad: 10, lote: '22110530', vencimiento: '2026-08-31', costo: 48.00, id_insumo: 18, forma_farmaceutica: 'Solución', concentracion: '7 ml', presentacion: 'Frasco 7ml', unidad_medida: 'Frasco', rendimiento_teorico: 100, aplicaciones_minimas: 20, id_categoria: 3 },
        { codigo: 'OI31', nombre: 'Suctor de saliva x 100 unidades', cantidad: 10, lote: 'NO APLICA', vencimiento: '2027-10-31', costo: 42.00, id_insumo: 19, forma_farmaceutica: 'Bolsa', concentracion: '100 und', presentacion: 'Bolsa x 100', unidad_medida: 'Bolsa', rendimiento_teorico: 100, aplicaciones_minimas: 20, id_categoria: 7 },
        { codigo: 'OI90', nombre: 'Tipo descartable campo', cantidad: 10, lote: '28223', vencimiento: '2028-04-30', costo: 48.00, id_insumo: 20, forma_farmaceutica: 'Paquete', concentracion: '100 und', presentacion: 'Paquete x 100', unidad_medida: 'Paquete', rendimiento_teorico: 100, aplicaciones_minimas: 20, id_categoria: 6 }
      ];

      res.render('ocr/review', {
        title: 'Revisar Datos Extraídos - Sistema DM-5',
        formulario,
        detalles
      });

    } catch (error) {
      console.error('Error mostrando revisión:', error);
      req.session.error = 'Error cargando datos';
      res.redirect('/ocr/upload');
    }
  };

  // Listar formularios del usuario
  static listFormularios = async (req, res) => {
    try {
      const formularios = await Formulario.findByUser(req.session.userId, 20);

      res.render('ocr/list', {
        title: 'Formularios SALMI - Sistema DM-5',
        formularios
      });

    } catch (error) {
      console.error('Error listando formularios:', error);
      res.render('ocr/list', {
        title: 'Formularios SALMI - Sistema DM-5',
        formularios: [],
        error: 'Error cargando formularios'
      });
    }
  };

  // CORREGIDO: Confirmar e importar al inventario
  static confirmarImportar = async (req, res) => {
    const client = await pool.connect(); // ⬅️ IMPORTACIÓN CORREGIDA
    try {
      await client.query('BEGIN');

      const formularioId = parseInt(req.params.id);
      const totalItems = parseInt(req.body.total_items) || 0;
      const sede = req.body.sede || req.session.sede || 'CENTRAL'; // ← CLAVE: sede obligatorio

      if (!formularioId || totalItems <= 0) {
        throw new Error('ID de formulario o total_items inválido');
      }

      if (!sede) {
        throw new Error('No se especificó la sede (campo obligatorio)');
      }

      console.log('Importando formulario:', formularioId);
      console.log('Sede:', sede);
      console.log('Total items a procesar:', totalItems);

      let itemsProcesados = 0;

      for (let i = 0; i < totalItems; i++) {
        const codigo = (req.body[`codigo_${i}`] || '').trim();
        const nombre = (req.body[`nombre_${i}`] || '').trim();
        const cantidad = parseInt(req.body[`cantidad_${i}`]) || 0;
        const lote = (req.body[`lote_${i}`] || '').trim();
        const vencimiento = req.body[`vencimiento_${i}`];
        const costoUnitarioInsumo = parseFloat(req.body[`costo_${i}`]) || 0;
        let idInsumo = parseInt(req.body[`id_insumo_${i}`]) || null;

        if (!codigo || !nombre || cantidad <= 0 || !lote || !vencimiento || costoUnitarioInsumo <= 0) {
          console.log(`Saltando item ${i}: datos incompletos`, { codigo, cantidad, vencimiento, costoUnitarioInsumo });
          continue;
        }

        // PASO 1: Obtener o crear insumo
        if (!idInsumo) {
          const buscar = await client.query(
            'SELECT id_insumo, rendimiento_teorico FROM insumos WHERE codigo = $1',
            [codigo]
          );

          if (buscar.rows.length > 0) {
            idInsumo = buscar.rows[0].id_insumo;
          } else {
            const nuevo = await client.query(
              `INSERT INTO insumos 
             (codigo, nombre_generico, forma_farmaceutica, concentracion, presentacion, 
              unidad_medida, rendimiento_teorico, aplicaciones_minimas, costo_unitario, id_categoria)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id_insumo`,
              [
                codigo,
                nombre,
                'Por definir',
                'N/A',
                'Por definir',
                'Unidad',
                1,
                5,
                Math.round(costoUnitarioInsumo),
                1
              ]
            );
            idInsumo = nuevo.rows[0].id_insumo;
          }
        }

        // Obtener rendimiento y costo del insumo
        const { rows: [insumo] } = await client.query(
          'SELECT rendimiento_teorico, costo_unitario FROM insumos WHERE id_insumo = $1',
          [idInsumo]
        );

        const rendimiento = insumo.rendimiento_teorico || 1;
        const costoUnitarioFisico = insumo.costo_unitario || costoUnitarioInsumo;

        const aplicacionesTotal = cantidad * rendimiento;
        const costoTotal = Math.round(costoUnitarioFisico * cantidad);
        const costoPorAplicacion = aplicacionesTotal > 0 ? Math.round(costoTotal / aplicacionesTotal) : 0;

        // PASO 2: Kardex activo
        const gestionActual = new Date().getFullYear();
        let idKardex;

        const kardexCheck = await client.query(
          'SELECT id_kardex FROM kardex WHERE id_insumo = $1 AND gestion = $2 AND abierto = TRUE',
          [idInsumo, gestionActual]
        );

        if (kardexCheck.rows.length === 0) {
          const nuevoKardex = await client.query(
            `INSERT INTO kardex 
           (id_insumo, numero_kardex, gestion, ubicacion, abierto, fecha_apertura)
           VALUES ($1, (SELECT COALESCE(MAX(numero_kardex), 0) + 1 FROM kardex WHERE id_insumo = $1), $2, $3, TRUE, CURRENT_TIMESTAMP)
           RETURNING id_kardex`,
            [idInsumo, gestionActual, 'Almacén Principal']
          );
          idKardex = nuevoKardex.rows[0].id_kardex;
        } else {
          idKardex = kardexCheck.rows[0].id_kardex;
        }

        // PASO 3: Crear lote
        const loteInsert = await client.query(
          `INSERT INTO lotes 
         (id_insumo, id_formulario, numero_lote, fecha_vencimiento, 
          cantidad_insumos, aplicaciones_disponibles, costo_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id_lote`,
          [
            idInsumo,
            formularioId,
            lote,
            vencimiento,
            cantidad,
            aplicacionesTotal,
            costoTotal
          ]
        );
        const idLote = loteInsert.rows[0].id_lote;

        // PASO 4: Saldos
        const saldoAnterior = await client.query(
          `SELECT COALESCE(SUM(aplicaciones_disponibles), 0) as total 
         FROM lotes 
         WHERE id_insumo = $1 AND id_lote != $2`,
          [idInsumo, idLote]
        );
        const saldoAplicaciones = parseInt(saldoAnterior.rows[0].total) + aplicacionesTotal;

        const valoradoAnterior = await client.query(
          `SELECT saldo_valorado 
         FROM detalle_kardex 
         WHERE id_kardex = $1 
         ORDER BY id_detalle DESC 
         LIMIT 1`,
          [idKardex]
        );
        const saldoValoradoAnterior = valoradoAnterior.rows.length > 0
          ? parseInt(valoradoAnterior.rows[0].saldo_valorado)
          : 0;
        const nuevoSaldoValorizado = saldoValoradoAnterior + costoTotal;

        // PASO 5: Registrar movimiento
        await client.query(
          `INSERT INTO detalle_kardex 
         (id_kardex, id_lote, fecha, entradas, salidas, ajustes, saldo, 
          clave_doc, recibido_de, recepcionado_por, costo_unitario, saldo_valorado)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, 0, 0, $4, $5, $6, $7, $8, $9)`,
          [
            idKardex,
            idLote,
            aplicacionesTotal,
            saldoAplicaciones,
            `98`,
            'FIM',
            req.session.userId,
            costoPorAplicacion,
            nuevoSaldoValorizado
          ]
        );

        itemsProcesados++;
      }

      // PASO FINAL: Actualizar formulario con sede
      await client.query(
        `UPDATE formularios_salmi 
       SET procesado = TRUE, total = $1, sede = $2, fecha_entrega = CURRENT_TIMESTAMP
       WHERE id_formulario = $3`,
        [itemsProcesados, sede, formularioId]
      );

      await client.query('COMMIT');
      console.log(`Importación exitosa: ${itemsProcesados} ítems procesados en sede ${sede}`);

      req.session.success = `Importado: ${itemsProcesados} insumos en sede ${sede}`;
      res.redirect('/ocr');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en importación:', error);
      req.session.error = 'Error al importar: ' + error.message;
      res.redirect(`/ocr/review/${req.params.id}`);
    } finally {
      client.release();
    }
  };
}

export default OCRController; // ⬅️ CAMBIADO: module.exports a export default