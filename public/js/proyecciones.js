/**
 * JavaScript para el Generador de Proyecciones Dentales
 */

let pacienteSeleccionado = null;
let proyeccionesGeneradas = [];
let proyeccionSeleccionada = null;

// ==============================
// NAVEGACIÓN ENTRE PASOS (SIMPLIFICADA)
// ==============================

function cambiarPaso(paso) {
    console.log('🔄 Cambiando a paso:', paso);
    
    // Ocultar TODOS los pasos
    ['step1', 'step2', 'step3', 'step4'].forEach(stepId => {
        const element = document.getElementById(stepId);
        if (element) {
            element.style.display = 'none';
            console.log(`  ❌ Ocultando ${stepId}`);
        }
    });
    
    // Mostrar paso actual
    const pasoActual = document.getElementById(`step${paso}`);
    if (pasoActual) {
        pasoActual.style.display = 'block';
        console.log(`  ✅ Mostrando step${paso}`);
    } else {
        console.error(`  ⚠️ No se encontró step${paso}`);
    }
    
    // Actualizar indicadores visuales
    ['indicator1', 'indicator2', 'indicator3', 'indicator4'].forEach((id, index) => {
        const indicator = document.getElementById(id);
        if (!indicator) return;
        
        const stepNum = index + 1;
        const stepNumber = indicator.querySelector('.step-number');
        
        // Reset
        indicator.style.opacity = '0.5';
        if (stepNumber) {
            stepNumber.style.background = '#ddd';
            stepNumber.style.color = '#666';
        }
        
        if (stepNum < paso) {
            // Completado
            indicator.style.opacity = '1';
            if (stepNumber) {
                stepNumber.style.background = '#28a745';
                stepNumber.style.color = 'white';
            }
        } else if (stepNum === paso) {
            // Activo
            indicator.style.opacity = '1';
            if (stepNumber) {
                stepNumber.style.background = '#007bff';
                stepNumber.style.color = 'white';
            }
        }
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    console.log('✓ Cambio completado');
}

function irPaso2() {
    console.log('📍 irPaso2 llamado');
    
    const pacienteId = document.getElementById('paciente_ci');
    if (!pacienteId || !pacienteId.value) {
        alert('Debe seleccionar un paciente primero');
        return;
    }
    
    pacienteSeleccionado = { ci: pacienteId.value };
    console.log('✓ Paciente seleccionado:', pacienteSeleccionado);
    
    cambiarPaso(2);
}

function volverPaso1() {
    cambiarPaso(1);
}

function volverPaso3() {
    cambiarPaso(3);
}

function irPaso4() {
    if (!proyeccionSeleccionada) {
        alert('Debe seleccionar una proyección');
        return;
    }
    
    const proyeccion = proyeccionesGeneradas.find(p => p.intensidad === proyeccionSeleccionada);
    if (proyeccion) {
        document.getElementById('diagnostico').value = proyeccion.diagnostico;
        document.getElementById('duracion_estimada').value = proyeccion.duracionEstimada;
    }
    
    mostrarPreviewSeleccion();
    cambiarPaso(4);
}

// ==============================
// BÚSQUEDA DE PACIENTES
// ==============================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Cargado - Inicializando proyecciones.js');
    
    const searchInput = document.getElementById('searchPaciente');
    const radioSourceOptions = document.getElementsByName('usar_imagen_existente');
    
    if (searchInput && !document.getElementById('paciente_ci')) {
        searchInput.addEventListener('input', debounce(function(e) {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                buscarPacientes(query);
            } else {
                document.getElementById('pacientesResults').innerHTML = '';
            }
        }, 500));
    }

    // Toggle de origen de imagen
    if (radioSourceOptions) {
        radioSourceOptions.forEach(radio => {
            radio.addEventListener('change', function() {
                const uploadGroup = document.getElementById('uploadImageGroup');
                const imagenInput = document.getElementById('imagen');
                
                if (this.value === 'false') {
                    uploadGroup.style.display = 'block';
                    if (imagenInput) imagenInput.required = true;
                } else {
                    uploadGroup.style.display = 'none';
                    if (imagenInput) imagenInput.required = false;
                }
            });
        });
    }

    // Estilos para cards de tratamiento
    document.querySelectorAll('.tratamiento-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.tratamiento-card').forEach(c => {
                c.style.borderColor = '#ddd';
            });
            this.style.borderColor = '#007bff';
            const radio = this.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    // Form guardar
    const formGuardar = document.getElementById('formGuardar');
    if (formGuardar) {
        formGuardar.addEventListener('submit', guardarProyeccion);
    }
    
    console.log('✓ Inicialización completada');
});

async function buscarPacientes(query) {
    try {
        const response = await fetch(`/pacientes/buscar?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
            mostrarResultadosPacientes(data.pacientes);
        }
    } catch (error) {
        console.error('Error buscando pacientes:', error);
    }
}

function mostrarResultadosPacientes(pacientes) {
    const resultsDiv = document.getElementById('pacientesResults');
    
    if (pacientes.length === 0) {
        resultsDiv.innerHTML = `
            <div class="alert alert-info">
                No se encontraron pacientes. 
                <a href="/pacientes/nuevo">¿Desea registrar uno nuevo?</a>
            </div>
        `;
        return;
    }
    
    resultsDiv.innerHTML = pacientes.map(p => `
        <div class="paciente-item" onclick="seleccionarPaciente(${p.ci}, '${p.nombres}', '${p.apellidos}', '${p.ci}')" style="padding: 1rem; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.3s;">
            <div class="paciente-info" style="display: flex; flex-direction: column;">
                <strong>${p.nombres} ${p.apellidos}</strong>
                <span style="color: #666; font-size: 0.9rem;">CI: ${p.ci}</span>
            </div>
            <button type="button" class="btn btn-sm btn-primary">Seleccionar</button>
        </div>
    `).join('');
}

function seleccionarPaciente(ci, nombres, apellidos, ci) {
    pacienteSeleccionado = { ci, nombres, apellidos, ci };
    
    document.getElementById('pacientesResults').innerHTML = `
        <div class="paciente-selected" style="padding: 1.5rem; border: 2px solid #28a745; border-radius: 8px; background: #f0fff4; display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
            <div class="paciente-info" style="display: flex; flex-direction: column;">
                <strong style="font-size: 1.1rem; margin-bottom: 0.25rem;">${nombres} ${apellidos}</strong>
                <span style="color: #666; font-size: 0.9rem;">CI: ${ci}</span>
            </div>
            <input type="hidden" id="paciente_ci" value="${id}">
            <button type="button" class="btn btn-primary" onclick="irPaso2()">Continuar →</button>
        </div>
    `;
}

// ==============================
// GENERAR PROYECCIONES
// ==============================

async function generarProyecciones() {
    const form = document.getElementById('formProyeccion');
    const formData = new FormData(form);
    
    const tipoTratamiento = formData.get('tipo_tratamiento');
    if (!tipoTratamiento) {
        alert('Debe seleccionar un tipo de tratamiento');
        return;
    }
    
    const usarExistente = formData.get('usar_imagen_existente');
    if (usarExistente === 'false' && !formData.get('imagen')) {
        alert('Debe subir una imagen');
        return;
    }
    
    formData.append('paciente_ci', pacienteSeleccionado.ci);
    
    cambiarPaso(3);
    document.getElementById('loadingProyecciones').style.display = 'block';
    document.getElementById('proyeccionesGrid').style.display = 'none';
    
    try {
        const response = await fetch('/proyecciones/generar', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            proyeccionesGeneradas = data.proyecciones;
            mostrarProyecciones(data.proyecciones);
        } else {
            alert('Error: ' + data.message);
            cambiarPaso(2);
        }
    } catch (error) {
        console.error('Error generando proyecciones:', error);
        alert('Error al generar proyecciones: ' + error.message);
        cambiarPaso(2);
    }
}

function mostrarProyecciones(proyecciones) {
    document.getElementById('loadingProyecciones').style.display = 'none';
    const grid = document.getElementById('proyeccionesGrid');
    
    grid.innerHTML = proyecciones.map((p, index) => `
        <div class="proyeccion-option" onclick="seleccionarProyeccion(${p.intensidad})" id="proyeccion_${p.intensidad}" style="border: 3px solid transparent; border-radius: 8px; padding: 1rem; cursor: pointer; transition: all 0.3s; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div class="proyeccion-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4>Variación ${index + 1}</h4>
                <span class="badge badge-primary" style="background: #007bff; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">Precision ${p.intensidad}%</span>
            </div>
            <img src="${p.rutaRelativa}" alt="Proyección ${p.intensidad}%" style="width: 100%; border-radius: 4px;">
            <div class="proyeccion-details" style="margin: 1rem 0; font-size: 0.9rem;">
                <p><strong>Diagnóstico:</strong> ${p.diagnostico}</p>
                <p><strong>Duración:</strong> ${p.duracionEstimada}</p>
            </div>
            <div class="proyeccion-footer" style="margin-top: 1rem;">
                <button type="button" class="btn btn-block btn-outline-primary" style="width: 100%;">Seleccionar esta variación</button>
            </div>
        </div>
    `).join('');
    
    grid.style.display = 'grid';
    document.getElementById('step3Actions').style.display = 'flex';
}

function seleccionarProyeccion(intensidad) {
    document.querySelectorAll('.proyeccion-option').forEach(option => {
        option.style.borderColor = 'transparent';
        option.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    });
    
    const selected = document.getElementById(`proyeccion_${intensidad}`);
    selected.style.borderColor = '#28a745';
    selected.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
    
    proyeccionSeleccionada = intensidad;
    document.getElementById('btnContinuar').disabled = false;
}

function cancelarProyecciones() {
    if (confirm('¿Está seguro que desea cancelar? Se perderán las proyecciones generadas.')) {
        window.location.href = '/pacientes';
    }
}

// ==============================
// GUARDAR PROYECCIÓN
// ==============================

function mostrarPreviewSeleccion() {
    const proyeccion = proyeccionesGeneradas.find(p => p.intensidad === proyeccionSeleccionada);
    if (!proyeccion) return;
    
    document.getElementById('selectedPreview').innerHTML = `
        <div class="selected-proyeccion" style="display: flex; gap: 2rem; padding: 1.5rem; background: #f8f9fa; border-radius: 8px; margin-top: 1rem;">
            <img src="${proyeccion.rutaRelativa}" alt="Proyección seleccionada" style="width: 300px; border-radius: 8px;">
            <div class="selection-info" style="flex: 1;">
                <span class="badge badge-success" style="background: #28a745; color: white; padding: 0.5rem 1rem; border-radius: 20px; display: inline-block; margin-bottom: 1rem;">Intensidad ${proyeccion.intensidad}%</span>
                <p><strong>Diagnóstico sugerido:</strong> ${proyeccion.diagnostico}</p>
                <p><strong>Duración estimada:</strong> ${proyeccion.duracionEstimada}</p>
            </div>
        </div>
    `;
}

async function guardarProyeccion(e) {
    e.preventDefault();
    
    const formData = {
        intensidad: proyeccionSeleccionada,
        diagnostico: document.getElementById('diagnostico').value,
        duracion_estimada: document.getElementById('duracion_estimada').value,
        id_usuario: 12345678
    };
    
    try {
        const response = await fetch('/proyecciones/guardar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('¡Proyección guardada exitosamente!');
            window.location.href = `/proyecciones/${data.proyeccion.id_proyeccion}`;
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar la proyección');
    }
}

// ==============================
// UTILIDADES
// ==============================

function previsualizarImagen(event) {
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    const file = event.target.files[0];

    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen es demasiado grande (máx. 5MB)');
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Hacer funciones globales
window.irPaso2 = irPaso2;
window.volverPaso1 = volverPaso1;
window.volverPaso3 = volverPaso3;
window.irPaso4 = irPaso4;
window.generarProyecciones = generarProyecciones;
window.seleccionarPaciente = seleccionarPaciente;
window.seleccionarProyeccion = seleccionarProyeccion;
window.cancelarProyecciones = cancelarProyecciones;
window.previsualizarImagen = previsualizarImagen;