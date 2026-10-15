// Formulario de solicitud de pedido (crear y editar)
// Ítems iniciales opcionales en <script type="application/json" id="solicitud-items">
(function () {
    let items = [];
    const el = (id) => document.getElementById(id);
    const esc = (v) => DM5.escape(v);

    const inicial = el('solicitud-items');
    if (inicial) {
        try { items = JSON.parse(inicial.textContent) || []; } catch (e) { items = []; }
    }

    function agregarInsumo() {
        const select = el('selectInsumo');
        const inputCant = el('inputCantidad');
        const cantidad = parseInt(inputCant.value) || 0;

        if (!select.value) {
            select.classList.add('is-invalid');
            select.focus();
            return;
        }
        if (cantidad <= 0) {
            inputCant.classList.add('is-invalid');
            inputCant.focus();
            return;
        }

        const option = select.options[select.selectedIndex];
        const idInsumo = parseInt(select.value);
        const precio = parseFloat(option.dataset.precio) || 0;
        const existente = items.find(i => i.id_insumo === idInsumo);

        if (existente) {
            // Si ya está en la lista, se suma la cantidad en lugar de rechazarlo
            existente.cantidad += cantidad;
            existente.precio_total = existente.cantidad * existente.precio_unitario;
            DM5.toast('Se actualizó la cantidad de ' + option.dataset.nombre, 'info');
        } else {
            items.push({
                id_insumo: idInsumo,
                codigo: option.dataset.codigo,
                nombre: option.dataset.nombre,
                presentacion: option.dataset.presentacion,
                cantidad,
                precio_unitario: precio,
                precio_total: precio * cantidad
            });
        }

        renderizarTabla();
        select.value = '';
        inputCant.value = 1;
        select.focus();
    }

    function cambiarCantidad(idInsumo, valor) {
        const item = items.find(i => i.id_insumo === idInsumo);
        if (!item) return;
        item.cantidad = Math.max(1, parseInt(valor) || 1);
        item.precio_total = item.cantidad * item.precio_unitario;
        renderizarTabla();
    }

    function eliminarItem(idInsumo) {
        items = items.filter(i => i.id_insumo !== idInsumo);
        renderizarTabla();
    }

    function renderizarTabla() {
        const tbody = el('tbodyItems');
        const total = items.reduce((s, i) => s + i.precio_total, 0);

        el('totalItems').textContent = items.length + (items.length === 1 ? ' ítem' : ' ítems');
        el('totalGeneral').textContent = DM5.moneda(total);
        el('btnGuardar').disabled = items.length === 0;

        if (items.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="7"><div class="empty-state py-4">' +
                    '<div class="empty-icon"><i data-lucide="package-plus"></i></div>' +
                    '<p class="mb-0">Agrega insumos con el selector de arriba.</p>' +
                '</div></td></tr>';
            DM5.icons();
            return;
        }

        tbody.innerHTML = items.map((item, index) =>
            '<tr>' +
                '<td class="text-muted num">' + (index + 1) + '</td>' +
                '<td><span class="cell-main">' + esc(item.nombre) + '</span><span class="cell-sub"><code>' + esc(item.codigo) + '</code></span></td>' +
                '<td>' + esc(item.presentacion) + '</td>' +
                '<td style="width: 110px"><input type="number" class="form-control form-control-sm text-end" min="1" value="' + item.cantidad + '" ' +
                    'aria-label="Cantidad de ' + esc(item.nombre) + '" onchange="SolicitudForm.cambiarCantidad(' + item.id_insumo + ', this.value)"></td>' +
                '<td class="text-end num">' + DM5.moneda(item.precio_unitario) + '</td>' +
                '<td class="text-end num fw-semibold">' + DM5.moneda(item.precio_total) + '</td>' +
                '<td class="text-end">' +
                    '<button type="button" class="btn-icon danger" onclick="SolicitudForm.eliminarItem(' + item.id_insumo + ')" title="Quitar" aria-label="Quitar ' + esc(item.nombre) + '">' +
                        '<i data-lucide="trash-2" class="icon-sm"></i>' +
                    '</button>' +
                    '<input type="hidden" name="detalles[' + index + '][id_insumo]" value="' + item.id_insumo + '">' +
                    '<input type="hidden" name="detalles[' + index + '][cantidad]" value="' + item.cantidad + '">' +
                    '<input type="hidden" name="detalles[' + index + '][costo_total]" value="' + item.precio_total.toFixed(2) + '">' +
                '</td>' +
            '</tr>'
        ).join('');
        DM5.icons();
    }

    document.addEventListener('DOMContentLoaded', function () {
        el('btnAgregar').addEventListener('click', agregarInsumo);
        el('inputCantidad').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); agregarInsumo(); } });
        ['selectInsumo', 'inputCantidad'].forEach(id => el(id).addEventListener('input', function () { this.classList.remove('is-invalid'); }));

        el('formSolicitud').addEventListener('submit', function (e) {
            if (items.length === 0) {
                e.preventDefault();
                DM5.toast('Agrega al menos un insumo a la solicitud', 'warning');
                return;
            }
            const btn = el('btnGuardar');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Guardando…';
        });

        renderizarTabla();
    });

    window.SolicitudForm = { cambiarCantidad, eliminarItem };
})();
