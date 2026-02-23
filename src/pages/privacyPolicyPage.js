import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';

async function initPrivacyPolicyPage() {
  await renderHeader();
  renderFooter();
}

initPrivacyPolicyPage();
