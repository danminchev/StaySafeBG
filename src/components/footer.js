export function renderFooter() {
  const footerHtml = `
    <footer class="footer mt-auto py-3 bg-light text-center">
      <div class="container">
        <span class="text-muted">&copy; 2026 StaySafeBG. Всички права запазени.</span>
      </div>
    </footer>
  `;
  const container = document.getElementById('app-footer');
  if (container) container.innerHTML = footerHtml;
}
