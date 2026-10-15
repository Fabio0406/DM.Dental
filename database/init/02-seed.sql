-- ============================================================
-- Sistema Odontológico DM-5 - Datos iniciales de desarrollo
-- ============================================================
-- Basado en seeds/createUsers.js y en los
-- seeds eliminados del historial (createInsumos, createServicios,
-- createServicioInsumos, createLotes, createKardex).
-- Las fechas de vencimiento son relativas a CURRENT_DATE para que
-- haya stock vigente y algunas alertas al levantar la base.
-- ============================================================

-- Usuarios de prueba (contraseña: 123456, hash bcrypt compatible con bcryptjs)
INSERT INTO usuarios (ci, username, password_hash, email, nombres, apellidos, telefono, numero_licencia) VALUES
  (12345678, 'dr.martinez', crypt('123456', gen_salt('bf', 10)), 'martinez@dm5.gov.bo', 'Carlos Alberto', 'Martinez López', '70123456', 'ODT-2024-001'),
  (87654321, 'dra.garcia',  crypt('123456', gen_salt('bf', 10)), 'garcia@dm5.gov.bo',   'María Elena',    'García Vargas',  '70654321', 'ODT-2024-002');

-- Categorías de insumo. El orden importa: ocrController crea insumos
-- nuevos con id_categoria = 1, y la revisión OCR usa los ids 1..7.
INSERT INTO categorias_insumo (nombre) VALUES
  ('Anestésicos'),               -- 1
  ('Materiales de Obturación'),  -- 2
  ('Material Preventivo'),       -- 3
  ('Material Quirúrgico'),       -- 4
  ('Material de Diagnóstico'),   -- 5
  ('Material Descartable'),      -- 6
  ('Mantenimiento y Otros');     -- 7

INSERT INTO insumos (codigo, nombre_generico, forma_farmaceutica, concentracion, presentacion, unidad_medida, aplicaciones_minimas, rendimiento_teorico, costo_unitario, id_categoria) VALUES
  ('IA111', 'Lidocaína al 2% con Epinefrina',      'Cartucho dental', '2% + 1:100.000', 'Caja x 50 cartuchos', 'Cartucho', 50,  1, 12, 1),
  ('IM201', 'Ionómero de vidrio',                  'Polvo + Líquido', '12.5 g',         'Frasco x 15g',        'Frasco',   10, 15, 45, 2),
  ('IM202', 'Resina compuesta fotopolimerizable',  'Jeringa',         '4 g',            'Jeringa x 4g',        'Jeringa',  15,  8, 36, 2),
  ('IP301', 'Flúor gel acidulado',                 'Gel',             '1.23%',          'Tubo x 90g',          'Tubo',     20, 30, 29, 3),
  ('IP302', 'Pasta profiláctica',                  'Pasta',           'N/A',            'Frasco x 250g',       'Frasco',   30, 50, 22, 3);

-- Servicios y protocolos
INSERT INTO categorias_servicio (nombre) VALUES
  ('Odontología Preventiva'), ('Odontología Restauradora'), ('Cirugía Oral'), ('Periodoncia');

INSERT INTO servicio (nombre, id_categoria)
SELECT s.nombre, c.id_categoria_servicio
FROM (VALUES
  ('Profilaxis Dental',            'Odontología Preventiva'),
  ('Aplicación de Flúor',          'Odontología Preventiva'),
  ('Sellantes de Fosas y Fisuras', 'Odontología Preventiva'),
  ('Obturación Simple',            'Odontología Restauradora'),
  ('Obturación Compuesta',         'Odontología Restauradora'),
  ('Reconstrucción Dental',        'Odontología Restauradora'),
  ('Exodoncia Simple',             'Cirugía Oral'),
  ('Exodoncia Compleja',           'Cirugía Oral'),
  ('Extracción de Cordal',         'Cirugía Oral'),
  ('Raspado y Alisado Radicular',  'Periodoncia'),
  ('Curetaje Periodontal',         'Periodoncia')
) AS s(nombre, categoria)
JOIN categorias_servicio c ON c.nombre = s.categoria;

INSERT INTO servicio_insumos (id_servicio, id_insumo, aplicaciones_por_servicio)
SELECT s.id_servicio, i.id_insumo, r.aplicaciones
FROM (VALUES
  ('Profilaxis Dental',            'IP302', 1),
  ('Profilaxis Dental',            'IP301', 1),
  ('Aplicación de Flúor',          'IP301', 1),
  ('Sellantes de Fosas y Fisuras', 'IM202', 1),
  ('Obturación Simple',            'IA111', 2),
  ('Obturación Simple',            'IM201', 1),
  ('Obturación Compuesta',         'IA111', 2),
  ('Obturación Compuesta',         'IM202', 1),
  ('Reconstrucción Dental',        'IA111', 2),
  ('Reconstrucción Dental',        'IM202', 2),
  ('Reconstrucción Dental',        'IM201', 1),
  ('Exodoncia Simple',             'IA111', 2),
  ('Exodoncia Compleja',           'IA111', 3),
  ('Extracción de Cordal',         'IA111', 4),
  ('Raspado y Alisado Radicular',  'IA111', 2),
  ('Raspado y Alisado Radicular',  'IP302', 1),
  ('Curetaje Periodontal',         'IA111', 2)
) AS r(servicio, codigo, aplicaciones)
JOIN servicio s ON s.nombre = r.servicio
JOIN insumos  i ON i.codigo = r.codigo;

-- Lotes (stock en aplicaciones = unidades físicas x rendimiento_teorico)
INSERT INTO lotes (id_insumo, numero_lote, fecha_vencimiento, cantidad_insumos, aplicaciones_disponibles, costo_total, id_usuario)
SELECT i.id_insumo, l.numero_lote, CURRENT_DATE + l.dias, l.cantidad, l.aplicaciones, l.costo, 12345678
FROM (VALUES
  ('IA111', 'LID2024001', 365, 2, 100, 1200),
  ('IA111', 'LID2024002',  20, 1,  50,  600),  -- próximo a vencer (alerta URGENTE/MODERADO)
  ('IM201', 'ION2024001', 200, 3,  45,  135),
  ('IM202', 'RES2024001', 150, 2,  12,   72),  -- bajo el mínimo (alerta de desabastecimiento)
  ('IP301', 'FLU2024001', 540, 4, 120,  116),
  ('IP302', 'PAS2024001',  50, 3, 150,   66)   -- vence en < 60 días (alerta preventiva)
) AS l(codigo, numero_lote, dias, cantidad, aplicaciones, costo)
JOIN insumos i ON i.codigo = l.codigo;

-- Un kardex abierto por insumo para la gestión actual
INSERT INTO kardex (id_insumo, numero_kardex, ubicacion, gestion, abierto)
SELECT id_insumo, 1, 'CONSULTORIO ODONTOLOGÍA - DM5', EXTRACT(YEAR FROM CURRENT_DATE)::int, TRUE
FROM insumos;

-- Movimiento de ENTRADA por cada lote, con saldo acumulado por kardex
INSERT INTO detalle_kardex (id_kardex, id_lote, fecha, entradas, salidas, ajustes, saldo, clave_doc, recibido_de, recepcionado_por, costo_unitario, saldo_valorado)
SELECT k.id_kardex,
       l.id_lote,
       CURRENT_TIMESTAMP,
       l.aplicaciones_disponibles,
       0, 0,
       SUM(l.aplicaciones_disponibles) OVER w,
       'LOTE-' || l.numero_lote,
       'FIM',
       12345678,
       ROUND(l.costo_total / NULLIF(l.aplicaciones_disponibles, 0), 2),
       SUM(l.costo_total) OVER w
FROM lotes l
JOIN kardex k ON k.id_insumo = l.id_insumo AND k.abierto
WINDOW w AS (PARTITION BY l.id_insumo ORDER BY l.fecha_vencimiento, l.id_lote)
ORDER BY l.id_insumo, l.fecha_vencimiento, l.id_lote;
