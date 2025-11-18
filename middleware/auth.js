// Middleware para verificar si el usuario está autenticado
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  } else {
    return res.redirect('/auth/login');
  }
};

// Middleware para redirigir usuarios autenticados
const redirectIfAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  } else {
    return next();
  }
};

// Middleware para agregar datos del usuario a las vistas
const addUserToViews = (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.userId;
  next();
};

module.exports = {
  requireAuth,
  redirectIfAuth,
  addUserToViews
};