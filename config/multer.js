const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

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
    const nombreBase = path.basename(file.originalname, ext); // Extrae "mi_foto_a"
    cb(null, `${nombreBase}_${timestamp}${ext}`);
    // Resultado: mi_foto_a_1698765432.jpg ✓ Conserva "_a"
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
// MIDDLEWARE PARA FORMULARIOS
// ============================================
const uploadFormulario = multer({
  storage: storageFormularios,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// ============================================
// MIDDLEWARE PARA PACIENTES
// ============================================
const uploadPaciente = multer({
  storage: storagePacientes,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// ============================================
// EXPORTACIÓN COMPATIBLE CON TODO
// ============================================

// Exportación por defecto (para routes/ocr.js)
module.exports = uploadFormulario;

// Named exports (para routes/pacientes.js y proyecciones.js)
module.exports.uploadFormulario = uploadFormulario;
module.exports.uploadPaciente = uploadPaciente;
module.exports.uploadProyeccion = uploadPaciente; // Reutilizamos la config