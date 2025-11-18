const express = require('express');
const router = express.Router();
const OCRController = require('../controllers/ocrController');
const { requireAuth } = require('../middleware/auth');
const uploadFormulario = require('../config/multer');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /ocr - Listar formularios
router.get('/', OCRController.listFormularios);

// GET /ocr/upload - Mostrar formulario de upload
router.get('/upload', OCRController.showUpload);

// POST /ocr/upload - Procesar upload y OCR
router.post('/upload', uploadFormulario.single('formulario'), OCRController.processUpload);

// GET /ocr/review/:id - Revisar datos extraídos
router.get('/review/:id', OCRController.showReview);

// POST /ocr/confirmar/:id - Confirmar e importar al inventario
router.post('/confirmar/:id', OCRController.confirmarImportar);

module.exports = router;