export function renderHeader() {
  const headerHtml = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
      <div class="container-fluid">
        <a class="navbar-brand" href="index.html">StaySafeBG</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <a class="nav-link" href="articles.html">Статии</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="scam-check.html">Провери за измама</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="report-scam.html">Докладвай измама</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="login.html">Вход</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="register.html">Регистрация</a>
            </li>
             <li class="nav-item">
              <a class="nav-link" href="admin.html">Админ</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `;
  const container = document.getElementById('app-header');
  if (container) container.innerHTML = headerHtml;
}
