import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getPublishedArticles } from '../services/articlesService.js';
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
        'identity_theft': 'Кражба на самоличност',
        'online_shopping': 'Онлайн пазаруване',
        'investment': 'Инвестиционни измами',
        'tech_support': 'Техническа поддръжка',
        'job_scams': 'Обяви за работа',
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
        'phone': 'bi-telephone-fill',
        'security': 'bi-shield-lock-fill'
    };

    return icons[categoryKey] || 'bi-tag-fill';
}

function renderLatestArticles(articles) {
    const listContainer = document.getElementById('home-articles-list');
    if (!listContainer) return;

    if (articles.length === 0) {
        listContainer.innerHTML = '<p class="text-white-50">Все още няма публикувани статии.</p>';
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

async function initHomePage() {
    await renderHeader();
    renderFooter();

    if (!hasSupabaseConfig) {
        const listContainer = document.getElementById('home-articles-list');
        if (listContainer) {
             listContainer.innerHTML = '<p class="text-white-50">Базата данни не е конфигурирана.</p>';
        }
        return; // Safe exit
    }

    try {
        const result = await getPublishedArticles({ limit: 3 });
        renderLatestArticles(result.data);
    } catch (error) {
        console.error('Failed to load home articles:', error);
        const listContainer = document.getElementById('home-articles-list');
        if (listContainer) {
            listContainer.innerHTML = '<p class="text-white-50 small">Неуспешно зареждане. Моля опитайте по-късно.</p>';
        }
    }
}

initHomePage();
