const Dashboard = require('../models/Dashboard');
const Alerta = require('../models/Alerta');

class DashboardController {
  static showDashboard = async (req, res) => {
    try {
      // Generar alertas automáticas al cargar el dashboard
      let alertasGeneradas = { desabastecimiento: 0, vencimiento: 0 };
      let alertasActivas = [];
      let resumenAlertas = { desabastecimiento: 0, vencimiento: 0, total: 0 };

      try {
        const [alertasDesab, alertasVenc] = await Promise.all([
          Alerta.generarAlertasDesabastecimiento(req.session.userId),
          Alerta.generarAlertasVencimiento(req.session.userId)
        ]);

        alertasGeneradas = {
          desabastecimiento: alertasDesab.length,
          vencimiento: alertasVenc.length
        };

        // Obtener todas las alertas no leídas para el modal
        alertasActivas = await Alerta.getNoLeidas(req.session.userId);
        resumenAlertas = await Alerta.getResumenAlertas(req.session.userId);
      } catch (alertError) {
        console.error('Error generando alertas:', alertError);
      }

      // Obtener todas las métricas
      const [
        statsGenerales,
        stockPorCategoria,
        tasaDesabastecimiento,
        insumosVencer,
        detalleVencer
      ] = await Promise.all([
        Dashboard.getEstadisticasGenerales(),
        Dashboard.getStockPorCategoria(),
        Dashboard.getTasaDesabastecimiento(),
        Dashboard.getInsumosProximosVencer(),
        Dashboard.getDetalleInsumosVencer(90)
      ]);
      res.render('dashboard/index', {
        title: 'Dashboard - Sistema DM-5',
        stats: statsGenerales,
        stockPorCategoria: JSON.stringify(stockPorCategoria),
        tasaDesabastecimiento,
        insumosVencer: JSON.stringify(insumosVencer),
        detalleVencer,
        alertasActivas: JSON.stringify(alertasActivas),
        resumenAlertas,
        mostrarModalAlertas: alertasActivas.length > 0
      });

    } catch (error) {
      console.error('Error cargando dashboard:', error);
      res.render('dashboard/index', {
        title: 'Dashboard - Sistema DM-5',
        stats: null,
        stockPorCategoria: JSON.stringify([]),
        tasaDesabastecimiento: null,
        insumosVencer: JSON.stringify([]),
        detalleVencer: [],
        alertasActivas: JSON.stringify([]),
        resumenAlertas: { desabastecimiento: 0, vencimiento: 0, total: 0 },
        mostrarModalAlertas: false,
        error: 'Error cargando estadísticas'
      });
    }
  };
}

module.exports = DashboardController;