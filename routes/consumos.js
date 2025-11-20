import express from 'express';
const router = express.Router();
import ConsumoController from '../controllers/consumoController.js'; // ⬅️ CAMBIADO y añadido .js
import { requireAuth } from '../middleware/auth.js';                // ⬅️ CAMBIADO y añadido .js

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Rutas de vistas
router.get('/registro', ConsumoController.showRegistro);
router.get('/historial', ConsumoController.showHistorial);
router.get('/estadisticas', ConsumoController.showEstadisticas);

// Rutas de API
router.get('/api/protocolo/:id', ConsumoController.getProtocoloByServicio);
router.get('/api/disponibilidad/:id_tipo_servicio', ConsumoController.verificarDisponibilidad);
router.get('/api/detalles/:id', ConsumoController.getDetallesConsumo);

// NUEVO: Ruta para marcar lotes vencidos como notificados
router.post('/api/lotes-vencidos/notificar', ConsumoController.marcarLotesVencidosNotificados);

// Rutas de acciones
router.post('/registro', ConsumoController.processRegistro);
router.post('/api/ajuste', ConsumoController.registrarAjuste);

export default router; // ⬅️ CAMBIADO: module.exports a export default