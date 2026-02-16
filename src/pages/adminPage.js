import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getCurrentUser } from '../services/authService.js';
import { getUserRole } from '../services/rolesService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';
import { createArticle } from '../services/articlesService.js';

function showForbidden(message) {
	const container = document.getElementById('page-content');
	if (!container) return;

    container.style.display = 'block';
	container.innerHTML = `
		<div class="alert alert-danger" role="alert">${message}</div>
		<a href="index.html" class="btn btn-primary mt-2">Към началната страница</a>
	`;
}

// Ensure bootstrap is available
const bootstrap = window.bootstrap;

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
			// Redirect immediately if not admin
			window.location.replace('index.html');
			return;
		}

		// Proceed to render admin content...
		renderAdminContent();

	} catch (error) {
		console.error('Admin check failed:', error);
		window.location.replace('index.html');
	}
}

function renderAdminContent() {
	const container = document.getElementById('page-content');
	if (!container) return;
    
    container.style.display = 'block'; 
    // Instead of overwriting, we can just log success or initialize specific JS components if needed.
    console.log('Admin content rendered successfully');
    
    // Initialize event listeners for admin actions
    initArticleCreation();
}

function initArticleCreation() {
    const saveBtn = document.getElementById('btn-save-article');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
        const titleInput = document.getElementById('article-title');
        const categoryInput = document.getElementById('article-category');
        const contentInput = document.getElementById('article-content');
        const publishedInput = document.getElementById('article-published');

        if (!titleInput.value || !categoryInput.value || !contentInput.value) {
            alert('Моля попълнете всички полета.');
            return;
        }

        const newArticle = {
            title: titleInput.value,
            category: categoryInput.value,
            content: contentInput.value,
            is_published: publishedInput.checked,
            tags: [] // default empty tags
        };

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Запазване...';

            await createArticle(newArticle);

            alert('Статията е създадена успешно!');
            
            // Close modal using Bootstrap API
            const modalEl = document.getElementById('createArticleModal');
            // Get existing or create new instance
            const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modal.hide();

            // Clear form
            document.getElementById('create-article-form').reset();
            // Remove modal backdrop manually if it sticks (sometimes happens with dynamic hiding)
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());
            document.body.classList.remove('modal-open');
            document.body.style = '';

        } catch (error) {
            console.error('Error creating article:', error);
            alert('Възникна грешка при създаването на статията: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Запази статията';
        }
    });
}

initAdminPage();
