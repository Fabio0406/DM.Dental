const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { redirectIfAuth } = require('../middleware/auth');

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

module.exports = router;