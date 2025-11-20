import path from 'path';        // ⬅️ CAMBIADO: require() a import
import { promises as fs } from 'fs'; // ⬅️ CAMBIADO: require() a import con desestructuración

// ============================================
// SERVICIOS ORIGINALES (COMENTADOS TEMPORALMENTE)
// ============================================
// import FaceDetectionService from './faceDetectionService.js'; // ⬅️ CAMBIADO y añadido .js
// import DentalProcessorService from './dentalProcessorService.js'; // ⬅️ CAMBIADO y añadido .js

/**
 * Servicio Principal de Proyecciones Dentales
 * VERSIÓN SIMULACIÓN ESTÁTICA - Para demostración
 * Retorna imágenes pre-procesadas basadas en el nombre del archivo
 */

class ProyeccionService {
  
  /**
   * Genera 3 proyecciones dentales con diferentes intensidades
   * VERSIÓN SIMULACIÓN: Detecta paciente por nombre y retorna imágenes estáticas
   * @param {string} imagePath - Ruta de la imagen del paciente
   * @param {string} tipoTratamiento - 'ortodoncia' o 'carillas'
   * @param {Object} opciones - Opciones adicionales
   * @returns {Object} Información de las 3 proyecciones generadas
   */
  static async generarProyecciones(imagePath, tipoTratamiento, opciones = {}) {
    try {
      console.log('🚀 Iniciando generación de proyecciones (SIMULACIÓN)...');
      console.log('📄 Imagen:', imagePath);
      console.log('💉 Tratamiento:', tipoTratamiento);

      // ============================================
      // LÓGICA DE ESTÁTICA
      // ============================================
      
      // PASO 1: Detectar qué paciente es por el nombre del archivo
      const pacienteDetectado = this.detectarPacientePorNombre(imagePath);
      
      if (!pacienteDetectado) {
        throw new Error('No se pudo identificar el paciente. El archivo debe contener _a, _b, _c o _d en el nombre.');
      }

      

      // PASO 2: Generar rutas a las 3 variaciones pre-procesadas
      const intensidades = [30, 60, 90];
      const proyecciones = [];
      const basePathUploads = path.join(__dirname, '../public/uploads/pacientes');

      for (const intensidad of intensidades) {
        const nivelTexto = intensidad === 30 ? 'Leve' : intensidad === 60 ? 'Moderado' : 'Avanzado';
        console.log(`  → Cargando variación ${nivelTexto} (${intensidad}%)...`);
        
        // Construir ruta a la imagen pre-procesada
        const nombreImagen = `paciente_${pacienteDetectado}_${intensidad}.png`;
        const rutaImagenProcesada = path.join(basePathUploads, nombreImagen);

        // Verificar que el archivo existe
        try {
          await fs.access(rutaImagenProcesada);
        } catch (error) {
          throw new Error(`No se encontró la imagen pre-procesada: ${nombreImagen}`);
        }

        // Generar diagnóstico y duración
        const diagnostico = this.generarDiagnostico(tipoTratamiento);
        const duracion = this.estimarDuracion(tipoTratamiento, intensidad);
        const descripcion = this.generarDescripcionResultado(tipoTratamiento, intensidad);

        proyecciones.push({
          intensidad: intensidad,
          nivel: nivelTexto,
          rutaImagen: rutaImagenProcesada,
          diagnostico: diagnostico,
          duracionEstimada: duracion,
          descripcionResultado: descripcion,
          metadata: {
            tratamiento: tipoTratamiento,
            intensidad: intensidad,
            paciente: pacienteDetectado,
            metodo: 'static_simulation',
            descripcion: 'Imagen pre-procesada para demostración'
          }
        });
      }

      console.log('✅ Proyecciones cargadas exitosamente');

      return {
        success: true,
        proyecciones: proyecciones,
        imagenOriginal: imagePath,
        tipoTratamiento: tipoTratamiento,
        descripcionGeneral: tipoTratamiento === 'ortodoncia' 
          ? 'Estas proyecciones muestran cómo se verían tus dientes DESPUÉS del tratamiento de ortodoncia (alineados y uniformes)'
          : 'Estas proyecciones muestran el resultado final con carillas dentales (sonrisa perfecta)',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error generando proyecciones:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detecta el paciente por el nombre del archivo
   * Busca "_a", "_b", "_c" o "_d" en el nombre
   * @param {string} imagePath - Ruta del archivo
   * @returns {string|null} - Letra del paciente ('a', 'b', 'c', 'd') o null
   */
  static detectarPacientePorNombre(imagePath) {
    console.log("este es la direccion " + imagePath)
    const nombreArchivo = path.basename(imagePath).toLowerCase();
    
    // Buscar patrones: _a, _b, _c, _d
    if (nombreArchivo.includes('_a') || nombreArchivo.includes('paciente_a')) {
      return 'a';
    } else if (nombreArchivo.includes('_b') || nombreArchivo.includes('paciente_b')) {
      return 'b';
    } else if (nombreArchivo.includes('_c') || nombreArchivo.includes('paciente_c')) {
      return 'c';
    } else if (nombreArchivo.includes('_d') || nombreArchivo.includes('paciente_d')) {
      return 'd';
    }
    
    return null;
  }

  /**
   * Genera diagnóstico automático basado en el tratamiento
   */
  static generarDiagnostico(tipoTratamiento) {
    const diagnosticos = {
      ortodoncia: [
        'Alineación dental progresiva mediante ortodoncia invisible',
        'Corrección de maloclusión y mejora de mordida',
        'Tratamiento ortodóntico para sonrisa armoniosa',
        'Alineación y nivelación dental integral'
      ],
      carillas: [
        'Restauración estética con carillas de porcelana',
        'Perfeccionamiento cosmético de sonrisa',
        'Mejora integral de forma, color y alineación',
        'Diseño de sonrisa digital con carillas cerámicas'
      ]
    };

    const opciones = diagnosticos[tipoTratamiento] || diagnosticos.ortodoncia;
    return opciones[Math.floor(Math.random() * opciones.length)];
  }

  /**
   * Estima duración del tratamiento según intensidad y tipo
   */
  static estimarDuracion(tipoTratamiento, intensidad) {
    const duraciones = {
      ortodoncia: {
        30: '10-14 meses (corrección leve)',
        60: '16-22 meses (corrección moderada)',
        90: '24-36 meses (corrección completa)'
      },
      carillas: {
        30: '2-3 sesiones (4-6 semanas)',
        60: '3-4 sesiones (6-8 semanas)',
        90: '4-6 sesiones (8-12 semanas)'
      }
    };

    return duraciones[tipoTratamiento][intensidad] || 'Consultar con especialista';
  }

  /**
   * Genera descripción del resultado esperado
   */
  static generarDescripcionResultado(tipoTratamiento, intensidad) {
    const descripciones = {
      ortodoncia: {
        30: 'Mejora sutil: Dientes más alineados y uniformes',
        60: 'Mejora notable: Sonrisa significativamente más recta y armoniosa',
        90: 'Transformación completa: Alineación perfecta y sonrisa ideal'
      },
      carillas: {
        30: 'Mejora natural: Dientes más blancos y uniformes',
        60: 'Sonrisa radiante: Blanqueamiento notable y forma mejorada',
        90: 'Hollywood Smile: Perfección estética total'
      }
    };

    return descripciones[tipoTratamiento][intensidad];
  }

  // ============================================
  // MÉTODOS AUXILIARES (CONVERTIDOS)
  // ============================================

  /**
   * Convierte ruta absoluta a ruta relativa para guardar en BD
   * @param {string} absolutePath - Ruta absoluta del archivo
   * @returns {string} Ruta relativa desde /public
   */
  static convertirARutaRelativa(absolutePath) {
    const publicIndex = absolutePath.indexOf('public');
    if (publicIndex === -1) {
      return absolutePath;
    }
    return '..'+absolutePath.substring(publicIndex + 6);
  }

  /**
   * Elimina archivos de proyecciones no seleccionadas
   * NOTA: En simulación, NO elimina archivos pre-procesados
   * @param {Array} rutasProyecciones - Array con rutas de las 3 proyecciones
   * @param {string} rutaSeleccionada - Ruta de la proyección elegida
   */
  static async limpiarProyeccionesNoSeleccionadas(rutasProyecciones, rutaSeleccionada) {
    console.log('⚠️ Modo simulación: No se eliminan archivos pre-procesados');
    // En simulación, NO eliminamos las imágenes porque son estáticas
    return;
  }

  /**
   * Genera metadata completa de la proyección para almacenar en BD
   * @param {Object} proyeccion - Datos de la proyección
   * @param {Object} paciente - Datos del paciente
   * @returns {Object} Metadata estructurada
   */
  static generarMetadata(proyeccion, paciente) {
    return {
      version: '1.0',
      fase: 'static_simulation',
      descripcion: 'Simulación estática con imágenes pre-procesadas',
      procesamiento: {
        metodo: proyeccion.metadata?.metodo || 'static_simulation',
        fecha: new Date().toISOString(),
        tiempoGeneracion: Date.now()
      },
      paciente: {
        edad: this.calcularEdad(paciente.fecha_nacimiento),
        sexo: paciente.sexo
      },
      tratamiento: {
        tipo: proyeccion.metadata?.tratamiento,
        intensidad: proyeccion.intensidad,
        diagnostico: proyeccion.diagnostico,
        duracion: proyeccion.duracionEstimada,
        descripcionResultado: proyeccion.descripcionResultado
      }
    };
  }

  /**
   * Calcula edad a partir de fecha de nacimiento
   */
  static calcularEdad(fechaNacimiento) {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    
    return edad;
  }

  /**
   * Obtiene estadísticas de uso del servicio
   */
  static async obtenerEstadisticas() {
    return {
      proyeccionesGeneradas: 0,
      tiempoPromedioGeneracion: 0,
      tasaExito: 0
    };
  }
}

// ============================================
// CÓDIGO ORIGINAL COMENTADO (Mantener en ESM)
// ============================================
/*
static async generarProyecciones(imagePath, tipoTratamiento, opciones = {}) {
  try {
    console.log('🚀 Iniciando generación de proyecciones...');
    console.log('📄 Imagen:', imagePath);
    console.log('💉 Tratamiento:', tipoTratamiento);

    // PASO 1: Validar imagen
    const validacion = await FaceDetectionService.validarImagen(imagePath);
    if (!validacion.valida) {
      throw new Error('Imagen no válida: ' + validacion.problemas.join(', '));
    }

    // PASO 2: Preprocesar imagen
    console.log('🔄 Preprocesando imagen...');
    const imagenPreprocesada = await FaceDetectionService.preprocesarImagen(imagePath);

    // PASO 3: Detectar región de la boca
    console.log('🔍 Detectando región facial...');
    const deteccion = await FaceDetectionService.detectarRegionBoca(imagenPreprocesada);
    
    if (!deteccion.success) {
      throw new Error('No se pudo detectar la región facial');
    }

    // PASO 4: Analizar calidad de la sonrisa
    console.log('📊 Analizando calidad...');
    const analisisCalidad = await FaceDetectionService.analizarCalidadSonrisa(imagenPreprocesada);

    // PASO 5: Generar 3 variaciones (intensidad 30, 60, 90)
    console.log('✨ Generando 3 variaciones del resultado final...');
    const intensidades = [30, 60, 90];
    const proyecciones = [];

    for (const intensidad of intensidades) {
      const nivelTexto = intensidad === 30 ? 'Leve' : intensidad === 60 ? 'Moderado' : 'Avanzado';
      console.log(`  → Simulando resultado ${nivelTexto} (${intensidad}%)...`);
      
      let resultado;
      if (tipoTratamiento === 'ortodoncia') {
        resultado = await DentalProcessorService.aplicarOrtodoncia(
          imagenPreprocesada,
          deteccion.region,
          intensidad
        );
      } else if (tipoTratamiento === 'carillas') {
        resultado = await DentalProcessorService.aplicarCarillas(
          imagenPreprocesada,
          deteccion.region,
          intensidad
        );
      } else {
        throw new Error('Tipo de tratamiento no válido');
      }

      const diagnostico = DentalProcessorService.generarDiagnostico(
        tipoTratamiento,
        analisisCalidad
      );

      const duracion = DentalProcessorService.estimarDuracion(
        tipoTratamiento,
        intensidad
      );

      const descripcion = DentalProcessorService.generarDescripcionResultado(
        tipoTratamiento,
        intensidad
      );

      proyecciones.push({
        intensidad: intensidad,
        nivel: nivelTexto,
        rutaImagen: resultado.path,
        diagnostico: diagnostico,
        duracionEstimada: duracion,
        descripcionResultado: descripcion,
        metadata: {
          ...resultado.metadata,
          analisisCalidad: analisisCalidad,
          regionDetectada: deteccion.region
        }
      });
    }

    // Limpiar archivo preprocesado temporal
    try {
      await fs.unlink(imagenPreprocesada);
    } catch (error) {
      console.warn('No se pudo eliminar archivo temporal:', error.message);
    }

    console.log('✅ Proyecciones generadas exitosamente!');
    console.log('   Simulando resultados finales del tratamiento');

    return {
      success: true,
      proyecciones: proyecciones,
      imagenOriginal: imagePath,
      tipoTratamiento: tipoTratamiento,
      descripcionGeneral: tipoTratamiento === 'ortodoncia' 
        ? 'Estas proyecciones muestran cómo se verían tus dientes DESPUÉS del tratamiento de ortodoncia (alineados y uniformes)'
        : 'Estas proyecciones muestran el resultado final con carillas dentales (sonrisa perfecta)',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error generando proyecciones:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
*/

export default ProyeccionService; // ⬅️ CAMBIADO: module.exports a export default