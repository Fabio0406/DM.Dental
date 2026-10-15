// Utilidades compartidas del Sistema DM-5
window.DM5 = (function () {
    const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    const fecha = (value, conHora = false) => {
        if (!value) return '—';
        const d = new Date(value);
        if (isNaN(d)) return '—';
        const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
        if (conHora) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleString('es-BO', opts);
    };

    const moneda = (value) => 'Bs ' + (parseFloat(value) || 0).toLocaleString('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const icons = () => {
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    // Notificación no bloqueante (reemplaza alert())
    const toast = (mensaje, tipo = 'success') => {
        let stack = document.getElementById('dm5-toasts');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'dm5-toasts';
            stack.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(stack);
        }
        const icono = { success: 'circle-check', danger: 'circle-x', warning: 'triangle-alert', info: 'info' }[tipo] || 'info';
        const el = document.createElement('div');
        el.className = 'toast align-items-center';
        el.setAttribute('role', 'status');
        el.innerHTML =
            '<div class="d-flex align-items-center gap-2 p-3">' +
                '<i data-lucide="' + icono + '" style="color: var(--' + tipo + ')"></i>' +
                '<div class="flex-grow-1 small fw-semibold">' + escape(mensaje) + '</div>' +
                '<button type="button" class="btn-close btn-sm" data-bs-dismiss="toast" aria-label="Cerrar"></button>' +
            '</div>';
        stack.appendChild(el);
        icons();
        const t = new bootstrap.Toast(el, { delay: 4000 });
        el.addEventListener('hidden.bs.toast', () => el.remove());
        t.show();
    };

    return { escape, fecha, moneda, icons, toast };
})();

document.addEventListener('DOMContentLoaded', function () {
    // Mostrar / ocultar contraseña
    document.querySelectorAll('[data-toggle-password]').forEach(btn => {
        btn.addEventListener('click', function () {
            const input = document.getElementById(this.dataset.togglePassword);
            const visible = input.type === 'text';
            input.type = visible ? 'password' : 'text';
            this.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
            this.innerHTML = '<i data-lucide="' + (visible ? 'eye' : 'eye-off') + '"></i>';
            DM5.icons();
        });
    });

    // Botones con estado de carga al enviar el formulario
    document.querySelectorAll('form[data-loading]').forEach(form => {
        form.addEventListener('submit', function () {
            if (!form.checkValidity()) return;
            const btn = form.querySelector('[type="submit"]');
            if (!btn) return;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> ' + (form.dataset.loading || 'Procesando…');
        });
    });

    // Validar confirmación de contraseña
    const passwordField = document.getElementById('password');
    const confirmPasswordField = document.getElementById('confirm_password');
    if (passwordField && confirmPasswordField) {
        const check = () => confirmPasswordField.setCustomValidity(
            passwordField.value !== confirmPasswordField.value ? 'Las contraseñas no coinciden' : ''
        );
        confirmPasswordField.addEventListener('input', check);
        passwordField.addEventListener('input', check);
    }

    // Validar CI boliviano
    const ciField = document.getElementById('ci');
    if (ciField && !ciField.readOnly) {
        ciField.addEventListener('input', function () {
            this.setCustomValidity(this.value && !/^\d{7,8}$/.test(this.value) ? 'El CI debe tener entre 7 y 8 dígitos' : '');
        });
    }

    // Validar número de licencia
    const licenciaField = document.getElementById('numero_licencia');
    if (licenciaField) {
        licenciaField.addEventListener('input', function () {
            this.setCustomValidity(this.value && !/^[A-Z]{2,3}-\d{4}-\d{3}$/.test(this.value) ? 'Formato esperado: ODT-2024-001' : '');
        });
    }
});
