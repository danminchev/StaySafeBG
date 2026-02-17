import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getCurrentUser } from '../services/authService.js';
import { getUserRole } from '../services/rolesService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';
import { createArticle, getAdminArticles, getArticleById, updateArticle } from '../services/articlesService.js';
import { showToast } from '../utils/notifications.js';

const state = {
    articles: []
};

const dom = {
    container: document.getElementById('page-content'),
    createSaveBtn: document.getElementById('btn-save-article'),
    updateBtn: document.getElementById('btn-update-article'),
    refreshBtn: document.getElementById('btn-refresh-articles'),
    articlesBody: document.getElementById('admin-articles-body'),
    create: {
        title: document.getElementById('article-title'),
        category: document.getElementById('article-category'),
        content: document.getElementById('article-content'),
        published: document.getElementById('article-published'),
        form: document.getElementById('create-article-form')
    },
    edit: {
        id: document.getElementById('edit-article-id'),
        title: document.getElementById('edit-article-title'),
        category: document.getElementById('edit-article-category'),
        content: document.getElementById('edit-article-content'),
        published: document.getElementById('edit-article-published')
    }
};

function showForbidden(message) {
    const container = dom.container;
	if (!container) return;

    container.style.display = 'block';
	container.innerHTML = `
		<div class="alert alert-danger" role="alert">${message}</div>
		<a href="index.html" class="btn btn-primary mt-2">Към началната страница</a>
	`;
}

// Ensure bootstrap is available
const bootstrap = window.bootstrap;

function formatDate(dateValue) {
    if (!dateValue) return 'Без дата';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Без дата';

    return new Intl.DateTimeFormat('bg-BG', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

function getCategoryName(category) {
    const map = {
        phishing: 'Фишинг',
        shopping: 'Пазаруване',
        online_shopping: 'Онлайн пазаруване',
        investment: 'Инвестиции',
        security: 'Сигурност',
        identity_theft: 'Кражба на самоличност',
        tech_support: 'Техническа поддръжка',
        job_scams: 'Работа',
        social: 'Социални мрежи'
    };

    return map[category] || category || 'Общи';
}

function closeModal(modalId) {
    if (!bootstrap) return;
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
}

function openModal(modalId) {
    if (!bootstrap) return;
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

function renderArticlesTable() {
    if (!dom.articlesBody) return;

    dom.articlesBody.textContent = '';

    if (state.articles.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.className = 'text-center text-muted py-4';
        cell.textContent = 'Няма налични статии.';
        row.appendChild(cell);
        dom.articlesBody.appendChild(row);
        return;
    }

    state.articles.forEach((article) => {
        const row = document.createElement('tr');

        const titleCell = document.createElement('td');
        titleCell.className = 'fw-semibold';
        titleCell.textContent = article.title || 'Без заглавие';

        const categoryCell = document.createElement('td');
        categoryCell.textContent = getCategoryName(article.category);

        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `badge ${article.is_published ? 'bg-success' : 'bg-secondary'}`;
        statusBadge.textContent = article.is_published ? 'Публикувана' : 'Чернова';
        statusCell.appendChild(statusBadge);

        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(article.created_at);

        const actionsCell = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-sm btn-outline-primary';
        editBtn.dataset.action = 'edit-article';
        editBtn.dataset.articleId = article.id;
        editBtn.textContent = 'Редактирай';
        actionsCell.appendChild(editBtn);

        row.appendChild(titleCell);
        row.appendChild(categoryCell);
        row.appendChild(statusCell);
        row.appendChild(dateCell);
        row.appendChild(actionsCell);

        dom.articlesBody.appendChild(row);
    });
}

async function loadAdminArticles() {
    if (!dom.articlesBody) return;

    dom.articlesBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Зареждане...</td></tr>';

    try {
        const { data } = await getAdminArticles();
        state.articles = data || [];
        renderArticlesTable();
    } catch (error) {
        console.error('Error loading admin articles:', error);
        dom.articlesBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Грешка при зареждане на статии.</td></tr>';
        showToast('Неуспешно зареждане на статии.', 'error');
    }
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
    const container = dom.container;
	if (!container) return;
    
    container.style.display = 'block'; 
    // Instead of overwriting, we can just log success or initialize specific JS components if needed.
    console.log('Admin content rendered successfully');
    
    // Initialize event listeners for admin actions
    initArticleCreation();
	initArticleEditing();
	loadAdminArticles();
}

function initArticleCreation() {
	const saveBtn = dom.createSaveBtn;
    if (!saveBtn) return;

    saveBtn.addEventListener('click', async () => {
        const titleInput = dom.create.title;
        const categoryInput = dom.create.category;
        const contentInput = dom.create.content;
        const publishedInput = dom.create.published;

        if (!titleInput?.value || !categoryInput?.value || !contentInput?.value) {
            showToast('Моля попълнете всички полета.', 'warning');
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

            showToast('Статията е създадена успешно!', 'success');

            closeModal('createArticleModal');

            // Clear form
            dom.create.form?.reset();
            await loadAdminArticles();

        } catch (error) {
            console.error('Error creating article:', error);
            showToast('Възникна грешка при създаването на статията: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Запази статията';
        }
    });
}

function initArticleEditing() {
    if (dom.refreshBtn) {
        dom.refreshBtn.addEventListener('click', () => {
            loadAdminArticles();
        });
    }

    if (dom.articlesBody) {
        dom.articlesBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const editButton = target.closest('button[data-action="edit-article"]');
            if (!editButton) return;

            const articleId = editButton.dataset.articleId;
            if (!articleId) return;

            try {
                editButton.disabled = true;
                const article = await getArticleById(articleId);
                if (!article) {
                    showToast('Статията не беше намерена.', 'warning');
                    return;
                }

                dom.edit.id.value = article.id;
                dom.edit.title.value = article.title || '';
                dom.edit.category.value = article.category || '';
                dom.edit.content.value = article.content || '';
                dom.edit.published.checked = Boolean(article.is_published);

                openModal('editArticleModal');
            } catch (error) {
                console.error('Error opening article editor:', error);
                showToast('Неуспешно отваряне на статия за редакция.', 'error');
            } finally {
                editButton.disabled = false;
            }
        });
    }

    if (dom.updateBtn) {
        dom.updateBtn.addEventListener('click', async () => {
            const articleId = dom.edit.id.value;
            const title = dom.edit.title.value.trim();
            const category = dom.edit.category.value;
            const content = dom.edit.content.value.trim();
            const isPublished = dom.edit.published.checked;

            if (!articleId || !title || !category || !content) {
                showToast('Моля попълнете всички задължителни полета.', 'warning');
                return;
            }

            try {
                dom.updateBtn.disabled = true;
                dom.updateBtn.textContent = 'Запазване...';

                await updateArticle(articleId, {
                    title,
                    category,
                    content,
                    is_published: isPublished,
                    tags: []
                });

                showToast('Статията е обновена успешно.', 'success');
                closeModal('editArticleModal');
                await loadAdminArticles();
            } catch (error) {
                console.error('Error updating article:', error);
                showToast('Неуспешно запазване на промените.', 'error');
            } finally {
                dom.updateBtn.disabled = false;
                dom.updateBtn.textContent = 'Запази промените';
            }
        });
    }
}

initAdminPage();
