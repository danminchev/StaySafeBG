import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

function getSameOriginReferrerUrl() {
  try {
    if (!document.referrer) return null;

    const referrerUrl = new URL(document.referrer);
    if (referrerUrl.origin !== window.location.origin) return null;

    return referrerUrl;
  } catch {
    return null;
  }
}

function getPageLabelByPath(pathname) {
  const normalized = pathname.split('/').pop() || 'index.html';

  const labels = {
    'index.html': 'Начало',
    'scam-check.html': 'Провери',
    'report-scam.html': 'Докладвай',
    'tips.html': 'Съвети',
    'community.html': 'Общност',
    'resources-bulletin.html': 'Публичен регистър',
    'login.html': 'Вход',
    'register.html': 'Регистрация',
    'admin.html': 'Админ панел',
  };

  return labels[normalized] || 'Предишна страница';
}

function updateBreadcrumbBackLink() {
  const breadcrumbBackLink = document.getElementById('pp-breadcrumb-back-link');
  if (!breadcrumbBackLink) return;

  const referrerUrl = getSameOriginReferrerUrl();
  if (!referrerUrl) return;

  const currentPath = window.location.pathname.split('/').pop() || 'privacy-policy.html';
  const referrerPath = referrerUrl.pathname.split('/').pop() || 'index.html';

  if (referrerPath === currentPath) return;

  const relativeHref = `${referrerPath}${referrerUrl.search}${referrerUrl.hash}`;
  breadcrumbBackLink.href = relativeHref;
  breadcrumbBackLink.textContent = getPageLabelByPath(referrerUrl.pathname);
}

async function initPrivacyPolicyPage() {
  await renderHeader();
  renderFooter();
  updateBreadcrumbBackLink();

  const backBtn = document.getElementById('pp-back-btn');
  if (!backBtn) return;

  backBtn.addEventListener('click', () => {
    const sameOriginReferrerUrl = getSameOriginReferrerUrl();

    if (sameOriginReferrerUrl) {
      window.location.href = sameOriginReferrerUrl.href;
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = 'index.html';
  });
}

initPrivacyPolicyPage();
