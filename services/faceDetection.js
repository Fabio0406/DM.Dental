import sharp from 'sharp'; // ⬅️ CAMBIADO: require() a import
import path from 'path';
import fs from 'fs';
// CORRECCIÓN: Importar y definir __dirname para ESM
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// FIN CORRECCIÓN
/**
 * Servicio de Detección Facial - FASE 1
 * Usa análisis de imagen con Sharp para detectar la región de la boca
 * En Fase 2 se reemplazará con TensorFlow.js para mayor precisión
 */

class FaceDetectionService {

  /**
   * Detecta la región de la boca en una imagen
   * @param {string} imagePath - Ruta de la imagen
   * @returns {Object} Coordenadas de la región detectada
   */
  static async detectarRegionBoca(imagePath) {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();

      // FASE 1: Estimación basada en proporciones faciales estándar
      // En una foto frontal de sonrisa, la boca suele estar:
      // - Horizontalmente: centro de la imagen (con margen)
      // - Verticalmente: en el tercio inferior del rostro

      const width = metadata.width;
      const height = metadata.height;

      // Región estimada de la boca (ROI - Region of Interest)
      const mouthRegion = {
        // Centro horizontal con 40% del ancho
        left: Math.floor(width * 0.3),
        width: Math.floor(width * 0.4),

        // Tercio inferior con 20% de altura
        top: Math.floor(height * 0.55),
        height: Math.floor(height * 0.25),

        // Coordenadas del centro
        centerX: Math.floor(width * 0.5),
        centerY: Math.floor(height * 0.67),

        // Dimensiones originales
        imageWidth: width,
        imageHeight: height
      };

      return {
        success: true,
        region: mouthRegion,
        metadata: {
          width,
          height,
          format: metadata.format,
          method: 'estimation_phase1'
        }
      };

    } catch (error) {
      console.error('Error en detección facial:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extrae la región de la boca de la imagen
   * @param {string} imagePath - Ruta de la imagen
   * @param {Object} region - Coordenadas de la región
   * @returns {Buffer} Buffer de la imagen extraída
   */
  static async extraerRegionBoca(imagePath, region) {
    try {
      return await sharp(imagePath)
        .extract({
          left: region.left,
          top: region.top,
          width: region.width,
          height: region.height
        })
        .toBuffer();

    } catch (error) {
      console.error('Error al extraer región:', error);
      throw error;
    }
  }

  /**
   * Valida que la imagen sea adecuada para procesamiento
   * @param {string} imagePath - Ruta de la imagen
   * @returns {Object} Resultado de la validación
   */
  static async validarImagen(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();

      const validacion = {
        valida: true,
        problemas: []
      };

      // Verificar dimensiones mínimas
      if (metadata.width < 400 || metadata.height < 400) {
        validacion.valida = false;
        validacion.problemas.push('La imagen es demasiado pequeña (mínimo 400x400px)');
      }

      // Verificar que no sea demasiado grande
      if (metadata.width > 4000 || metadata.height > 4000) {
        validacion.problemas.push('La imagen es muy grande, se redimensionará');
      }

      // Verificar formato
      const formatosPermitidos = ['jpeg', 'jpg', 'png', 'webp'];
      if (!formatosPermitidos.includes(metadata.format)) {
        validacion.valida = false;
        validacion.problemas.push('Formato de imagen no soportado');
      }

      validacion.metadata = metadata;
      return validacion;

    } catch (error) {
      return {
        valida: false,
        problemas: ['Error al leer la imagen: ' + error.message]
      };
    }
  }

  /**
   * Preprocesa la imagen para análisis óptimo
   * @param {string} imagePath - Ruta de la imagen
   * @returns {string} Ruta de la imagen procesada
   */
  static async preprocesarImagen(imagePath) {
    try {
      const outputPath = imagePath.replace(
        path.extname(imagePath),
        '_preprocessed' + path.extname(imagePath)
      );

      await sharp(imagePath)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .normalize() // Normalizar contraste
        .sharpen() // Aumentar nitidez
        .toFile(outputPath);

      return outputPath;

    } catch (error) {
      console.error('Error en preprocesamiento:', error);
      throw error;
    }
  }

  /**
   * Analiza la calidad de la sonrisa en la imagen
   * Fase 1: Análisis básico de brillo y contraste
   * @param {string} imagePath - Ruta de la imagen
   * @returns {Object} Métricas de calidad
   */
  static async analizarCalidadSonrisa(imagePath) {
    try {
      const stats = await sharp(imagePath).stats();

      // Analizar brillo promedio (luminosidad)
      const brightness = (
        stats.channels[0].mean +
        stats.channels[1].mean +
        stats.channels[2].mean
      ) / 3;

      // Analizar contraste (desviación estándar)
      const contrast = (
        stats.channels[0].stdev +
        stats.channels[1].stdev +
        stats.channels[2].stdev
      ) / 3;

      return {
        brightness: brightness,
        contrast: contrast,
        quality: brightness > 100 && contrast > 30 ? 'buena' : 'regular',
        recomendaciones: this.generarRecomendaciones(brightness, contrast)
      };

    } catch (error) {
      console.error('Error en análisis de calidad:', error);
      return null;
    }
  }

  /**
   * Genera recomendaciones basadas en el análisis
   */
  static generarRecomendaciones(brightness, contrast) {
    const recomendaciones = [];

    if (brightness < 80) {
      recomendaciones.push('La imagen está muy oscura');
    } else if (brightness > 180) {
      recomendaciones.push('La imagen está muy brillante');
    }

    if (contrast < 20) {
      recomendaciones.push('La imagen tiene poco contraste');
    }

    if (recomendaciones.length === 0) {
      recomendaciones.push('Imagen óptima para procesamiento');
    }

    return recomendaciones;
  }
}

export default FaceDetectionService; // ⬅️ CAMBIADO: module.exports a export default