const { pool } = require('../config/database');

const categorias = [
  { nombre: 'Anestésicos' },
  { nombre: 'Materiales de Obturación' },
  { nombre: 'Material Preventivo' },
  { nombre: 'Material Quirúrgico' },
  { nombre: 'Material de Diagnóstico' }
];

const insumos = [
  { 
    codigo: 'IA111', 
    nombre_generico: 'Lidocaína al 2% con Epinefrina', 
    forma_farmaceutica: 'Cartucho dental',
    concentracion: '2% + 1:100.000',
    presentacion: 'Caja x 50 cartuchos', 
    unidad_medida: 'Cartucho',
    aplicaciones_minimas: 50,
    rendimiento_teorico: 1,
    costo_unitario: 12,
    categoria: 'Anestésicos'
  },
  { 
    codigo: 'IM201', 
    nombre_generico: 'Ionómero de vidrio', 
    forma_farmaceutica: 'Polvo + Líquido',
    concentracion: '12.5 g',
    presentacion: 'Frasco x 15g', 
    unidad_medida: 'Frasco',
    aplicaciones_minimas: 10,
    rendimiento_teorico: 15,
    costo_unitario: 45,
    categoria: 'Materiales de Obturación'
  },
  { 
    codigo: 'IM202', 
    nombre_generico: 'Resina compuesta fotopolimerizable', 
    forma_farmaceutica: 'Jeringa',
    concentracion: '4 g',
    presentacion: 'Jeringa x 4g', 
    unidad_medida: 'Jeringa',
    aplicaciones_minimas: 15,
    rendimiento_teorico: 8,
    costo_unitario: 36,
    categoria: 'Materiales de Obturación'
  },
  { 
    codigo: 'IP301', 
    nombre_generico: 'Flúor gel acidulado', 
    forma_farmaceutica: 'Gel',
    concentracion: '1.23%',
    presentacion: 'Tubo x 90g', 
    unidad_medida: 'Tubo',
    aplicaciones_minimas: 20,
    rendimiento_teorico: 30,
    costo_unitario: 29,
    categoria: 'Material Preventivo'
  },
  { 
    codigo: 'IP302', 
    nombre_generico: 'Pasta profiláctica', 
    forma_farmaceutica: 'Pasta',
    concentracion: 'N/A',
    presentacion: 'Frasco x 250g', 
    unidad_medida: 'Frasco',
    aplicaciones_minimas: 30,
    rendimiento_teorico: 50,
    costo_unitario: 22,
    categoria: 'Material Preventivo'
  }
];

const createInsumos = async () => {
  try {
    console.log('🌱 Creando categorías e insumos de prueba...');

    // Crear categorías
    for (const cat of categorias) {
      const existingCat = await pool.query(
        'SELECT id_categoria_insumo FROM categorias_insumo WHERE nombre = $1',
        [cat.nombre]
      );

      if (existingCat.rows.length === 0) {
        await pool.query(
          'INSERT INTO categorias_insumo (nombre) VALUES ($1)',
          [cat.nombre]
        );
        console.log(`✅ Categoría creada: ${cat.nombre}`);
      }
    }

    // Crear insumos
    for (const insumo of insumos) {
      const existingInsumo = await pool.query(
        'SELECT codigo FROM insumos WHERE codigo = $1',
        [insumo.codigo]
      );

      if (existingInsumo.rows.length === 0) {
        // Buscar ID de categoría
        const categoria = await pool.query(
          'SELECT id_categoria_insumo FROM categorias_insumo WHERE nombre = $1',
          [insumo.categoria]
        );

        await pool.query(
          `INSERT INTO insumos 
           (codigo, nombre_generico, forma_farmaceutica, concentracion, presentacion, 
            unidad_medida, aplicaciones_minimas, rendimiento_teorico, costo_unitario, id_categoria) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            insumo.codigo, 
            insumo.nombre_generico, 
            insumo.forma_farmaceutica,
            insumo.concentracion,
            insumo.presentacion, 
            insumo.unidad_medida,
            insumo.aplicaciones_minimas,
            insumo.rendimiento_teorico,
            insumo.costo_unitario,
            categoria.rows[0].id_categoria_insumo
          ]
        );
        console.log(`✅ Insumo creado: ${insumo.codigo} - ${insumo.nombre_generico}`);
      }
    }

    console.log('🎉 Insumos de prueba creados');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando insumos:', error);
    process.exit(1);
  }
};

createInsumos();