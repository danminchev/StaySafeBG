import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getApprovedReportsFeed } from '../services/reportsService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function formatDate(dateString) {
  if (!dateString) return 'Без дата';

  return new Date(dateString).toLocaleDateString('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getCategoryName(category) {
  const map = {
    phishing: 'Фишинг',
    phone: 'Телефонна измама',
    shopping: 'Пазаруване',
    online_shopping: 'Онлайн пазаруване',
    investment: 'Инвестиции',
    security: 'Сигурност',
    identity_theft: 'Кражба на самоличност',
    tech_support: 'Техническа поддръжка',
    job_scams: 'Работа',
    romance: 'Романтична измама',
    social: 'Социални мрежи',
    social_media: 'Социални мрежи',
    crypto: 'Крипто измама',
    marketplace: 'Marketplace измама',
    other: 'Друго'
  };

  return map[category] || 'Общи';
}

function getSourceText(report) {
  return report.url || report.phone || report.iban || report.scam_type || 'Не е посочен';
}

function renderEmptyState(message) {
  const list = document.getElementById('community-reports-list');
  if (!list) return;

  list.innerHTML = `
    <div class="col-12">
      <div class="empty-state">
        <div class="empty-state-icon"><i class="bi bi-inbox"></i></div>
        <p class="mb-0">${message}</p>
      </div>
    </div>
  `;
}

function renderReports(reports) {
  const list = document.getElementById('community-reports-list');
  const template = document.getElementById('community-report-template');

  if (!list || !template) return;

  if (!reports.length) {
    renderEmptyState('Все още няма одобрени доклади от общността.');
    return;
  }

  list.textContent = '';

  reports.forEach((report) => {
    const fragment = template.content.cloneNode(true);

    const cardEl = fragment.querySelector('.article-card');
    const linkEl = fragment.querySelector('.article-link-overlay');
    const categoryBadge = fragment.querySelector('.category-badge');
    const dateEl = fragment.querySelector('.community-date');
    const titleEl = fragment.querySelector('.article-title');
    const excerptEl = fragment.querySelector('.article-excerpt');
    const sourceEl = fragment.querySelector('.community-source');

    if (cardEl) {
      cardEl.dataset.category = report.category || 'other';
    }

    if (linkEl) {
      linkEl.href = `article-details.html?id=${report.id}`;
    }

    categoryBadge.textContent = getCategoryName(report.category);
    dateEl.textContent = formatDate(report.created_at);
    titleEl.textContent = report.title || report.scam_type || 'Доклад от общността';
    excerptEl.textContent = report.description || 'Няма допълнително описание.';
    sourceEl.textContent = getSourceText(report);

    list.appendChild(fragment);
  });
}

async function initCommunityPage() {
  await renderHeader();
  renderFooter();

  const totalCountEl = document.getElementById('community-total-count');

  if (!hasSupabaseConfig) {
    if (totalCountEl) {
      totalCountEl.textContent = '0';
    }
    renderEmptyState('Базата данни не е конфигурирана.');
    return;
  }

  try {
    const result = await getApprovedReportsFeed({ limit: 30 });
    renderReports(result.data || []);

    if (totalCountEl) {
      totalCountEl.textContent = String(result.count || 0);
    }
  } catch (error) {
    console.error('Failed to load community reports:', error);
    renderEmptyState('Неуспешно зареждане на доклади. Опитайте отново по-късно.');
    if (totalCountEl) {
      totalCountEl.textContent = '-';
    }
  }
}

initCommunityPage();
