// Revisión de un formulario SALMI antes de importarlo al kardex
(function () {
    const form = document.getElementById('formRevision');
    const lista = document.getElementById('listaItems');
    const plantilla = document.getElementById('plantillaItem');
    const catalogo = JSON.parse(document.getElementById('catalogoInsumos').textContent || '[]');
    let siguiente = window.REVISION_SIGUIENTE || 0;

    // ------------------------------------------------------------------
    // Sugerencias del catálogo por nombre genérico
    // ------------------------------------------------------------------
    const IGNORAR = new Set(['del', 'las', 'los', 'con', 'sin', 'para', 'por', 'caja', 'frasco', 'unidad',
        'unidades', 'und', 'pares', 'litros', 'litro', 'ltr', 'tubo', 'sobre', 'bolsa', 'paquete', 'pieza']);
    const MAX_SUGERENCIAS = 5;

    const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const tokens = (s) => normalizar(s).split(' ').filter(t => t.length >= 3 && !IGNORAR.has(t) && !/^\d+$/.test(t));

    function distancia(a, b) {
        if (Math.abs(a.length - b.length) > 2) return 3;
        const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
        for (let i = 1; i <= a.length; i++) {
            let prev = fila[0];
            fila[0] = i;
            for (let j = 1; j <= b.length; j++) {
                const tmp = fila[j];
                fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
                prev = tmp;
            }
        }
        return fila[b.length];
    }

    // Igual, mismo inicio (≥5 letras) o un error de OCR de 1–2 letras
    function coinciden(a, b) {
        if (a === b) return true;
        const min = Math.min(a.length, b.length);
        if (min >= 5 && a.slice(0, 5) === b.slice(0, 5) && Math.abs(a.length - b.length) <= 3) return true;
        return min >= 5 && distancia(a, b) <= (min >= 8 ? 2 : 1);
    }

    function similitud(nombre, candidato) {
        const a = tokens(nombre);
        const b = tokens(candidato);
        if (!a.length || !b.length) return 0;
        const usados = new Set();
        let iguales = 0;
        let principal = false;
        a.forEach((t, i) => {
            const j = b.findIndex((u, k) => !usados.has(k) && coinciden(t, u));
            if (j >= 0) {
                usados.add(j);
                iguales++;
                if (i === 0) principal = true;
            }
        });
        const score = (2 * iguales) / (a.length + b.length);
        // La palabra principal (la primera) debe coincidir, salvo coincidencia muy alta
        return principal || score >= 0.6 ? score : 0;
    }

    function sugerencias(nombre, excluir) {
        return catalogo
            .filter(i => i.id !== excluir)
            .map(i => ({ ...i, score: similitud(nombre, i.nombre) }))
            .filter(i => i.score >= 0.34)
            .sort((x, y) => y.score - x.score)
            .slice(0, MAX_SUGERENCIAS);
    }

    const opcion = (i, seleccionado, extra = '') =>
        '<option value="' + i.id + '" data-rendimiento="' + (i.rendimiento || 1) + '"' + (seleccionado ? ' selected' : '') + '>' +
        DM5.escape(i.codigo + ' · ' + i.nombre) + extra + '</option>';

    function actualizarOpciones(row) {
        const select = row.querySelector('[data-insumo]');
        const nombre = row.querySelector('[data-nombre]').value;
        const codigo = row.querySelector('[data-codigo]').value.trim().toUpperCase();
        const actual = select.value;

        const porCodigo = catalogo.find(i => String(i.codigo).toUpperCase() === codigo) || null;
        const parecidos = sugerencias(nombre, porCodigo ? porCodigo.id : null);
        const visibles = new Set([porCodigo && porCodigo.id, ...parecidos.map(p => p.id)].filter(Boolean).map(String));

        let html = '<option value="nuevo"' + (actual === 'nuevo' ? ' selected' : '') + '>➕ Crear insumo nuevo</option>';
        if (porCodigo) html += '<optgroup label="Mismo código">' + opcion(porCodigo, actual === String(porCodigo.id)) + '</optgroup>';
        if (parecidos.length) {
            html += '<optgroup label="Parecidos por nombre">' +
                parecidos.map(p => opcion(p, actual === String(p.id), ' (' + Math.round(p.score * 100) + '%)')).join('') + '</optgroup>';
        }
        // Una elección previa que ya no aparece como sugerencia se conserva
        if (actual !== 'nuevo' && !visibles.has(actual)) {
            const elegido = catalogo.find(i => String(i.id) === actual);
            if (elegido) html += '<optgroup label="Elegido">' + opcion(elegido, true) + '</optgroup>';
        }
        select.innerHTML = html;
        row.dataset.sugerencias = parecidos.length + (porCodigo ? 1 : 0);
        sincronizarInsumo(row);
    }

    // ------------------------------------------------------------------
    // Ítems
    // ------------------------------------------------------------------
    function sincronizarInsumo(row) {
        const select = row.querySelector('[data-insumo]');
        const nuevo = select.value === 'nuevo';
        const panel = row.querySelector('.item-nuevo');
        panel.hidden = !nuevo;
        panel.querySelectorAll('[data-req-nuevo]').forEach(el => { el.required = nuevo; });
        actualizarFila(row);
    }

    function actualizarFila(row) {
        const cant = parseFloat(row.querySelector('[data-cantidad]').value) || 0;
        const costo = parseFloat(row.querySelector('[data-costo]').value) || 0;
        row.querySelector('[data-subtotal]').textContent = cant && costo ? DM5.moneda(cant * costo) : '—';

        const select = row.querySelector('[data-insumo]');
        const nuevo = select.value === 'nuevo';
        const rend = nuevo
            ? parseInt(row.querySelector('[data-rendimiento-nuevo]').value) || 1
            : parseInt(select.selectedOptions[0].dataset.rendimiento) || 1;
        row.querySelector('[data-aplicaciones]').textContent = cant ? cant + ' × ' + rend + ' = ' + (cant * rend) + ' apl.' : '';

        const ayuda = row.querySelector('[data-insumo-ayuda]');
        const codigo = row.querySelector('[data-codigo]').value.trim().toUpperCase();
        const codigoExiste = catalogo.some(i => String(i.codigo).toUpperCase() === codigo);
        if (nuevo && codigoExiste) {
            ayuda.innerHTML = '<span class="text-warning-emphasis">El código ' + DM5.escape(codigo) + ' ya existe en el catálogo; elígelo en la lista.</span>';
        } else if (nuevo) {
            ayuda.textContent = row.dataset.sugerencias === '0' ? 'Sin parecidos en el catálogo' : 'Se creará como insumo nuevo';
        } else {
            ayuda.textContent = 'Se sumará a este insumo';
        }
        recalcular();
    }

    function marcarVencido(row) {
        const input = row.querySelector('[data-vence]');
        const marcas = row.querySelector('[data-marcas]');
        let badge = marcas.querySelector('.badge-vencido');
        const vencido = input.value && input.value < hoy();
        if (vencido && !badge) {
            marcas.insertAdjacentHTML('afterbegin', '<span class="badge badge-soft-warning badge-vencido"><i data-lucide="calendar-x"></i> Vencido</span>');
            DM5.icons();
        } else if (!vencido && badge) {
            badge.remove();
        }
    }

    function hoy() {
        const d = new Date();
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }

    function recalcular() {
        const filas = lista.querySelectorAll('.item-row');
        let total = 0;
        filas.forEach((row, i) => {
            row.querySelector('.n-fila').textContent = i + 1;
            const cant = parseFloat(row.querySelector('[data-cantidad]').value) || 0;
            const costo = parseFloat(row.querySelector('[data-costo]').value) || 0;
            total += cant * costo;
        });
        document.getElementById('sinItems').hidden = filas.length > 0;
        document.getElementById('resumenItems').textContent = filas.length + ' ítem(s)';
        document.getElementById('totalItems').textContent = DM5.moneda(total);

        const impreso = parseFloat(document.getElementById('h_total').value);
        const estado = document.getElementById('estadoTotal');
        if (!isNaN(impreso) && filas.length) {
            estado.innerHTML = Math.abs(impreso - total) <= 0.05
                ? '<span class="badge badge-soft-success"><i data-lucide="check" class="icon-sm"></i> coincide con el total impreso</span>'
                : '<span class="badge badge-soft-warning"><i data-lucide="triangle-alert" class="icon-sm"></i> el impreso es ' + DM5.moneda(impreso) + '</span>';
            DM5.icons();
        } else {
            estado.innerHTML = '';
        }
        return { n: filas.length, total };
    }

    function prepararFila(row) {
        let espera;
        const refrescar = () => { clearTimeout(espera); espera = setTimeout(() => actualizarOpciones(row), 250); };
        row.querySelector('[data-nombre]').addEventListener('input', refrescar);
        row.querySelector('[data-codigo]').addEventListener('input', refrescar);
        row.querySelector('[data-insumo]').addEventListener('change', () => sincronizarInsumo(row));
        row.querySelector('[data-vence]').addEventListener('change', () => marcarVencido(row));
        row.querySelector('[data-quitar]').addEventListener('click', () => { row.remove(); recalcular(); });
        row.addEventListener('input', (e) => { if (!e.target.matches('[data-nombre], [data-codigo]')) actualizarFila(row); });
        actualizarOpciones(row);
    }

    lista.querySelectorAll('.item-row').forEach(prepararFila);
    document.getElementById('h_total').addEventListener('input', recalcular);

    document.getElementById('btnAgregar').addEventListener('click', function () {
        lista.insertAdjacentHTML('beforeend', plantilla.innerHTML.split('__K__').join(String(siguiente++)));
        const row = lista.lastElementChild;
        prepararFila(row);
        DM5.icons();
        row.querySelector('input').focus();
    });

    // ------------------------------------------------------------------
    // Confirmación
    // ------------------------------------------------------------------
    const modalImportar = new bootstrap.Modal(document.getElementById('modalImportar'));
    document.getElementById('btnRevisarImportar').addEventListener('click', function () {
        const r = recalcular();
        if (r.n === 0) { DM5.toast('Agrega al menos un ítem', 'warning'); return; }
        if (!form.reportValidity()) return;

        const selects = [...lista.querySelectorAll('[data-insumo]')];
        const nuevos = selects.filter(s => s.value === 'nuevo').length;
        const vinculados = selects.length - nuevos;
        const vencidos = [...lista.querySelectorAll('[data-vence]')].filter(i => i.value && i.value < hoy()).length;
        const duplicados = lista.querySelectorAll('.item-row[data-duplicado="1"]').length;

        let html = '<p class="mb-2">Se registrarán <strong>' + r.n + ' ítem(s)</strong> por <strong>' + DM5.moneda(r.total) + '</strong> como entradas en el kardex.</p><ul class="small mb-2">';
        if (vinculados) html += '<li>' + vinculados + ' ítem(s) se sumarán a insumos existentes del catálogo.</li>';
        if (nuevos) html += '<li>' + nuevos + ' insumo(s) nuevo(s) se agregarán al catálogo.</li>';
        if (vencidos) html += '<li class="text-warning-emphasis">' + vencidos + ' lote(s) vencido(s): quedarán registrados pero no se usarán en consumos.</li>';
        if (duplicados) html += '<li class="text-danger-emphasis">' + duplicados + ' lote(s) ya existen en el inventario: verifica que no sea la misma entrega.</li>';
        html += '</ul><p class="small text-muted mb-0">Esta acción no se puede deshacer.</p>';
        document.getElementById('resumenImportacion').innerHTML = html;
        modalImportar.show();
    });

    document.getElementById('btnConfirmarImportar').addEventListener('click', function () {
        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Importando…';
        form.submit();
    });

    recalcular();
})();
