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

    // Clear container first
    listContainer.innerHTML = '';
    
    articles.slice(0, 3).forEach(article => {
        const wrapper = document.createElement('div');
        wrapper.className = 'card bg-black bg-opacity-25 border-0 mb-3 shadow-sm hover-lift fade-in';
        wrapper.style.backdropFilter = 'blur(5px)';
        
        // Safety: Use textContent for user data
        const dateStr = formatDate(article.created_at);
        const category = article.category || 'Новини';
        
        wrapper.innerHTML = `
            <div class="card-body position-relative py-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="badge bg-white bg-opacity-25 text-white fw-normal border border-white border-opacity-25">
                        <i class="bi bi-tag-fill me-1"></i><span class="cat-text"></span>
                    </span>
                    <small class="text-white-50"><i class="bi bi-calendar3 me-1"></i>${dateStr}</small>
                </div>
                <h5 class="card-title h6 mb-1 fw-bold">
                    <a href="article-details.html?id=${article.id}" class="text-white text-decoration-none stretched-link article-link"></a>
                </h5>
            </div>
        `;
        
        // Securely set text content
        wrapper.querySelector('.cat-text').textContent = category;
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
