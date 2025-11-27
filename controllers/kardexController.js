// Importaciones de módulos (convertidas a ESM)
import Kardex from '../models/Kardex.js';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
// CORRECCIÓN: Importar y definir __dirname para ESM
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// FIN CORRECCIÓN

class KardexController {
   // Mostrar lista de kardex
  static showLista = async (req, res) => {
    try {
      const { buscar } = req.query;
      let insumos = [];
      let termino = buscar || '';

      if (buscar) {
        insumos = await Kardex.buscarInsumos(buscar);
      } else {
        insumos = await Kardex.listarInsumosConKardex(50);
      }

      res.render('kardex/lista', {
        title: 'Kardex de Insumos - Sistema DM-5',
        insumos,
        termino,
        error: req.session.error || null
      });

      req.session.error = null;
    } catch (error) {
      console.error('Error cargando lista de kardex:', error);
      res.render('kardex/lista', {
        title: 'Kardex de Insumos - Sistema DM-5',
        insumos: [],
        termino: '',
        error: 'Error cargando datos del kardex'
      });
    }
  };

  // Ver kardex específico de un insumo
  static showVer = async (req, res) => {
    try {
      const { id } = req.params;
      const { fecha_inicio, fecha_fin } = req.query;

      if (!id) {
        req.session.error = 'ID de insumo no especificado';
        return res.redirect('/kardex');
      }

      // Convertir fechas si existen
      let fechaInicio = fecha_inicio ? new Date(fecha_inicio + 'T00:00:00') : null;
      let fechaFin = fecha_fin ? new Date(fecha_fin + 'T23:59:59') : null;

      const kardex = await Kardex.obtenerKardexActual(parseInt(id), fechaInicio, fechaFin);

      if (!kardex) {
        req.session.error = 'No se encontró kardex activo para este insumo';
        return res.redirect('/kardex');
      }

      // Obtener nombre del responsable (usuario que aperturó el kardex)
      let responsable = req.session.user.nombres + ' ' + req.session.user.apellidos;

      res.render('kardex/ver', {
        title: `Kardex: ${kardex.codigo} - ${kardex.nombre_generico}`,
        kardex,
        responsable,
        filtros: {
          fecha_inicio: fecha_inicio || '',
          fecha_fin: fecha_fin || ''
        }
      });

    } catch (error) {
      console.error('Error cargando kardex:', error);
      req.session.error = 'Error cargando detalles del kardex';
      res.redirect('/kardex');
    }
  };

  // Exportar Kardex a PDF
  static exportarPDF = async (req, res) => {
    try {
      const { id } = req.params;
      const { fecha_inicio, fecha_fin } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'ID de insumo requerido' });
      }

      // Convertir fechas si existen
      let fechaInicio = fecha_inicio ? new Date(fecha_inicio + 'T00:00:00') : null;
      let fechaFin = fecha_fin ? new Date(fecha_fin + 'T23:59:59') : null;

      const kardex = await Kardex.obtenerKardexActual(parseInt(id), fechaInicio, fechaFin);

      if (!kardex) {
        return res.status(404).json({ error: 'No se encontró kardex activo para este insumo' });
      }

      const responsable = req.session.user.nombres + ' ' + req.session.user.apellidos;

      // Leer imagen del escudo y convertir a base64
      let escudoBase64 = '';
      const escudoPath = path.join(__dirname, '..', 'public', 'images', 'escudo.png');
      if (fs.existsSync(escudoPath)) {
        const escudoBuffer = fs.readFileSync(escudoPath);
        escudoBase64 = `data:image/png;base64,${escudoBuffer.toString('base64')}`;
      }

      // Generar HTML del PDF
      const htmlContent = KardexController.generarHTMLKardex(kardex, responsable, escudoBase64);

      // Generar PDF con Puppeteer
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        landscape: true,
        printBackground: true,
        margin: {
          top: '5mm',
          bottom: '5mm',
          left: '5mm',
          right: '5mm'
        }
      });

      await browser.close();

      // Enviar PDF como descarga
      const nombreArchivo = `Kardex_${kardex.codigo}_${kardex.gestion}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      res.send(pdfBuffer);

    } catch (error) {
      console.error('Error exportando PDF:', error);
      res.status(500).json({ error: 'Error generando PDF: ' + error.message });
    }
  };

  // Generar HTML para el PDF del Kardex (Formato SNUS-01)
  static generarHTMLKardex(kardex, responsable, escudoBase64) {
    const formatearFecha = (fecha) => {
      if (!fecha) return '';
      const d = new Date(fecha);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      return `${dia}/${mes}/${anio}`;
    };

    const formatearMoneda = (valor) => {
      return new Intl.NumberFormat('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(valor || 0);
    };

    // Generar filas de movimientos
    let filasMovimientos = '';
    const totalMovimientos = kardex.movimientos?.length || 0;
    
    if (totalMovimientos > 0) {
      kardex.movimientos.forEach(mov => {
        const recibidoExpedido = mov.entradas > 0 
          ? (mov.recibido_de || 'FIM')
          : responsable;

        filasMovimientos += `
          <tr>
            <td class="text-center">${formatearFecha(mov.fecha)}</td>
            <td class="text-center">${mov.entradas > 0 ? mov.entradas : ''}</td>
            <td class="text-center">${mov.salidas > 0 ? mov.salidas : ''}</td>
            <td class="text-center">${mov.ajustes !== 0 ? (mov.saldo > 0 ? '+' : '-') + mov.ajustes : ''}</td>
            <td class="text-center"><strong>${mov.saldo}</strong></td>
            <td class="text-center">${mov.clave_doc || ''}</td>
            <td class="text-center">${recibidoExpedido}</td>
            <td class="text-end">${formatearMoneda(mov.costo_unitario)}</td>
            <td class="text-end">${formatearMoneda(mov.saldo_valorado)}</td>
            <td class="text-center">${formatearFecha(mov.fecha_vencimiento)}</td>
            <td class="text-center">${mov.numero_lote || ''}</td>
          </tr>
        `;
      });
    } else {
      filasMovimientos = `
        <tr>
          <td colspan="11" class="text-center">No hay movimientos registrados</td>
        </tr>
      `;
    }

    // Calcular filas vacías para completar (máximo 25 filas totales para caber en una página)
    const maxFilas = 25;
    const filasVacias = Math.max(0, maxFilas - totalMovimientos);
    for (let i = 0; i < filasVacias; i++) {
      filasMovimientos += `
        <tr>
          <td>&nbsp;</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }

    // Imagen del escudo o placeholder
    const escudoHTML = escudoBase64 
      ? `<img src="${escudoBase64}" alt="Escudo" style="width: 45px; height: auto;">`
      : `<div class="escudo-placeholder">ESCUDO</div>`;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Kardex - ${kardex.codigo}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: Letter landscape;
      margin: 5mm;
    }
    
    body {
      font-family: Arial, sans-serif;
      font-size: 7.5pt;
      background-color: #f5f5dc;
      padding: 8px;
    }
    
    .container {
      background-color: #f5f5dc;
      border: 1px solid #333;
      padding: 8px;
      height: 100%;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 5px;
      border-bottom: 1px solid #333;
      padding-bottom: 5px;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .escudo-placeholder {
      width: 45px;
      height: 50px;
      border: 1px solid #333;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 6pt;
      text-align: center;
    }
    
    .ministerio {
      font-weight: bold;
      font-size: 8pt;
    }
    
    .form-code {
      font-size: 6pt;
      margin-top: 3px;
    }
    
    .header-right {
      text-align: right;
    }
    
    .fim-logo {
      font-size: 12pt;
      font-weight: bold;
    }
    
    .fim-text {
      font-size: 6pt;
      text-align: right;
    }
    
    .title {
      text-align: center;
      margin: 8px 0;
    }
    
    .title h1 {
      font-size: 11pt;
      font-style: italic;
      font-weight: bold;
      margin-bottom: 2px;
    }
    
    .title h2 {
      font-size: 9pt;
      font-style: italic;
    }
    
    .info-section {
      margin-bottom: 5px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
      font-size: 7.5pt;
    }
    
    .info-row .label {
      font-weight: bold;
    }
    
    .info-row .value {
      border-bottom: 1px solid #333;
      min-width: 120px;
      padding-left: 3px;
    }
    
    .codigo-box {
      border: 1px solid #333;
      padding: 2px 8px;
      font-weight: bold;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7pt;
    }
    
    th, td {
      border: 1px solid #333;
      padding: 2px 3px;
    }
    
    th {
      background-color: #e8e8d0;
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
      height: 14px;
    }
    
    .footer {
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 7pt;
    }
    
    .footer-left {
      line-height: 1.4;
    }
    
    .firma {
      text-align: center;
    }
    
    .firma-line {
      border-top: 1px solid #333;
      width: 180px;
      padding-top: 3px;
      font-size: 7pt;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Encabezado -->
    <div class="header">
      <div class="header-left">
        ${escudoHTML}
        <div>
          <div class="ministerio">MINISTERIO DE SALUD<br>Y DEPORTES</div>
          <div class="form-code">Form. SNUS-01</div>
        </div>
      </div>
      <div class="header-right">
        <div class="fim-text">Farmacia<br>Institucional<br>Municipal</div>
        <div class="fim-logo">FIM</div>
      </div>
    </div>
    
    <!-- Título -->
    <div class="title">
      <h1>FORMULARIO DE REGISTRO DE EXISTENCIAS</h1>
      <h2>(Kardex Valorado)</h2>
    </div>
    
    <!-- Información del producto -->
    <div class="info-section">
      <div class="info-row">
        <div>
          <span class="label">NOMBRE DEL PRODUCTO:</span>
          <span class="value">${kardex.nombre_generico}</span>
        </div>
        <div>
          <span class="label">CÓDIGO:</span>
          <span class="codigo-box">${kardex.codigo}</span>
        </div>
      </div>
      
      <div class="info-row">
        <div>
          <span class="label">FORMA FARMACÉUTICA:</span>
          <span class="value">${kardex.forma_farmaceutica || ''}</span>
        </div>
        <div>
          <span class="label">CONCENTRACIÓN:</span>
          <span class="value">${kardex.concentracion || ''}</span>
        </div>
        <div>
          <span class="label">UBICACIÓN:</span>
          <span class="value">${kardex.ubicacion || ''}</span>
        </div>
      </div>
    </div>
    
    <!-- Tabla de movimientos -->
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="width: 60px;">FECHA</th>
          <th colspan="3">MOVIMIENTOS</th>
          <th rowspan="2" style="width: 45px;">SALDO</th>
          <th rowspan="2" style="width: 70px;">N° y<br>Clave Doc.</th>
          <th rowspan="2" style="width: 90px;">RECIBIDO DE:<br>EXPEDIDO A:</th>
          <th rowspan="2" style="width: 60px;">COSTO<br>UNITARIO</th>
          <th rowspan="2" style="width: 70px;">SALDO<br>VALORADO</th>
          <th rowspan="2" style="width: 60px;">FECHA<br>VTO.</th>
          <th rowspan="2" style="width: 65px;">No.<br>LOTE</th>
        </tr>
        <tr>
          <th style="width: 45px;">ENTRADAS</th>
          <th style="width: 45px;">SALIDAS</th>
          <th style="width: 45px;">AJUSTES<br>(+/-)</th>
        </tr>
      </thead>
      <tbody>
        ${filasMovimientos}
      </tbody>
    </table>
    
    <!-- Pie de página -->
    <div class="footer">
      <div class="footer-left">
        <strong>Gestión:</strong> ${kardex.gestion}<br>
        <strong>N° Kardex:</strong> ${kardex.numero_kardex}<br>
        <strong>Fecha Apertura:</strong> ${formatearFecha(kardex.fecha_apertura)}
      </div>
      <div class="firma">
        <div class="firma-line">
          ${responsable}<br>
          <small>Responsable</small>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  // Ver historial de kardex cerrados de un insumo
  static showHistorial = async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        req.session.error = 'ID de insumo no especificado';
        return res.redirect('/kardex');
      }

      const historial = await Kardex.obtenerHistorialKardex(parseInt(id));

      // Obtener información básica del insumo
      const { pool } = require('../config/database');
      const insumoResult = await pool.query(
        'SELECT codigo, nombre_generico, presentacion FROM insumos WHERE id_insumo = $1',
        [id]
      );

      if (insumoResult.rows.length === 0) {
        req.session.error = 'Insumo no encontrado';
        return res.redirect('/kardex');
      }

      const insumo = insumoResult.rows[0];

      res.render('kardex/historial', {
        title: `Historial Kardex: ${insumo.codigo}`,
        insumo,
        historial
      });

    } catch (error) {
      console.error('Error cargando historial:', error);
      req.session.error = 'Error cargando historial del kardex';
      res.redirect('/kardex');
    }
  };

  // API: Obtener movimientos de un kardex específico
  static getMovimientosKardex = async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: 'ID de kardex requerido' });
      }

      const movimientos = await Kardex.obtenerMovimientosKardex(parseInt(id));

      res.json({
        success: true,
        movimientos
      });

    } catch (error) {
      console.error('Error obteniendo movimientos:', error);
      res.status(500).json({ error: 'Error obteniendo movimientos del kardex' });
    }
  };

  // API: Crear nuevo kardex para un insumo
  static crearKardex = async (req, res) => {
    try {
      const { id_insumo, gestion, ubicacion } = req.body;

      if (!id_insumo || !gestion || !ubicacion) {
        return res.status(400).json({ 
          error: 'Faltan datos requeridos: id_insumo, gestion, ubicacion' 
        });
      }

      const nuevoKardex = await Kardex.crearKardex(
        parseInt(id_insumo),
        parseInt(gestion),
        ubicacion
      );

      res.json({
        success: true,
        mensaje: 'Kardex creado exitosamente',
        kardex: nuevoKardex
      });

    } catch (error) {
      console.error('Error creando kardex:', error);
      res.status(500).json({ error: 'Error creando kardex: ' + error.message });
    }
  };

  // API: Cerrar un kardex
  static cerrarKardex = async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: 'ID de kardex requerido' });
      }

      const kardexCerrado = await Kardex.cerrarKardex(parseInt(id));

      res.json({
        success: true,
        mensaje: 'Kardex cerrado exitosamente',
        kardex: kardexCerrado
      });

    } catch (error) {
      console.error('Error cerrando kardex:', error);
      res.status(500).json({ error: 'Error cerrando kardex: ' + error.message });
    }
  };
}

export default KardexController; // ⬅️ CAMBIADO: module.exports a export default