
import { getCurrentUser as getSupabaseCurrentUser, logoutUser } from '../services/authService.js';
import { getUserRole } from '../services/rolesService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getCurrentUser() {
  const keys = ['staysafebgUser', 'currentUser', 'user'];

  for (const key of keys) {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) continue;

    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      if (rawValue.includes('@')) {
        return { email: rawValue };
      }
    }
  }

  return null;
}

function getLocalCurrentUser() {
  return getCurrentUser();
}

function isAdminUser(user) {
  if (!user) return false;

  if (typeof user.isAdmin === 'boolean') {
    return user.isAdmin;
  }

  const role = typeof user.role === 'string' ? user.role.toLowerCase() : '';
  return role === 'admin';
}

function isModeratorUser(user) {
  if (!user) return false;
  const role = typeof user.role === 'string' ? user.role.toLowerCase() : '';
  return role === 'moderator';
}

function isLoggedIn(user) {
  if (user) return true;
  const token = localStorage.getItem('token') || localStorage.getItem('authToken');
  return Boolean(token);
}

function getActivePage() {
  const path = window.location.pathname.split('/').pop();
  return path || 'index.html';
}

async function resolveCurrentUser() {
  if (!hasSupabaseConfig) {
    return getLocalCurrentUser();
  }

  try {
    const user = await getSupabaseCurrentUser();
    if (!user) return null;

    let role = user.role || 'user';
    try {
      role = await getUserRole(user.id);
    } catch {
      role = user.role || 'user';
    }

    const normalizedUser = {
      id: user.id,
      email: user.email,
      role,
      username: user.firstName || user.email,
    };

    localStorage.setItem('staysafebgUser', JSON.stringify(normalizedUser));
    return normalizedUser;
  } catch {
    return getLocalCurrentUser();
  }
}

function renderHeaderHtml(currentUser) {
  const loggedIn = isLoggedIn(currentUser);
  const isAdmin = isAdminUser(currentUser);
  const isModerator = isModeratorUser(currentUser);
  const userLabel = escapeHtml(currentUser?.email || currentUser?.username || 'Профил');
  const activePage = getActivePage();
  const ctaClass = 'nav-link ss-nav-link fw-semibold mx-2';
  const accountClass = 'btn ss-account-btn fw-semibold px-4 py-2 fs-5 border-2';

  const homeIsActive = activePage === 'index.html';
  const checkIsActive = activePage === 'scam-check.html' || activePage === 'resources-bulletin.html';
  const reportIsActive = activePage === 'report-scam.html';
  const articlesIsActive = activePage === 'tips.html' || activePage === 'tips-details.html';
  const communityIsActive = activePage === 'community.html';

  const accountActionsHtml = loggedIn
    ? `
      <li class="nav-item mt-2 mt-lg-0 me-lg-2">
        <a class="btn ss-profile-btn fw-semibold px-3 py-2 fs-6 border-2" href="#">${userLabel}</a>
      </li>
      <li class="nav-item mt-2 mt-lg-0">
        <button class="btn ss-account-solid fw-semibold px-4 py-2 fs-5 border-2" id="logout-btn" type="button">Изход</button>
      </li>
    `
    : `
      <li class="nav-item mt-2 mt-lg-0 me-lg-2">
        <a class="${accountClass}" href="login.html">Вход</a>
      </li>
      <li class="nav-item mt-2 mt-lg-0">
        <a class="btn ss-account-solid fw-semibold px-4 py-2 fs-5 border-2" href="register.html">Регистрация</a>
      </li>
    `;

  const managementActionHtml = (isAdmin || isModerator)
    ? `
      <li class="nav-item mt-2 mt-lg-0 ms-lg-2">
        <a class="btn ss-account-btn fw-semibold px-4 py-2 fs-6 border-2" href="admin.html">${isAdmin ? 'Админ' : 'Модератор'}</a>
      </li>
    `
    : '';

  return `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary mb-4 ss-navbar">
      <div class="container-fluid">
        <a class="navbar-brand d-flex align-items-center ss-navbar-brand" href="index.html">
          <img src="/logo-nav.png" alt="StaySafeBG Logo" style="height: 84px; width: auto;" class="d-inline-block ss-navbar-brand-img">
        </a>

        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Превключи навигацията">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse ss-navbar-collapse-panel" id="navbarNav">
          <ul class="navbar-nav mx-lg-auto mb-2 mb-lg-0 align-items-lg-center">
            <li class="nav-item mt-2 mt-lg-0">
              <a class="${ctaClass} ${homeIsActive ? 'ss-nav-link-active' : ''}" href="index.html" ${homeIsActive ? 'aria-current="page"' : ''}>Начало</a>
            </li>
            <li class="nav-item mt-2 mt-lg-0">
              <a class="${ctaClass} ${checkIsActive ? 'ss-nav-link-active' : ''}" href="scam-check.html" ${checkIsActive ? 'aria-current="page"' : ''}>Провери</a>
            </li>
            <li class="nav-item mt-2 mt-lg-0">
              <a class="${ctaClass} ${reportIsActive ? 'ss-nav-link-active' : ''}" href="report-scam.html" ${reportIsActive ? 'aria-current="page"' : ''}>Докладвай</a>
            </li>
            <li class="nav-item mt-2 mt-lg-0">
              <a class="${ctaClass} ${articlesIsActive ? 'ss-nav-link-active' : ''}" href="tips.html" ${articlesIsActive ? 'aria-current="page"' : ''}>Съвети</a>
            </li>
            <li class="nav-item mt-2 mt-lg-0">
              <a class="${ctaClass} ${communityIsActive ? 'ss-nav-link-active' : ''}" href="community.html" ${communityIsActive ? 'aria-current="page"' : ''}>Общност</a>
            </li>
          </ul>

          <ul class="navbar-nav mb-2 mb-lg-0 align-items-lg-center ms-lg-3">
            ${accountActionsHtml}
            ${managementActionHtml}
          </ul>
        </div>
      </div>
    </nav>
  `;
}

export async function renderHeader() {
  const currentUser = await resolveCurrentUser();
  const headerHtml = renderHeaderHtml(currentUser);
  const container = document.getElementById('app-header');
  if (!container) return;

  container.innerHTML = headerHtml;

  const logoutButton = document.getElementById('logout-btn');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', async () => {
    try {
      if (hasSupabaseConfig) {
        await logoutUser();
      } else {
        localStorage.removeItem('staysafebgUser');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
      }
    } catch {
      localStorage.removeItem('staysafebgUser');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('authToken');
    }

    window.location.href = 'index.html';
  });
}
