import Solicitud from '../models/Solicitud.js';
import Insumo from '../models/Insumo.js';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
// CORRECCIÓN: Importar y definir __dirname para ESM
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// FIN CORRECCIÓN

class SolicitudController {
  // Mostrar lista de solicitudes del usuario
  static showLista = async (req, res) => {
    try {
      const solicitudes = await Solicitud.listarPorUsuario(req.session.userId);

      res.render('solicitudes/lista', {
        title: 'Mis Solicitudes de Pedido - Sistema DM-5',
        solicitudes,
        success: req.session.success || null,
        error: req.session.error || null
      });

      req.session.success = null;
      req.session.error = null;
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
      res.render('solicitudes/lista', {
        title: 'Mis Solicitudes de Pedido - Sistema DM-5',
        solicitudes: [],
        success: null,
        error: 'Error cargando solicitudes'
      });
    }
  };

  // Mostrar formulario para nueva solicitud
  static showNueva = async (req, res) => {
    try {
      const insumos = await Insumo.findAll();

      res.render('solicitudes/nueva', {
        title: 'Nueva Solicitud de Pedido - Sistema DM-5',
        insumos,
        error: req.session.error || null
      });

      req.session.error = null;
    } catch (error) {
      console.error('Error cargando formulario:', error);
      req.session.error = 'Error cargando formulario';
      res.redirect('/solicitudes');
    }
  };

  // Crear nueva solicitud
  static crear = async (req, res) => {
    try {
      const { detalles } = req.body;

      if (!detalles || detalles.length === 0) {
        req.session.error = 'Debe agregar al menos un insumo a la solicitud';
        return res.redirect('/solicitudes/nueva');
      }

      // Validar y formatear detalles
      const detallesFormateados = detalles.map(d => ({
        id_insumo: parseInt(d.id_insumo),
        cantidad: parseInt(d.cantidad),
        costo_total: parseInt(d.costo_total)
      }));

      await Solicitud.crear(req.session.userId, detallesFormateados);

      req.session.success = 'Solicitud creada exitosamente';
      res.redirect('/solicitudes');
    } catch (error) {
      console.error('Error creando solicitud:', error);
      req.session.error = 'Error creando solicitud: ' + error.message;
      res.redirect('/solicitudes/nueva');
    }
  };

  // Ver detalle de solicitud
  static showVer = async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar que la solicitud pertenece al usuario
      const pertenece = await Solicitud.perteneceAUsuario(parseInt(id), req.session.userId);
      if (!pertenece) {
        req.session.error = 'No tiene permiso para ver esta solicitud';
        return res.redirect('/solicitudes');
      }

      const solicitud = await Solicitud.obtenerPorId(parseInt(id));

      if (!solicitud) {
        req.session.error = 'Solicitud no encontrada';
        return res.redirect('/solicitudes');
      }

      res.render('solicitudes/ver', {
        title: `Solicitud ${solicitud.nro_solicitud} - Sistema DM-5`,
        solicitud
      });
    } catch (error) {
      console.error('Error cargando solicitud:', error);
      req.session.error = 'Error cargando solicitud';
      res.redirect('/solicitudes');
    }
  };

  // Mostrar formulario de edición
  static showEditar = async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar que la solicitud pertenece al usuario
      const pertenece = await Solicitud.perteneceAUsuario(parseInt(id), req.session.userId);
      if (!pertenece) {
        req.session.error = 'No tiene permiso para editar esta solicitud';
        return res.redirect('/solicitudes');
      }

      const solicitud = await Solicitud.obtenerPorId(parseInt(id));
      const insumos = await Insumo.findAll();

      if (!solicitud) {
        req.session.error = 'Solicitud no encontrada';
        return res.redirect('/solicitudes');
      }

      res.render('solicitudes/editar', {
        title: `Editar Solicitud ${solicitud.nro_solicitud} - Sistema DM-5`,
        solicitud,
        insumos,
        error: req.session.error || null
      });

      req.session.error = null;
    } catch (error) {
      console.error('Error cargando solicitud para editar:', error);
      req.session.error = 'Error cargando solicitud';
      res.redirect('/solicitudes');
    }
  };

  // Actualizar solicitud
  static actualizar = async (req, res) => {
    try {
      const { id } = req.params;
      const { detalles } = req.body;

      // Verificar que la solicitud pertenece al usuario
      const pertenece = await Solicitud.perteneceAUsuario(parseInt(id), req.session.userId);
      if (!pertenece) {
        req.session.error = 'No tiene permiso para editar esta solicitud';
        return res.redirect('/solicitudes');
      }

      if (!detalles || detalles.length === 0) {
        req.session.error = 'Debe agregar al menos un insumo a la solicitud';
        return res.redirect(`/solicitudes/editar/${id}`);
      }

      // Validar y formatear detalles
      const detallesFormateados = detalles.map(d => ({
        id_insumo: parseInt(d.id_insumo),
        cantidad: parseInt(d.cantidad),
        costo_total: parseInt(d.costo_total)
      }));

      await Solicitud.actualizar(parseInt(id), detallesFormateados);

      req.session.success = 'Solicitud actualizada exitosamente';
      res.redirect('/solicitudes');
    } catch (error) {
      console.error('Error actualizando solicitud:', error);
      req.session.error = 'Error actualizando solicitud: ' + error.message;
      res.redirect(`/solicitudes/editar/${req.params.id}`);
    }
  };

  // Eliminar solicitud
  static eliminar = async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar que la solicitud pertenece al usuario
      const pertenece = await Solicitud.perteneceAUsuario(parseInt(id), req.session.userId);
      if (!pertenece) {
        req.session.error = 'No tiene permiso para eliminar esta solicitud';
        return res.redirect('/solicitudes');
      }

      await Solicitud.eliminar(parseInt(id));

      req.session.success = 'Solicitud eliminada exitosamente';
      res.redirect('/solicitudes');
    } catch (error) {
      console.error('Error eliminando solicitud:', error);
      req.session.error = 'Error eliminando solicitud: ' + error.message;
      res.redirect('/solicitudes');
    }
  };

  // Exportar solicitud a PDF
  static exportarPDF = async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar que la solicitud pertenece al usuario
      const pertenece = await Solicitud.perteneceAUsuario(parseInt(id), req.session.userId);
      if (!pertenece) {
        return res.status(403).json({ error: 'No tiene permiso para exportar esta solicitud' });
      }

      const solicitud = await Solicitud.obtenerPorId(parseInt(id));

      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      // Leer imagen del escudo
      let escudoBase64 = '';
      const escudoPath = path.join(__dirname, '..', 'public', 'images', 'escudo2.png');
      if (fs.existsSync(escudoPath)) {
        const escudoBuffer = fs.readFileSync(escudoPath);
        escudoBase64 = `data:image/png;base64,${escudoBuffer.toString('base64')}`;
      }

      // Generar HTML del PDF
      const htmlContent = SolicitudController.generarHTMLSolicitud(solicitud, escudoBase64);

      // Generar PDF con Puppeteer
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '10mm',
          bottom: '10mm',
          left: '10mm',
          right: '10mm'
        }
      });

      await browser.close();

      // Enviar PDF como descarga
      const nombreArchivo = `Solicitud_${solicitud.nro_solicitud}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      res.send(pdfBuffer);

    } catch (error) {
      console.error('Error exportando PDF:', error);
      res.status(500).json({ error: 'Error generando PDF: ' + error.message });
    }
  };

  // Generar HTML para el PDF de Solicitud de Pedido
  static generarHTMLSolicitud(solicitud, escudoBase64) {
    const formatearFecha = (fecha) => {
      if (!fecha) return '';
      const d = new Date(fecha);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      return `${dia}-${mes}-${anio}`;
    };

    const formatearMoneda = (valor) => {
      return new Intl.NumberFormat('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(valor || 0);
    };

    // Generar filas de detalles
    let filasDetalles = '';
    let totalGeneral = 0;
    
    if (solicitud.detalles && solicitud.detalles.length > 0) {
      solicitud.detalles.forEach((det, index) => {
        const precioUnitario = det.costo_unitario || 0;
        const precioTotal = det.costo_total || 0;
        totalGeneral += precioTotal;

        filasDetalles += `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td class="text-center">${det.codigo}</td>
            <td>${det.nombre_generico}</td>
            <td class="text-center">${det.presentacion || 'Unidad'}</td>
            <td class="text-center">${det.cantidad}</td>
            <td class="text-end">${formatearMoneda(precioUnitario)}</td>
            <td class="text-end">${formatearMoneda(precioTotal)}</td>
          </tr>
        `;
      });
    }

    // Agregar filas vacías para completar
    const filasVacias = Math.max(0, 20 - (solicitud.detalles?.length || 0));
    for (let i = 0; i < filasVacias; i++) {
      filasDetalles += `
        <tr>
          <td>&nbsp;</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }

    // Fila de total
    filasDetalles += `
      <tr class="total-row">
        <td colspan="6" class="text-end"><strong>TOTAL GENERAL:</strong></td>
        <td class="text-end"><strong>${formatearMoneda(totalGeneral)}</strong></td>
      </tr>
    `;

    // Imagen del escudo o placeholder
    const escudoHTML = escudoBase64 
      ? `<img src="${escudoBase64}" alt="Escudo" style="width: 50px; height: auto;">`
      : `<div class="escudo-placeholder">ESCUDO</div>`;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Solicitud de Pedido - ${solicitud.nro_solicitud}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: Letter;
      margin: 10mm;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      padding: 10px;
    }
    
    .container {
      border: 1px solid #333;
      padding: 15px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .escudo-placeholder {
      width: 50px;
      height: 60px;
      border: 1px solid #333;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7pt;
      text-align: center;
    }
    
    .header-center {
      text-align: center;
      flex: 1;
    }
    
    .header-center h1 {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 3px;
    }
    
    .header-center p {
      font-size: 8pt;
      margin-bottom: 2px;
    }
    
    .header-right {
      text-align: right;
      font-size: 14pt;
      font-weight: bold;
      color: #c00;
    }
    
    .titulo-solicitud {
      text-align: center;
      margin: 15px 0;
      padding: 8px;
      border: 2px solid #333;
      font-size: 14pt;
      font-weight: bold;
    }
    
    .info-section {
      margin-bottom: 10px;
    }
    
    .info-row {
      display: flex;
      margin-bottom: 5px;
      font-size: 9pt;
    }
    
    .info-row .label {
      font-weight: bold;
      min-width: 120px;
    }
    
    .info-row .value {
      border-bottom: 1px solid #333;
      flex: 1;
      padding-left: 5px;
    }
    
    .info-row-inline {
      display: flex;
      gap: 30px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-top: 10px;
    }
    
    th, td {
      border: 1px solid #333;
      padding: 4px 5px;
    }
    
    th {
      background-color: #f0f0f0;
      font-weight: bold;
      text-align: center;
    }
    
    .text-center {
      text-align: center;
    }
    
    .text-end {
      text-align: right;
    }
    
    tr {
      height: 18px;
    }
    
    .total-row {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    
    .firmas {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    
    .firma-box {
      text-align: center;
      width: 22%;
      margin-top: 20px;
    }
    
    .firma-line {
      border-top: 1px solid #333;
      padding-top: 5px;
      font-size: 7pt;
      font-weight: bold;
    }
    
    .firma-cargo {
      font-size: 6pt;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Encabezado -->
    <div class="header">
      <div class="header-left">
        ${escudoHTML}
      </div>
      <div class="header-center">
        <h1>RED METROPOLITANA DE SALUD NORTE</h1>
        <p>B/ Hamacas Calle Río Blanco N° 3105 Tel/Fax: 342-2322</p>
        <p>Santa Cruz - Bolivia</p>
      </div>
      <div class="header-right">
        ${solicitud.nro_solicitud.split('-').pop()}
      </div>
    </div>
    
    <!-- Título -->
    <div class="titulo-solicitud">
      SOLICITUD DE PEDIDO
    </div>
    
    <!-- Información del pedido -->
    <div class="info-section">
      <div class="info-row">
        <span class="label">Centro de Salud:</span>
        <span class="value">Municipal DM-5</span>
      </div>
      <div class="info-row">
        <span class="label">Lugar y Fecha:</span>
        <span class="value">Santa Cruz, ${formatearFecha(solicitud.fecha)}</span>
      </div>
      <div class="info-row-inline">
        <div class="info-row" style="flex: 1;">
          <span class="label">Material:</span>
          <span class="value">${solicitud.material}</span>
        </div>
        <div class="info-row" style="flex: 1;">
          <span class="label">N° Pedido:</span>
          <span class="value">${solicitud.nro_solicitud}</span>
        </div>
      </div>
    </div>
    
    <!-- Tabla de detalles -->
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">ITEM</th>
          <th style="width: 70px;">CÓDIGO</th>
          <th>DETALLE</th>
          <th style="width: 70px;">UNIDAD</th>
          <th style="width: 60px;">CANTIDAD</th>
          <th style="width: 80px;">PRECIO<br>UNITARIO</th>
          <th style="width: 80px;">PRECIO<br>TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${filasDetalles}
      </tbody>
    </table>
    
    <!-- Sección de firmas -->
    <div class="firmas">
      <div class="firma-box">
        <div class="firma-line">Vo.Bo. JEFE DE ÁREA</div>
      </div>
      <div class="firma-box">
        <div class="firma-line">DIRECTORA</div>
        <div class="firma-cargo">CENTRO DE SALUD MUNICIPAL DM-5</div>
      </div>
      <div class="firma-box">
        <div class="firma-line">Vo.Bo. GERENCIA</div>
      </div>
      <div class="firma-box">
        <div class="firma-line">Vo.Bo. ADMINISTRACIÓN</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }
}

export default SolicitudController;