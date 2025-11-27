// Variables globales
let protocoloActual = [];
let insumosConsumo = new Map();
let lotesVencidosPendientes = [];

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('id_tipo_servicio').addEventListener('change', function () {
        const idTipoServicio = this.value;
        if (idTipoServicio) {
            cargarProtocolo(idTipoServicio);
            verificarDisponibilidad(idTipoServicio);
        } else {
            mostrarMensajeInicial();
        }
    });

    updateSubmitButton();
});

// Cargar protocolo
async function cargarProtocolo(idTipoServicio) {
    try {
        console.log('Cargando protocolo para servicio:', idTipoServicio);

        document.getElementById('protocolo_mensaje').innerHTML = '<div class="text-center"><div class="spinner-border text-primary"></div><p class="mt-2">Cargando protocolo...</p></div>';

        const response = await fetch('/consumos/api/protocolo/' + idTipoServicio);
        console.log('Response status:', response.status);

        const data = await response.json();
        console.log('Datos recibidos:', data);

        if (data.success && data.protocolo.length > 0) {
            console.log('Protocolo válido con', data.protocolo.length, 'items');
            protocoloActual = data.protocolo;
            
            // NUEVO: Manejar lotes vencidos si existen
            if (data.lotes_vencidos && data.lotes_vencidos.length > 0) {
                lotesVencidosPendientes = data.lotes_vencidos;
                mostrarAlertaLotesVencidos(data.lotes_vencidos);
            } else {
                lotesVencidosPendientes = [];
                ocultarAlertaLotesVencidos();
            }
            
            mostrarProtocolo();
        } else {
            console.warn('Protocolo vacío');
            document.getElementById('protocolo_mensaje').innerHTML = '<div class="text-center text-warning py-4"><h5>No hay protocolo definido para este servicio</h5><p>Contacte al administrador para configurar los insumos.</p></div>';
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('protocolo_mensaje').innerHTML = '<div class="text-center text-danger py-4"><h5>Error cargando protocolo</h5></div>';
    }
}

// NUEVO: Mostrar alerta de lotes vencidos
function mostrarAlertaLotesVencidos(lotes) {
    const alertContainer = document.getElementById('alerta_lotes_vencidos');
    if (!alertContainer) {
        // Crear contenedor si no existe
        const nuevoAlert = document.createElement('div');
        nuevoAlert.id = 'alerta_lotes_vencidos';
        nuevoAlert.className = 'alert alert-danger alert-dismissible fade show mb-4';
        nuevoAlert.role = 'alert';
        
        // Agrupar lotes por insumo
        const lotesporInsumo = {};
        lotes.forEach(lote => {
            if (!lotesporInsumo[lote.id_insumo]) {
                lotesporInsumo[lote.id_insumo] = {
                    nombre: lote.nombre_generico,
                    lotes: []
                };
            }
            lotesporInsumo[lote.id_insumo].lotes.push(lote);
        });
        
        let listaLotes = '<ul class="mb-2">';
        Object.values(lotesporInsumo).forEach(insumo => {
            listaLotes += `<li><strong>${insumo.nombre}</strong>: ${insumo.lotes.length} lote(s) vencido(s)</li>`;
        });
        listaLotes += '</ul>';
        
        nuevoAlert.innerHTML = `
            <h5 class="alert-heading"><i class="bi bi-exclamation-triangle-fill"></i> Lotes Vencidos Detectados</h5>
            <p><strong>Los siguientes lotes han vencido y no pueden ser utilizados:</strong></p>
            ${listaLotes}
            <hr>
            <p class="mb-0">Estos lotes han sido excluidos automáticamente del consumo.</p>
            <button type="button" class="btn btn-sm btn-outline-dark mt-2" onclick="descartarAlertaVencidos()">
                <i class="bi bi-check-circle"></i> Entendido, no volver a mostrar
            </button>
        `;
        
        // Insertar antes del protocolo
        const protocoloSection = document.getElementById('protocolo_mensaje').parentElement;
        protocoloSection.parentElement.insertBefore(nuevoAlert, protocoloSection);
    }
}

// NUEVO: Ocultar alerta de lotes vencidos
function ocultarAlertaLotesVencidos() {
    const alertContainer = document.getElementById('alerta_lotes_vencidos');
    if (alertContainer) {
        alertContainer.remove();
    }
}

// NUEVO: Descartar alerta y marcar lotes como notificados
async function descartarAlertaVencidos() {
    try {
        if (lotesVencidosPendientes.length === 0) {
            ocultarAlertaLotesVencidos();
            return;
        }
        
        const lotesIds = lotesVencidosPendientes.map(l => l.id_lote);
        
        const response = await fetch('/consumos/api/lotes-vencidos/notificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lotes_ids: lotesIds })
        });
        
        const data = await response.json();
        if (data.success) {
            ocultarAlertaLotesVencidos();
            lotesVencidosPendientes = [];
            console.log('Lotes marcados como notificados');
        } else {
            console.error('Error marcando lotes:', data.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Mostrar protocolo como cards
function mostrarProtocolo() {
    const grid = document.getElementById('protocolo_grid');
    grid.innerHTML = '';
    insumosConsumo.clear();
    
    protocoloActual.forEach(item => {
        const col = document.createElement('div');
        col.className = 'col-sm-6 col-md-4 col-lg-3 col-xl-2';
        
        // Verificar si hay lote actual
        if (!item.lote_actual) {
            col.innerHTML = `
                <div class="card h-100" style="border: 2px solid #dc3545; border-radius: 15px;">
                    <div class="card-body text-center p-3">
                        <h6>${item.nombre}</h6>
                        <div class="alert alert-danger">SIN STOCK</div>
                    </div>
                </div>
            `;
            grid.appendChild(col);
            return;
        }
        
        const lote = item.lote_actual;
        
        // Calcular días hasta vencimiento
        let advertenciaVencimiento = '';
        const fechaVenc = new Date(lote.fecha_vencimiento);
        const hoy = new Date();
        const diasDiff = Math.floor((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
        
        if (diasDiff <= 30 && diasDiff > 0) {
            advertenciaVencimiento = `<div class="alert alert-warning p-1 mb-2"><small><i class="bi bi-exclamation-triangle"></i> Vence en ${diasDiff} dias</small></div>`;
        } else if (diasDiff <= 0) {
            advertenciaVencimiento = '<div class="alert alert-danger p-1 mb-2"><small><i class="bi bi-x-circle"></i> VENCIDO</small></div>';
        }
        
        const cantidadInicial = Math.floor(lote.aplicaciones_disponibles >= item.cantidad_por_uso ? item.cantidad_por_uso : 0);
        insumosConsumo.set(item.id_insumo, cantidadInicial);
        
        const imagenUrl = item.imagen_url || '/images/insumos/default.png';
        
        const card = document.createElement('div');
        card.className = 'card h-100';
        card.style.cssText = 'border: 2px solid #dee2e6; border-radius: 15px;';
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body text-center p-3';
        
        // Header con stock unitario y lote
        const header = document.createElement('div');
        header.className = 'd-flex justify-content-between align-items-center mb-2';
        header.innerHTML = `
            <small class="text-muted"><strong>Stock Unitario:</strong> ${lote.cantidad_fisica || 1}</small>
            <small class="text-muted"><strong>No.Lote:</strong> ${lote.numero_lote}</small>
        `;
        cardBody.appendChild(header);
        
        // Advertencia de vencimiento
        if (advertenciaVencimiento) {
            const divAdv = document.createElement('div');
            divAdv.innerHTML = advertenciaVencimiento;
            cardBody.appendChild(divAdv);
        }
        
        // Imagen
        const imgDiv = document.createElement('div');
        imgDiv.className = 'mb-2';
        const img = document.createElement('img');
        img.src = imagenUrl;
        img.alt = item.nombre;
        img.className = 'img-fluid rounded';
        img.style.maxHeight = '100px';
        img.onerror = function() { this.src = '/images/insumos/default.png'; };
        imgDiv.appendChild(img);
        cardBody.appendChild(imgDiv);
        
        // Nombre del insumo
        const nombreDiv = document.createElement('div');
        nombreDiv.className = 'mb-2';
        nombreDiv.innerHTML = `<strong style="font-size: 14px;">${item.nombre}</strong>`;
        cardBody.appendChild(nombreDiv);
        
        // Controles de cantidad
        const controlesDiv = document.createElement('div');
        controlesDiv.className = 'd-flex align-items-center justify-content-center mb-3';
        
        const btnMenos = document.createElement('button');
        btnMenos.type = 'button';
        btnMenos.className = 'btn btn-outline-danger btn-sm';
        btnMenos.style.cssText = 'width: 35px; height: 35px; border-radius: 50%; font-size: 20px; padding: 0; line-height: 1;';
        btnMenos.innerHTML = '<i class="bi bi-dash"></i>';
        btnMenos.onclick = function() { decrementarInsumo(item.id_insumo); };
        
        const inputCant = document.createElement('input');
        inputCant.type = 'number';
        inputCant.className = 'form-control text-center mx-2';
        inputCant.setAttribute('data-id', item.id_insumo);
        inputCant.value = cantidadInicial;
        inputCant.min = 0;
        inputCant.max = Math.floor(lote.aplicaciones_disponibles);
        inputCant.step = 1;
        inputCant.style.cssText = 'width: 70px; font-size: 22px; font-weight: bold;';
        inputCant.onchange = function() { 
            // Forzar número entero
            this.value = Math.floor(parseInt(this.value) || 0);
            updateInsumo(item.id_insumo, this.value); 
        };
        
        const btnMas = document.createElement('button');
        btnMas.type = 'button';
        btnMas.className = 'btn btn-outline-success btn-sm';
        btnMas.style.cssText = 'width: 35px; height: 35px; border-radius: 50%; font-size: 20px; padding: 0; line-height: 1;';
        btnMas.innerHTML = '<i class="bi bi-plus"></i>';
        btnMas.onclick = function() { incrementarInsumo(item.id_insumo); };
        
        controlesDiv.appendChild(btnMenos);
        controlesDiv.appendChild(inputCant);
        controlesDiv.appendChild(btnMas);
        cardBody.appendChild(controlesDiv);
        
        // Info del producto
        const infoDiv = document.createElement('div');
        infoDiv.className = 'text-center';
        infoDiv.innerHTML = `
            <p class="mb-2" style="font-size: 12px; line-height: 1.4;">
                <strong style="font-size: 13px;">Saldo: ${Math.floor(lote.aplicaciones_disponibles)} aplicaciones</strong><br>
                <span class="text-muted">Fecha VTO: ${fechaVenc.toLocaleDateString('es-BO')}</span><br>
                <span class="text-muted">${item.presentacion || 'N/A'}</span><br>
                <span class="text-muted">Aplicaciones del lote: ${Math.floor(lote.aplicaciones_disponibles)}</span>
            </p>
        `;
        
        if (item.es_obligatorio) {
            const badge = document.createElement('span');
            badge.className = 'badge bg-warning mb-2';
            badge.textContent = 'Obligatorio';
            infoDiv.appendChild(badge);
        }
        
        // Botón agotado
        const btnAgotado = document.createElement('button');
        btnAgotado.type = 'button';
        btnAgotado.className = 'btn btn-outline-dark btn-sm w-100';
        btnAgotado.innerHTML = '<i class="bi bi-box-seam"></i> Agotado';
        btnAgotado.onclick = function() { 
            mostrarModalAgotado(item.id_insumo, item.nombre, lote.numero_lote, lote.id_lote); 
        };
        infoDiv.appendChild(btnAgotado);
        
        cardBody.appendChild(infoDiv);
        card.appendChild(cardBody);
        col.appendChild(card);
        grid.appendChild(col);
    });
    
    document.getElementById('protocolo_mensaje').style.display = 'none';
    document.getElementById('protocolo_container').style.display = 'block';
    updateTotalAplicaciones();
    updateSubmitButton();
}

// Asegurar números enteros en las funciones
function incrementarInsumo(id) {
    const input = document.querySelector(`input[data-id="${id}"]`);
    const max = Math.floor(parseInt(input.getAttribute('max')));
    const current = Math.floor(parseInt(input.value) || 0);
    if (current < max) {
        input.value = current + 1;
        updateInsumo(id, input.value);
    }
}

function decrementarInsumo(id) {
    const input = document.querySelector(`input[data-id="${id}"]`);
    const current = Math.floor(parseInt(input.value) || 0);
    if (current > 0) {
        input.value = current - 1;
        updateInsumo(id, input.value);
    }
}

function updateInsumo(id, cantidad) {
    cantidad = Math.floor(parseInt(cantidad) || 0);
    insumosConsumo.set(id, cantidad);
    updateTotalAplicaciones();
    updateSubmitButton();
}

function updateTotalAplicaciones() {
    // Contar cuántos insumos tienen cantidad > 0
    const insumosSeleccionados = Array.from(insumosConsumo.values()).filter(cant => cant > 0).length;
    
    document.getElementById('total_aplicaciones').textContent = `${insumosSeleccionados} insumo${insumosSeleccionados !== 1 ? 's' : ''}`;
}

function updateSubmitButton() {
    const hasService = document.getElementById('id_tipo_servicio').value;
    const hasInsumos = Array.from(insumosConsumo.values()).some(cant => cant > 0);
    document.getElementById('btn_guardar').disabled = !(hasService && hasInsumos);
}

function mostrarModalRecibo() {
    const tipoServicio = document.getElementById('id_tipo_servicio').selectedOptions[0].text;
    let resumen = `<strong>Servicio:</strong> ${tipoServicio}<br><strong>Insumos:</strong><ul>`;

    insumosConsumo.forEach((cantidad, id) => {
        if (cantidad > 0) {
            const insumo = protocoloActual.find(i => i.id_insumo == id);
            resumen += `<li>${insumo.nombre}: ${cantidad} aplicaciones</li>`;
        }
    });
    resumen += '</ul>';

    document.getElementById('resumen_consumo').innerHTML = resumen;
    new bootstrap.Modal(document.getElementById('reciboModal')).show();
}

function confirmarConsumo() {
    const numeroRecibo = document.getElementById('numero_recibo_input').value.trim();
    if (!numeroRecibo) {
        alert('Debe ingresar el número de recibo');
        return;
    }

    const insumosArray = [];
    insumosConsumo.forEach((cantidad, id) => {
        if (cantidad > 0) {
            insumosArray.push({ id_insumo: parseInt(id), cantidad: parseInt(cantidad) });
        }
    });

    document.getElementById('hidden_insumos').value = JSON.stringify(insumosArray);
    document.getElementById('hidden_numero_recibo').value = numeroRecibo;
    document.getElementById('consumoForm').submit();
}

function mostrarModalAgotado(idInsumo, nombre, lote, idLote) {
    document.getElementById('agotado_insumo_nombre').textContent = nombre;
    document.getElementById('agotado_lote_numero').textContent = lote;
    document.getElementById('agotado_lote_id').value = idLote;
    new bootstrap.Modal(document.getElementById('agotadoModal')).show();
}

async function confirmarAgotado() {
    const idLote = document.getElementById('agotado_lote_id').value;
    const motivo = document.getElementById('motivo_agotado').value || 'Agotado manualmente';

    try {
        const response = await fetch('/consumos/api/ajuste', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_lote: parseInt(idLote), aplicaciones_sobrantes: 0, motivo: motivo })
        });

        const data = await response.json();
        if (data.success) {
            alert('Lote marcado como agotado');
            location.reload();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al registrar el ajuste');
    }
}

async function verificarDisponibilidad(idTipoServicio) {
    try {
        const response = await fetch('/consumos/api/disponibilidad/' + idTipoServicio);
        const data = await response.json();
        const alertDiv = document.getElementById('disponibilidad_alert');

        if (data.success && !data.todo_disponible) {
            const faltantes = data.disponibilidad.filter(item => item.obligatorio && !item.suficiente);
            alertDiv.innerHTML = `<div class="alert alert-warning"><small><strong><i class="bi bi-exclamation-triangle"></i> Insumos sin stock:</strong> ${faltantes.map(f => f.nombre).join(', ')}</small></div>`;
            alertDiv.style.display = 'block';
        } else {
            alertDiv.style.display = 'none';
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function mostrarMensajeInicial() {
    document.getElementById('protocolo_mensaje').innerHTML = '<div class="text-center text-muted py-4"><h5><i class="bi bi-hand-index-thumb"></i> Selecciona un tipo de servicio</h5></div>';
    document.getElementById('protocolo_mensaje').style.display = 'block';
    document.getElementById('protocolo_container').style.display = 'none';
    insumosConsumo.clear();
    updateTotalAplicaciones();
    updateSubmitButton();
    ocultarAlertaLotesVencidos();
}