# DM.Dental

Sistema web de gestión de inventario de insumos odontológicos para el consultorio de odontología del **C.S. Integral Municipal DM-5** (Red Norte, Santa Cruz). Controla el stock por **aplicaciones**, lleva el **kardex valorado** de cada insumo, registra el consumo por prestación y digitaliza el ingreso de insumos a partir de los formularios **SALMI**.

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Dashboard** | Indicadores de stock, tasa de desabastecimiento, stock por categoría, lotes por vencer y alertas pendientes. |
| **Ingreso de insumos (SALMI)** | Se sube o se toma una foto del formulario (Consumo Interno / Distribución Interna). El OCR local lee el encabezado y la tabla; el usuario revisa, corrige y confirma la importación al kardex. Se puede cancelar antes de importar. |
| **Registrar consumo** | Al elegir una prestación se cargan los insumos de su protocolo; se ajustan las aplicaciones y se descuentan por **FIFO** (primero el lote que vence antes). |
| **Kardex** | Kardex valorado por insumo (formato oficial): entradas, salidas, ajustes, saldo y saldo valorado. Exportación a PDF. |
| **Historial y estadísticas** | Salidas registradas por usuario y consumo por insumo en distintos períodos. |
| **Solicitudes de pedido** | Arma pedidos de insumos con totales y los exporta a PDF. |
| **Alertas** | Desabastecimiento (stock ≤ mínimo) y vencimiento de lotes (60, 30 y 10 días). |

### Cómo funciona el inventario

- Cada **insumo** tiene un `rendimiento_teorico`: cuántas aplicaciones rinde una unidad física (p. ej. un frasco de ionómero = 15 aplicaciones).
- El stock real vive en los **lotes** (`aplicaciones_disponibles`); el consumo descuenta del lote vigente que vence primero.
- Todo movimiento queda en `detalle_kardex`, asociado al kardex abierto del insumo.

### Lectura de formularios SALMI (OCR)

La lectura se hace **en el propio servidor, sin enviar la imagen a internet**, con [PaddleOCR PP-OCRv6](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) sobre ONNX Runtime. Los modelos (~31 MB) vienen incluidos en [`ocr-models/`](ocr-models).

[`services/salmiParser.js`](services/salmiParser.js) reconstruye la tabla a partir de la posición de cada texto: ubica las columnas por sus títulos, sigue cada fila aunque la hoja esté inclinada o doblada, corrige confusiones típicas en los códigos (O/0, I/1) y valida cantidad × costo y la suma contra el total impreso.

En la revisión cada ítem se marca como **nuevo**, **vencido**, **lote ya registrado** o **por revisar**, y el selector de catálogo solo sugiere insumos parecidos por nombre genérico. Nada entra al kardex sin confirmación del usuario.

## Tecnologías

- **Backend:** Node.js (ESM) · Express 5 · express-session + connect-pg-simple
- **Base de datos:** PostgreSQL 16 (Docker) · `pg`
- **Vistas:** EJS · Bootstrap 5 · Lucide · Chart.js
- **OCR:** ppu-paddle-ocr · onnxruntime-node · sharp
- **PDF:** Puppeteer

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (probado con 24)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) para la base de datos

## Instalación

```bash
git clone <url-del-repositorio>
cd DM.Dental
npm install
```

Crear el archivo `.env` a partir del ejemplo y, si hace falta, cambiar el secreto de sesión:

```bash
cp .env.example .env
```

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto de la aplicación |
| `NODE_ENV` | `development` | Entorno |
| `SESSION_SECRET` | — | Secreto para firmar la cookie de sesión |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | Servidor PostgreSQL |
| `DB_NAME` | `sistema_dm5` | Base de datos |
| `DB_USER` / `DB_PASS` | `postgres` / `postgres` | Credenciales |

Levantar la base de datos (la primera vez crea las tablas y carga datos de prueba):

```bash
npm run db:up
```

Iniciar la aplicación:

```bash
npm run dev
```

Abrir <http://localhost:3000>.

### Usuarios de prueba

| Usuario | Contraseña |
|---|---|
| `dr.martinez` | `123456` |
| `dra.garcia` | `123456` |

## Base de datos

El contenedor `dm5-postgres` ejecuta automáticamente los scripts de [`database/init/`](database/init) cuando el volumen está vacío:

- [`01-schema.sql`](database/init/01-schema.sql): estructura completa (15 tablas, índices y restricciones).
- [`02-seed.sql`](database/init/02-seed.sql): datos de prueba (usuarios, categorías, insumos, prestaciones con sus protocolos, lotes y kardex inicial). Las fechas de vencimiento son relativas al día de carga.

Para una base creada antes de la importación SALMI, aplicar la migración (se puede ejecutar más de una vez):

```bash
npm run db:migrate
```

### Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia la app con recarga automática (nodemon) |
| `npm start` | Inicia la app |
| `npm run db:up` | Levanta PostgreSQL en Docker |
| `npm run db:down` | Detiene el contenedor (conserva los datos) |
| `npm run db:reset` | **Borra la base** y la vuelve a crear con el esquema y los datos de prueba |
| `npm run db:migrate` | Aplica [`001_importacion_salmi.sql`](database/migrations/001_importacion_salmi.sql) |
| `npm run db:psql` | Abre una consola `psql` en la base |
| `npm run seed` | Crea los usuarios de prueba si no existen |

## Estructura

```
├── app.js                  # Configuración de Express y rutas
├── config/                 # Conexión a PostgreSQL, sesiones y subida de archivos
├── controllers/            # Lógica de cada módulo
├── models/                 # Consultas SQL
├── routes/                 # Rutas por módulo
├── services/salmiParser.js # Lectura y reconstrucción de formularios SALMI
├── views/                  # Vistas EJS (layout + módulos)
├── public/                 # CSS, JS del cliente, imágenes y archivos subidos
├── ocr-models/             # Modelos PP-OCRv6 para el OCR local
├── database/
│   ├── init/               # Esquema y datos iniciales
│   └── migrations/         # Cambios para bases existentes
├── seeds/                  # Scripts de carga de datos
└── docker-compose.yml      # PostgreSQL 16
```

## Limitaciones conocidas

- **Cierre de gestión del kardex:** todavía no está implementado. Al cambiar de año, la importación abre un kardex nuevo sin cerrar el anterior ni trasladar el saldo valorado.
- **Calidad de la foto:** con imágenes borrosas o de baja resolución la lectura empeora; las celdas dudosas quedan marcadas y la revisión es obligatoria antes de importar.
- Los scripts `seed:insumos`, `seed:stock`, `seed:protocolos`, `seed:lotes` y `seed:all` de `package.json` apuntan a archivos que ya no existen; esos datos los carga `02-seed.sql`.
