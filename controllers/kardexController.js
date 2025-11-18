const Kardex = require('../models/Kardex');

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

      if (!id) {
        req.session.error = 'ID de insumo no especificado';
        return res.redirect('/kardex');
      }

      const kardex = await Kardex.obtenerKardexActual(parseInt(id));

      if (!kardex) {
        req.session.error = 'No se encontró kardex activo para este insumo';
        return res.redirect('/kardex');
      }

      // MODIFICADO: Obtener nombre del responsable (usuario que aperturó el kardex)
      let responsable = req.session.user.nombres + " "+req.session.user.apellidos;
     

      res.render('kardex/ver', {
        title: `Kardex: ${kardex.codigo} - ${kardex.nombre_generico}`,
        kardex,
        responsable // NUEVO: Pasar el responsable a la vista
      });

    } catch (error) {
      console.error('Error cargando kardex:', error);
      req.session.error = 'Error cargando detalles del kardex';
      res.redirect('/kardex');
    }
  };

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

module.exports = KardexController;