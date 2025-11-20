import express from 'express';
const router = express.Router();
import AlertaController from '../controllers/alertaController.js'; // ⬅️ CAMBIADO y añadido .js
import { requireAuth } from '../middleware/auth.js';              // ⬅️ CAMBIADO y añadido .js

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

export default router; // ⬅️ CAMBIADO: module.exports a export default