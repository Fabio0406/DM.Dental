const { pool } = require('../config/database');

const categoriasServicio = [
  { nombre: 'Odontología Preventiva' },
  { nombre: 'Odontología Restauradora' },
  { nombre: 'Cirugía Oral' },
  { nombre: 'Periodoncia' }
];

const servicios = [
  { nombre: 'Profilaxis Dental', categoria: 'Odontología Preventiva' },
  { nombre: 'Aplicación de Flúor', categoria: 'Odontología Preventiva' },
  { nombre: 'Sellantes de Fosas y Fisuras', categoria: 'Odontología Preventiva' },
  
  { nombre: 'Obturación Simple', categoria: 'Odontología Restauradora' },
  { nombre: 'Obturación Compuesta', categoria: 'Odontología Restauradora' },
  { nombre: 'Reconstrucción Dental', categoria: 'Odontología Restauradora' },
  
  { nombre: 'Exodoncia Simple', categoria: 'Cirugía Oral' },
  { nombre: 'Exodoncia Compleja', categoria: 'Cirugía Oral' },
  { nombre: 'Extracción de Cordal', categoria: 'Cirugía Oral' },
  
  { nombre: 'Raspado y Alisado Radicular', categoria: 'Periodoncia' },
  { nombre: 'Curetaje Periodontal', categoria: 'Periodoncia' }
];

const createServicios = async () => {
  try {
    console.log('🏥 Creando categorías de servicio y servicios...');

    // Crear categorías de servicio
    for (const cat of categoriasServicio) {
      const existingCat = await pool.query(
        'SELECT id_categoria_servicio FROM categorias_servicio WHERE nombre = $1',
        [cat.nombre]
      );

      if (existingCat.rows.length === 0) {
        await pool.query(
          'INSERT INTO categorias_servicio (nombre) VALUES ($1)',
          [cat.nombre]
        );
        console.log(`✅ Categoría de servicio creada: ${cat.nombre}`);
      } else {
        console.log(`ℹ️  Categoría ya existe: ${cat.nombre}`);
      }
    }

    // Crear servicios
    for (const servicio of servicios) {
      const existingServicio = await pool.query(
        'SELECT id_servicio FROM servicio WHERE nombre = $1',
        [servicio.nombre]
      );

      if (existingServicio.rows.length === 0) {
        // Buscar ID de categoría
        const categoria = await pool.query(
          'SELECT id_categoria_servicio FROM categorias_servicio WHERE nombre = $1',
          [servicio.categoria]
        );

        if (categoria.rows.length > 0) {
          await pool.query(
            'INSERT INTO servicio (nombre, id_categoria) VALUES ($1, $2)',
            [servicio.nombre, categoria.rows[0].id_categoria_servicio]
          );
          console.log(`✅ Servicio creado: ${servicio.nombre}`);
        } else {
          console.warn(`⚠️  Categoría no encontrada: ${servicio.categoria}`);
        }
      } else {
        console.log(`ℹ️  Servicio ya existe: ${servicio.nombre}`);
      }
    }

    console.log('🎉 Servicios creados exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando servicios:', error);
    process.exit(1);
  }
};

createServicios();