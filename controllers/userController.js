import User from '../models/User.js'; // ⬅️ CAMBIADO: require() a import, añadido .js

class UserController {
  // Mostrar perfil del usuario
  static showProfile = async (req, res) => {
    try {
      const user = await User.findByCi(req.session.userId);

      if (!user) {
        req.session.error = 'Usuario no encontrado';
        return res.redirect('/auth/login');
      }

      const success = req.session.success || null;
      const error = req.session.error || null;

      // Limpiar mensajes
      req.session.success = null;
      req.session.error = null;

      res.render('users/profile', {
        title: 'Mi Perfil - Sistema DM-5',
        user,
        success,
        error
      });

    } catch (error) {
      console.error('Error mostrando perfil:', error);
      req.session.error = 'Error cargando perfil';
      res.redirect('/dashboard');
    }
  };

  // Actualizar perfil del usuario
  static updateProfile = async (req, res) => {
    try {
      const { nombres, apellidos, telefono, password, confirm_password } = req.body;

      // Validar campos requeridos
      if (!nombres || !apellidos) {
        req.session.error = 'Nombres y apellidos son requeridos';
        return res.redirect('/users/profile');
      }

      // Validar contraseña si se proporciona
      if (password) {
        if (password !== confirm_password) {
          req.session.error = 'Las contraseñas no coinciden';
          return res.redirect('/users/profile');
        }

        if (password.length < 6) {
          req.session.error = 'La contraseña debe tener al menos 6 caracteres';
          return res.redirect('/users/profile');
        }
      }

      // Actualizar usuario
      const updateData = {
        nombres,
        apellidos,
        telefono: telefono || null
      };

      if (password) {
        updateData.password = password;
      }

      const updatedUser = await User.updateProfile(req.session.userId, updateData);

      // Actualizar datos en la sesión
      req.session.user.nombres = updatedUser.nombres;
      req.session.user.apellidos = updatedUser.apellidos;

      req.session.success = 'Perfil actualizado correctamente';
      res.redirect('/users/profile');

    } catch (error) {
      console.error('Error actualizando perfil:', error);
      req.session.error = 'Error actualizando perfil';
      res.redirect('/users/profile');
    }
  };
}

export default UserController; // ⬅️ CAMBIADO: module.exports a export default