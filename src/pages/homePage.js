import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getPublishedArticles } from '../services/articlesService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('bg-BG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function renderLatestArticles(articles) {
    const listContainer = document.getElementById('home-articles-list');
    if (!listContainer) return;

    if (articles.length === 0) {
        listContainer.innerHTML = '<p class="text-white-50">Все още няма публикувани статии.</p>';
        return;
    }

    const html = articles.slice(0, 3).map(article => `
        <div class="card bg-secondary text-white mb-3 bg-opacity-25" style="border: 1px solid rgba(255,255,255,0.1);">
            <div class="card-body position-relative">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="badge bg-primary rounded-pill small">${article.category || 'Общи'}</span>
                    <small class="text-white-50">${formatDate(article.created_at)}</small>
                </div>
                <h5 class="card-title h6 mb-1">
                    <a href="article-details.html?id=${article.id}" class="text-white text-decoration-none stretched-link hover-underline">
                        ${article.title}
                    </a>
                </h5>
            </div>
        </div>
    `).join('');

    listContainer.innerHTML = html;
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
