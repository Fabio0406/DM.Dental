/**
 * JavaScript para Gestión de Pacientes
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeSearchFilters();
    initializeImageHandlers();
    initializeFormValidation();
});

// ==============================
// Búsqueda y Filtros
// ==============================

function initializeSearchFilters() {
    const searchForm = document.querySelector('.search-form');
    if (!searchForm) return;

    // Auto-submit al presionar Enter
    const inputs = searchForm.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchForm.submit();
            }
        });
    });

    // Limpiar búsqueda
    const clearBtn = document.getElementById('clearSearch');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            window.location.href = '/pacientes';
        });
    }
}

// ==============================
// Manejo de Imágenes
// ==============================

function initializeImageHandlers() {
    // Preview de imagen al seleccionar archivo
    const imageInput = document.getElementById('imagen');
    if (imageInput) {
        imageInput.addEventListener('change', handleImagePreview);
    }

    // Galería de imágenes (si existe)
    const galleryItems = document.querySelectorAll('.gallery-item');
    if (galleryItems.length > 0) {
        initializeGallery(galleryItems);
    }
}

function handleImagePreview(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');

    if (!file) {
        if (preview) preview.style.display = 'none';
        return;
    }

    // Validar tamaño
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        alert('La imagen es demasiado grande. Tamaño máximo: 5MB');
        event.target.value = '';
        return;
    }

    // Validar tipo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Formato no válido. Use: JPG, PNG o WEBP');
        event.target.value = '';
        return;
    }

    // Mostrar preview
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImg.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function initializeGallery(items) {
    items.forEach(item => {
        item.addEventListener('click', function() {
            const imgSrc = this.querySelector('img').src;
            openLightbox(imgSrc);
        });
    });
}

function openLightbox(imageSrc) {
    // Crear lightbox
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <span class="lightbox-close">&times;</span>
            <img src="${imageSrc}" alt="Imagen ampliada">
        </div>
    `;

    document.body.appendChild(lightbox);
    document.body.style.overflow = 'hidden';

    // Cerrar al hacer clic
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
            closeLightbox(lightbox);
        }
    });

    // Cerrar con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeLightbox(lightbox);
        }
    });
}

function closeLightbox(lightbox) {
    lightbox.remove();
    document.body.style.overflow = '';
}

// ==============================
// Validación de Formularios
// ==============================

function initializeFormValidation() {
    const form = document.getElementById('formRegistro') || document.getElementById('formEditar');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        if (!validatePacienteForm()) {
            e.preventDefault();
        }
    });
}

function validatePacienteForm() {
    let isValid = true;
    const errors = [];

    // Validar CI
    const ci = document.getElementById('ci');
    if (ci && !ci.disabled) {
        const ciValue = ci.value.trim();
        if (!/^\d+$/.test(ciValue)) {
            errors.push('El CI debe contener solo números');
            isValid = false;
            highlightError(ci);
        } else if (ciValue.length < 6 || ciValue.length > 10) {
            errors.push('El CI debe tener entre 6 y 10 dígitos');
            isValid = false;
            highlightError(ci);
        }
    }

    // Validar nombres
    const nombres = document.getElementById('nombres');
    if (nombres && nombres.value.trim().length < 2) {
        errors.push('Los nombres deben tener al menos 2 caracteres');
        isValid = false;
        highlightError(nombres);
    }

    // Validar apellidos
    const apellidos = document.getElementById('apellidos');
    if (apellidos && apellidos.value.trim().length < 2) {
        errors.push('Los apellidos deben tener al menos 2 caracteres');
        isValid = false;
        highlightError(apellidos);
    }

    // Validar fecha de nacimiento
    const fechaNac = document.getElementById('fecha_nacimiento');
    if (fechaNac) {
        const fecha = new Date(fechaNac.value);
        const hoy = new Date();
        
        if (fecha > hoy) {
            errors.push('La fecha de nacimiento no puede ser futura');
            isValid = false;
            highlightError(fechaNac);
        }

        // Validar edad mínima (debe ser mayor de 0 años)
        const edad = hoy.getFullYear() - fecha.getFullYear();
        if (edad > 120) {
            errors.push('La fecha de nacimiento no es válida');
            isValid = false;
            highlightError(fechaNac);
        }
    }

    // Validar teléfono (opcional pero si existe debe ser válido)
    const telefono = document.getElementById('telefono');
    if (telefono && telefono.value.trim()) {
        const telefonoValue = telefono.value.trim();
        if (!/^\d{7,8}$/.test(telefonoValue)) {
            errors.push('El teléfono debe tener 7 u 8 dígitos');
            isValid = false;
            highlightError(telefono);
        }
    }

    if (!isValid) {
        showErrors(errors);
    }

    return isValid;
}

function highlightError(element) {
    element.classList.add('error');
    element.addEventListener('input', function() {
        this.classList.remove('error');
    }, { once: true });
}

function showErrors(errors) {
    alert('Por favor corrija los siguientes errores:\n\n' + errors.join('\n'));
}

// ==============================
// Acciones de Paciente
// ==============================

async function eliminarPaciente(id, nombre) {
    if (!confirm(`¿Está seguro que desea eliminar al paciente ${nombre}?\n\nEsta acción también eliminará:\n- Todas sus imágenes\n- Todas sus proyecciones\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const response = await fetch(`/pacientes/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Paciente eliminado exitosamente', 'success');
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al eliminar el paciente', 'error');
    }
}

async function subirNuevaImagen(pacienteId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp';

    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('imagen', file);

        try {
            const response = await fetch(`/pacientes/${pacienteId}/imagen`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                showNotification('Imagen subida exitosamente', 'success');
                setTimeout(() => {
                    location.reload();
                }, 1000);
            } else {
                showNotification('Error: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error al subir la imagen', 'error');
        }
    };

    input.click();
}

// ==============================
// Búsqueda Rápida en Tiempo Real
// ==============================

function setupQuickSearch() {
    const searchInput = document.getElementById('quickSearch');
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            clearSearchResults();
            return;
        }

        searchTimeout = setTimeout(async () => {
            await performQuickSearch(query);
        }, 300);
    });
}

async function performQuickSearch(query) {
    try {
        const response = await fetch(`/pacientes/buscar?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.success) {
            displayQuickSearchResults(data.pacientes);
        }
    } catch (error) {
        console.error('Error en búsqueda rápida:', error);
    }
}

function displayQuickSearchResults(pacientes) {
    const resultsContainer = document.getElementById('quickSearchResults');
    if (!resultsContainer) return;

    if (pacientes.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No se encontraron pacientes</div>';
        return;
    }

    resultsContainer.innerHTML = pacientes.map(p => `
        <a href="/pacientes/${p.id}/perfil" class="quick-result-item">
            <div class="result-info">
                <strong>${p.nombres} ${p.apellidos}</strong>
                <small>CI: ${p.ci}</small>
            </div>
            <span class="result-arrow">→</span>
        </a>
    `).join('');
}

function clearSearchResults() {
    const resultsContainer = document.getElementById('quickSearchResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
    }
}

// ==============================
// Notificaciones
// ==============================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// ==============================
// Exportar Funciones Globales
// ==============================

window.eliminarPaciente = eliminarPaciente;
window.subirNuevaImagen = subirNuevaImagen;

// Estilos adicionales
const style = document.createElement('style');
style.textContent = `
    .error {
        border-color: #dc3545 !important;
        background-color: #fff5f5 !important;
    }

    .lightbox {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: fadeIn 0.3s;
    }

    .lightbox-content {
        position: relative;
        max-width: 90vw;
        max-height: 90vh;
    }

    .lightbox-content img {
        max-width: 100%;
        max-height: 90vh;
        object-fit: contain;
    }

    .lightbox-close {
        position: absolute;
        top: -40px;
        right: 0;
        color: white;
        font-size: 2rem;
        cursor: pointer;
        padding: 0.5rem;
    }

    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s;
        font-weight: 500;
    }

    .notification.show {
        transform: translateX(0);
    }

    .notification-success {
        background: #4caf50;
        color: white;
    }

    .notification-error {
        background: #f44336;
        color: white;
    }

    .notification-info {
        background: #2196f3;
        color: white;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .quick-result-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        border-bottom: 1px solid #eee;
        text-decoration: none;
        color: inherit;
        transition: background 0.2s;
    }

    .quick-result-item:hover {
        background: #f8f9fa;
    }

    .result-info {
        display: flex;
        flex-direction: column;
    }

    .result-info strong {
        margin-bottom: 0.25rem;
    }

    .result-info small {
        color: #666;
    }

    .no-results {
        padding: 1rem;
        text-align: center;
        color: #999;
    }
`;
document.head.appendChild(style);