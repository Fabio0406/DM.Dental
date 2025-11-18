const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

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

module.exports = router;