// Lectura de formularios SALMI (Consumo interno / Distribución interna)
// OCR local con PaddleOCR PP-OCRv6 (ONNX) y reconstrucción de la tabla a
// partir de las coordenadas de cada texto detectado.
import path from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { PaddleOcrService } from 'ppu-paddle-ocr';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Modelos PP-OCRv6 small (Apache-2.0) incluidos en el repo para funcionar sin internet
const MODEL_DIR = path.join(__dirname, '../ocr-models');

const CONFIANZA_MINIMA = 0.3;   // cajas por debajo se descartan (ruido, sellos, firmas)
const CONFIANZA_DUDOSA = 0.6;   // celdas por debajo se marcan para revisar

// Columnas del formulario, de izquierda a derecha
const COLUMNAS = [
  { key: 'codigo', re: /^c[oó0]d[il1]g[o0]/i },
  { key: 'nombre', re: /nombre/i },
  { key: 'forma', re: /forma/i },
  { key: 'concentracion', re: /concentr/i },
  { key: 'lote', re: /lote/i },
  { key: 'vencimiento', re: /(vto|venc)/i },
  { key: 'cantidad', re: /cant[il1]dad/i },
  { key: 'unitario', re: /un[il1]t/i },
  { key: 'total', re: /^c\W{0,3}[\/j]?\s*t[oa0]tal/i }
];
// Posición relativa de cada columna (código = 0, total = 1) medida en el
// formulario; sirve para completar títulos que el OCR no detecte.
const PLANTILLA = [0, 0.169, 0.367, 0.519, 0.625, 0.739, 0.839, 0.918, 1];

// ---------------------------------------------------------------------------
// Motor OCR (una sola instancia, trabajos en serie)
// ---------------------------------------------------------------------------
let servicioPromesa = null;
let cola = Promise.resolve();

const toArrayBuffer = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

async function obtenerServicio() {
  if (!servicioPromesa) {
    servicioPromesa = (async () => {
      const [det, rec, dict] = await Promise.all([
        readFile(path.join(MODEL_DIR, 'PP-OCRv6_small_det.ort')),
        readFile(path.join(MODEL_DIR, 'PP-OCRv6_small_rec.ort')),
        readFile(path.join(MODEL_DIR, 'ppocrv6_dict.txt'))
      ]);
      const servicio = new PaddleOcrService({
        model: { detection: toArrayBuffer(det), recognition: toArrayBuffer(rec), charactersDictionary: toArrayBuffer(dict) },
        detection: { maxSideLength: 2000 },
        debugging: { verbose: false }
      });
      await servicio.initialize();
      return servicio;
    })().catch(err => {
      servicioPromesa = null;
      throw err;
    });
  }
  return servicioPromesa;
}

/**
 * Lee una imagen de formulario SALMI.
 * @returns {Promise<{encabezado: object, items: object[], advertencias: string[], texto: string}>}
 */
export function leerFormulario(rutaImagen) {
  const trabajo = cola.then(() => procesar(rutaImagen));
  cola = trabajo.catch(() => {});
  return trabajo;
}

async function procesar(rutaImagen) {
  const servicio = await obtenerServicio();
  const imagen = await sharp(rutaImagen)
    .rotate()                       // respeta la orientación EXIF del celular
    .resize({ width: 2400 })
    .normalize()
    .jpeg({ quality: 95 })
    .toBuffer();

  const resultado = await servicio.recognize(toArrayBuffer(imagen), { flatten: true });
  const cajas = (resultado.results || [])
    .filter(r => r.text && r.text.trim() && r.confidence >= CONFIANZA_MINIMA)
    .map(r => ({
      text: r.text.trim(),
      x: r.box.x, y: r.box.y, w: r.box.width, h: r.box.height,
      cx: r.box.x + r.box.width / 2,
      cy: r.box.y + r.box.height / 2,
      conf: r.confidence
    }));

  return { ...interpretar(cajas), texto: resultado.text || '' };
}

// ---------------------------------------------------------------------------
// Interpretación de las cajas (exportada para pruebas)
// ---------------------------------------------------------------------------
export function interpretar(cajas) {
  const advertencias = [];
  const altoFila = mediana(cajas.map(c => c.h)) || 32;

  // 1. Títulos de columna y línea de títulos (puede estar inclinada)
  const titulos = encontrarTitulos(cajas, altoFila);
  if (titulos.length < 3) {
    return {
      encabezado: leerEncabezado(cajas, () => true, () => true, altoFila),
      items: [],
      advertencias: ['No se reconoció la tabla del formulario. Ingresa los ítems manualmente o sube una foto más nítida.']
    };
  }

  const pendiente = calcularPendiente(titulos);
  const ref = titulos[0].caja;
  const yTituloEn = (x) => ref.cy + pendiente * (x - ref.cx);
  const debajoDeTitulos = (c) => c.cy > yTituloEn(c.cx) + altoFila * 0.5;

  const centros = completarColumnas(titulos);
  const limites = centros.slice(0, -1).map((c, i) => (c + centros[i + 1]) / 2);
  const columnaDe = (cx) => {
    let i = 0;
    while (i < limites.length && cx > limites[i]) i++;
    return COLUMNAS[i].key;
  };

  // 2. Pie del formulario y fila "Total:"
  const esTitulo = new Set(titulos.map(t => t.caja));
  const pie = cajas.filter(c => debajoDeTitulos(c) && /^(obs|elaborad)/.test(normalizar(c.text)));
  const yPie = pie.length ? Math.min(...pie.map(c => c.cy)) : Infinity;

  const excluidas = new Set(esTitulo);
  let totalFormulario = null;
  const etiquetaTotal = cajas.find(c => !esTitulo.has(c) && debajoDeTitulos(c) && /^t[o0]tal\s*:?/i.test(c.text));
  if (etiquetaTotal) {
    excluidas.add(etiquetaTotal);
    const enLinea = etiquetaTotal.text.replace(/^t[o0]tal\s*:?\s*/i, '');
    const vecino = enLinea ? null : vecinoDerecha(cajas, etiquetaTotal, altoFila);
    if (vecino) excluidas.add(vecino);
    totalFormulario = parseNumero(enLinea || (vecino && vecino.text));
  }

  // 3. Cuerpo de la tabla, separando textos que invaden la columna vecina
  let cuerpo = cajas.filter(c => !excluidas.has(c) && debajoDeTitulos(c) && c.cy < yPie - altoFila * 0.3);
  cuerpo = cuerpo.flatMap(c => dividirPorColumnas(c, limites));
  cuerpo.forEach(c => { c.col = columnaDe(c.cx); });

  // 4. Filas: cada código abre una fila
  const pareceCodigo = (c) => /\d/.test(c.text) && /^[A-Za-z0-9]{3,8}$/.test(primerToken(c.text));
  let anclas = cuerpo.filter(c => c.col === 'codigo' && pareceCodigo(c)).sort((a, b) => a.cy - b.cy);
  if (anclas.length === 0) {
    const porColumna = ['vencimiento', 'lote', 'total'].map(k => cuerpo.filter(c => c.col === k));
    anclas = porColumna.sort((a, b) => b.length - a.length)[0].sort((a, b) => a.cy - b.cy);
    if (anclas.length) advertencias.push('No se leyeron los códigos; las filas se armaron por otras columnas.');
  }
  anclas = anclas.filter((c, i) => i === 0 || c.cy - anclas[i - 1].cy > altoFila * 0.5);
  if (anclas.length === 0) advertencias.push('No se encontraron ítems en la tabla.');

  const paso = anclas.length > 1 ? mediana(anclas.slice(1).map((c, i) => c.cy - anclas[i].cy)) : altoFila;
  const filas = anclas.map(a => ({ puntos: [{ x: a.cx, y: a.cy }], celdas: { codigo: [a] } }));
  const usadas = new Set(anclas);

  // 5. Una hoja doblada no tiene una sola inclinación: cada fila se recorre
  //    de izquierda a derecha siguiendo la forma de la fila de arriba (la
  //    primera sigue la línea de títulos), desde su propia última celda.
  let perfil = titulos.map(t => ({ x: t.caja.cx, y: t.caja.cy })).sort((a, b) => a.x - b.x);
  const tolerancia = paso * 0.45;

  for (const fila of filas) {
    for (const col of COLUMNAS.slice(1)) {
      const ultimo = fila.puntos[fila.puntos.length - 1];
      const candidatas = cuerpo
        .filter(c => c.col === col.key && !usadas.has(c))
        .map(c => ({ c, d: Math.abs(c.cy - (ultimo.y + evaluarPerfil(perfil, c.cx, pendiente) - evaluarPerfil(perfil, ultimo.x, pendiente))) }))
        .filter(p => p.d < tolerancia)
        .sort((a, b) => a.d - b.d);

      const elegidas = [];
      for (const { c } of candidatas) {
        // Dos cajas apiladas en la misma columna son de filas distintas
        const solapa = elegidas.some(e => Math.min(e.x + e.w, c.x + c.w) - Math.max(e.x, c.x) > Math.min(e.w, c.w) * 0.5);
        if (!solapa) elegidas.push(c);
      }
      if (!elegidas.length) continue;
      elegidas.sort((a, b) => a.x - b.x);
      fila.celdas[col.key] = elegidas;
      elegidas.forEach(c => { usadas.add(c); fila.puntos.push({ x: c.cx, y: c.cy }); });
      fila.puntos.sort((a, b) => a.x - b.x);
    }
    if (fila.puntos.length >= 3) perfil = fila.puntos;
  }

  // 6. Convertir a ítems y validar
  const items = filas.map((f, i) => construirItem(f, i + 1)).filter(Boolean);
  const suma = redondear(items.reduce((s, it) => s + (it.costo_total || 0), 0));
  if (totalFormulario !== null && items.length && Math.abs(suma - totalFormulario) > 0.05) {
    advertencias.push(`La suma de los ítems (Bs ${suma.toFixed(2)}) no coincide con el total impreso (Bs ${totalFormulario.toFixed(2)}). Revisa las filas marcadas.`);
  }

  const yUltimaFila = anclas.length ? Math.max(...anclas.map(a => a.cy)) : 0;
  const encabezado = leerEncabezado(
    cajas,
    (c) => c.cy < yTituloEn(c.cx) - altoFila * 0.3,
    (c) => c.cy > yUltimaFila + altoFila * 0.5,
    altoFila
  );
  encabezado.total_formulario = totalFormulario;

  return { encabezado, items, advertencias };
}

// ---------------------------------------------------------------------------
// Tabla
// ---------------------------------------------------------------------------
function encontrarTitulos(cajas, altoFila) {
  const porColumna = COLUMNAS.map((col, indice) => ({
    indice,
    candidatas: cajas.filter(c => col.re.test(c.text) && c.text.length < 30)
  }));

  // Se toma como referencia la fila donde coinciden más títulos
  const referencias = porColumna.flatMap(p => p.candidatas);
  let mejorFila = [];
  for (const ref of referencias) {
    const fila = [];
    for (const p of porColumna) {
      const cerca = p.candidatas
        .filter(c => Math.abs(c.cy - ref.cy) < altoFila * 3)
        .sort((a, b) => Math.abs(a.cy - ref.cy) - Math.abs(b.cy - ref.cy))[0];
      if (cerca) fila.push({ indice: p.indice, caja: cerca });
    }
    if (fila.length > mejorFila.length) mejorFila = fila;
  }

  // Deben quedar en orden de izquierda a derecha
  mejorFila.sort((a, b) => a.indice - b.indice);
  return mejorFila.filter((t, i) => i === 0 || t.caja.cx > mejorFila[i - 1].caja.cx);
}

function calcularPendiente(titulos) {
  const xs = titulos.map(t => t.caja.cx);
  const ys = titulos.map(t => t.caja.cy);
  const mx = promedio(xs);
  const my = promedio(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const m = den ? num / den : 0;
  return Math.max(-0.12, Math.min(0.12, m));
}

// Ubica las 9 columnas usando los títulos detectados y la plantilla
function completarColumnas(titulos) {
  const xs = titulos.map(t => PLANTILLA[t.indice]);
  const ys = titulos.map(t => t.caja.cx);
  const mx = promedio(xs);
  const my = promedio(ys);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const escala = den ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den : 1;
  const base = my - escala * mx;
  const detectados = new Map(titulos.map(t => [t.indice, t.caja.cx]));
  return PLANTILLA.map((p, i) => detectados.get(i) ?? base + escala * p);
}

// Un texto largo puede desbordar su celda (p. ej. nombre + forma farmacéutica)
function dividirPorColumnas(caja, limites) {
  const izquierda = caja.x;
  const derecha = caja.x + caja.w;
  // El borde código|nombre no se usa: los nombres empiezan casi pegados al código
  const cruzados = limites.slice(1).filter(l => l > izquierda + caja.w * 0.15 && l < derecha - caja.w * 0.15);
  if (!cruzados.length || !caja.text.includes(' ')) return [caja];

  const partes = [];
  let resto = caja.text;
  let inicioX = izquierda;
  for (const limite of cruzados) {
    const anchoResto = derecha - inicioX;
    const proporcion = (limite - inicioX) / anchoResto;
    let corte = Math.round(resto.length * proporcion);
    // Buscar el espacio más cercano al punto estimado
    let mejor = -1;
    for (let d = 0; d < resto.length; d++) {
      if (resto[corte - d] === ' ') { mejor = corte - d; break; }
      if (resto[corte + d] === ' ') { mejor = corte + d; break; }
    }
    if (mejor <= 0 || mejor >= resto.length - 1) continue;
    const texto = resto.slice(0, mejor).trim();
    const anchoParte = anchoResto * (mejor / resto.length);
    partes.push({ ...caja, text: texto, x: inicioX, w: anchoParte, cx: inicioX + anchoParte / 2 });
    inicioX += anchoParte;
    resto = resto.slice(mejor + 1);
  }
  partes.push({ ...caja, text: resto.trim(), x: inicioX, w: derecha - inicioX, cx: (inicioX + derecha) / 2 });
  return partes.filter(p => p.text);
}

function textoCelda(fila, columna) {
  const cajas = fila.celdas[columna];
  if (!cajas) return '';
  return cajas.sort((a, b) => a.x - b.x).map(c => c.text).join(' ').trim();
}

function construirItem(fila, linea) {
  const todas = Object.values(fila.celdas).flat();
  if (!todas.length) return null;

  // Si los números quedaron mal repartidos, se reasignan por posición:
  // de derecha a izquierda son total, unitario y cantidad.
  const numericas = ['cantidad', 'unitario', 'total'].flatMap(k => fila.celdas[k] || []).sort((a, b) => a.x - b.x);
  let cantidadTxt = textoCelda(fila, 'cantidad');
  let unitarioTxt = textoCelda(fila, 'unitario');
  let totalTxt = textoCelda(fila, 'total');
  if (numericas.length === 3 && (!cantidadTxt || !unitarioTxt || !totalTxt || fila.celdas.cantidad?.length > 1 || fila.celdas.unitario?.length > 1)) {
    [cantidadTxt, unitarioTxt, totalTxt] = numericas.map(c => c.text);
  }

  const codigoLeido = primerToken(textoCelda(fila, 'codigo'));
  const item = {
    linea,
    codigo: normalizarCodigo(codigoLeido),
    codigo_leido: codigoLeido,
    nombre_generico: limpiarTexto(textoCelda(fila, 'nombre')),
    forma_farmaceutica: limpiarTexto(textoCelda(fila, 'forma')),
    concentracion: limpiarTexto(textoCelda(fila, 'concentracion')),
    numero_lote: textoCelda(fila, 'lote').replace(/\s+/g, '').replace(/-$/, ''),
    fecha_vencimiento: parseFecha(textoCelda(fila, 'vencimiento')),
    cantidad: parseCantidad(cantidadTxt),
    costo_unitario: parseNumero(unitarioTxt),
    costo_total: parseNumero(totalTxt),
    confianza: redondear(Math.min(...todas.map(c => c.conf)), 3),
    dudoso: false,
    observacion: null
  };

  const notas = [];
  const { cantidad, costo_unitario: cu, costo_total: ct } = item;
  if (cantidad && cu && ct === null) item.costo_total = redondear(cantidad * cu);
  else if (cantidad && ct && cu === null) { item.costo_unitario = redondear(ct / cantidad); notas.push('costo unitario calculado'); }
  else if (!cantidad && cu && ct) {
    const estimada = ct / cu;
    if (Math.abs(estimada - Math.round(estimada)) < 0.05) { item.cantidad = Math.round(estimada); notas.push('cantidad calculada'); }
  }

  if (item.cantidad && item.costo_unitario && item.costo_total &&
      Math.abs(item.cantidad * item.costo_unitario - item.costo_total) > Math.max(0.06, item.costo_total * 0.01)) {
    notas.push('cantidad × costo no coincide con el total');
  }
  if (!item.codigo) notas.push('sin código');
  if (!item.nombre_generico) notas.push('sin nombre');
  if (!item.numero_lote) notas.push('sin lote');
  if (!item.fecha_vencimiento) notas.push('fecha de vencimiento ilegible');
  if (!item.cantidad) notas.push('sin cantidad');
  if (!item.costo_unitario) notas.push('sin costo');
  if (item.confianza < CONFIANZA_DUDOSA) notas.push('lectura poco nítida');

  if (notas.length) {
    item.dudoso = true;
    item.observacion = notas.join(' · ');
  }
  return item;
}

// ---------------------------------------------------------------------------
// Encabezado y pie del formulario
// ---------------------------------------------------------------------------
const ETIQUETAS = {
  sede: /^sedes?\b/,
  establecimiento: /^establec/,
  responsable: /^responsable/,
  representante: /^repr/,
  botiquin: /^botiqu/,
  nro_documento: /documento/,
  elaborado_por: /^elaborad/,
  observaciones: /^obs/,
  fecha: /^fecha/
};

function leerEncabezado(cajas, arriba, abajo, altoFila) {
  const enc = {
    tipo_formulario: null,
    nro_formulario: null,
    nro_documento: null,
    fecha_elaboracion: null,
    sede: null,
    establecimiento: null,
    botiquin: null,
    responsable: null,
    representante: null,
    elaborado_por: null,
    observaciones: null,
    total_formulario: null
  };

  const titulo = cajas.find(c => /consumo\s*interno|distribuci[oó]n\s*interna/i.test(c.text));
  if (titulo) {
    enc.tipo_formulario = /consumo/i.test(titulo.text) ? 'CONSUMO INTERNO' : 'DISTRIBUCION INTERNA';
  }

  for (const [campo, re] of Object.entries(ETIQUETAS)) {
    const zona = ['elaborado_por', 'observaciones'].includes(campo) ? abajo : arriba;
    const etiqueta = cajas.find(c => zona(c) && re.test(normalizar(c.text)));
    if (!etiqueta) continue;
    const valor = valorDeEtiqueta(cajas, etiqueta, altoFila);
    if (!valor) continue;
    if (campo === 'fecha') enc.fecha_elaboracion = parseFecha(valor);
    else if (campo === 'nro_documento') enc.nro_documento = (valor.match(/\d+/) || [null])[0];
    else enc[campo] = limpiarTexto(valor);
  }

  // "N°:" suele leerse como "°:", "No:" o "N:"; su valor es el número a la derecha
  const etiquetaNro = cajas.find(c => arriba(c) && !/documento/i.test(c.text) && /^(n[°ºo]?|[°º])\s*:?\s*$/i.test(c.text.trim()));
  if (etiquetaNro) {
    const vecino = vecinoDerecha(cajas, etiquetaNro, altoFila, c => /\d/.test(c.text));
    if (vecino) enc.nro_formulario = (vecino.text.match(/\d+/) || [null])[0];
  }
  return enc;
}

function valorDeEtiqueta(cajas, etiqueta, altoFila) {
  const idx = etiqueta.text.indexOf(':');
  if (idx >= 0 && etiqueta.text.slice(idx + 1).trim()) return etiqueta.text.slice(idx + 1).trim();
  // El valor no puede ser otra etiqueta (p. ej. "Firma:" junto a Observaciones vacías)
  const vecino = vecinoDerecha(cajas, etiqueta, altoFila, c => !/:\s*$/.test(c.text) && !Object.values(ETIQUETAS).some(re => re.test(normalizar(c.text))));
  return vecino ? vecino.text : '';
}

function vecinoDerecha(cajas, ref, altoFila, filtro = () => true) {
  const yRef = ref.cy;
  return cajas
    .filter(c => c !== ref && c.x > ref.x + ref.w * 0.6 && Math.abs((c.cy) - yRef) < altoFila * 0.7 && filtro(c))
    .sort((a, b) => a.x - b.x)[0] || null;
}

// ---------------------------------------------------------------------------
// Normalizadores (exportados para pruebas)
// ---------------------------------------------------------------------------

// Los códigos SALMI son 1 letra + dígitos (N0111) o, si empiezan con I/O,
// 2 letras + dígitos (IC036, OI23, OM42). El OCR confunde O/0, I/1, S/5…
const A_LETRA = { 0: 'O', 1: 'I', 5: 'S', 8: 'B', 2: 'Z', 6: 'G' };
const A_DIGITO = { O: '0', Q: '0', D: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6', T: '7' };

export function normalizarCodigo(texto) {
  const s = String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length < 2) return s;
  const letra = (c) => (/\d/.test(c) ? A_LETRA[c] || c : c);
  const digito = (c) => (/[A-Z]/.test(c) ? A_DIGITO[c] || c : c);
  const primera = letra(s[0]);
  if ((primera === 'I' || primera === 'O') && s.length >= 3) {
    return primera + letra(s[1]) + [...s.slice(2)].map(digito).join('');
  }
  return primera + [...s.slice(1)].map(digito).join('');
}

export function parseNumero(texto) {
  let s = String(texto ?? '').replace(/[^\d.,]/g, '');
  if (!s || !/\d/.test(s)) return null;
  const decimal = s.match(/^(.*)[.,](\d{1,2})$/);
  const valor = decimal
    ? parseFloat(decimal[1].replace(/[.,]/g, '') + '.' + decimal[2])
    : parseFloat(s.replace(/[.,]/g, ''));
  return Number.isFinite(valor) ? valor : null;
}

export function parseCantidad(texto) {
  const s = String(texto ?? '').replace(/[lI|]/g, '1').replace(/[oO]/g, '0').replace(/[^\d]/g, '');
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseFecha(texto) {
  const s = String(texto ?? '').replace(/[oO]/g, '0').replace(/[lI]/g, '1');
  let d, m, a;
  const conBarras = s.match(/(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})/);
  if (conBarras) [, d, m, a] = conBarras;
  else {
    const digitos = s.replace(/\D/g, '');
    if (digitos.length !== 8) return null;
    [d, m, a] = [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4)];
  }
  const dia = +d, mes = +m, anio = +a;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || anio < 2000 || anio > 2100) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9: ]/g, '').trim();
}
function limpiarTexto(s) {
  return String(s || '').replace(/[^\p{L}\p{N}\s.,%°º/+×x:()½-]/gu, '').replace(/\s+/g, ' ').trim() || null;
}
// Primer token con dígitos (descarta marcas de verificación junto al código)
function primerToken(s) {
  const tokens = String(s || '').split(/\s+/).filter(Boolean);
  return tokens.find(t => /\d/.test(t)) || tokens[0] || '';
}
// Interpolación lineal por tramos de una fila (o de los títulos); fuera del
// rango se extrapola con el tramo extremo.
function evaluarPerfil(pts, x, pendientePorDefecto) {
  if (pts.length === 1) return pts[0].y + pendientePorDefecto * (x - pts[0].x);
  let i = pts.findIndex(p => p.x >= x);
  if (i <= 0) i = i === 0 ? 1 : pts.length - 1;
  const a = pts[i - 1], b = pts[i];
  const m = b.x === a.x ? 0 : Math.max(-0.15, Math.min(0.15, (b.y - a.y) / (b.x - a.x)));
  return a.y + m * (x - a.x);
}
function mediana(arr) {
  if (!arr.length) return 0;
  const o = [...arr].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
function promedio(arr) { return arr.reduce((s, v) => s + v, 0) / (arr.length || 1); }
function redondear(v, dec = 2) { const f = 10 ** dec; return Math.round(v * f) / f; }
