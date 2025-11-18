const Consumo = require('../models/Consumo');
const Protocolo = require('../models/Protocolo');
const TipoServicio = require('../models/TipoServicio');
const Lote = require('../models/Lote');

class ConsumoController {
  // Mostrar página de registro de consumos
  static showRegistro = async (req, res) => {
    try {
      const tiposServicio = await TipoServicio.findAll();

      const error = req.session.error || null;
      const success = req.session.success || null;
      const lotes_agotados = req.session.lotes_agotados || null;

      req.session.error = null;
      req.session.success = null;
      req.session.lotes_agotados = null;

      res.render('consumos/registro', {
        title: 'Registrar Consumo de Insumos - Sistema DM-5',
        tiposServicio,
        error,
        success,
        lotes_agotados // Pasar los lotes agotados a la vista
      });

    } catch (error) {
      console.error('Error cargando página de registro:', error);
      req.session.error = 'Error cargando datos iniciales';
      res.redirect('/dashboard');
    }
  };

  // API: Obtener protocolo de insumos por tipo de servicio
  static getProtocoloByServicio = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Solicitando protocolo para servicio:', id);
      
      if (!id) {
        return res.status(400).json({ error: 'ID de tipo de servicio requerido' });
      }

      const protocolo = await Protocolo.getByTipoServicio(parseInt(id));
      console.log('Protocolo obtenido:', protocolo.length, 'items');
      
      // NUEVO: Obtener lotes vencidos no notificados para este servicio
      const lotesVencidos = await Protocolo.getLotesVencidosServicio(parseInt(id));
      
      res.json({
        success: true,
        protocolo: protocolo.map(item => ({
          id_insumo: item.id_insumo,
          codigo: item.codigo,
          nombre: item.nombre_generico,
          presentacion: item.presentacion,
          unidad_medida: item.unidad_medida,
          imagen_url: item.imagen_url,
          cantidad_por_uso: item.cantidad_por_uso,
          es_obligatorio: item.es_obligatorio,
          rendimiento_teorico: item.rendimiento_teorico,
          // Solo datos del lote actual (FIFO)
          lote_actual: item.lote_actual
        })),
        // NUEVO: Información de lotes vencidos
        lotes_vencidos: lotesVencidos.length > 0 ? lotesVencidos : null
      });

    } catch (error) {
      console.error('Error obteniendo protocolo:', error);
      res.status(500).json({ error: 'Error obteniendo protocolo de servicio' });
    }
  };

  // NUEVO: API para marcar lotes vencidos como notificados
  static marcarLotesVencidosNotificados = async (req, res) => {
    try {
      const { lotes_ids } = req.body;
      
      if (!lotes_ids || !Array.isArray(lotes_ids) || lotes_ids.length === 0) {
        return res.status(400).json({ error: 'Se requiere un array de IDs de lotes' });
      }

      const resultado = await Lote.marcarVencimientoNotificado(lotes_ids);
      
      res.json({
        success: true,
        mensaje: `${resultado.lotes_actualizados} lote(s) marcados como notificados`,
        lotes_actualizados: resultado.lotes_actualizados
      });

    } catch (error) {
      console.error('Error marcando lotes como notificados:', error);
      res.status(500).json({ error: 'Error marcando lotes: ' + error.message });
    }
  };

  // API: Verificar disponibilidad de stock
  static verificarDisponibilidad = async (req, res) => {
    try {
      const { id_tipo_servicio } = req.params;

      const disponibilidad = await Protocolo.verificarDisponibilidad(parseInt(id_tipo_servicio));

      const todoDisponible = disponibilidad
        .filter(item => item.obligatorio)
        .every(item => item.suficiente);

      res.json({
        success: true,
        disponibilidad,
        todo_disponible: todoDisponible
      });

    } catch (error) {
      console.error('Error verificando disponibilidad:', error);
      res.status(500).json({ error: 'Error verificando disponibilidad' });
    }
  };

  // Procesar registro de consumos (ACTUALIZADO PARA APLICACIONES)
  static processRegistro = async (req, res) => {
    try {
      const id_tipo_servicio = req.body.id_tipo_servicio;
      const insumos = req.body.insumos;
      const numero_recibo = req.body.numero_recibo;

      // Validaciones básicas
      if (!id_tipo_servicio) {
        req.session.error = 'Debe seleccionar un tipo de servicio';
        return res.redirect('/consumos/registro');
      }

      if (!numero_recibo || numero_recibo.trim() === '') {
        req.session.error = 'Debe ingresar el número del recibo recetario';
        return res.redirect('/consumos/registro');
      }

      if (!insumos) {
        req.session.error = 'No se recibieron datos de insumos';
        return res.redirect('/consumos/registro');
      }

      // Parsear insumos
      let insumosArray = [];
      try {
        insumosArray = JSON.parse(insumos);
      } catch (e) {
        console.error('Error parseando insumos:', e);
        req.session.error = 'Error en el formato de los datos de insumos';
        return res.redirect('/consumos/registro');
      }

      // Filtrar insumos válidos
      const insumosValidos = insumosArray.filter(i =>
        i.id_insumo &&
        i.cantidad &&
        parseInt(i.cantidad) > 0 &&
        !isNaN(parseInt(i.id_insumo)) &&
        !isNaN(parseInt(i.cantidad))
      );

      if (insumosValidos.length === 0) {
        req.session.error = 'Debe especificar al menos un insumo con cantidad válida';
        return res.redirect('/consumos/registro');
      }

      // Preparar datos para crear consumo
      const consumoData = {
        id_usuario: req.session.userId,
        id_tipo_servicio: parseInt(id_tipo_servicio),
        numero_recibo: numero_recibo.trim(),
        insumos: insumosValidos.map(i => ({
          id_insumo: parseInt(i.id_insumo),
          cantidad: parseInt(i.cantidad)
        }))
      };

      // Crear consumo (registra en detalle_kardex con FIFO)
      const resultado = await Consumo.createConsumo(consumoData);

      // Si hay lotes agotados, guardar en sesión para mostrar modal
      if (resultado.requiere_ajuste && resultado.lotes_agotados.length > 0) {
        req.session.lotes_agotados = resultado.lotes_agotados;
        req.session.success = `Consumo registrado exitosamente (Recibo: ${numero_recibo}). IMPORTANTE: Algunos lotes se agotaron, verifica si sobró producto físico.`;
      } else {
        req.session.success = `Consumo registrado exitosamente (Recibo: ${numero_recibo}). ${insumosValidos.length} tipo(s) de insumo(s) procesados.`;
      }

      res.redirect('/consumos/registro');

    } catch (error) {
      console.error('Error procesando consumo:', error);
      req.session.error = 'Error registrando consumo: ' + error.message;
      res.redirect('/consumos/registro');
    }
  };

  // API: Registrar ajuste de lote
  static registrarAjuste = async (req, res) => {
    try {
      const { id_lote, aplicaciones_sobrantes, motivo } = req.body;
      
      if (!id_lote) {
        return res.status(400).json({ error: 'ID de lote requerido' });
      }

      // Convertir a número y validar
      const aplicaciones = aplicaciones_sobrantes
      if (isNaN(aplicaciones)) {
        return res.status(400).json({ error: 'Cantidad de aplicaciones inválida' });
      }

      const ajusteData = {
        id_lote: parseInt(id_lote),
        id_usuario: req.session.userId,
        aplicaciones_ajuste: aplicaciones, // Puede ser positivo (sobró) o 0 (no sobró)
        motivo: motivo || 'Verificación post-consumo'
      };
      
      const resultado = await Consumo.registrarAjuste(ajusteData);

      res.json({
        success: true,
        mensaje: aplicaciones > 0
          ? `Se registraron ${aplicaciones} aplicaciones sobrantes`
          : 'Lote confirmado sin sobrantes',
        nuevo_saldo: resultado.nuevo_saldo
      });

    } catch (error) {
      console.error('Error registrando ajuste:', error);
      res.status(500).json({ error: 'Error registrando ajuste: ' + error.message });
    }
  };

  // Mostrar historial de consumos
  static showHistorial = async (req, res) => {
    try {
      const { fecha } = req.query;
      const consumos = await Consumo.findByUserAndDate(req.session.userId, fecha);

      res.render('consumos/historial', {
        title: 'Historial de Consumos - Sistema DM-5',
        consumos,
        fechaFiltro: fecha || null
      });

    } catch (error) {
      console.error('Error cargando historial:', error);
      res.render('consumos/historial', {
        title: 'Historial de Consumos - Sistema DM-5',
        consumos: [],
        error: 'Error cargando historial'
      });
    }
  };

  // API: Obtener detalles de un consumo
  static getDetallesConsumo = async (req, res) => {
    try {
      const { id } = req.params;
      const detalles = await Consumo.getDetallesConsumo(parseInt(id));

      if (!detalles) {
        return res.status(404).json({ error: 'Consumo no encontrado' });
      }

      res.json({
        success: true,
        detalles
      });

    } catch (error) {
      console.error('Error obteniendo detalles:', error);
      res.status(500).json({ error: 'Error obteniendo detalles del consumo' });
    }
  };

  // Mostrar estadísticas
  static showEstadisticas = async (req, res) => {
    try {
      const fechaFin = new Date();
      const fechaInicio = new Date();
      fechaInicio.setMonth(fechaInicio.getMonth() - 1);

      const stats = await Consumo.getStats(
        req.session.userId,
        fechaInicio.toISOString().split('T')[0],
        fechaFin.toISOString().split('T')[0]
      );

      res.render('consumos/estadisticas', {
        title: 'Estadísticas de Consumo - Sistema DM-5',
        stats,
        periodo: `${fechaInicio.toLocaleDateString('es-BO')} - ${fechaFin.toLocaleDateString('es-BO')}`
      });

    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      res.render('consumos/estadisticas', {
        title: 'Estadísticas de Consumo - Sistema DM-5',
        stats: [],
        error: 'Error cargando estadísticas'
      });
    }
  };
}

module.exports = ConsumoController;