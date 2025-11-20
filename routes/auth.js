import express from 'express';
const router = express.Router();
import AuthController from '../controllers/authController.js'; // ⬅️ CAMBIADO y añadido .js
import { redirectIfAuth } from '../middleware/auth.js';      // ⬅️ CAMBIADO y añadido .js

// GET /auth/login - Mostrar formulario de login
router.get('/login', redirectIfAuth, AuthController.showLogin);

// POST /auth/login - Procesar login
router.post('/login', redirectIfAuth, AuthController.processLogin);

// GET /auth/register - Mostrar formulario de registro
router.get('/register', redirectIfAuth, AuthController.showRegister);

// POST /auth/register - Procesar registro
router.post('/register', redirectIfAuth, AuthController.processRegister);

// POST /auth/logout - Procesar logout
router.post('/logout', AuthController.logout);

// Redirigir /auth a /auth/login
router.get('/', (req, res) => {
  res.redirect('/auth/login');
});

export default router; // ⬅️ CAMBIADO: module.exports a export default