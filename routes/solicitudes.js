import express from 'express';
const router = express.Router();
import SolicitudController from '../controllers/solicitudController.js';
import { requireAuth } from '../middleware/auth.js'; 

// Aplicar autenticación a todas las rutas
router.use(requireAuth);

// GET /solicitudes - Lista de solicitudes del usuario
router.get('/', SolicitudController.showLista);

// GET /solicitudes/nueva - Formulario nueva solicitud
router.get('/nueva', SolicitudController.showNueva);

// POST /solicitudes - Crear solicitud
router.post('/', SolicitudController.crear);

// GET /solicitudes/ver/:id - Ver detalle de solicitud
router.get('/ver/:id', SolicitudController.showVer);

// GET /solicitudes/editar/:id - Formulario editar solicitud
router.get('/editar/:id', SolicitudController.showEditar);

// POST /solicitudes/editar/:id - Actualizar solicitud
router.post('/editar/:id', SolicitudController.actualizar);

// POST /solicitudes/eliminar/:id - Eliminar solicitud
router.post('/eliminar/:id', SolicitudController.eliminar);

// GET /solicitudes/exportar/:id - Exportar PDF
router.get('/exportar/:id', SolicitudController.exportarPDF);

module.exports = router;