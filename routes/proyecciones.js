import express from 'express';
const router = express.Router();
import proyeccionController from '../controllers/proyeccionController.js'; // ⬅️ CAMBIADO y añadido .js
import { requireAuth } from '../middleware/auth.js';                  // ⬅️ CAMBIADO y añadido .js
import { uploadPaciente } from '../config/multer.js';               // ⬅️ CAMBIADO y añadido .js

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

export default router; // ⬅️ CAMBIADO: module.exports a export default