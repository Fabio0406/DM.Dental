import express from 'express';
const router = express.Router();
import UserController from '../controllers/userController.js'; // ⬅️ CAMBIADO y añadido .js
import { requireAuth } from '../middleware/auth.js';          // ⬅️ CAMBIADO y añadido .js

// Aplicar middleware de autenticación a todas las rutas de usuarios
router.use(requireAuth);

// GET /users/profile - Mostrar perfil
router.get('/profile', UserController.showProfile);

// POST /users/profile - Actualizar perfil
router.post('/profile', UserController.updateProfile);

// Redirigir /users a /users/profile
router.get('/', (req, res) => {
  res.redirect('/users/profile');
});

export default router; // ⬅️ CAMBIADO: module.exports a export default