import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getPublishedArticles } from '../services/tipsService.js';
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
	clearBtn: document.getElementById('btn-clear'),
	templates: {
		article: document.getElementById('article-template'),
		skeleton: document.getElementById('skeleton-template')
	}
};

function ensureMobileToolbarSelect(selectEl, customId) {
	if (!selectEl) return;

	let wrap = document.getElementById(customId);
	if (!wrap) {
		wrap = document.createElement('div');
		wrap.id = customId;
		wrap.className = 'ss-mobile-select ss-mobile-select--toolbar d-none';
		wrap.innerHTML = `
			<button type="button" class="ss-mobile-select__trigger" aria-haspopup="listbox" aria-expanded="false">
				<span class="ss-mobile-select__label"></span>
				<i class="bi bi-chevron-down ss-mobile-select__caret" aria-hidden="true"></i>
			</button>
			<div class="ss-mobile-select__menu" role="listbox" tabindex="-1"></div>
		`;
		selectEl.insertAdjacentElement('afterend', wrap);
	}

	const trigger = wrap.querySelector('.ss-mobile-select__trigger');
	const label = wrap.querySelector('.ss-mobile-select__label');
	const menu = wrap.querySelector('.ss-mobile-select__menu');
	if (!trigger || !label || !menu) return;

	const isMobile = window.matchMedia('(max-width: 767.98px)').matches;
	wrap.classList.toggle('d-none', !isMobile);
	selectEl.classList.toggle('ss-native-select-mobile-hidden', isMobile);

	if (!isMobile) {
		wrap.classList.remove('is-open');
		trigger.setAttribute('aria-expanded', 'false');
		return;
	}

	const selectedOption = selectEl.options[selectEl.selectedIndex] || selectEl.options[0];
	label.textContent = selectedOption?.textContent || '';

	menu.innerHTML = '';
	for (const option of Array.from(selectEl.options)) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'ss-mobile-select__option';
		btn.setAttribute('role', 'option');
		btn.textContent = option.textContent;
		btn.dataset.value = option.value || '';
		if (option.value === selectEl.value) {
			btn.classList.add('is-selected');
			btn.setAttribute('aria-selected', 'true');
		}

		btn.addEventListener('click', () => {
			selectEl.value = option.value;
			selectEl.dispatchEvent(new Event('change', { bubbles: true }));
			label.textContent = option.textContent;
			wrap.classList.remove('is-open');
			trigger.setAttribute('aria-expanded', 'false');
		});

		menu.appendChild(btn);
	}

	if (!wrap.dataset.bound) {
		trigger.addEventListener('click', () => {
			const next = !wrap.classList.contains('is-open');
			document.querySelectorAll('.ss-mobile-select.is-open').forEach((el) => {
				if (el !== wrap) {
					el.classList.remove('is-open');
					const t = el.querySelector('.ss-mobile-select__trigger');
					if (t) t.setAttribute('aria-expanded', 'false');
				}
			});
			wrap.classList.toggle('is-open', next);
			trigger.setAttribute('aria-expanded', String(next));
		});

		document.addEventListener('click', (event) => {
			if (!wrap.contains(event.target)) {
				wrap.classList.remove('is-open');
				trigger.setAttribute('aria-expanded', 'false');
			}
		});

		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				wrap.classList.remove('is-open');
				trigger.setAttribute('aria-expanded', 'false');
			}
		});

		wrap.dataset.bound = 'true';
	}
}

function syncMobileToolbarSelects() {
	ensureMobileToolbarSelect(dom.inputs.category, 'tips-mobile-category');
	ensureMobileToolbarSelect(dom.inputs.sort, 'tips-mobile-sort');
}

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

function createCard(article) {
	const clone = dom.templates.article.content.cloneNode(true);
	const wrapper = clone.querySelector('.col');
	
	// Apply category class and data attribute to the card root
	const card = clone.querySelector('.article-card');
	if(card) {
		card.dataset.category = article.category || 'default';
	}
	
	const link = clone.querySelector('.article-link-overlay');
	if(link) {
		link.href = `tips-details.html?id=${article.id}`;
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
		const excerptLimit = 150;
		text.textContent = rawText.slice(0, excerptLimit) + (rawText.length > excerptLimit ? '...' : '');
	}
	
	const dateSpan = clone.querySelector('.date-text');
	if(dateSpan) dateSpan.textContent = formatDate(article.created_at);
	
	return clone;
}

function renderArticlesList() {
	if (!dom.container) return;
	dom.container.innerHTML = '';
	if (!state.articles.length) return;

	const fragment = document.createDocumentFragment();
	state.articles.forEach((article) => {
		fragment.appendChild(createCard(article));
	});
	dom.container.appendChild(fragment);
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

			renderArticlesList();
		}
		
		state.loadedCount = isAppend ? state.loadedCount + articles.length : articles.length;
		
		// Handle Load More visibility
		if (state.loadedCount < state.totalCount && state.totalCount > 0) {
			dom.loadMoreContainer.classList.remove('d-none');
			dom.loadMoreBtn.classList.remove('disabled');
			dom.loadMoreBtn.textContent = 'Зареждане още съвети';
		} else {
			dom.loadMoreContainer.classList.add('d-none');
		}

	} catch (err) {
		console.error(err);
		renderError('Неуспешно зареждане на съветите. Моля проверете връзката си.');
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
	syncMobileToolbarSelects();
	
	// Check if we should override the existing static HTML
	// The requirement says "modernize tips.html". 
	// The static HTML in tips.html IS the demo content.
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
		syncMobileToolbarSelects();
		updateURL();
		fetchArticles(false);
	});
	
	dom.inputs.sort.addEventListener('change', (e) => {
		state.params.sort = e.target.value;
		syncMobileToolbarSelects();
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
		syncMobileToolbarSelects();
		
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

	window.addEventListener('resize', syncMobileToolbarSelects);

	// Initial Fetch
	fetchArticles(false);
}

init();
