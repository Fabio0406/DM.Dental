const express = require('express');
const router = express.Router();
const AlertaController = require('../controllers/alertaController');
const { requireAuth } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(requireAuth);

// API endpoints
router.get('/no-leidas', AlertaController.getNoLeidas);
router.get('/contar', AlertaController.contarNoLeidas);
router.get('/resumen', AlertaController.getResumen);
router.get('/historial', AlertaController.getHistorial);
router.post('/generar', AlertaController.generarAlertas);
router.put('/marcar-leida/:id', AlertaController.marcarLeida);
router.put('/marcar-todas-leidas', AlertaController.marcarTodasLeidas);

module.exports = router;