-- ============================================================
-- Sistema Odontológico DM-5 - Esquema de base de datos
-- ============================================================
-- Reconstruido a partir de las consultas en models/, controllers/
-- y seeds/ (el repositorio no incluía un script DDL).
-- Se ejecuta automáticamente al crear el contenedor de Postgres
-- (docker-entrypoint-initdb.d), solo si el volumen está vacío.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Usuarios (odontólogos). PK = CI
-- ------------------------------------------------------------
CREATE TABLE usuarios (
  ci               INTEGER PRIMARY KEY,
  username         VARCHAR(50)  NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,
  email            VARCHAR(150) UNIQUE,
  nombres          VARCHAR(100) NOT NULL,
  apellidos        VARCHAR(100) NOT NULL,
  telefono         VARCHAR(20),
  numero_licencia  VARCHAR(50),
  fecha_creacion   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso    TIMESTAMP
);

-- ------------------------------------------------------------
-- Sesiones (connect-pg-simple, createTableIfMissing: false)
-- ------------------------------------------------------------
CREATE TABLE user_sessions (
  sid    VARCHAR      NOT NULL COLLATE "default" PRIMARY KEY,
  sess   JSON         NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_user_sessions_expire ON user_sessions (expire);

-- ------------------------------------------------------------
-- Inventario: categorías e insumos
-- ------------------------------------------------------------
CREATE TABLE categorias_insumo (
  id_categoria_insumo SERIAL PRIMARY KEY,
  nombre              VARCHAR(100) NOT NULL UNIQUE,
  -- Alias: Insumo.findById y Insumo.findLowStock hacen JOIN por
  -- c.id_categoria en lugar de c.id_categoria_insumo.
  id_categoria        INTEGER GENERATED ALWAYS AS (id_categoria_insumo) STORED
);

CREATE TABLE insumos (
  id_insumo            SERIAL PRIMARY KEY,
  codigo               VARCHAR(30)  NOT NULL UNIQUE,
  nombre_generico      VARCHAR(200) NOT NULL,
  forma_farmaceutica   VARCHAR(100),
  concentracion        VARCHAR(100),
  presentacion         VARCHAR(150),
  unidad_medida        VARCHAR(50),
  aplicaciones_minimas INTEGER NOT NULL DEFAULT 10,   -- stock mínimo (en aplicaciones)
  rendimiento_teorico  INTEGER NOT NULL DEFAULT 1,    -- aplicaciones por unidad física
  costo_unitario       NUMERIC(12,2) NOT NULL DEFAULT 0,
  id_categoria         INTEGER REFERENCES categorias_insumo (id_categoria_insumo),
  imagen_url           VARCHAR(255)
);

-- ------------------------------------------------------------
-- Formularios SALMI (ingreso de insumos vía OCR)
-- ------------------------------------------------------------
CREATE TABLE formularios_salmi (
  id_formulario      SERIAL PRIMARY KEY,
  id_usuario         INTEGER REFERENCES usuarios (ci),   -- quien subió la imagen
  estado             VARCHAR(20) NOT NULL DEFAULT 'procesando'
                     CONSTRAINT formularios_salmi_estado_check
                     CHECK (estado IN ('procesando', 'pendiente', 'importado', 'cancelado', 'error')),
  imagen_path        VARCHAR(255),
  -- Datos impresos en el formulario (leídos por OCR y revisados)
  tipo_formulario    VARCHAR(60),    -- CONSUMO INTERNO / DISTRIBUCION INTERNA
  nro_formulario     VARCHAR(50),    -- N°
  nro_documento      VARCHAR(50),    -- N° Documento
  fecha_elaboracion  DATE,           -- Fecha del encabezado
  sede               VARCHAR(100),
  establecimiento    VARCHAR(150),
  botiquin           VARCHAR(150),
  responsable        VARCHAR(150),
  representante      VARCHAR(150),
  elaborado_por      VARCHAR(150),
  observaciones      TEXT,
  total_formulario   NUMERIC(14,2),  -- total impreso, para validar la lectura
  texto_ocr          TEXT,
  error_ocr          TEXT,           -- motivo cuando estado = 'error'
  avisos_ocr         TEXT,           -- advertencias de la lectura (JSON)
  -- Seguimiento
  procesado          BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_escaneo      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_entrega      TIMESTAMP,      -- fecha de importación al kardex
  total              INTEGER DEFAULT 0,  -- ítems importados
  motivo_cancelacion TEXT,
  fecha_cancelacion  TIMESTAMP,
  cancelado_por      INTEGER REFERENCES usuarios (ci)
);
CREATE INDEX idx_formularios_usuario ON formularios_salmi (id_usuario, fecha_escaneo DESC);

CREATE TABLE detalles_formulario_salmi (
  id_detalle        SERIAL PRIMARY KEY,
  id_formulario     INTEGER NOT NULL REFERENCES formularios_salmi (id_formulario) ON DELETE CASCADE,
  id_insumo         INTEGER REFERENCES insumos (id_insumo),
  linea_numero      INTEGER,
  codigo            VARCHAR(30),
  nombre_generico   VARCHAR(200),
  numero_lote       VARCHAR(100),
  fecha_vencimiento DATE,
  cantidad          INTEGER,
  costo_unitario    NUMERIC(12,2),
  costo_total       NUMERIC(14,2),
  forma_farmaceutica VARCHAR(100),
  concentracion     VARCHAR(100),
  confianza         NUMERIC(4,3),
  dudoso            BOOLEAN NOT NULL DEFAULT FALSE,  -- lectura que no cuadra
  observacion       VARCHAR(255),
  procesado         BOOLEAN NOT NULL DEFAULT FALSE
);

-- ------------------------------------------------------------
-- Lotes (stock real, en aplicaciones; consumo FIFO por vencimiento)
-- ------------------------------------------------------------
CREATE TABLE lotes (
  id_lote                  SERIAL PRIMARY KEY,
  id_insumo                INTEGER NOT NULL REFERENCES insumos (id_insumo),
  id_formulario            INTEGER REFERENCES formularios_salmi (id_formulario),
  numero_lote              VARCHAR(100) NOT NULL,
  fecha_vencimiento        DATE NOT NULL,
  cantidad_insumos         INTEGER NOT NULL DEFAULT 0,  -- unidades físicas
  aplicaciones_disponibles INTEGER NOT NULL DEFAULT 0,
  costo_total              NUMERIC(14,2) NOT NULL DEFAULT 0,
  vencimiento_notificado   BOOLEAN NOT NULL DEFAULT FALSE,
  id_usuario               INTEGER REFERENCES usuarios (ci),
  fecha_registro           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lotes_insumo_venc ON lotes (id_insumo, fecha_vencimiento);
CREATE INDEX idx_lotes_numero ON lotes (id_insumo, numero_lote);

-- ------------------------------------------------------------
-- Kardex (uno abierto por insumo y gestión) y sus movimientos
-- ------------------------------------------------------------
CREATE TABLE kardex (
  id_kardex      SERIAL PRIMARY KEY,
  id_insumo      INTEGER NOT NULL REFERENCES insumos (id_insumo),
  numero_kardex  INTEGER NOT NULL,   -- ocrController usa MAX(numero_kardex) + 1
  ubicacion      VARCHAR(150),
  gestion        INTEGER NOT NULL,
  abierto        BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_apertura TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre   TIMESTAMP
);
CREATE INDEX idx_kardex_insumo_abierto ON kardex (id_insumo, abierto);

CREATE TABLE detalle_kardex (
  id_detalle       SERIAL PRIMARY KEY,
  id_kardex        INTEGER NOT NULL REFERENCES kardex (id_kardex) ON DELETE CASCADE,
  id_lote          INTEGER REFERENCES lotes (id_lote),
  fecha            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  entradas         INTEGER NOT NULL DEFAULT 0,
  salidas          INTEGER NOT NULL DEFAULT 0,
  ajustes          INTEGER NOT NULL DEFAULT 0,
  saldo            INTEGER NOT NULL DEFAULT 0,
  clave_doc        VARCHAR(100),
  recibido_de      VARCHAR(150),
  recepcionado_por INTEGER,          -- CI del usuario (JOIN usuarios.ci)
  costo_unitario   NUMERIC(12,2) NOT NULL DEFAULT 0,  -- costo por aplicación
  saldo_valorado   NUMERIC(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_detalle_kardex_kardex ON detalle_kardex (id_kardex, fecha, id_detalle);

-- ------------------------------------------------------------
-- Servicios odontológicos y protocolos (insumos por servicio)
-- ------------------------------------------------------------
CREATE TABLE categorias_servicio (
  id_categoria_servicio SERIAL PRIMARY KEY,
  nombre                VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE servicio (
  id_servicio  SERIAL PRIMARY KEY,
  nombre       VARCHAR(150) NOT NULL UNIQUE,
  id_categoria INTEGER REFERENCES categorias_servicio (id_categoria_servicio)
);

CREATE TABLE servicio_insumos (
  id_servicio               INTEGER NOT NULL REFERENCES servicio (id_servicio) ON DELETE CASCADE,
  id_insumo                 INTEGER NOT NULL REFERENCES insumos (id_insumo) ON DELETE CASCADE,
  aplicaciones_por_servicio INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (id_servicio, id_insumo)
);

-- ------------------------------------------------------------
-- Alertas (desabastecimiento / vencimiento)
-- ------------------------------------------------------------
CREATE TABLE alertas (
  id_alerta      SERIAL PRIMARY KEY,
  titulo         VARCHAR(200) NOT NULL,
  mensaje        TEXT NOT NULL,
  id_usuario     INTEGER REFERENCES usuarios (ci) ON DELETE CASCADE,
  id_insumo      INTEGER REFERENCES insumos (id_insumo) ON DELETE SET NULL,
  leida          BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alertas_usuario_leida ON alertas (id_usuario, leida);

-- ------------------------------------------------------------
-- Solicitudes de pedido
-- ------------------------------------------------------------
CREATE TABLE solicitudes_pedido (
  id_solicitud  SERIAL PRIMARY KEY,
  id_usuario    INTEGER NOT NULL REFERENCES usuarios (ci),
  nro_solicitud VARCHAR(50) NOT NULL UNIQUE,
  fecha         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  material      VARCHAR(100) DEFAULT 'ODONTOLOGICO'
);

CREATE TABLE detalles_solicitud (
  id_detalle_solicitud SERIAL PRIMARY KEY,
  id_solicitud         INTEGER NOT NULL REFERENCES solicitudes_pedido (id_solicitud) ON DELETE CASCADE,
  id_insumo            INTEGER NOT NULL REFERENCES insumos (id_insumo),
  cantidad             INTEGER NOT NULL,
  costo_total          NUMERIC(14,2) NOT NULL DEFAULT 0
);
