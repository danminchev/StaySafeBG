import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getCurrentUser } from '../services/authService.js';
import { getUserRole } from '../services/rolesService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function showForbidden(message) {
	const container = document.getElementById('page-content');
	if (!container) return;

	container.innerHTML = `
		<div class="alert alert-danger" role="alert">${message}</div>
		<a href="index.html" class="btn btn-primary mt-2">Към началната страница</a>
	`;
}

async function initAdminPage() {
	await renderHeader();
	renderFooter();

	if (!hasSupabaseConfig) {
		showForbidden('Админ панелът изисква активирана Supabase конфигурация.');
		return;
	}

	try {
		const user = await getCurrentUser();
		if (!user) {
			showForbidden('Трябва да сте влезли с админ акаунт.');
			return;
		}

		const role = await getUserRole(user.id);
		if (role !== 'admin') {
			showForbidden('Нямате права за достъп до админ панела.');
		}
	} catch (error) {
		showForbidden(error.message || 'Грешка при проверка на правата.');
	}
}

initAdminPage();
