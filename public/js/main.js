// JavaScript básico para el sistema DM-5
console.log('🏥 Sistema DM-5 cargado');

// Validación simple de formularios
document.addEventListener('DOMContentLoaded', function() {
    // Validar confirmación de contraseña
    const passwordField = document.getElementById('password');
    const confirmPasswordField = document.getElementById('confirm_password');
    
    if (passwordField && confirmPasswordField) {
        confirmPasswordField.addEventListener('input', function() {
            if (passwordField.value !== confirmPasswordField.value) {
                confirmPasswordField.setCustomValidity('Las contraseñas no coinciden');
            } else {
                confirmPasswordField.setCustomValidity('');
            }
        });
    }

    // Validar CI boliviano
    const ciField = document.getElementById('ci');
    if (ciField) {
        ciField.addEventListener('input', function() {
            const ci = this.value;
            if (ci && !/^\d{7,8}$/.test(ci)) {
                this.setCustomValidity('El CI debe tener entre 7 y 8 dígitos');
            } else {
                this.setCustomValidity('');
            }
        });
    }

    // Validar número de licencia
    const licenciaField = document.getElementById('numero_licencia');
    if (licenciaField) {
        licenciaField.addEventListener('input', function() {
            const licencia = this.value;
            if (licencia && !/^[A-Z]{2,3}-\d{4}-\d{3}$/.test(licencia)) {
                this.setCustomValidity('Formato sugerido: ODT-2024-001');
            } else {
                this.setCustomValidity('');
            }
        });
    }
});