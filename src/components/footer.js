export function renderFooter() {
  const currentYear = new Date().getFullYear();

  const footerHtml = `
    <footer class="ss-footer mt-auto">
      <div class="container py-5">
        <div class="ss-footer-top">
          <span></span>
          <div class="ss-footer-top-center">
            <a href="index.html" aria-label="Към начална страница">
              <img src="/logo-nav.png" alt="StaySafeBG" class="ss-footer-logo" />
            </a>
          </div>
          <span></span>
        </div>

        <div class="row g-4 g-lg-5 align-items-start mt-1">
          <div class="col-12 col-lg-4">
            <div class="ss-footer-block">
              <h6 class="ss-footer-title">Контакт</h6>
              <ul class="ss-footer-meta list-unstyled mb-0">
                <li><strong>Телефон:</strong> +359 889 153 077</li>
                <li><strong>Имейл:</strong> support@staysafebg.bg</li>
                <li><strong>Адрес:</strong> България</li>
              </ul>
            </div>
          </div>

          <div class="col-12 col-lg-4">
            <div class="ss-footer-center">
              <p class="ss-footer-desc mb-0">Надеждна платформа за превенция на онлайн измами и дигитална безопасност.</p>
            </div>
          </div>

          <div class="col-12 col-lg-4">
            <div class="ss-footer-block ss-footer-nav-wrap">
              <h6 class="ss-footer-title">Навигация</h6>
              <ul class="ss-footer-links list-unstyled mb-0">
                <li><a href="index.html">Начало</a></li>
                <li><a href="scam-check.html">Провери измама</a></li>
                <li><a href="report-scam.html">Докладвай измама</a></li>
                <li><a href="tips.html">Съвети</a></li>
                <li><a href="community.html">Общност</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div class="ss-footer-bottom mt-4 pt-3">
          <span>&copy; ${currentYear} StaySafeBG. Всички права запазени.</span>
          <a href="privacy-policy.html" class="ss-footer-policy">Политика за поверителност</a>
        </div>
      </div>
    </footer>
  `;
  const container = document.getElementById('app-footer');
  if (container) container.innerHTML = footerHtml;
}
