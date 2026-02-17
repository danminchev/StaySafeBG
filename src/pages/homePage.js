import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getPublishedArticles } from '../services/newsService.js';
import { getApprovedReports } from '../services/reportsService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';
import '../styles/home.css';

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('bg-BG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function getCategoryName(categoryKey) {
    const categories = {
        'phishing': 'Фишинг',
        'phone': 'Телефонна измама',
        'security': 'Сигурност',
        'identity_theft': 'Кражба на самоличност',
        'online_shopping': 'Онлайн пазаруване',
        'shopping': 'Пазаруване',
        'investment': 'Инвестиционни измами',
        'tech_support': 'Техническа поддръжка',
        'job_scams': 'Обяви за работа',
        'romance': 'Романтични измами',
        'social': 'Социални мрежи',
        'social_media': 'Социални мрежи',
        'crypto': 'Криптовалути',
        'marketplace': 'Marketplace измами',
        'romance_scams': 'Романтични измами',
        'fake_websites': 'Фалшиви уебсайтове',
        'lottery_scams': 'Лотарийни измами',
        'bank_fraud': 'Банкови измами',
        'crypto_scams': 'Криптовалути',
        'charity_scams': 'Фалшиви каузи',
        'other': 'Други'
    };
    return categories[categoryKey] || categoryKey || 'Новини';
}

function getCategoryIcon(categoryKey) {
    const icons = {
        'phishing': 'bi-envelope-exclamation-fill',
        'phone': 'bi-telephone-fill',
        'security': 'bi-shield-lock-fill'
    };

    return icons[categoryKey] || 'bi-tag-fill';
}

function renderLatestArticles(articles) {
    const listContainer = document.getElementById('home-articles-list');
    if (!listContainer) return;

    if (articles.length === 0) {
        listContainer.innerHTML = '<p class="text-white-50">Все още няма публикувани новини.</p>';
        return;
    }

    // Clear container first
    listContainer.innerHTML = '';
    
    articles.slice(0, 3).forEach(article => {
        const wrapper = document.createElement('article');
        wrapper.className = 'news-card fade-in';
        // Note: Inline backdrop-removed in favor of CSS class
        
        // Safety: Use textContent for user data
        const dateStr = formatDate(article.created_at);
        const categoryKey = article.category || 'other';
        const categoryLabel = getCategoryName(categoryKey);
        const categoryIcon = getCategoryIcon(categoryKey);
        const isIconOnlyCategory = categoryKey === 'phone' || categoryKey === 'security';
        
        wrapper.innerHTML = `
            <div class="news-card-header">
                <span class="news-badge" data-category="${categoryKey}">
                    <i class="bi ${categoryIcon}"></i><span class="cat-text"></span>
                </span>
                <time class="news-date">
                    <i class="bi bi-calendar3 me-1"></i>${dateStr}
                </time>
            </div>
            <h3 class="news-title h5 mb-0">
                <a href="article-details.html?id=${article.id}" class="stretched-link article-link"></a>
            </h3>
            <i class="bi bi-arrow-right news-arrow"></i>
        `;
        
        // Securely set text content
        const badgeElement = wrapper.querySelector('.news-badge');
        const categoryTextElement = wrapper.querySelector('.cat-text');

        if (isIconOnlyCategory) {
            badgeElement.classList.add('icon-only');
            badgeElement.setAttribute('title', categoryLabel);
            badgeElement.setAttribute('aria-label', categoryLabel);
            categoryTextElement.textContent = '';
        } else {
            categoryTextElement.textContent = categoryLabel;
        }

        wrapper.querySelector('.article-link').textContent = article.title;
        
        listContainer.appendChild(wrapper);
    });
}

function updateApprovedReportsCount(count) {
    const countEl = document.getElementById('home-approved-reports-count');
    if (!countEl) return;

    if (typeof count === 'number') {
        countEl.textContent = `${count.toLocaleString('bg-BG')} Одобрени`;
        return;
    }

    countEl.textContent = 'Одобрени доклади';
}

function renderApprovedReports(reports) {
    const listContainer = document.getElementById('home-community-list');
    if (!listContainer) return;

    if (!reports || reports.length === 0) {
        listContainer.innerHTML = '<p class="text-white-50 mb-0">Все още няма одобрени доклади.</p>';
        return;
    }

    listContainer.innerHTML = '';

    reports.slice(0, 3).forEach(report => {
        const wrapper = document.createElement('article');
        wrapper.className = 'news-card fade-in';

        const dateStr = formatDate(report.created_at);
        const categoryKey = report.category || 'other';
        const categoryLabel = getCategoryName(categoryKey);
        const categoryIcon = getCategoryIcon(categoryKey);
        const isIconOnlyCategory = categoryKey === 'phone' || categoryKey === 'security' || categoryKey === 'phishing';

        wrapper.innerHTML = `
            <div class="news-card-header">
                <span class="news-badge" data-category="${categoryKey}">
                    <i class="bi ${categoryIcon}"></i><span class="cat-text"></span>
                </span>
                <time class="news-date">
                    <i class="bi bi-calendar3 me-1"></i>${dateStr}
                </time>
            </div>
            <h3 class="news-title h5 mb-0">
                <span class="community-report-title"></span>
            </h3>
        `;

        const badgeElement = wrapper.querySelector('.news-badge');
        const categoryTextElement = wrapper.querySelector('.cat-text');

        if (isIconOnlyCategory) {
            badgeElement.classList.add('icon-only');
            badgeElement.setAttribute('title', categoryLabel);
            badgeElement.setAttribute('aria-label', categoryLabel);
            categoryTextElement.textContent = '';
        } else {
            categoryTextElement.textContent = categoryLabel;
        }

        const titleEl = wrapper.querySelector('.community-report-title');
        titleEl.textContent = report.title || report.scam_type || 'Доклад от общността';

        listContainer.appendChild(wrapper);
    });
}

async function initHomePage() {
    await renderHeader();
    renderFooter();

    if (!hasSupabaseConfig) {
        const articlesContainer = document.getElementById('home-articles-list');
        const reportsContainer = document.getElementById('home-community-list');
        if (articlesContainer) {
             articlesContainer.innerHTML = '<p class="text-white-50">Базата данни не е конфигурирана.</p>';
        }
        if (reportsContainer) {
            reportsContainer.innerHTML = '<p class="text-white-50 mb-0">Базата данни не е конфигурирана.</p>';
        }
        return; // Safe exit
    }

    try {
        const [articlesResult, reportsResult] = await Promise.all([
            getPublishedArticles({ limit: 3 }),
            getApprovedReports({ limit: 3 })
        ]);

        renderLatestArticles(articlesResult.data);
        renderApprovedReports(reportsResult.data);
        updateApprovedReportsCount(reportsResult.count);
    } catch (error) {
        console.error('Failed to load home content:', error);
        const articlesContainer = document.getElementById('home-articles-list');
        const reportsContainer = document.getElementById('home-community-list');
        if (articlesContainer) {
            articlesContainer.innerHTML = '<p class="text-white-50 small">Неуспешно зареждане. Моля опитайте по-късно.</p>';
        }
        if (reportsContainer) {
            reportsContainer.innerHTML = '<p class="text-white-50 small mb-0">Неуспешно зареждане. Моля опитайте по-късно.</p>';
        }
    }
}

initHomePage();
