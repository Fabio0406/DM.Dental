const express = require('express');
const router = express.Router();
const proyeccionController = require('../controllers/proyeccionController');
const { requireAuth } = require('../middleware/auth');
const { uploadPaciente } = require('../config/multer'); // ✅ Importación directa

/**
 * Rutas para Proyecciones Dentales
 * Todas las rutas requieren autenticación
 */

// GET /proyecciones/nueva - Formulario para nueva proyección
router.get('/nueva', requireAuth, proyeccionController.mostrarFormularioNuevaProyeccion);

// POST /proyecciones/generar - Generar las 3 proyecciones
router.post(
  '/generar',
  requireAuth,
  uploadPaciente.single('imagen'),
  proyeccionController.generarProyecciones
);

// POST /proyecciones/guardar - Guardar proyección seleccionada
router.post('/guardar', requireAuth, proyeccionController.guardarProyeccionSeleccionada);

// GET /proyecciones/historial - Ver historial de proyecciones
router.get('/historial', requireAuth, proyeccionController.verHistorial);

// GET /proyecciones/:id - Ver resultado de proyección
router.get('/:id', requireAuth, proyeccionController.verResultado);

// GET /proyecciones/:id/descargar - Descargar imagen de proyección
router.get('/:id/descargar', requireAuth, proyeccionController.descargarProyeccion);


// DELETE /proyecciones/:id - Eliminar proyección
router.delete('/:id', requireAuth, proyeccionController.eliminarProyeccion);

module.exports = router;