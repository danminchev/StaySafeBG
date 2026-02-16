export function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '1060'; // Ensure it's above modals
        document.body.appendChild(container);
    }

    const toastEl = document.createElement('div');
    
    // Choose colors/icons based on type
    let bgClass = 'bg-primary';
    let icon = 'info-circle';
    
    if (type === 'success') {
        bgClass = 'bg-success';
        icon = 'check-circle';
    } else if (type === 'error') {
        bgClass = 'bg-danger';
        icon = 'exclamation-triangle';
    } else if (type === 'warning') {
        bgClass = 'bg-warning text-dark';
        icon = 'exclamation-circle';
    } else if (type === 'info') {
        bgClass = 'bg-info text-dark';
        icon = 'info-circle';
    }

    const textColor = (type === 'warning' || type === 'info') ? 'text-dark' : 'text-white';

    toastEl.className = `toast align-items-center ${textColor} ${bgClass} border-0 shadow-lg mb-2`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');

    // SVG Icons
    const icons = {
        'check-circle': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>',
        'exclamation-triangle': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>',
        'info-circle': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-info-circle-fill" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>',
        'exclamation-circle': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-exclamation-circle-fill" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>'
    };

    const iconHtml = icons[icon] || icons['info-circle'];

    toastEl.innerHTML = `
        <div class="d-flex w-100">
            <div class="toast-body d-flex align-items-center gap-3 w-100">
                 <div class="flex-shrink-0">
                    ${iconHtml}
                 </div>
                 <div class="flex-grow-1">
                     ${message}
                 </div>
                <button type="button" class="btn-close ${type === 'warning' || type === 'info' ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    container.appendChild(toastEl);

    // Initialize Bootstrap Toast (assuming bootstrap is globally available on window)
    const bootstrap = window.bootstrap;
    if (bootstrap) {
        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();
        
        toastEl.addEventListener('hidden.bs.toast', () => {
            toastEl.remove();
        });
    } else {
        // Fallback if bootstrap is not loaded (should not happen in this project)
        console.warn('Bootstrap JS not found, falling back to simple display');
        setTimeout(() => toastEl.remove(), 4000);
    }
}
