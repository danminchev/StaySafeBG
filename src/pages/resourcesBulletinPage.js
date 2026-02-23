import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getTrustedPhishingDomains } from '../services/trustedDomainsService.js';
import { getMaliciousResources } from '../services/maliciousResourcesService.js';

const state = {
  search: '',
  phishing: [],
  malicious: [],
};

const dom = {
  searchInput: document.getElementById('resources-bulletin-search'),
  clearBtn: document.getElementById('resources-bulletin-clear'),
  phishingBody: document.getElementById('rb-phishing-body'),
  maliciousBody: document.getElementById('rb-malicious-body'),
  phishingCount: document.getElementById('rb-phishing-count'),
  maliciousCount: document.getElementById('rb-malicious-count'),
};

function formatDateTime(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function riskBadge(risk) {
  const normalized = String(risk || '').toLowerCase();
  if (normalized === 'low') return '<span class="badge bg-success">Нисък риск</span>';
  if (normalized === 'medium') return '<span class="badge bg-warning text-dark">Среден риск</span>';
  return '<span class="badge bg-danger">Висок риск</span>';
}

function phishingStatusBadge(isActive) {
  return isActive
    ? '<span class="badge bg-success">Активен</span>'
    : '<span class="badge bg-secondary">Неактивен</span>';
}

function maliciousStatusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'offline') return '<span class="badge bg-secondary">Офлайн</span>';
  if (normalized === 'unknown') return '<span class="badge bg-warning text-dark">Неизвестен</span>';
  return '<span class="badge bg-danger">Онлайн</span>';
}

function maliciousTypeLabel(type) {
  const map = {
    url: 'URL',
    domain: 'Домейн',
    ip: 'IP',
    hash: 'Hash',
    file: 'Файл',
    other: 'Друго',
  };
  return map[String(type || '').toLowerCase()] || 'Друго';
}

function renderPhishingTable() {
  if (!dom.phishingBody) return;
  const search = state.search.trim().toLowerCase();
  const items = state.phishing.filter((item) => {
    if (!search) return true;
    const haystack = `${item.domain || ''} ${item.source || ''} ${item.notes || ''}`.toLowerCase();
    return haystack.includes(search);
  });

  if (dom.phishingCount) dom.phishingCount.textContent = String(items.length);

  if (!items.length) {
    dom.phishingBody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-4">Няма съвпадения.</td></tr>';
    return;
  }

  dom.phishingBody.innerHTML = items.map((item) => `
    <tr>
      <td class="rb-resource-cell fw-semibold">${item.domain || '-'}</td>
      <td>${riskBadge(item.risk_level || (Number(item.confidence || 0) >= 0.9 ? 'high' : Number(item.confidence || 0) >= 0.6 ? 'medium' : 'low'))}</td>
      <td>${phishingStatusBadge(Boolean(item.is_active))}</td>
      <td>${item.source || '-'}</td>
      <td>${formatDateTime(item.updated_at || item.last_seen_at || item.created_at)}</td>
    </tr>
  `).join('');
}

function renderMaliciousTable() {
  if (!dom.maliciousBody) return;
  const search = state.search.trim().toLowerCase();
  const items = state.malicious.filter((item) => {
    if (!search) return true;
    const haystack = `${item.resource_value || ''} ${item.threat_name || ''} ${item.source || ''} ${item.resource_type || ''}`.toLowerCase();
    return haystack.includes(search);
  });

  if (dom.maliciousCount) dom.maliciousCount.textContent = String(items.length);

  if (!items.length) {
    dom.maliciousBody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary py-4">Няма съвпадения.</td></tr>';
    return;
  }

  dom.maliciousBody.innerHTML = items.map((item) => `
    <tr>
      <td class="rb-resource-cell">
        <div class="fw-semibold">${item.resource_value || '-'}</div>
        <div class="small text-secondary">${item.threat_name || '-'}</div>
      </td>
      <td>${maliciousTypeLabel(item.resource_type)}</td>
      <td>${riskBadge(item.risk_level)}</td>
      <td>${maliciousStatusBadge(item.status)}</td>
      <td>${item.source || '-'}</td>
      <td>${formatDateTime(item.updated_at || item.last_seen_at || item.created_at)}</td>
    </tr>
  `).join('');
}

function renderAll() {
  renderPhishingTable();
  renderMaliciousTable();
}

async function loadData() {
  try {
    const [phishing, malicious] = await Promise.all([
      getTrustedPhishingDomains(300),
      getMaliciousResources(300),
    ]);
    state.phishing = phishing || [];
    state.malicious = (malicious || []).filter((item) => item.is_active !== false);
    renderAll();
  } catch {
    if (dom.phishingBody) dom.phishingBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Грешка при зареждане.</td></tr>';
    if (dom.maliciousBody) dom.maliciousBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Грешка при зареждане.</td></tr>';
  }
}

function initFilters() {
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      state.search = target.value || '';
      renderAll();
    });
  }

  if (dom.clearBtn) {
    dom.clearBtn.addEventListener('click', () => {
      state.search = '';
      if (dom.searchInput) dom.searchInput.value = '';
      renderAll();
    });
  }
}

async function initPage() {
  await renderHeader();
  renderFooter();
  initFilters();
  await loadData();
}

initPage();
