import express from 'express';
const router = express.Router();
import OCRController from '../controllers/ocrController.js';        // ⬅️ CAMBIADO y añadido .js
import { requireAuth } from '../middleware/auth.js';               // ⬅️ CAMBIADO y añadido .js
import { uploadFormulario } from '../config/multer.js';          // ⬅️ CAMBIADO y añadido .js

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

// GET /ocr/estado/:id - Estado de la lectura (consulta periódica)
router.get('/estado/:id', OCRController.estado);

// POST /ocr/guardar/:id - Guardar la revisión como borrador
router.post('/guardar/:id', OCRController.guardarBorrador);

// POST /ocr/releer/:id - Volver a leer la imagen
router.post('/releer/:id', OCRController.releer);

// POST /ocr/cancelar/:id - Cancelar la importación (solo antes de importar)
router.post('/cancelar/:id', OCRController.cancelar);

// POST /ocr/confirmar/:id - Confirmar e importar al inventario
router.post('/confirmar/:id', OCRController.confirmarImportar);

export default router; // ⬅️ CAMBIADO: module.exports a export default