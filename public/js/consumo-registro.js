// Registro de consumo de insumos por protocolo (FIFO por lote)
let protocoloActual = [];
const insumosConsumo = new Map();
let lotesVencidosPendientes = [];

const esc = (v) => DM5.escape(v);

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('id_tipo_servicio').addEventListener('change', function () {
        if (this.value) {
            cargarProtocolo(this.value);
            verificarDisponibilidad(this.value);
        } else {
            mostrarMensajeInicial();
        }
    });

    // Enter dentro del modal de recibo confirma
    document.getElementById('numero_recibo_input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); confirmarConsumo(); }
    });
    document.getElementById('reciboModal').addEventListener('shown.bs.modal', () => {
        document.getElementById('numero_recibo_input').focus();
    });

    if (Array.isArray(window.LOTES_AGOTADOS) && window.LOTES_AGOTADOS.length > 0) {
        mostrarModalSobrantes(window.LOTES_AGOTADOS);
    }

    updateSubmitButton();
});

function setMensaje(html) {
    const box = document.getElementById('protocolo_mensaje');
    box.innerHTML = html;
    box.style.display = 'block';
    document.getElementById('protocolo_container').style.display = 'none';
    DM5.icons();
}

function emptyState(icono, titulo, texto, tono) {
    return '<div class="empty-state">' +
        '<div class="empty-icon"' + (tono ? ' style="background: var(--' + tono + '-soft); color: var(--' + tono + ')"' : '') + '><i data-lucide="' + icono + '"></i></div>' +
        '<h3>' + titulo + '</h3>' + (texto ? '<p>' + texto + '</p>' : '') +
    '</div>';
}

// ---------- Protocolo ----------
async function cargarProtocolo(idTipoServicio) {
    setMensaje('<div class="text-center py-5"><div class="spinner-border" role="status"></div><p class="text-muted mt-3 mb-0">Cargando protocolo…</p></div>');
    try {
        const response = await fetch('/consumos/api/protocolo/' + idTipoServicio);
        const data = await response.json();

        if (data.success && data.protocolo.length > 0) {
            protocoloActual = data.protocolo;
            if (data.lotes_vencidos && data.lotes_vencidos.length > 0) {
                lotesVencidosPendientes = data.lotes_vencidos;
                mostrarAlertaLotesVencidos(data.lotes_vencidos);
            } else {
                lotesVencidosPendientes = [];
                ocultarAlertaLotesVencidos();
            }
            mostrarProtocolo();
        } else {
            protocoloActual = [];
            insumosConsumo.clear();
            updateTotalAplicaciones();
            updateSubmitButton();
            setMensaje(emptyState('clipboard-x', 'Este servicio no tiene protocolo', 'Configura los insumos del servicio para poder registrar su consumo.', 'warning'));
        }
    } catch (error) {
        console.error('Error:', error);
        setMensaje(emptyState('wifi-off', 'No se pudo cargar el protocolo', 'Revisa tu conexión e inténtalo de nuevo.', 'danger'));
    }
}

function mostrarProtocolo() {
    const grid = document.getElementById('protocolo_grid');
    grid.innerHTML = '';
    insumosConsumo.clear();

    protocoloActual.forEach(item => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-xl-4 col-xxl-3';
        const imagen = esc(item.imagen_url || '/images/insumos/default.png');

        if (!item.lote_actual) {
            col.innerHTML =
                '<div class="supply-card is-empty">' +
                    '<div class="supply-head">' +
                        '<img class="supply-thumb" src="' + imagen + '" alt="" onerror="this.src=\'/images/insumos/default.png\'">' +
                        '<div><p class="supply-name">' + esc(item.nombre) + '</p><span class="supply-meta">' + esc(item.codigo || '') + '</span></div>' +
                    '</div>' +
                    '<span class="badge badge-soft-danger align-self-start"><i data-lucide="package-x"></i> Sin stock vigente</span>' +
                    '<p class="supply-meta mt-2 mb-0">No hay lotes con stock y sin vencer para este insumo.</p>' +
                '</div>';
            grid.appendChild(col);
            return;
        }

        const lote = item.lote_actual;
        const disponibles = Math.floor(lote.aplicaciones_disponibles);
        const fechaVenc = new Date(lote.fecha_vencimiento);
        const dias = Math.floor((fechaVenc - new Date()) / 86400000);
        const cantidadInicial = disponibles >= item.cantidad_por_uso ? Math.floor(item.cantidad_por_uso) : 0;
        insumosConsumo.set(item.id_insumo, cantidadInicial);

        let aviso = '';
        if (dias <= 0) aviso = '<span class="badge badge-soft-danger"><i data-lucide="circle-x"></i> Vencido</span>';
        else if (dias <= 30) aviso = '<span class="badge badge-soft-warning"><i data-lucide="clock"></i> Vence en ' + dias + ' días</span>';

        col.innerHTML =
            '<div class="supply-card' + (cantidadInicial > 0 ? ' is-active' : '') + '" id="card_' + item.id_insumo + '">' +
                '<div class="supply-head">' +
                    '<img class="supply-thumb" src="' + imagen + '" alt="" onerror="this.src=\'/images/insumos/default.png\'">' +
                    '<div class="min-w-0">' +
                        '<p class="supply-name">' + esc(item.nombre) + '</p>' +
                        '<span class="supply-meta">' + esc(item.presentacion || item.codigo || '') + '</span>' +
                    '</div>' +
                '</div>' +
                (aviso ? '<div class="mb-2">' + aviso + '</div>' : '') +
                '<div class="supply-stats">' +
                    '<div><span>Disponible</span><strong>' + disponibles + ' apl.</strong></div>' +
                    '<div><span>Protocolo</span><strong>' + item.cantidad_por_uso + ' apl.</strong></div>' +
                    '<div><span>Lote</span><strong>' + esc(lote.numero_lote) + '</strong></div>' +
                    '<div><span>Vence</span><strong>' + fechaVenc.toLocaleDateString('es-BO') + '</strong></div>' +
                '</div>' +
                '<div class="supply-foot">' +
                    '<label class="form-label mb-0" for="cant_' + item.id_insumo + '">Aplicaciones a descontar</label>' +
                    '<div class="stepper">' +
                        '<button type="button" onclick="decrementarInsumo(' + item.id_insumo + ')" aria-label="Restar una aplicación"><i data-lucide="minus" class="icon-sm"></i></button>' +
                        '<input type="number" id="cant_' + item.id_insumo + '" data-id="' + item.id_insumo + '" value="' + cantidadInicial + '" min="0" max="' + disponibles + '" step="1" inputmode="numeric">' +
                        '<button type="button" onclick="incrementarInsumo(' + item.id_insumo + ')" aria-label="Sumar una aplicación"><i data-lucide="plus" class="icon-sm"></i></button>' +
                    '</div>' +
                    '<button type="button" class="btn btn-ghost btn-sm text-danger" data-agotado="' + item.id_insumo + '">' +
                        '<i data-lucide="package-x" class="icon-sm"></i> Marcar lote agotado' +
                    '</button>' +
                '</div>' +
            '</div>';
        grid.appendChild(col);

        const input = col.querySelector('input[data-id]');
        input.addEventListener('change', function () {
            let v = Math.floor(parseInt(this.value) || 0);
            v = Math.max(0, Math.min(v, disponibles));
            this.value = v;
            updateInsumo(item.id_insumo, v);
        });
        col.querySelector('[data-agotado]').addEventListener('click', function () {
            mostrarModalAgotado(item.nombre, lote.numero_lote, lote.id_lote);
        });
    });

    document.getElementById('protocolo_mensaje').style.display = 'none';
    document.getElementById('protocolo_container').style.display = 'block';
    DM5.icons();
    updateTotalAplicaciones();
    updateSubmitButton();
}

function incrementarInsumo(id) {
    const input = document.querySelector('input[data-id="' + id + '"]');
    const max = parseInt(input.max);
    const current = parseInt(input.value) || 0;
    if (current < max) {
        input.value = current + 1;
        updateInsumo(id, input.value);
    } else {
        DM5.toast('No hay más aplicaciones disponibles en este lote', 'warning');
    }
}

function decrementarInsumo(id) {
    const input = document.querySelector('input[data-id="' + id + '"]');
    const current = parseInt(input.value) || 0;
    if (current > 0) {
        input.value = current - 1;
        updateInsumo(id, input.value);
    }
}

function updateInsumo(id, cantidad) {
    cantidad = Math.floor(parseInt(cantidad) || 0);
    insumosConsumo.set(id, cantidad);
    const card = document.getElementById('card_' + id);
    if (card) card.classList.toggle('is-active', cantidad > 0);
    updateTotalAplicaciones();
    updateSubmitButton();
}

function updateTotalAplicaciones() {
    const n = Array.from(insumosConsumo.values()).filter(c => c > 0).length;
    document.getElementById('total_aplicaciones').textContent = n + ' insumo' + (n !== 1 ? 's' : '');
}

function updateSubmitButton() {
    const hasService = document.getElementById('id_tipo_servicio').value;
    const hasInsumos = Array.from(insumosConsumo.values()).some(c => c > 0);
    document.getElementById('btn_guardar').disabled = !(hasService && hasInsumos);
}

// ---------- Confirmación ----------
function mostrarModalRecibo() {
    const servicio = document.getElementById('id_tipo_servicio').selectedOptions[0].text;
    let filas = '';
    insumosConsumo.forEach((cantidad, id) => {
        if (cantidad > 0) {
            const insumo = protocoloActual.find(i => i.id_insumo == id);
            filas += '<tr><td>' + esc(insumo.nombre) + '</td><td class="text-end num fw-semibold">' + cantidad + '</td></tr>';
        }
    });

    document.getElementById('resumen_consumo').innerHTML =
        '<div class="text-muted small mb-1">Servicio</div>' +
        '<div class="fw-semibold mb-3">' + esc(servicio) + '</div>' +
        '<div class="border rounded-3 overflow-hidden border-soft">' +
            '<table class="table table-sm mb-0"><thead><tr><th>Insumo</th><th class="text-end">Aplicaciones</th></tr></thead><tbody>' + filas + '</tbody></table>' +
        '</div>';
    new bootstrap.Modal(document.getElementById('reciboModal')).show();
}

function confirmarConsumo() {
    const input = document.getElementById('numero_recibo_input');
    const numeroRecibo = input.value.trim();
    if (!numeroRecibo) {
        input.classList.add('is-invalid');
        input.focus();
        return;
    }
    input.classList.remove('is-invalid');

    const insumosArray = [];
    insumosConsumo.forEach((cantidad, id) => {
        if (cantidad > 0) insumosArray.push({ id_insumo: parseInt(id), cantidad: parseInt(cantidad) });
    });

    const btn = document.getElementById('btnConfirmarConsumo');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Registrando…';

    document.getElementById('hidden_insumos').value = JSON.stringify(insumosArray);
    document.getElementById('hidden_numero_recibo').value = numeroRecibo;
    document.getElementById('consumoForm').submit();
}

// ---------- Lote agotado ----------
function mostrarModalAgotado(nombre, lote, idLote) {
    document.getElementById('agotado_insumo_nombre').textContent = nombre;
    document.getElementById('agotado_lote_numero').textContent = lote;
    document.getElementById('agotado_lote_id').value = idLote;
    document.getElementById('motivo_agotado').value = '';
    new bootstrap.Modal(document.getElementById('agotadoModal')).show();
}

async function confirmarAgotado() {
    const idLote = document.getElementById('agotado_lote_id').value;
    const motivo = document.getElementById('motivo_agotado').value || 'Agotado manualmente';
    try {
        const response = await fetch('/consumos/api/ajuste', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_lote: parseInt(idLote), aplicaciones_sobrantes: 0, motivo })
        });
        const data = await response.json();
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('agotadoModal')).hide();
            DM5.toast('Lote marcado como agotado');
            const servicio = document.getElementById('id_tipo_servicio').value;
            if (servicio) cargarProtocolo(servicio);
        } else {
            DM5.toast(data.error || 'No se pudo registrar el ajuste', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        DM5.toast('Error al registrar el ajuste', 'danger');
    }
}

// ---------- Disponibilidad y lotes vencidos ----------
async function verificarDisponibilidad(idTipoServicio) {
    const alertDiv = document.getElementById('disponibilidad_alert');
    try {
        const response = await fetch('/consumos/api/disponibilidad/' + idTipoServicio);
        const data = await response.json();
        if (data.success && !data.todo_disponible) {
            const faltantes = data.disponibilidad.filter(i => i.obligatorio && !i.suficiente);
            alertDiv.innerHTML = '<div class="alert alert-warning mb-0"><i data-lucide="triangle-alert"></i><div><strong>Stock insuficiente:</strong> ' +
                faltantes.map(f => esc(f.nombre)).join(', ') + '</div></div>';
        } else if (data.success) {
            alertDiv.innerHTML = '<div class="alert alert-success mb-0"><i data-lucide="circle-check"></i><div>Hay stock suficiente para todo el protocolo.</div></div>';
        } else {
            alertDiv.innerHTML = '';
        }
        DM5.icons();
    } catch (error) {
        console.error('Error:', error);
        alertDiv.innerHTML = '';
    }
}

function mostrarAlertaLotesVencidos(lotes) {
    ocultarAlertaLotesVencidos();
    const porInsumo = {};
    lotes.forEach(l => {
        porInsumo[l.id_insumo] = porInsumo[l.id_insumo] || { nombre: l.nombre_generico, n: 0 };
        porInsumo[l.id_insumo].n++;
    });
    const lista = Object.values(porInsumo).map(i => '<li><strong>' + esc(i.nombre) + '</strong>: ' + i.n + ' lote(s)</li>').join('');

    const alerta = document.createElement('div');
    alerta.id = 'alerta_lotes_vencidos';
    alerta.className = 'alert alert-danger mb-3';
    alerta.setAttribute('role', 'alert');
    alerta.innerHTML =
        '<i data-lucide="calendar-x"></i>' +
        '<div class="flex-grow-1">' +
            '<p class="alert-heading">Hay lotes vencidos con stock</p>' +
            '<ul class="mb-2 ps-3">' + lista + '</ul>' +
            '<p class="mb-2 small">Se excluyeron automáticamente del consumo. Retíralos del almacén.</p>' +
            '<button type="button" class="btn btn-sm btn-outline-danger" onclick="descartarAlertaVencidos()"><i data-lucide="check" class="icon-sm"></i> Entendido, no volver a mostrar</button>' +
        '</div>';
    const form = document.getElementById('consumoForm');
    form.insertBefore(alerta, form.querySelector('.card'));
    DM5.icons();
}

function ocultarAlertaLotesVencidos() {
    const el = document.getElementById('alerta_lotes_vencidos');
    if (el) el.remove();
}

async function descartarAlertaVencidos() {
    if (lotesVencidosPendientes.length === 0) return ocultarAlertaLotesVencidos();
    try {
        const response = await fetch('/consumos/api/lotes-vencidos/notificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lotes_ids: lotesVencidosPendientes.map(l => l.id_lote) })
        });
        const data = await response.json();
        if (data.success) {
            ocultarAlertaLotesVencidos();
            lotesVencidosPendientes = [];
        } else {
            DM5.toast(data.error || 'No se pudo actualizar', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function mostrarMensajeInicial() {
    insumosConsumo.clear();
    updateTotalAplicaciones();
    updateSubmitButton();
    ocultarAlertaLotesVencidos();
    document.getElementById('disponibilidad_alert').innerHTML = '';
    setMensaje(emptyState('mouse-pointer-click', 'Selecciona un servicio', 'Los insumos del protocolo aparecerán aquí para que ajustes las cantidades.'));
}

// ---------- Sobrantes tras agotar lotes ----------
function mostrarModalSobrantes(lotes) {
    const container = document.getElementById('sobrantes_list_dinamico');
    container.innerHTML = '';

    lotes.forEach(lote => {
        const id = lote.id_lote;
        const card = document.createElement('div');
        card.className = 'card mb-3';
        card.innerHTML =
            '<div class="card-body">' +
                '<p class="fw-semibold mb-1">' + esc(lote.nombre_insumo) + '</p>' +
                '<p class="text-muted small mb-3">Lote <code>' + esc(lote.numero_lote) + '</code> · ' + lote.cantidad_fisica + ' unidad(es) físicas</p>' +
                '<div class="btn-group w-100 mb-2" role="group" aria-label="¿Quedó sobrante?">' +
                    '<input type="radio" class="btn-check" name="sobrante_' + id + '" id="no_' + id + '" value="no" checked>' +
                    '<label class="btn btn-outline-secondary" for="no_' + id + '">No, se agotó</label>' +
                    '<input type="radio" class="btn-check" name="sobrante_' + id + '" id="si_' + id + '" value="si">' +
                    '<label class="btn btn-outline-secondary" for="si_' + id + '">Sí, quedó producto</label>' +
                '</div>' +
                '<div id="cantidad_sobrante_' + id + '" style="display: none;">' +
                    '<label class="form-label" for="aplicaciones_' + id + '">Aplicaciones sobrantes</label>' +
                    '<input type="number" class="form-control" min="1" id="aplicaciones_' + id + '" placeholder="Ej: 5">' +
                '</div>' +
            '</div>';
        container.appendChild(card);

        const box = card.querySelector('#cantidad_sobrante_' + id);
        card.querySelector('#si_' + id).addEventListener('change', () => { box.style.display = 'block'; });
        card.querySelector('#no_' + id).addEventListener('change', () => { box.style.display = 'none'; });
    });

    new bootstrap.Modal(document.getElementById('verificarSobrantesModal')).show();
}

async function guardarAjustesSobrantes() {
    for (const lote of window.LOTES_AGOTADOS || []) {
        const tieneSobrante = document.getElementById('si_' + lote.id_lote).checked;
        const aplicaciones = tieneSobrante ? parseInt(document.getElementById('aplicaciones_' + lote.id_lote).value) || 0 : 0;
        try {
            await fetch('/consumos/api/ajuste', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_lote: lote.id_lote,
                    aplicaciones_sobrantes: aplicaciones,
                    motivo: tieneSobrante ? 'Verificación post-consumo: sobrante' : 'Verificación post-consumo: agotado'
                })
            });
        } catch (error) {
            console.error('Error guardando ajuste:', error);
        }
    }
    window.location.href = '/consumos/registro';
}
