import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getArticleById } from '../services/articlesService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function renderMessage(message) {
	const pageContent = document.getElementById('page-content');
	if (!pageContent) return;

	pageContent.innerHTML = `
		<div class="alert alert-info">${message}</div>
		<a href="articles.html" class="btn btn-secondary mt-3">Обратно към статиите</a>
	`;
}

function renderArticle(article) {
	const pageContent = document.getElementById('page-content');
	if (!pageContent) return;

	const title = escapeHtml(article.title || 'Без заглавие');
	const category = escapeHtml(article.category || 'Общи');
	const content = escapeHtml(article.content || '');

	pageContent.innerHTML = `
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="articles.html">Статии</a></li>
				<li class="breadcrumb-item active" aria-current="page">${title}</li>
			</ol>
		</nav>
		<article class="blog-post">
			<h2 class="blog-post-title mb-2">${title}</h2>
			<p class="blog-post-meta text-muted mb-4">Категория: ${category}</p>
			<p style="white-space: pre-line;">${content}</p>
		</article>
		<div class="mt-4">
			<a href="articles.html" class="btn btn-secondary">Обратно към статиите</a>
		</div>
	`;
}

async function initArticleDetailsPage() {
	await renderHeader();
	renderFooter();

	if (!hasSupabaseConfig) {
		return;
	}

	const id = new URLSearchParams(window.location.search).get('id');
	if (!id) {
		renderMessage('Липсва идентификатор на статията.');
		return;
	}

	try {
		const article = await getArticleById(id);
		if (!article) {
			renderMessage('Статията не е намерена или не е достъпна.');
			return;
		}

		renderArticle(article);
	} catch (error) {
		renderMessage(error.message || 'Грешка при зареждане на статията.');
	}
}

initArticleDetailsPage();
