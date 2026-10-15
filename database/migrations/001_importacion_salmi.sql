-- ============================================================
-- 001 · Importación real de formularios SALMI (OCR) y cancelación
-- ============================================================
-- Idempotente: se puede ejecutar más de una vez.
--   npm run db:migrate
-- En instalaciones nuevas no hace falta: 01-schema.sql ya lo incluye.
-- ============================================================

BEGIN;

-- Estado del flujo. Solo la primera vez se inicializa a partir de 'procesado'
-- (en ejecuciones posteriores no debe tocar formularios que se están leyendo).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'formularios_salmi' AND column_name = 'estado') THEN
    ALTER TABLE formularios_salmi ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'procesando';
    UPDATE formularios_salmi SET estado = CASE WHEN procesado THEN 'importado' ELSE 'pendiente' END;
  END IF;
END $$;

-- Datos del encabezado y cancelación
ALTER TABLE formularios_salmi
  ADD COLUMN IF NOT EXISTS id_usuario         INTEGER REFERENCES usuarios (ci),
  ADD COLUMN IF NOT EXISTS tipo_formulario    VARCHAR(60),
  ADD COLUMN IF NOT EXISTS nro_documento      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS establecimiento    VARCHAR(150),
  ADD COLUMN IF NOT EXISTS botiquin           VARCHAR(150),
  ADD COLUMN IF NOT EXISTS elaborado_por      VARCHAR(150),
  ADD COLUMN IF NOT EXISTS observaciones      TEXT,
  ADD COLUMN IF NOT EXISTS total_formulario   NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS texto_ocr          TEXT,
  ADD COLUMN IF NOT EXISTS error_ocr          TEXT,
  ADD COLUMN IF NOT EXISTS avisos_ocr         TEXT,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_cancelacion  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelado_por      INTEGER REFERENCES usuarios (ci);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'formularios_salmi_estado_check') THEN
    ALTER TABLE formularios_salmi ADD CONSTRAINT formularios_salmi_estado_check
      CHECK (estado IN ('procesando', 'pendiente', 'importado', 'cancelado', 'error'));
  END IF;
END $$;

-- Antes 'representante' guardaba el CI de quien subía el formulario;
-- ahora ese dato va en id_usuario y 'representante' es el nombre impreso.
UPDATE formularios_salmi
   SET id_usuario = representante::int,
       representante = NULL
 WHERE id_usuario IS NULL
   AND representante ~ '^[0-9]+$'
   AND EXISTS (SELECT 1 FROM usuarios u WHERE u.ci = representante::int);

-- Ítems leídos: datos para crear insumos nuevos y marca de lectura dudosa
ALTER TABLE detalles_formulario_salmi
  ADD COLUMN IF NOT EXISTS forma_farmaceutica VARCHAR(100),
  ADD COLUMN IF NOT EXISTS concentracion      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS confianza          NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS dudoso             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS observacion        VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_formularios_usuario ON formularios_salmi (id_usuario, fecha_escaneo DESC);
CREATE INDEX IF NOT EXISTS idx_lotes_numero ON lotes (id_insumo, numero_lote);

COMMIT;
