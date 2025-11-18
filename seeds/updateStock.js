const { pool } = require('../config/database');

const updateStock = async () => {
  try {
    console.log('📦 Actualizando stock de insumos...');
    
    // Actualizar stock de los insumos existentes
    const updates = [
      { codigo: '10001', stock: 50 },
      { codigo: '10002', stock: 30 },
      { codigo: '10003', stock: 25 },
      { codigo: '10004', stock: 15 },
      { codigo: '10005', stock: 20 }
    ];

    for (const update of updates) {
      await pool.query(
        'UPDATE insumos SET stock_actual = $1 WHERE codigo = $2',
        [update.stock, update.codigo]
      );
      console.log(`✅ Stock actualizado: ${update.codigo} -> ${update.stock}`);
    }

    console.log('🎉 Stock actualizado correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error actualizando stock:', error);
    process.exit(1);
  }
};

updateStock();