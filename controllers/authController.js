import User from '../models/User.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class AuthController {
  // Mostrar formulario de login
  static showLogin = (req, res) => {
    const error = req.session.error || null;
    const success = req.session.success || null;
    req.session.error = null; // Limpiar mensajes después de mostrarlos
    req.session.success = null;

    res.render('auth/login', {
      title: 'Iniciar Sesión - Sistema DM-5',
      error,
      success
    });
  };

  // Mostrar formulario de registro
  static showRegister = (req, res) => {
    const error = req.session.error || null;
    req.session.error = null;
    
    res.render('auth/register', {
      title: 'Registrarse - Sistema DM-5',
      error
    });
  };

  // Procesar registro
  static processRegister = async (req, res) => {
    const { 
      username, 
      password, 
      confirm_password, 
      email, 
      nombres, 
      apellidos, 
      ci, 
      telefono, 
      numero_licencia 
    } = req.body;
    
    try {
      // Validar campos requeridos
      if (!username || !password || !email || !nombres || !apellidos || !ci || !numero_licencia) {
        req.session.error = 'Todos los campos obligatorios deben ser completados';
        return res.redirect('/auth/register');
      }

      // Validar contraseñas
      if (password !== confirm_password) {
        req.session.error = 'Las contraseñas no coinciden';
        return res.redirect('/auth/register');
      }

      if (password.length < 6) {
        req.session.error = 'La contraseña debe tener al menos 6 caracteres';
        return res.redirect('/auth/register');
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        req.session.error = 'El formato del email no es válido';
        return res.redirect('/auth/register');
      }

      // Validar CI (número entero)
      if (!/^\d+$/.test(ci)) {
        req.session.error = 'El CI debe contener solo números';
        return res.redirect('/auth/register');
      }

      // Crear usuario
      const userData = {
        username,
        password,
        email,
        nombres,
        apellidos,
        ci: parseInt(ci),
        telefono: telefono || null,
        numero_licencia
      };

      const newUser = await User.create(userData);
      
      console.log(`✅ Usuario registrado: ${newUser.username} (CI: ${newUser.ci})`);
      
      // Redirigir al login con mensaje de éxito
      req.session.success = 'Usuario registrado correctamente. Puede iniciar sesión.';
      res.redirect('/auth/login');
      
    } catch (error) {
      console.error('Error en registro:', error);
      
      // Manejar errores específicos de base de datos
      if (error.message.includes('usuarios_username_key')) {
        req.session.error = 'El nombre de usuario ya existe';
      } else if (error.message.includes('usuarios_email_key')) {
        req.session.error = 'El email ya está registrado';
      } else if (error.message.includes('usuarios_pkey') || error.message.includes('usuarios_ci')) {
        req.session.error = 'El CI ya está registrado';
      } else if (error.message.includes('usuarios_numero_licencia_key')) {
        req.session.error = 'El número de licencia ya está registrado';
      } else {
        req.session.error = 'Error registrando usuario: ' + error.message;
      }
      
      res.redirect('/auth/register');
    }
  };

  // Procesar login
  static processLogin = async (req, res) => {
    const { username, password } = req.body;
    
    try {
      // Validar campos
      if (!username || !password) {
        req.session.error = 'Username y contraseña son requeridos';
        return res.redirect('/auth/login');
      }

      // Buscar usuario
      const user = await User.findByUsername(username);
      if (!user) {
        req.session.error = 'Credenciales incorrectas';
        return res.redirect('/auth/login');
      }

      // Verificar contraseña
      const isValidPassword = await User.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        req.session.error = 'Credenciales incorrectas';
        return res.redirect('/auth/login');
      }

      // Actualizar último acceso
      await User.updateLastLogin(user.ci);

      // Crear sesión usando CI como identificador principal
      req.session.userId = user.ci; // Mantener por compatibilidad
      req.session.userCi = user.ci;  // Nuevo campo explícito
      req.session.user = {
        ci: user.ci,
        username: user.username,
        nombres: user.nombres,
        apellidos: user.apellidos
      };

      console.log(`✅ Login exitoso: ${user.username} (CI: ${user.ci})`);
      res.redirect('/dashboard');
      
    } catch (error) {
      console.error('Error en login:', error);
      req.session.error = 'Error interno del servidor';
      res.redirect('/auth/login');
    }
  };

  // Procesar logout
  static logout = (req, res) => {
    const username = req.session.user?.username || 'Usuario desconocido';
    
    req.session.destroy((err) => {
      if (err) {
        console.error('Error cerrando sesión:', err);
        return res.redirect('/dashboard');
      }
      
      console.log(`👋 Logout: ${username}`);
      res.clearCookie('dm5.sid');
      res.redirect('/auth/login');
    });
  };
}

export default AuthController; // ⬅️ CAMBIADO: module.exports a export default