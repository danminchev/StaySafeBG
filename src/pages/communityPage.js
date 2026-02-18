import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getApprovedReportsFeed } from '../services/reportsService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

const dom = {
  modal: {
    el: document.getElementById('communityReportModal'),
    title: document.getElementById('communityReportModalLabel'),
    date: document.getElementById('communityReportModalDate'),
    category: document.getElementById('communityReportModalCategory'),
    source: document.getElementById('communityReportModalSource'),
    content: document.getElementById('communityReportModalContent')
  }
};

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

function getCategoryIcon(category) {
  const map = {
    phishing: 'bi-bug-fill',
    phone: 'bi-telephone-fill',
    shopping: 'bi-cart-fill',
    online_shopping: 'bi-cart-fill',
    investment: 'bi-graph-up-arrow',
    security: 'bi-shield-fill-check',
    identity_theft: 'bi-person-vcard-fill',
    tech_support: 'bi-tools',
    job_scams: 'bi-briefcase-fill',
    romance: 'bi-heart-fill',
    social: 'bi-chat-dots-fill',
    social_media: 'bi-chat-dots-fill',
    crypto: 'bi-currency-bitcoin',
    marketplace: 'bi-tag-fill',
    other: 'bi-grid-fill'
  };

  return map[category] || 'bi-newspaper';
}

function getSourceText(report) {
  return report.url || report.phone || report.iban || report.scam_type || 'Не е посочен';
}

function openReportModal(report) {
  if (!report || !window.bootstrap || !dom.modal.el) {
    return;
  }

  const category = report.category || 'other';
  const categoryName = getCategoryName(category);
  const source = getSourceText(report);

  dom.modal.el.dataset.category = category;

  if (dom.modal.title) {
    dom.modal.title.textContent = localizeReportTitle(report);
  }

  if (dom.modal.date) {
    dom.modal.date.textContent = formatDate(report.created_at);
  }

  if (dom.modal.category) {
    dom.modal.category.dataset.category = category;
    dom.modal.category.textContent = categoryName;
  }

  if (dom.modal.source) {
    dom.modal.source.textContent = `Източник: ${source}`;
  }

  if (dom.modal.content) {
    dom.modal.content.textContent = report.description || 'Няма допълнително описание.';
  }

  const modal = window.bootstrap.Modal.getOrCreateInstance(dom.modal.el);
  modal.show();
}

function localizeReportTitle(report) {
  const rawTitle = String(report?.title || report?.scam_type || '').trim();
  if (!rawTitle) return 'Доклад от общността';

  const titleParts = rawTitle.split(' - ');
  const rawPrefix = titleParts[0] || '';
  const remainder = titleParts.slice(1).join(' - ');

  const normalizedPrefix = String(rawPrefix || '').toLowerCase().replace(/\s+/g, '_');
  const normalizedCategory = String(report?.category || '').toLowerCase();
  const keyToTranslate = normalizedCategory || normalizedPrefix;
  const localizedPrefix = getCategoryName(keyToTranslate);

  if (!remainder) {
    return localizedPrefix !== 'Общи' ? localizedPrefix : rawTitle;
  }

  if (localizedPrefix === 'Общи') {
    return rawTitle;
  }

  return `${localizedPrefix} - ${remainder}`;
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

    if (cardEl) {
      cardEl.dataset.category = report.category || 'other';
    }

    if (linkEl) {
      linkEl.href = `article-details.html?id=${report.id}`;
      linkEl.addEventListener('click', (event) => {
        event.preventDefault();
        openReportModal(report);
      });
    }

    if (categoryBadge) {
      const category = report.category || 'other';
      const categoryName = getCategoryName(category);
      const iconClass = getCategoryIcon(category);

      categoryBadge.dataset.category = category;
      categoryBadge.innerHTML = `<i class="bi ${iconClass}"></i><span>${categoryName}</span>`;
    }
    dateEl.textContent = formatDate(report.created_at);
    titleEl.textContent = localizeReportTitle(report);
    excerptEl.textContent = report.description || 'Няма допълнително описание.';

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
