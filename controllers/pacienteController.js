// Importaciones de módulos locales (Añadir .js y usar import)
import Paciente from '../models/Paciente.js';
import ImagenPaciente from '../models/ImagenPaciente.js';
import ProyeccionDental from '../models/ProyeccionDental.js';

// Importaciones de módulos nativos de Node.js
import path from 'path';
import { promises as fs } from 'fs'; // Usamos desestructuración para el objeto promises de fs

/**
 * Controlador de Gestión de Pacientes
 */

const pacienteController = {

  // Renderizar lista de pacientes
  listarPacientes: async (req, res) => {
    try {
      const { ci, nombre, page = 1 } = req.query;
      const limit = 10;
      const offset = (page - 1) * limit;

      const filtros = {
        ci,
        nombre,
        limit,
        offset
      };

      const pacientes = await Paciente.obtenerTodos(filtros);
      const estadisticas = await Paciente.obtenerEstadisticas();

      res.render('pacientes/lista', {
        title: 'Lista de Pacientes',
        pacientes,
        estadisticas,
        filtros: { ci, nombre },
        currentPage: parseInt(page),
        user: req.session.user,
        calcularEdad: (fecha) => {
          const hoy = new Date();
          const nacimiento = new Date(fecha);
          let edad = hoy.getFullYear() - nacimiento.getFullYear();
          const m = hoy.getMonth() - nacimiento.getMonth();
          if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
          return edad;
        }
      });

    } catch (error) {
      console.error('Error al listar pacientes:', error);
      res.status(500).render('error', {
        message: 'Error al cargar la lista de pacientes',
        error: error
      });
    }
  },

  // Mostrar formulario de registro
  mostrarFormularioRegistro: (req, res) => {
    res.render('pacientes/registro', {
      title: 'Registrar Paciente',
      user: req.session.user,
      errores: null,
      datos: {}
    });
  },

  // Registrar nuevo paciente
  registrarPaciente: async (req, res) => {
    try {
      const { ci, nombres, apellidos, fecha_nacimiento, sexo, telefono, direccion } = req.body;

      // Validar CI único
      const pacienteExistente = await Paciente.obtenerPorCI(parseInt(ci));
      if (pacienteExistente) {
        return res.render('pacientes/registro', {
          title: 'Registrar Paciente',
          user: req.session.user,
          errores: ['Ya existe un paciente con este CI'],
          datos: req.body
        });
      }

      // Crear paciente
      const nuevoPaciente = await Paciente.crear({
        ci: parseInt(ci),
        nombres,
        apellidos,
        fecha_nacimiento,
        sexo,
        telefono,
        direccion,
        id_usuario: req.session.userId
      });

      // Guardar imagen si se subió
      if (req.file) {
        const rutaRelativa = '/uploads/pacientes/' + req.file.filename;

        await ImagenPaciente.crear({
          paciente_id: nuevoPaciente.ci,
          ruta_imagen: rutaRelativa,
          tipo_imagen: 'frontal',
          descripcion: 'Foto inicial del paciente',
          id_usuario: req.session.userId
        });
      }

      req.session.mensaje = {
        tipo: 'success',
        texto: 'Paciente registrado exitosamente'
      };

      res.redirect(`/pacientes/${nuevoPaciente.ci}/perfil`);

    } catch (error) {
      console.error('Error al registrar paciente:', error);
      res.render('pacientes/registro', {
        title: 'Registrar Paciente',
        user: req.session.user,
        errores: ['Error al registrar el paciente: ' + error.message],
        datos: req.body
      });
    }
  },

  // Ver perfil del paciente
  verPerfil: async (req, res) => {
    try {
      const { id } = req.params;
      const paciente = await Paciente.obtenerPorId(parseInt(id));

      if (!paciente) {
        return res.status(404).render('error', {
          message: 'Paciente no encontrado',
          error: { status: 404 }
        });
      }

      // Calcular edad
      paciente.edad = Paciente.calcularEdad(paciente.fecha_nacimiento);
      console.log("aqui esta las proyecciones")
      if (paciente?.proyecciones) {
        paciente.proyecciones = paciente.proyecciones.map(p => ({
          ...p,
          parametros_ia: p.parametros_ia ? JSON.parse(p.parametros_ia) : null
        }));


      }
      console.log(paciente.proyecciones)

      res.render('pacientes/perfil', {
        title: `Perfil de ${paciente.nombres} ${paciente.apellidos}`,
        paciente,
        user: req.session.user,
        mensaje: req.session.mensaje
      });

      // Limpiar mensaje
      delete req.session.mensaje;

    } catch (error) {
      console.error('Error al ver perfil:', error);
      res.status(500).render('error', {
        message: 'Error al cargar el perfil del paciente',
        error: error
      });
    }
  },

  // Mostrar formulario de edición
  mostrarFormularioEdicion: async (req, res) => {
    try {
      const { id } = req.params;
      const paciente = await Paciente.obtenerPorId(parseInt(id));

      if (!paciente) {
        return res.status(404).render('error', {
          message: 'Paciente no encontrado',
          error: { status: 404 }
        });
      }

      res.render('pacientes/editar', {
        title: 'Editar Paciente',
        paciente,
        user: req.session.user,
        errores: null
      });

    } catch (error) {
      console.error('Error al mostrar formulario:', error);
      res.status(500).render('error', {
        message: 'Error al cargar el formulario',
        error: error
      });
    }
  },

  // Actualizar paciente
  actualizarPaciente: async (req, res) => {
    try {
      const { id } = req.params;
      const { nombres, apellidos, fecha_nacimiento, sexo, telefono, direccion } = req.body;

      await Paciente.actualizar(parseInt(id), {
        nombres,
        apellidos,
        fecha_nacimiento,
        sexo,
        telefono,
        direccion
      });

      // Actualizar imagen si se subió nueva
      if (req.file) {
        const rutaRelativa = '/uploads/pacientes/' + req.file.filename;

        await ImagenPaciente.crear({
          paciente_id: parseInt(id),
          ruta_imagen: rutaRelativa,
          tipo_imagen: 'frontal',
          id_usuario: req.session.userId
        });
      }

      req.session.mensaje = {
        tipo: 'success',
        texto: 'Paciente actualizado exitosamente'
      };

      res.redirect(`/pacientes/${id}/perfil`);

    } catch (error) {
      console.error('Error al actualizar paciente:', error);
      const paciente = await Paciente.obtenerPorId(parseInt(req.params.id));

      res.render('pacientes/editar', {
        title: 'Editar Paciente',
        paciente: { ...paciente, ...req.body },
        user: req.session.user,
        errores: ['Error al actualizar: ' + error.message]
      });
    }
  },

  // Eliminar paciente
  eliminarPaciente: async (req, res) => {
    try {
      const { id } = req.params;

      // Obtener paciente con sus imágenes
      const paciente = await Paciente.obtenerPorId(parseInt(id));

      if (!paciente) {
        return res.status(404).json({
          success: false,
          message: 'Paciente no encontrado'
        });
      }

      // Eliminar archivos físicos de imágenes
      if (paciente.imagenes) {
        for (const imagen of paciente.imagenes) {
          const rutaArchivo = path.join(__dirname, '../public', imagen.ruta_imagen);
          try {
            await fs.unlink(rutaArchivo);
          } catch (error) {
            console.warn('No se pudo eliminar archivo:', rutaArchivo);
          }
        }
      }

      // Eliminar archivos de proyecciones
      if (paciente.proyecciones) {
        for (const proyeccion of paciente.proyecciones) {
          const rutaProcesada = path.join(__dirname, '../public', proyeccion.ruta_proyeccion);

          try {
            await fs.unlink(rutaProcesada);
          } catch (error) {
            console.warn('No se pudo eliminar archivo de proyección');
          }
        }
      }

      // Eliminar de BD (eliminará en cascada imágenes y proyecciones)
      await Paciente.eliminar(parseInt(id));

      res.json({
        success: true,
        message: 'Paciente eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar paciente:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar el paciente'
      });
    }
  },

  // Subir nueva imagen del paciente
  subirImagen: async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No se subió ninguna imagen'
        });
      }

      const rutaRelativa = '/uploads/pacientes/' + req.file.filename;

      const nuevaImagen = await ImagenPaciente.crear({
        paciente_id: parseInt(id),
        ruta_imagen: rutaRelativa,
        tipo_imagen: 'frontal',
        id_usuario: req.session.userId
      });

      res.json({
        success: true,
        message: 'Imagen subida exitosamente',
        imagen: nuevaImagen
      });

    } catch (error) {
      console.error('Error al subir imagen:', error);
      res.status(500).json({
        success: false,
        message: 'Error al subir la imagen'
      });
    }
  },

  // Buscar pacientes (API endpoint)
  buscarPacientes: async (req, res) => {
    try {
      const { q } = req.query;

      const pacientes = await Paciente.obtenerTodos({
        nombre: q,
        limit: 10
      });

      res.json({
        success: true,
        pacientes: pacientes
      });

    } catch (error) {
      console.error('Error al buscar pacientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error en la búsqueda'
      });
    }
  }

};

export default pacienteController; // ⬅️ CAMBIADO: module.exports a export default