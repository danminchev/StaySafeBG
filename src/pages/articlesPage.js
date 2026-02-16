import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getPublishedArticles } from '../services/articlesService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function formatDate(dateValue) {
	if (!dateValue) return 'Без дата';
	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) return 'Без дата';

	return new Intl.DateTimeFormat('bg-BG', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	}).format(date);
}

function renderArticles(articles) {
	const pageContent = document.getElementById('page-content');
	if (!pageContent) return;

	const cardsHtml = articles
		.map((article) => {
			const excerpt = (article.content || '').slice(0, 140);
			const safeTitle = escapeHtml(article.title || 'Без заглавие');
			const safeExcerpt = escapeHtml(excerpt || 'Няма описание.');
			const safeCategory = escapeHtml(article.category || 'Общи');
			const dateLabel = formatDate(article.created_at);

			return `
				<div class="col">
					<div class="card h-100 shadow-sm">
						<div class="card-body d-flex flex-column">
							<span class="badge bg-light text-dark mb-2 align-self-start">${safeCategory}</span>
							<h5 class="card-title">${safeTitle}</h5>
							<p class="card-text flex-grow-1">${safeExcerpt}${article.content && article.content.length > 140 ? '...' : ''}</p>
							<a href="article-details.html?id=${article.id}" class="btn btn-outline-primary mt-2">Прочети повече</a>
						</div>
						<div class="card-footer text-muted">${dateLabel}</div>
					</div>
				</div>
			`;
		})
		.join('');

	pageContent.innerHTML = `
		<h1 class="mb-4">Статии за онлайн безопасност</h1>
		<div class="row row-cols-1 row-cols-md-3 g-4">${cardsHtml}</div>
	`;
}

function renderEmptyState(message) {
	const pageContent = document.getElementById('page-content');
	if (!pageContent) return;

	pageContent.innerHTML = `
		<h1 class="mb-4">Статии за онлайн безопасност</h1>
		<div class="alert alert-info">${message}</div>
	`;
}

async function initArticlesPage() {
	await renderHeader();
	renderFooter();

	if (!hasSupabaseConfig) {
		return;
	}

	try {
		const articles = await getPublishedArticles();
		if (!articles.length) {
			// If no articles are found in the database, we keep the static HTML content
			// instead of showing an empty state message.
			// renderEmptyState('Все още няма публикувани статии.');
			return;
		}

		renderArticles(articles);
	} catch (error) {
		renderEmptyState(error.message || 'Грешка при зареждане на статиите.');
	}
}

initArticlesPage();
