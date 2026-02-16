import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { registerUser } from '../services/authService.js';
import { ensureUserRole } from '../services/rolesService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function showMessage(message, type = 'danger') {
	const form = document.querySelector('form');
	if (!form) return;

	let alertEl = document.getElementById('register-message');
	if (!alertEl) {
		alertEl = document.createElement('div');
		alertEl.id = 'register-message';
		alertEl.className = 'alert mt-3';
		form.prepend(alertEl);
	}

	alertEl.className = `alert alert-${type} mt-3`;
	alertEl.textContent = message;
}

async function handleRegisterSubmit(event) {
	event.preventDefault();

	if (!hasSupabaseConfig) {
		showMessage('Липсва Supabase конфигурация. Добавете VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env файла.');
		return;
	}

	const firstName = document.getElementById('firstName')?.value.trim() || '';
	const lastName = document.getElementById('lastName')?.value.trim() || '';
	const email = document.getElementById('email')?.value.trim() || '';
	const password = document.getElementById('password')?.value || '';
	const confirmPassword = document.getElementById('confirmPassword')?.value || '';

	if (!firstName || !lastName || !email || !password || !confirmPassword) {
		showMessage('Моля, попълнете всички полета.');
		return;
	}

	if (password.length < 6) {
		showMessage('Паролата трябва да е поне 6 символа.');
		return;
	}

	if (password !== confirmPassword) {
		showMessage('Паролите не съвпадат.');
		return;
	}

	const submitButton = event.target.querySelector('button[type="submit"]');
	if (submitButton) {
		submitButton.disabled = true;
		submitButton.textContent = 'Създаване...';
	}

	try {
		const { user } = await registerUser({ email, password, firstName, lastName });

		if (user?.id) {
			await ensureUserRole(user.id);
		}

		showMessage('Регистрацията е успешна. Може да се наложи потвърждение по имейл.', 'success');
		window.setTimeout(() => {
			window.location.href = 'login.html';
		}, 900);
	} catch (error) {
		showMessage(error.message || 'Възникна грешка при регистрация.');
	} finally {
		if (submitButton) {
			submitButton.disabled = false;
			submitButton.textContent = 'Създай акаунт';
		}
	}
}

async function initRegisterPage() {
	await renderHeader();
	renderFooter();

	const form = document.querySelector('form');
	if (form) {
		form.addEventListener('submit', handleRegisterSubmit);
	}
}

initRegisterPage();
