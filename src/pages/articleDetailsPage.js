import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getApprovedReportById, getEvidenceFileSignedUrl } from '../services/reportsService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function escapeHtml(value) {
  return String(value ?? '')
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
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
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

function isImageFile(file) {
  if ((file.mime_type || '').startsWith('image/')) return true;

  const path = (file.file_path || '').toLowerCase();
  return path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png') || path.endsWith('.webp') || path.endsWith('.gif');
}

function renderMessage(message) {
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  pageContent.innerHTML = `
    <div class="alert alert-info">${escapeHtml(message)}</div>
    <a href="community.html" class="btn btn-secondary mt-3">Обратно към общността</a>
  `;
}

async function renderReportDetails(report) {
  const pageContent = document.getElementById('page-content');
  if (!pageContent) return;

  const title = escapeHtml(report.title || 'Доклад от общността');
  const category = escapeHtml(getCategoryName(report.category));
  const dateText = escapeHtml(formatDate(report.created_at));
  const sourceText = escapeHtml(getSourceText(report));
  const description = escapeHtml(report.description || 'Няма допълнително описание.');

  pageContent.innerHTML = `
    <nav aria-label="breadcrumb" class="mb-4">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="community.html">Общност</a></li>
        <li class="breadcrumb-item active" aria-current="page">${title}</li>
      </ol>
    </nav>

    <article class="card border-0 shadow-sm mb-4">
      <div class="card-body p-4 p-md-5">
        <div class="d-flex flex-wrap gap-2 mb-3">
          <span class="badge text-bg-light">${category}</span>
          <span class="badge text-bg-light"><i class="bi bi-calendar3 me-1"></i>${dateText}</span>
          <span class="badge text-bg-light"><i class="bi bi-link-45deg me-1"></i>${sourceText}</span>
        </div>
        <h1 class="h2 fw-bold mb-3">${title}</h1>
        <p class="mb-0" style="white-space: pre-line;">${description}</p>
      </div>
    </article>

    <section id="report-images-section" class="mb-4">
      <h2 class="h4 mb-3">Прикачени снимки</h2>
      <div id="report-images-grid" class="row g-3"></div>
      <p id="report-images-empty" class="text-muted mb-0 d-none">Няма прикачени изображения към този доклад.</p>
    </section>

    <a href="community.html" class="btn btn-secondary">Обратно към общността</a>
  `;

  const imageGrid = document.getElementById('report-images-grid');
  const emptyEl = document.getElementById('report-images-empty');
  if (!imageGrid || !emptyEl) return;

  const imageFiles = (report.files || []).filter(isImageFile);
  if (!imageFiles.length) {
    emptyEl.classList.remove('d-none');
    return;
  }

  const filesWithUrls = await Promise.all(imageFiles.map(async (file) => {
    try {
      const url = await getEvidenceFileSignedUrl(file.file_path);
      return { file, url };
    } catch {
      return { file, url: null };
    }
  }));

  filesWithUrls.forEach(({ file, url }) => {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';

    if (!url) {
      col.innerHTML = `
        <div class="border rounded p-3 h-100 text-muted small">
          <i class="bi bi-image me-1"></i>
          ${escapeHtml(file.file_path.split('/').pop() || 'Изображение')} (недостъпно)
        </div>
      `;
      imageGrid.appendChild(col);
      return;
    }

    col.innerHTML = `
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="d-block text-decoration-none">
        <img src="${escapeHtml(url)}" alt="Прикачено изображение" class="img-fluid rounded border w-100" style="aspect-ratio: 4 / 3; object-fit: cover;">
      </a>
    `;

    imageGrid.appendChild(col);
  });
}

async function initArticleDetailsPage() {
  await renderHeader();
  renderFooter();

  if (!hasSupabaseConfig) {
    renderMessage('Базата данни не е конфигурирана.');
    return;
  }

  const reportId = new URLSearchParams(window.location.search).get('id');
  if (!reportId) {
    renderMessage('Липсва идентификатор на доклада.');
    return;
  }

  try {
    const report = await getApprovedReportById(reportId);
    if (!report) {
      renderMessage('Докладът не е намерен или не е одобрен.');
      return;
    }

    await renderReportDetails(report);
  } catch (error) {
    console.error('Failed to load report details:', error);
    renderMessage('Неуспешно зареждане на доклада. Опитайте отново по-късно.');
  }
}

initArticleDetailsPage();
