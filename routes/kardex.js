import express from 'express';
const router = express.Router();
import KardexController from '../controllers/kardexController.js'; // ⬅️ CAMBIADO y añadido .js
import { requireAuth } from '../middleware/auth.js';              // ⬅️ CAMBIADO y añadido .js

// Aplicar autenticación a todas las rutas
router.use(requireAuth);

// GET /kardex - Lista de insumos
router.get('/', KardexController.showLista);

// GET /kardex/ver/:id - Ver Kardex actual
router.get('/ver/:id', KardexController.showVer);

// GET /kardex/historial/:id - Ver historial
router.get('/historial/:id', KardexController.showHistorial);


export default router; // ⬅️ CAMBIADO: module.exports a export default