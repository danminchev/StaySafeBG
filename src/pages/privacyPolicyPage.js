import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

async function initPrivacyPolicyPage() {
  await renderHeader();
  renderFooter();

  const backBtn = document.getElementById('pp-back-btn');
  if (!backBtn) return;

  backBtn.addEventListener('click', () => {
    const hasSameOriginReferrer = (() => {
      try {
        if (!document.referrer) return false;
        return new URL(document.referrer).origin === window.location.origin;
      } catch {
        return false;
      }
    })();

    if (hasSameOriginReferrer) {
      window.location.href = document.referrer;
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
