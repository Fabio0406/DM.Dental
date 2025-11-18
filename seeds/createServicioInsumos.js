const { pool } = require('../config/database');

// Relaciones servicio-insumos con cantidad de aplicaciones por servicio
const servicioInsumos = [
  // Profilaxis Dental
  { servicio: 'Profilaxis Dental', insumo: 'IP302', aplicaciones: 1 }, // Pasta profiláctica
  { servicio: 'Profilaxis Dental', insumo: 'IP301', aplicaciones: 1 }, // Flúor gel
  
  // Aplicación de Flúor
  { servicio: 'Aplicación de Flúor', insumo: 'IP301', aplicaciones: 1 }, // Flúor gel
  
  // Sellantes de Fosas y Fisuras
  { servicio: 'Sellantes de Fosas y Fisuras', insumo: 'IM202', aplicaciones: 1 }, // Resina
  
  // Obturación Simple
  { servicio: 'Obturación Simple', insumo: 'IA111', aplicaciones: 2 }, // Lidocaína
  { servicio: 'Obturación Simple', insumo: 'IM201', aplicaciones: 1 }, // Ionómero
  
  // Obturación Compuesta
  { servicio: 'Obturación Compuesta', insumo: 'IA111', aplicaciones: 2 }, // Lidocaína
  { servicio: 'Obturación Compuesta', insumo: 'IM202', aplicaciones: 1 }, // Resina
  
  // Reconstrucción Dental
  { servicio: 'Reconstrucción Dental', insumo: 'IA111', aplicaciones: 2 }, // Lidocaína
  { servicio: 'Reconstrucción Dental', insumo: 'IM202', aplicaciones: 2 }, // Resina
  { servicio: 'Reconstrucción Dental', insumo: 'IM201', aplicaciones: 1 }, // Ionómero
  
  // Exodoncia Simple
  { servicio: 'Exodoncia Simple', insumo: 'IA111', aplicaciones: 2 }, // Lidocaína
  
  // Exodoncia Compleja
  { servicio: 'Exodoncia Compleja', insumo: 'IA111', aplicaciones: 3 }, // Lidocaína
  
  // Extracción de Cordal
  { servicio: 'Extracción de Cordal', insumo: 'IA111', aplicaciones: 4 }, // Lidocaína
  
  // Raspado y Alisado Radicular
  { servicio: 'Raspado y Alisado Radicular', insumo: 'IA111', aplicaciones: 2 }, // Lidocaína
  { servicio: 'Raspado y Alisado Radicular', insumo: 'IP302', aplicaciones: 1 }, // Pasta profiláctica
  
  // Curetaje Periodontal
  { servicio: 'Curetaje Periodontal', insumo: 'IA111', aplicaciones: 2 }, // Lidocaína
];

const createServicioInsumos = async () => {
  try {
    console.log('🧬 Creando relaciones servicio-insumos...');
    
    for (const relacion of servicioInsumos) {
      // Obtener ID del servicio
      const servicio = await pool.query(
        'SELECT id_servicio FROM servicio WHERE nombre = $1',
        [relacion.servicio]
      );

      if (servicio.rows.length === 0) {
        console.warn(`⚠️  Servicio no encontrado: ${relacion.servicio}`);
        continue;
      }

      // Obtener ID del insumo
      const insumo = await pool.query(
        'SELECT id_insumo FROM insumos WHERE codigo = $1',
        [relacion.insumo]
      );

      if (insumo.rows.length === 0) {
        console.warn(`⚠️  Insumo no encontrado: ${relacion.insumo}`);
        continue;
      }

      const idServicio = servicio.rows[0].id_servicio;
      const idInsumo = insumo.rows[0].id_insumo;

      // Verificar si ya existe
      const existe = await pool.query(
        'SELECT * FROM servicio_insumos WHERE id_servicio = $1 AND id_insumo = $2',
        [idServicio, idInsumo]
      );

      if (existe.rows.length === 0) {
        await pool.query(
          `INSERT INTO servicio_insumos (id_servicio, id_insumo, aplicaciones_por_servicio) 
           VALUES ($1, $2, $3)`,
          [idServicio, idInsumo, relacion.aplicaciones]
        );
        console.log(`✅ Relación creada: ${relacion.servicio} - ${relacion.insumo} (${relacion.aplicaciones} aplicaciones)`);
      } else {
        console.log(`ℹ️  Relación ya existe: ${relacion.servicio} - ${relacion.insumo}`);
      }
    }

    console.log('🎉 Relaciones servicio-insumos creadas exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando relaciones:', error);
    process.exit(1);
  }
};

createServicioInsumos();