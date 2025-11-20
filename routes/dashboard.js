import express from 'express';
const router = express.Router();
import DashboardController from '../controllers/dashboardController.js'; // ⬅️ CAMBIADO y añadido .js
import { requireAuth } from '../middleware/auth.js';                // ⬅️ CAMBIADO y añadido .js

// Aplicar middleware de autenticación
router.use(requireAuth);

// GET /dashboard - Mostrar dashboard principal
router.get('/', DashboardController.showDashboard);

export default router; // ⬅️ CAMBIADO: module.exports a export default