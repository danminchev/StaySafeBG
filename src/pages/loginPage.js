import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { loginUser } from '../services/authService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function showMessage(message, type = 'danger') {
	const form = document.querySelector('form');
	if (!form) return;

	let alertEl = document.getElementById('login-message');
	if (!alertEl) {
		alertEl = document.createElement('div');
		alertEl.id = 'login-message';
		alertEl.className = 'alert mt-3';
		form.prepend(alertEl);
	}

	alertEl.className = `alert alert-${type} mt-3`;
	alertEl.textContent = message;
}

async function handleLoginSubmit(event) {
	event.preventDefault();

	if (!hasSupabaseConfig) {
		showMessage('Липсва Supabase конфигурация. Добавете VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env файла.');
		return;
	}

	const emailInput = document.getElementById('email');
	const passwordInput = document.getElementById('password');

	const email = emailInput?.value.trim();
	const password = passwordInput?.value || '';

	if (!email || !password) {
		showMessage('Моля, попълнете имейл и парола.');
		return;
	}

	const submitButton = event.target.querySelector('button[type="submit"]');
	if (submitButton) {
		submitButton.disabled = true;
		submitButton.textContent = 'Влизане...';
	}

	try {
		await loginUser({ email, password });
		showMessage('Успешен вход. Пренасочване...', 'success');
		window.setTimeout(() => {
			window.location.href = 'index.html';
		}, 500);
	} catch (error) {
		showMessage(error.message || 'Възникна грешка при вход.');
	} finally {
		if (submitButton) {
			submitButton.disabled = false;
			submitButton.textContent = 'Влез';
		}
	}
}

async function initLoginPage() {
	await renderHeader();
	renderFooter();

	const form = document.querySelector('form');
	if (form) {
		form.addEventListener('submit', handleLoginSubmit);
	}
}

initLoginPage();
