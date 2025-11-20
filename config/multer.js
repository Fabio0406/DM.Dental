import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs'; // Para operaciones asíncronas de archivos/directorios

// Usar __dirname en ES Modules
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURACIÓN PARA FORMULARIOS (OCR)
// ============================================
const storageFormularios = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../public/uploads/formularios');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}_${timestamp}${ext}`);
  }
});

// ============================================
// CONFIGURACIÓN PARA PACIENTES
// ============================================
const storagePacientes = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../public/uploads/pacientes');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const nombreBase = path.basename(file.originalname, ext);
    cb(null, `${nombreBase}_${timestamp}${ext}`);
  }
});

// ============================================
// FILTRO DE ARCHIVOS DE IMAGEN
// ============================================
const imageFileFilter = function (req, file, cb) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no válido. Solo se permiten imágenes (JPEG, JPG, PNG, WEBP)'), false);
  }
};

// ============================================
// MIDDLEWARE PARA FORMULARIOS (Exportado con nombre)
// ============================================
const uploadFormulario = multer({
  storage: storageFormularios,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// ============================================
// MIDDLEWARE PARA PACIENTES (Exportado con nombre)
// ============================================
const uploadPaciente = multer({
  storage: storagePacientes,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// ============================================
// EXPORTACIÓN CORREGIDA (100% ESM - Exportaciones con nombre)
// ============================================
// Esto resuelve el error "does not provide an export named 'uploadFormulario'"
export {
  uploadFormulario,
  uploadPaciente,
  // Alias para compatibilidad con rutas de proyecciones
  uploadPaciente as uploadProyeccion
};