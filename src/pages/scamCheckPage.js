import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { showToast } from '../utils/notifications.js';
import { getRecentApprovedScamChecks, runScamCheck } from '../services/scamCheckService.js';

renderHeader();
renderFooter();

const form = document.querySelector('.scam-check-form');
const input = document.getElementById('scam-check-input');
const button = document.getElementById('scam-check-submit');
const resultHost = document.getElementById('scam-check-result');
const recentList = document.getElementById('recent-checks-list');

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function detectTargetValue(item) {
	return item.url || item.phone || item.title || 'Няма данни';
}

function iconByValue(value) {
	if (!value) return 'bi-shield-check';
	if (value.startsWith('http') || value.includes('.')) return 'bi-globe';
	if (value.includes('+') || /\d/.test(value)) return 'bi-telephone';
	return 'bi-shield-check';
}

function renderResult(result) {
	const statusClass = result.verdict === 'danger'
		? 'result-danger'
		: result.verdict === 'warning'
			? 'result-warning'
			: result.verdict === 'unknown'
				? 'result-unknown'
				: 'result-safe';
	const statusLabel = result.verdict === 'danger'
		? 'ВИСОК РИСК'
		: result.verdict === 'warning'
			? 'СРЕДЕН РИСК'
			: result.verdict === 'unknown'
				? 'НЕПЪЛНА ПРОВЕРКА'
				: 'НИСЪК РИСК';
	const summary = result.verdict === 'danger'
		? 'Открити са силни рискови сигнали от множество източници.'
		: result.verdict === 'warning'
			? 'Има частични рискови сигнали. Не отваряйте линка без допълнителна проверка.'
			: result.verdict === 'unknown'
				? 'Външните източници не отговориха. Резултатът не може да се приеме за безопасен.'
				: 'Не е открито съвпадение в базата и външните източници.';

	const dbLabel = result.database.matched
		? `Намерени съвпадения в база: ${result.database.matches.length}`
		: 'Няма съвпадение в базата';

	const internetLabel = result.internet.checked
		? `Интернет източници: ${result.internet.flaggedCount || 0} сигнал(а) от ${result.internet.checkedCount || 0} проверени`
		: 'Интернет проверка: източниците не върнаха данни';

	const sourceRows = (result.internet.sources || [])
		.filter((source) => source.checked || source.reason)
		.map((source) => `
			<li>
				<strong>${escapeHtml(source.source || 'Unknown source')}</strong>
				<span class="small d-block ${source.flagged ? 'check-source-risk' : 'check-source-clean'}">
					${source.flagged ? 'Сигнал за риск' : 'Няма сигнал'}${source.reason ? ` · ${escapeHtml(source.reason)}` : ''}
				</span>
			</li>
		`).join('');

	const matchedRows = (result.database.matches || []).map((match) => {
		const target = detectTargetValue(match);
		return `
			<li>
				<strong>${escapeHtml(target)}</strong>
				<span class="small check-result-subtle d-block">${escapeHtml(match.category || 'Категория: -')}</span>
			</li>
		`;
	}).join('');

	resultHost.innerHTML = `
		<div class="check-result-card ${statusClass}">
			<div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
				<h5 class="mb-0"><i class="bi bi-activity me-2"></i>Резултат от проверката</h5>
				<span class="badge rounded-pill ${result.verdict === 'danger' ? 'text-bg-danger' : result.verdict === 'warning' ? 'text-bg-warning text-dark' : result.verdict === 'unknown' ? 'text-bg-secondary' : 'text-bg-success'}">${statusLabel}</span>
			</div>
			<p class="mb-2">${summary}</p>
			<div class="risk-score mb-2">Риск индекс: <strong>${result.riskScore}/100</strong></div>
			<ul class="check-result-meta mb-0">
				<li><i class="bi bi-database-check me-2"></i>${dbLabel}</li>
				<li><i class="bi bi-globe2 me-2"></i>${internetLabel}</li>
				<li><i class="bi bi-shield-lock me-2"></i>Режим: ${result.internet.usedEdgeFunction ? 'Разширена проверка (Edge Function)' : 'Базова проверка (fallback)'}</li>
			</ul>
			${(result.warnings || []).length ? `<div class="check-result-warning mt-3"><i class="bi bi-exclamation-triangle me-2"></i>${escapeHtml(result.warnings[0])}</div>` : ''}
			${matchedRows ? `<hr class="my-3"><h6 class="mb-2">Съвпадения в базата</h6><ul class="check-result-list mb-0">${matchedRows}</ul>` : ''}
			${sourceRows ? `<hr class="my-3"><h6 class="mb-2">Външни източници</h6><ul class="check-result-list mb-0">${sourceRows}</ul>` : ''}
		</div>
	`;
}

function setLoading(isLoading) {
	if (!button) return;
	button.disabled = isLoading;
	button.innerHTML = isLoading
		? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Проверка...'
		: '<i class="bi bi-search me-2"></i>Провери';
}

async function handleSubmit(event) {
	event.preventDefault();

	const value = input?.value?.trim() || '';
	if (!value) {
		showToast('Въведете URL, телефон или имейл за проверка.', 'warning');
		return;
	}

	setLoading(true);

	try {
		const result = await runScamCheck(value);
		renderResult(result);
		const toastMessage = result.verdict === 'unknown'
			? 'Проверката е непълна: външните източници не отговориха надеждно.'
			: result.isSuspicious
				? `Открити са рискови сигнали (индекс ${result.riskScore}/100).`
				: 'Проверката приключи без рисков сигнал.';
		showToast(toastMessage, result.verdict === 'unknown' ? 'warning' : result.isSuspicious ? 'warning' : 'success');
	} catch (error) {
		showToast(error?.message || 'Грешка при проверката. Опитайте отново.', 'error');
	} finally {
		setLoading(false);
	}
}

function renderRecentChecks(items) {
	if (!recentList) return;

	if (!items.length) {
		recentList.innerHTML = `
			<div class="recent-check-item">
				<span class="check-target"><i class="bi bi-info-circle"></i>Няма налични проверки</span>
				<span class="badge bg-secondary rounded-pill">Няма данни</span>
			</div>
		`;
		return;
	}

	recentList.innerHTML = items.map((item) => {
		const target = detectTargetValue(item);
		const icon = iconByValue(target);

		return `
			<div class="recent-check-item">
				<span class="check-target"><i class="bi ${icon}"></i>${escapeHtml(target)}</span>
				<span class="badge bg-danger text-white border border-danger-subtle rounded-pill">Съмнителен</span>
			</div>
		`;
	}).join('');
}

async function loadRecentChecks() {
	try {
		const data = await getRecentApprovedScamChecks(5);
		renderRecentChecks(data);
	} catch {
		renderRecentChecks([]);
	}
}

if (form) {
	form.addEventListener('submit', handleSubmit);
}

loadRecentChecks();
