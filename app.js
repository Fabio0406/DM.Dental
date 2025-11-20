import express from 'express';
import path from 'path';
import 'dotenv/config'; // ⬅️ CAMBIADO: require('dotenv').config() a import 'dotenv/config'
import fs from 'fs';   // ⬅️ CAMBIADO: require() a import

// Importar configuraciones (Añadir .js)
import sessionConfig from './config/session.js';
import { testConnection } from './config/database.js'; // Asumo que database.js exporta pool y testConnection

// Importar middleware (Añadir .js)
import { addUserToViews } from './middleware/auth.js';

// Importar rutas (Añadir .js)
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import ocrRoutes from './routes/ocr.js';
import consumoRoutes from './routes/consumos.js';
import kardexRoutes from './routes/kardex.js';
import pacientesRoutes from './routes/pacientes.js';
import proyeccionesRoutes from './routes/proyecciones.js';
import alertasRoutes from './routes/alertas.js';
import solicitudesRoutes from './routes/solicitudes.js';

// Usar __dirname en ES Modules
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar motor de plantillas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware para archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Servir node_modules como archivos estáticos (para librerías frontend)
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Middleware para parsear datos del formulario
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configurar sesiones
app.use(sessionConfig);

// Middleware para agregar datos del usuario a las vistas
app.use(addUserToViews);

app.use((req, res, next) => {
  if (req.body && req.body._method) {
    req.method = req.body._method;
    delete req.body._method;
  }
  next();
});

// Crear directorios necesarios
const directorios = [
  path.join(__dirname, 'public/uploads/formularios'),
  path.join(__dirname, 'public/uploads/pacientes'),
  path.join(__dirname, 'public/uploads/proyecciones')
];

directorios.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('📁 Directorio creado:', dir);
  }
});

// Rutas
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/ocr', ocrRoutes);
app.use('/consumos', consumoRoutes);
app.use('/kardex', kardexRoutes);
app.use('/pacientes', pacientesRoutes);
app.use('/proyecciones', proyeccionesRoutes);
app.use('/alertas', alertasRoutes);
app.use('/solicitudes', solicitudesRoutes);

// Ruta raíz - redirigir según estado de autenticación
app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/auth/login');
  }
});

// Middleware para rutas no encontradas
app.use((req, res) => {
  res.status(404).render('layouts/main', {
    title: 'Página no encontrada',
    body: '<div class="container mt-5"><h1>404 - Página no encontrada</h1><a href="/" class="btn btn-primary">Volver al inicio</a></div>'
  });
});

// Middleware para manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).render('layouts/main', {
    title: 'Error del servidor',
    body: '<div class="container mt-5"><h1>500 - Error interno del servidor</h1><a href="/" class="btn btn-primary">Volver al inicio</a></div>'
  });
});

// Middleware para agregar mensajes de éxito a las vistas
app.use((req, res, next) => {
  res.locals.success = req.session.success || null;
  if (req.session.success) {
    req.session.success = null;
  }
  next();
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`🏥 Sistema Odontológico DM-5 - Entorno: ${process.env.NODE_ENV}`);
  
  // Probar conexión a la base de datos
  await testConnection();
  
  console.log('\n📋 Rutas disponibles:');
  console.log('   🏠 GET  /                    - Página principal');
  console.log('   🔐 GET  /auth/login          - Formulario de login');
  console.log('   🔐 POST /auth/login          - Procesar login');
  console.log('   🚪 POST /auth/logout         - Cerrar sesión');
  console.log('   👤 GET  /users/profile       - Perfil del usuario');
  console.log('   👤 POST /users/profile       - Actualizar perfil');
  console.log('   📊 GET  /dashboard           - Dashboard principal');
  console.log('\n💡 Usuarios de prueba:');
  console.log('   👨‍⚕️ dr.martinez / 123456');
  console.log('   👩‍⚕️ dra.garcia / 123456');
});


export default app; // ⬅️ CAMBIADO: module.exports a export default