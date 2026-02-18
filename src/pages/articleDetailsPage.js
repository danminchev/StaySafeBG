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
    <div class="ss-report-details-stack">
      <nav aria-label="breadcrumb" class="mb-4">
        <ol class="breadcrumb">
          <li class="breadcrumb-item"><a href="community.html">Общност</a></li>
          <li class="breadcrumb-item active" aria-current="page">${title}</li>
        </ol>
      </nav>

      <div class="row g-4 align-items-start mb-4 ss-report-details-row">
        <div class="col-12 col-lg-8">
          <article class="ss-details-popup h-100">
            <div class="ss-details-popup-body p-4 p-md-5">
              <div class="d-flex flex-wrap gap-2 mb-3">
                <span class="badge modal-category-badge">${category}</span>
                <span class="badge modal-category-badge"><i class="bi bi-calendar3 me-1"></i>${dateText}</span>
                <span class="badge modal-category-badge"><i class="bi bi-link-45deg me-1"></i>${sourceText}</span>
              </div>
              <h1 class="h2 fw-bold mb-3">${title}</h1>
              <p class="mb-0 ss-details-description">${description}</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-lg-4">
          <section id="report-images-section" class="ss-details-popup ss-details-images-popup d-none">
            <div class="ss-details-popup-body p-4 p-md-4">
              <h2 class="h4 mb-3">Прикачени снимки</h2>
              <div id="report-images-grid" class="row g-3"></div>
            </div>
          </section>
        </div>
      </div>

      <a href="community.html" class="btn btn-secondary">Обратно към общността</a>
    </div>
  `;

  const imageSection = document.getElementById('report-images-section');
  const imageGrid = document.getElementById('report-images-grid');
  if (!imageGrid || !imageSection) return;

  const imageFiles = (report.files || []).filter(isImageFile);
  if (!imageFiles.length) {
    return;
  }

  imageSection.classList.remove('d-none');

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
    col.className = 'col-12';

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
        <img src="${escapeHtml(url)}" alt="Прикачено изображение" class="img-fluid rounded border w-100 ss-report-evidence-image">
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
