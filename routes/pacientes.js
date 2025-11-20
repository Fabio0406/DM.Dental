import express from 'express';
const router = express.Router();
import pacienteController from '../controllers/pacienteController.js'; // ⬅️ CAMBIADO y añadido .js
import { requireAuth } from '../middleware/auth.js';                  // ⬅️ CAMBIADO y añadido .js
import { uploadPaciente } from '../config/multer.js';               // ⬅️ CAMBIADO y añadido .js

/**
 * Rutas para Gestión de Pacientes
 * Todas las rutas requieren autenticación
 */

// GET /pacientes - Lista de pacientes con búsqueda
router.get('/', requireAuth, pacienteController.listarPacientes);

// GET /pacientes/nuevo - Formulario de registro
router.get('/nuevo', requireAuth, pacienteController.mostrarFormularioRegistro);

// POST /pacientes - Crear nuevo paciente
router.post(
  '/',
  requireAuth,
  uploadPaciente.single('imagen'),
  pacienteController.registrarPaciente
);

// GET /pacientes/:id/perfil - Ver perfil del paciente
router.get('/:id/perfil', requireAuth, pacienteController.verPerfil);

// GET /pacientes/:id/editar - Formulario de edición
router.get('/:id/editar', requireAuth, pacienteController.mostrarFormularioEdicion);

// PUT /pacientes/:id - Actualizar paciente
router.put(
  '/:id',
  requireAuth,
  uploadPaciente.single('imagen'),
  pacienteController.actualizarPaciente
);

// DELETE /pacientes/:id - Eliminar paciente
router.delete('/:id', requireAuth, pacienteController.eliminarPaciente);

// POST /pacientes/:id/imagen - Subir nueva imagen
router.post(
  '/:id/imagen',
  requireAuth,
  uploadPaciente.single('imagen'),
  pacienteController.subirImagen
);

// GET /pacientes/buscar - Buscar pacientes (API)
router.get('/buscar', requireAuth, pacienteController.buscarPacientes);

export default router; // ⬅️ CAMBIADO: module.exports a export default