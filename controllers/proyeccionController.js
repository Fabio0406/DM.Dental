// Importaciones de módulos locales (Añadir .js y usar import)
import Paciente from '../models/Paciente.js';
import ImagenPaciente from '../models/ImagenPaciente.js';
import ProyeccionDental from '../models/ProyeccionDental.js';
import ProyeccionService from '../services/proyeccionService.js'; // ⬅️ CAMBIADO y añadido .js
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Controlador de Proyecciones Dentales
 * ACTUALIZADO para nueva estructura de BD
 */

const proyeccionController = {

  // Mostrar formulario para nueva proyección
  mostrarFormularioNuevaProyeccion: async (req, res) => {
    try {
      const { paciente_id } = req.query;
      let paciente = null;
      if (paciente_id) {
        // CAMBIO: Ahora buscar por CI en lugar de ID
        paciente = await Paciente.findByCi(paciente_id);
      }
      res.render('proyecciones/nueva', {
        title: 'Nueva Proyección Dental',
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

  // Generar las 3 proyecciones
  generarProyecciones: async (req, res) => {
    try {
      const { paciente_ci, tipo_tratamiento, usar_imagen_existente } = req.body;
      // CAMBIO: Validar paciente por CI
      const paciente = await Paciente.findByCi(paciente_ci);
      if (!paciente) {
        return res.status(404).json({
          success: false,
          message: 'Paciente no encontrado'
        });
      }

      // Determinar ruta de la imagen a procesar
      let rutaImagen;
      let imagenId = null;

      if (usar_imagen_existente === 'true') {
        // Usar imagen principal del paciente
        const imagenPrincipal = await ImagenPaciente.obtenerPrincipal(paciente_ci);
        if (!imagenPrincipal) {
          return res.status(400).json({
            success: false,
            message: 'El paciente no tiene una imagen registrada'
          });
        }
        rutaImagen = imagenPrincipal.ruta_imagen;
        imagenId = imagenPrincipal.id_imagen;
      } else {
        // Usar imagen subida en el formulario
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'Debe subir una imagen o usar la imagen existente del paciente'
          });
        }
        rutaImagen = req.file.path;

        // Guardar la nueva imagen como imagen del paciente
        const rutaRelativa = '/uploads/pacientes/' + req.file.filename;
        const nuevaImagen = await ImagenPaciente.crear({
          ci_paciente: paciente_ci, // CAMBIO: usar ci_paciente
          ruta_imagen: rutaRelativa,
          tipo_imagen: 'sonrisa_frontal',
          es_principal: false
        });
        imagenId = nuevaImagen.id_imagen;
      }

      // Generar las 3 proyecciones
      console.log('Generando proyecciones para paciente:', paciente.nombres);
      const resultado = await ProyeccionService.generarProyecciones(
        rutaImagen,
        tipo_tratamiento
      );

      if (!resultado.success) {
        return res.status(500).json({
          success: false,
          message: 'Error al generar proyecciones: ' + resultado.error
        });
      }

      // Convertir rutas absolutas a relativas
      const proyeccionesConRutas = resultado.proyecciones.map(p => ({
        ...p,
        rutaRelativa: ProyeccionService.convertirARutaRelativa(p.rutaImagen)
      }));

      // Guardar las 3 rutas en sesión para poder eliminar las no seleccionadas después
      req.session.proyeccionesTemporales = {
        rutas: resultado.proyecciones.map(p => p.rutaImagen),
        paciente_ci: paciente_ci, // Este es el CI del paciente
        imagen_id: imagenId,
        tipo_tratamiento: tipo_tratamiento,
        imagenOriginal: resultado.imagenOriginal
      };

      res.json({
        success: true,
        proyecciones: proyeccionesConRutas,
        paciente: {
          ci: paciente.ci, // CAMBIO: retornar CI en lugar de ID
          nombre: `${paciente.nombres} ${paciente.apellidos}`,
          ci_display: paciente.ci
        }
      });

    } catch (error) {
      console.error('Error al generar proyecciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al generar proyecciones: ' + error.message
      });
    }
  },

  // Guardar proyección seleccionada
  guardarProyeccionSeleccionada: async (req, res) => {
    try {
      const { intensidad, diagnostico, duracion_estimada } = req.body;

      // Obtener datos temporales de la sesión
      const datosTemporales = req.session.proyeccionesTemporales;
      if (!datosTemporales) {
        return res.status(400).json({
          success: false,
          message: 'No hay proyecciones temporales en sesión'
        });
      }

      // Encontrar la proyección seleccionada
      const proyeccionSeleccionada = datosTemporales.rutas.find(ruta =>
        ruta.includes(`_${intensidad}.`)
      );

      if (!proyeccionSeleccionada) {
        return res.status(400).json({
          success: false,
          message: 'Proyección seleccionada no encontrada'
        });
      }

      // CAMBIO: Obtener paciente por CI
      const paciente = await Paciente.findByCi(datosTemporales.paciente_ci);

      // Crear registro en BD con nuevos campos
      const proyeccionData = {
        id_imagen: datosTemporales.imagen_id,
        tipo_tratamiento: datosTemporales.tipo_tratamiento,
        diagnostico,
        duracion_estimada,
        intensidad: parseInt(intensidad),
        ruta_imagen_original: ProyeccionService.convertirARutaRelativa(datosTemporales.imagenOriginal),
        ruta_proyeccion: ProyeccionService.convertirARutaRelativa(proyeccionSeleccionada), // ✅ nombre correcto
        parametros_ia: ProyeccionService.generarMetadata(
          { intensidad: parseInt(intensidad), metadata: {} },
          paciente
        ),
        id_usuario: req.session.userId
      };


      const nuevaProyeccion = await ProyeccionDental.crear(proyeccionData);

      // Eliminar proyecciones no seleccionadas
      await ProyeccionService.limpiarProyeccionesNoSeleccionadas(
        datosTemporales.rutas,
        proyeccionSeleccionada
      );

      // Limpiar sesión
      delete req.session.proyeccionesTemporales;

      res.json({
        success: true,
        message: 'Proyección guardada exitosamente',
        proyeccion: nuevaProyeccion
      });

    } catch (error) {
      console.error('Error al guardar proyección:', error);
      res.status(500).json({
        success: false,
        message: 'Error al guardar la proyección: ' + error.message
      });
    }
  },

  // Ver resultado de proyección
  verResultado: async (req, res) => {
    try {
      const { id } = req.params;
      const proyeccion = await ProyeccionDental.obtenerPorId(id);

      if (!proyeccion) {
        return res.status(404).render('error', {
          message: 'Proyección no encontrada',
          error: { status: 404 }
        });
      }

      // CAMBIO: Mapear campos de BD nueva a nombres esperados en vista
      proyeccion.ruta_imagen_procesada = proyeccion.ruta_proyeccion;
      proyeccion.metadata = proyeccion.parametros_ia;

      // Parsear metadata si es string
      if (typeof proyeccion.metadata === 'string') {
        proyeccion.metadata = JSON.parse(proyeccion.metadata);
      }

      res.render('proyecciones/resultado', {
        title: 'Resultado de Proyección',
        proyeccion,
        user: req.session.user
      });

    } catch (error) {
      console.error('Error al ver resultado:', error);
      res.status(500).render('error', {
        message: 'Error al cargar el resultado',
        error: error
      });
    }
  },

  // Ver historial de proyecciones
  verHistorial: async (req, res) => {
    try {
      const { paciente_ci, tipo_tratamiento, page = 1 } = req.query;
      const limit = 12;
      const offset = (page - 1) * limit;

      const filtros = {
        tipo_tratamiento,
        limit,
        offset
      };

      let proyecciones;
      if (paciente_ci) {
        proyecciones = await ProyeccionDental.obtenerPorPaciente(paciente_ci);
      } else {
        proyecciones = await ProyeccionDental.obtenerHistorial(filtros);
      }

      // CAMBIO: Mapear campos para compatibilidad con vistas
      proyecciones = proyecciones.map(p => ({
        ...p,
        id: p.id_proyeccion,
        ruta_imagen_procesada: p.ruta_proyeccion,
        fecha_proyeccion: p.fecha_generacion
      }));

      const estadisticas = await ProyeccionDental.obtenerEstadisticas();

      res.render('proyecciones/historial', {
        title: 'Historial de Proyecciones',
        proyecciones,
        estadisticas,
        filtros: { paciente_ci, tipo_tratamiento },
        currentPage: parseInt(page),
        user: req.session.user
      });

    } catch (error) {
      console.error('Error al ver historial:', error);
      res.status(500).render('error', {
        message: 'Error al cargar el historial',
        error: error
      });
    }
  },

  // Descargar imagen de proyección
  descargarProyeccion: async (req, res) => {
    try {
      const { id } = req.params;
      const proyeccion = await ProyeccionDental.obtenerPorId(id);

      if (!proyeccion) {
        return res.status(404).json({
          success: false,
          message: 'Proyección no encontrada'
        });
      }

      // CAMBIO: Usar ruta_proyeccion
      const rutaArchivo = path.join(__dirname, '../public' + proyeccion.ruta_proyeccion.substring(2));
      const nombreArchivo = `proyeccion_${proyeccion.tipo_tratamiento}_${proyeccion.ci}_${Date.now()}.jpg`;

      res.download(rutaArchivo, nombreArchivo);

    } catch (error) {
      console.error('Error al descargar proyección:', error);
      res.status(500).json({
        success: false,
        message: 'Error al descargar la proyección'
      });
    }
  },

  // Actualizar proyección (sin campo estado)
  actualizarProyeccion: async (req, res) => {
    try {
      const { id } = req.params;
      const { diagnostico, duracion_estimada } = req.body;

      const proyeccionActualizada = await ProyeccionDental.actualizar(id, {
        diagnostico,
        duracion_estimada
      });

      res.json({
        success: true,
        message: 'Proyección actualizada exitosamente',
        proyeccion: proyeccionActualizada
      });

    } catch (error) {
      console.error('Error al actualizar proyección:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar la proyección'
      });
    }
  },

  // Eliminar proyección
  eliminarProyeccion: async (req, res) => {
    try {
      const { id } = req.params;

      const proyeccion = await ProyeccionDental.obtenerPorId(id);
      if (!proyeccion) {
        return res.status(404).json({
          success: false,
          message: 'Proyección no encontrada'
        });
      }

      // Eliminar archivos físicos
      const rutaOriginal = path.join(__dirname, '../public', proyeccion.ruta_imagen_original);
      const rutaProcesada = path.join(__dirname, '../public', proyeccion.ruta_proyeccion);

      try {
        await fs.unlink(rutaOriginal);
        await fs.unlink(rutaProcesada);
      } catch (error) {
        console.warn('No se pudieron eliminar archivos físicos:', error.message);
      }

      // Eliminar de BD
      await ProyeccionDental.eliminar(id);

      res.json({
        success: true,
        message: 'Proyección eliminada exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar proyección:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar la proyección'
      });
    }
  }

};

export default proyeccionController; // ⬅️ CAMBIADO: module.exports a export default