const express = require('express');
const router = express.Router();
const KardexController = require('../controllers/kardexController');
const { requireAuth } = require('../middleware/auth');

// Aplicar autenticación a todas las rutas
router.use(requireAuth);

// GET /kardex - Lista de insumos
router.get('/', KardexController.showLista);

// GET /kardex/ver/:id - Ver Kardex actual
router.get('/ver/:id', KardexController.showVer);

// GET /kardex/historial/:id - Ver historial
router.get('/historial/:id', KardexController.showHistorial);



module.exports = router;