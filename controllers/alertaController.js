const Alerta = require('../models/Alerta');

class AlertaController {
  // Obtener alertas no leídas (API)
  static getNoLeidas = async (req, res) => {
    try {
      const alertas = await Alerta.getNoLeidas(req.session.userId);
      res.json({ success: true, alertas });
    } catch (error) {
      console.error('Error obteniendo alertas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // Contar alertas no leídas (API)
  static contarNoLeidas = async (req, res) => {
    try {
      const total = await Alerta.contarNoLeidas(req.session.userId);
      res.json({ success: true, total });
    } catch (error) {
      console.error('Error contando alertas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // Marcar alerta como leída (API)
  static marcarLeida = async (req, res) => {
    try {
      const { id } = req.params;
      const alerta = await Alerta.marcarLeida(id);
      res.json({ success: true, alerta });
    } catch (error) {
      console.error('Error marcando alerta:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // Marcar todas como leídas (API)
  static marcarTodasLeidas = async (req, res) => {
    try {
      const alertas = await Alerta.marcarTodasLeidas(req.session.userId);
      res.json({ success: true, cantidad: alertas.length });
    } catch (error) {
      console.error('Error marcando alertas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // Obtener resumen de alertas (API)
  static getResumen = async (req, res) => {
    try {
      const resumen = await Alerta.getResumenAlertas(req.session.userId);
      res.json({ success: true, resumen });
    } catch (error) {
      console.error('Error obteniendo resumen:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // Generar alertas automáticas (API)
  static generarAlertas = async (req, res) => {
    try {
      const [alertasDesabastecimiento, alertasVencimiento] = await Promise.all([
        Alerta.generarAlertasDesabastecimiento(req.session.userId),
        Alerta.generarAlertasVencimiento(req.session.userId)
      ]);

      res.json({
        success: true,
        generadas: {
          desabastecimiento: alertasDesabastecimiento.length,
          vencimiento: alertasVencimiento.length,
          total: alertasDesabastecimiento.length + alertasVencimiento.length
        }
      });
    } catch (error) {
      console.error('Error generando alertas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // Obtener historial de alertas (API)
  static getHistorial = async (req, res) => {
    try {
      const historial = await Alerta.getHistorial(req.session.userId);
      res.json({ success: true, historial });
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

module.exports = AlertaController;