// 1. Importaciones de módulos principales
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './database.js'; // Asegúrate de añadir la extensión .js

const pgSession = connectPgSimple(session);

export default session({
  store: new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: false
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'dm5.sid', // nombre personalizado de la cookie
  cookie: {
    secure: false, // true en producción con HTTPS
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000 // 8 horas en milisegundos
  }
});