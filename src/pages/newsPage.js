import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getPublishedArticles } from '../services/newsService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

// --- State ---
const state = {
	params: {
		q: '',
		category: '',
		sort: 'newest',
		limit: 9,
		offset: 0
	},
	articles: [],
	isLoading: false,
	totalCount: 0,
	loadedCount: 0
};

// --- DOM Elements ---
const dom = {
	container: document.getElementById('articles-container'),
	loadMoreBtn: document.getElementById('btn-load-more'),
	loadMoreContainer: document.getElementById('load-more-container'),
	spinner: document.getElementById('loading-spinner'),
	inputs: {
		search: document.getElementById('params-search'),
		category: document.getElementById('params-category'),
		sort: document.getElementById('params-sort'),
	},
	modal: {
		el: document.getElementById('newsDetailsModal'),
		title: document.getElementById('newsDetailsModalLabel'),
		date: document.getElementById('newsDetailsModalDate'),
		category: document.getElementById('newsDetailsModalCategory'),
		content: document.getElementById('newsDetailsModalContent')
	},
	clearBtn: document.getElementById('btn-clear'),
	templates: {
		article: document.getElementById('article-template'),
		skeleton: document.getElementById('skeleton-template')
	}
};

// --- Utilities ---
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

function formatDate(dateValue) {
	if (!dateValue) return 'Без дата';
	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) return 'Без дата';

	return new Intl.DateTimeFormat('bg-BG', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	}).format(date);
}

function calculateReadingTime(text) {
	const wpm = 200;
	const words = (text || '').trim().split(/\s+/).length;
	const time = Math.ceil(words / wpm);
	return `~${time} мин`;
}

function getCategoryColor(cat) {
	const map = {
		'phishing': 'bg-danger-subtle text-danger-emphasis',
		'shopping': 'bg-success-subtle text-success-emphasis',
		'investment': 'bg-warning-subtle text-warning-emphasis',
		'security': 'bg-info-subtle text-info-emphasis'
	};
	return map[cat] || 'bg-secondary-subtle text-secondary-emphasis';
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

function updateURL() {
	const url = new URL(window.location);
	if(state.params.q) url.searchParams.set('q', state.params.q); else url.searchParams.delete('q');
	if(state.params.category) url.searchParams.set('category', state.params.category); else url.searchParams.delete('category');
	if(state.params.sort !== 'newest') url.searchParams.set('sort', state.params.sort); else url.searchParams.delete('sort');
	
	window.history.replaceState({}, '', url);
}

function readURLParams() {
	const params = new URLSearchParams(window.location.search);
	state.params.q = params.get('q') || '';
	state.params.category = params.get('category') || '';
	state.params.sort = params.get('sort') || 'newest';
	
	// Sync inputs
	if(dom.inputs.search) dom.inputs.search.value = state.params.q;
	if(dom.inputs.category) dom.inputs.category.value = state.params.category;
	if(dom.inputs.sort) dom.inputs.sort.value = state.params.sort;
}

// --- Rendering ---
function showSkeletons(count = 6) {
	if(!dom.container || !dom.templates.skeleton) return;
	// Don't clear if appending
	if (state.params.offset === 0) dom.container.innerHTML = '';
	
	const fragment = document.createDocumentFragment();
	for (let i = 0; i < count; i++) {
		const clone = dom.templates.skeleton.content.cloneNode(true);
		fragment.appendChild(clone);
	}
	dom.container.appendChild(fragment);
}

function removeSkeletons() {
	const skeletons = dom.container.querySelectorAll('.skeleton-wrapper');
	skeletons.forEach(el => el.remove());
}

function renderError(message) {
	dom.container.innerHTML = `
		<div class="col-12 text-center py-5">
			<div class="alert alert-danger d-inline-block shadow-sm rounded-3" role="alert">
				<h4 class="alert-heading"><i class="bi bi-exclamation-triangle"></i> Възникна грешка!</h4>
				<p>${message}</p>
				<button class="btn btn-outline-danger btn-sm" onclick="location.reload()">Опитай пак</button>
			</div>
		</div>
	`;
	dom.loadMoreContainer.classList.add('d-none');
}

function openNewsModal(article) {
    if (!article || !window.bootstrap || !dom.modal.el) {
        console.warn('Cannot open modal: missing article, bootstrap or modal element');
        return;
    }

	dom.modal.el.dataset.category = article.category || 'other';
    
    if(dom.modal.title) dom.modal.title.textContent = article.title;
    if(dom.modal.date) dom.modal.date.textContent = formatDate(article.created_at);
    if(dom.modal.category) {
        dom.modal.category.textContent = getCategoryName(article.category);
		dom.modal.category.className = 'badge modal-category-badge';
		dom.modal.category.dataset.category = article.category || 'other';
    }
    if(dom.modal.content) {
        // Handle newlines for text content
        const safeContent = article.content 
            ? article.content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>') 
            : '';
        dom.modal.content.innerHTML = safeContent;
    }
    
    const modal = new window.bootstrap.Modal(dom.modal.el);
    modal.show();
}

function createCard(article) {
	const clone = dom.templates.article.content.cloneNode(true);
	
	// Apply category class and data attribute to the card root
	const card = clone.querySelector('.article-card');
	if(card) {
		card.dataset.category = article.category || 'default';
	}
	
	const link = clone.querySelector('.article-link-overlay');
	if(link) {
        link.href = `news-details.html?id=${article.id}`;
        link.addEventListener('click', (e) => {
            // Allow opening in new tab with Ctrl/Cmd + Click
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;

            e.preventDefault();
            openNewsModal(article);
        });
    }
	
	const badge = clone.querySelector('.category-badge');
	if(badge) {
		badge.textContent = getCategoryName(article.category);
		badge.dataset.category = article.category || 'other';
		// Note: The color is handled by CSS based on data-category
	}
	
	const title = clone.querySelector('.article-title');
	if(title) title.textContent = article.title;
	
	const text = clone.querySelector('.article-excerpt');
	// Simple text stripping/truncation
	if(text) {
		const rawText = article.content || '';
        // Basic strip html logic if needed, or rely on textContent
		text.textContent = rawText.slice(0, 150) + (rawText.length > 150 ? '...' : '');
	}
	
	const dateSpan = clone.querySelector('.date-text');
	if(dateSpan) dateSpan.textContent = formatDate(article.created_at);
	
	const timeSpan = clone.querySelector('.reading-time');
	if(timeSpan) timeSpan.textContent = article.reading_time || calculateReadingTime(article.content);

    // Also attach click to "Read More" button if user clicks that specifically
    const readMoreBtn = clone.querySelector('.read-more-btn');
    if(readMoreBtn) {
        readMoreBtn.style.cursor = 'pointer';
        readMoreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Avoid double triggering if overlay is present
            openNewsModal(article);
        });
    }
	
	return clone;
}

// --- Data Fetching ---
async function fetchArticles(isAppend = false) {
	if (state.isLoading) return;
	state.isLoading = true;
	
	if (!isAppend) {
		state.params.offset = 0;
		dom.loadMoreContainer.classList.add('d-none');
		showSkeletons(6);
	} else {
		// Show spinner when loading more
		dom.loadMoreBtn.classList.add('disabled');
		dom.loadMoreBtn.textContent = 'Зареждане...';
	}

	try {
		// Simulate network delay for UX demo if local, remove in prod
		// await new Promise(r => setTimeout(r, 600)); 

		const response = await getPublishedArticles(state.params);
		
		if (!isAppend) removeSkeletons();
		
		state.totalCount = response.count || 0;
		const articles = response.data;

        if (!isAppend) {
            state.articles = articles;
        } else {
            state.articles = [...(state.articles || []), ...articles];
        }
		
		if (articles.length === 0 && !isAppend) {
			renderNoResults();
			return;

		}

		if (articles.length > 0) {
            // Check for demo data if database is empty but no error
            if (response.count === null && articles.length === 0) {
                 // Fallback to static html? No, service returns empty array.
                 // If we are here, we have empty array from DB.
                 renderNoResults();
                 return;
            }

			const fragment = document.createDocumentFragment();
			articles.forEach(article => {
				fragment.appendChild(createCard(article));
			});
			dom.container.appendChild(fragment);
		}
		
		state.loadedCount = isAppend ? state.loadedCount + articles.length : articles.length;
		
		// Handle Load More visibility
		if (state.loadedCount < state.totalCount && state.totalCount > 0) {
			dom.loadMoreContainer.classList.remove('d-none');
			dom.loadMoreBtn.classList.remove('disabled');
			dom.loadMoreBtn.textContent = 'Зареждане още новини';
		} else {
			dom.loadMoreContainer.classList.add('d-none');
		}

	} catch (err) {
		console.error(err);
		renderError('Неуспешно зареждане на новините. Моля проверете връзката си.');
	} finally {
		state.isLoading = false;
	}
}

// --- Initialization ---
async function init() {
	await renderHeader();
	renderFooter();
	
	if (!hasSupabaseConfig) {
        // If no config, maybe leave static content or show specific error?
        // Current logic: assumes config exists or service handles it. 
        // We will just let the service throw or return empty.
	}

	readURLParams();
	
	// Check if we should override the existing static HTML
	// The requirement says "modernize news.html". 
	// The static HTML in news.html IS the demo content.
	// We should clear it initially IF we are going to fetch real data.
	// But if DB is empty, maybe we want to keep it? 
    // New Logic: Always fetch. If DB empty, show empty state (per requirement), 
    // OR we can inject the "demo" data as a fallback JS array if needed.
    // For this task, I will treat the HTML container as the target and clear it.
    
    // Clear static content (demo HTML) immediately so we can render skeletons/real data
    if (dom.container) dom.container.innerHTML = '';
	
	// Event Listeners
	dom.inputs.search.addEventListener('input', debounce((e) => {
		state.params.q = e.target.value;
		updateURL();
		fetchArticles(false);
	}, 400));
	
	dom.inputs.category.addEventListener('change', (e) => {
		state.params.category = e.target.value;
		updateURL();
		fetchArticles(false);
	});
	
	dom.inputs.sort.addEventListener('change', (e) => {
		state.params.sort = e.target.value;
		updateURL();
		fetchArticles(false);
	});
	
	dom.clearBtn.addEventListener('click', () => {
		state.params.q = '';
		state.params.category = '';
		state.params.sort = 'newest';
		
		dom.inputs.search.value = '';
		dom.inputs.category.value = '';
		dom.inputs.sort.value = 'newest';
		
		updateURL();
		fetchArticles(false);
	});
	
	dom.loadMoreBtn.addEventListener('click', () => {
		state.params.offset += state.params.limit;
		fetchArticles(true);
	});

	// Sticky Toolbar Shadow Effect
    const toolbar = document.getElementById('articles-toolbar');
    window.addEventListener('scroll', () => {
       if (window.scrollY > 10) {
           toolbar.classList.add('is-stuck');
       } else {
           toolbar.classList.remove('is-stuck');
       }
    });

	// Initial Fetch
	fetchArticles(false);
}

init();
