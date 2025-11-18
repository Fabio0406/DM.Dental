const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const users = [
  {
    ci: 12345678,
    username: 'dr.martinez',
    password: '123456',
    email: 'martinez@dm5.gov.bo',
    nombres: 'Carlos Alberto',
    apellidos: 'Martinez López',
    telefono: '70123456',
    numero_licencia: 'ODT-2024-001'
  },
  {
    ci: 87654321,
    username: 'dra.garcia',
    password: '123456',
    email: 'garcia@dm5.gov.bo',
    nombres: 'María Elena',
    apellidos: 'García Vargas',
    telefono: '70654321',
    numero_licencia: 'ODT-2024-002'
  }
];

const createUsers = async () => {
  try {
    console.log('🌱 Creando usuarios de prueba...');
    
    for (const user of users) {
      // Verificar si el usuario ya existe
      const existingUser = await pool.query(
        'SELECT username FROM usuarios WHERE ci = $1',
        [user.ci]
      );
      
      if (existingUser.rows.length === 0) {
        // Hashear contraseña
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        // Crear usuario
        await pool.query(
          `INSERT INTO usuarios (ci, username, password_hash, email, nombres, apellidos, telefono, numero_licencia) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [user.ci, user.username, hashedPassword, user.email, user.nombres, user.apellidos, user.telefono, user.numero_licencia]
        );
        
        console.log(`✅ Usuario creado: ${user.username} (CI: ${user.ci})`);
      } else {
        console.log(`ℹ️  Usuario ya existe: ${user.username} (CI: ${user.ci})`);
      }
    }
    
    console.log('🎉 Proceso completado');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando usuarios:', error);
    process.exit(1);
  }
};

createUsers();