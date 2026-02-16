export function renderHeader() {
  const headerHtml = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
      <div class="container-fluid">
        <a class="navbar-brand d-flex align-items-center" href="index.html">
          <img src="/logo-nav.png" alt="StaySafeBG Logo" style="height: 72px; width: auto;" class="d-inline-block">
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-center">
            <li class="nav-item">
              <a class="nav-link fs-5 ms-3" href="articles.html">Статии</a>
            </li>
            <li class="nav-item">
              <a class="nav-link fs-5 ms-3" href="scam-check.html">Провери за измама</a>
            </li>
            <li class="nav-item">
              <a class="nav-link fs-5 ms-3" href="report-scam.html">Докладвай измама</a>
            </li>
            <li class="nav-item">
              <a class="nav-link fs-5 ms-3" href="login.html">Вход</a>
            </li>
            <li class="nav-item">
              <a class="nav-link fs-5 ms-3" href="register.html">Регистрация</a>
            </li>
             <li class="nav-item">
              <a class="nav-link fs-5 ms-3" href="admin.html">Админ</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `;
  const container = document.getElementById('app-header');
  if (container) container.innerHTML = headerHtml;
}
