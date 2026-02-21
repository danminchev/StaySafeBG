import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getArticleById } from '../services/tipsService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

const AI_LABEL_TEXT = 'Тази статия е генерирана с изкуствен интелект и е с информационна цел. Прегледана е от модератор.';

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
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(date);
}

function getCategoryName(cat) {
	const map = {
		'phishing': '🎣 Фишинг',
		'shopping': '🛒 Пазаруване',
		'online_shopping': '🛒 Онлайн пазаруване',
		'investment': '📈 Инвестиции',
		'security': '🛡️ Сигурност',
		'identity_theft': '🆔 Самоличност',
		'tech_support': '💻 Тех. поддръжка',
		'job_scams': '💼 Работа',
		'phone': '📞 Телефонна измама',
		'romance': '💘 Романтична измама',
		'social': '💬 Социални мрежи',
		'social_media': '💬 Социални мрежи',
		'crypto': '₿ Крипто измама',
		'marketplace': '🏷️ Marketplace измама',
		'other': '🧩 Друго'
	};
	return map[cat] || '📰 Общи';
}

function renderMessage(message) {
	const pageContent = document.getElementById('page-content');
	if (!pageContent) return;

	pageContent.innerHTML = `
		<div class="tips-status-card">
			<div class="alert alert-info mb-3">${message}</div>
			<a href="tips.html" class="btn btn-outline-secondary"><i class="bi bi-arrow-left me-2"></i>Обратно към съветите</a>
		</div>
	`;
}

function renderArticle(article) {
	const pageContent = document.getElementById('page-content');
	if (!pageContent) return;

	const title = escapeHtml(article.title || 'Без заглавие');
	const category = escapeHtml(getCategoryName(article.category));
	const content = escapeHtml(article.content || '');
	const createdAt = formatDate(article.created_at);

	pageContent.innerHTML = `
		<div class="tips-details-shell">
			<div class="tips-breadcrumb mb-3" aria-label="breadcrumb">
				<ol class="breadcrumb">
					<li class="breadcrumb-item"><a href="tips.html">Съвети</a></li>
					<li class="breadcrumb-item active" aria-current="page">${title}</li>
				</ol>
			</div>

			<article class="tips-article-card">
				<span class="tips-kicker"><i class="bi bi-stars"></i>Практичен съвет</span>
				<h1 class="tips-title">${title}</h1>

				<div class="tips-meta">
					<span class="tips-meta-badge"><i class="bi bi-tag"></i>Категория: ${category}</span>
					<span class="tips-meta-badge tips-meta-date"><i class="bi bi-calendar3"></i>${createdAt}</span>
				</div>

				<p class="tips-ai-label">${AI_LABEL_TEXT}</p>

				<hr class="tips-separator">

				<div class="tips-article-content">${content}</div>

				<div class="tips-footer-actions">
					<a href="tips.html" class="btn btn-outline-secondary"><i class="bi bi-arrow-left me-2"></i>Обратно към съветите</a>
				</div>
			</article>
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
		renderMessage('Липсва идентификатор на съвета.');
		return;
	}

	try {
		const article = await getArticleById(id);
		if (!article) {
			renderMessage('Съветът не е намерен или не е достъпен.');
			return;
		}

		renderArticle(article);
	} catch (error) {
		renderMessage(error.message || 'Грешка при зареждане на съвета.');
	}
}

initArticleDetailsPage();
