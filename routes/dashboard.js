const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación
router.use(requireAuth);

// GET /dashboard - Mostrar dashboard principal
router.get('/', DashboardController.showDashboard);

module.exports = router;