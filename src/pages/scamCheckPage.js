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

const RECENT_CHECKS_STORAGE_KEY = 'staysafebg_recent_checks';
const RECENT_CHECKS_LIMIT = 5;

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function detectTargetValue(item) {
	return item.input || item.url || item.phone || item.title || 'Няма данни';
}

function iconByValue(value) {
	if (!value) return 'bi-shield-check';
	if (value.startsWith('http') || value.includes('.')) return 'bi-globe';
	if (value.includes('+') || /\d/.test(value)) return 'bi-telephone';
	return 'bi-shield-check';
}

function readStoredRecentChecks() {
	try {
		const raw = localStorage.getItem(RECENT_CHECKS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveStoredRecentChecks(items) {
	try {
		localStorage.setItem(
			RECENT_CHECKS_STORAGE_KEY,
			JSON.stringify((items || []).slice(0, RECENT_CHECKS_LIMIT)),
		);
	} catch {
		// Ignore storage errors.
	}
}

function rememberRecentCheck(target, result) {
	const nextItem = {
		input: target,
		verdict: result?.verdict || 'unknown',
		checkedAt: new Date().toISOString(),
	};

	const current = readStoredRecentChecks()
		.filter((item) => typeof item?.input === 'string' && item.input.trim().length > 0)
		.filter((item) => item.input !== nextItem.input);

	saveStoredRecentChecks([nextItem, ...current]);
}

function badgeByVerdict(verdict) {
	if (verdict === 'danger') {
		return { label: 'Съмнителен', className: 'bg-danger text-white border border-danger-subtle' };
	}

	if (verdict === 'warning') {
		return { label: 'Риск', className: 'bg-warning text-dark border border-warning-subtle' };
	}

	if (verdict === 'clean') {
		return { label: 'Чист', className: 'bg-success text-white border border-success-subtle' };
	}

	return { label: 'Непълна', className: 'bg-secondary text-white border border-secondary-subtle' };
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
	const meterClass = result.verdict === 'danger'
		? 'risk-meter-fill-danger'
		: result.verdict === 'warning'
			? 'risk-meter-fill-warning'
			: result.verdict === 'unknown'
				? 'risk-meter-fill-unknown'
				: 'risk-meter-fill-safe';

	const dbLabel = result.database.matched
		? `Намерени съвпадения в база: ${result.database.matches.length}`
		: 'Няма съвпадение в базата';

	const malwareLabel = result.maliciousResources?.matched
		? `Зловредни ресурси: ${result.maliciousResources.matches.length} съвпадение(я)`
		: 'Зловредни ресурси: няма съвпадение';

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

	const maliciousRows = (result.maliciousResources?.matches || []).map((match) => `
		<li>
			<strong>${escapeHtml(match.resource_value || match.normalized_value || '-')}</strong>
			<span class="small d-block ${String(match.risk_level || '').toLowerCase() === 'high' ? 'check-source-risk' : 'check-result-subtle'}">
				${escapeHtml(String(match.resource_type || 'other').toUpperCase())} | ${escapeHtml(String(match.risk_level || 'high').toUpperCase())} | ${escapeHtml(match.status || 'unknown')} | ${escapeHtml(match.source || 'manual')}
			</span>
		</li>
	`).join('');

	resultHost.innerHTML = `
		<div class="check-result-card ${statusClass}">
			<div class="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
				<h5 class="mb-0"><i class="bi bi-activity me-2"></i>Резултат от проверката</h5>
				<span class="badge rounded-pill ${result.verdict === 'danger' ? 'text-bg-danger' : result.verdict === 'warning' ? 'text-bg-warning text-dark' : result.verdict === 'unknown' ? 'text-bg-secondary' : 'text-bg-success'}">${statusLabel}</span>
			</div>
			<p class="mb-2">${summary}</p>
			<div class="risk-score mb-2">Риск индекс: <strong>${result.riskScore}/100</strong></div>
			<div class="risk-meter mb-3" role="progressbar" aria-label="Риск индекс" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${result.riskScore}">
				<div class="risk-meter-fill ${meterClass}" style="width: ${Math.max(0, Math.min(100, result.riskScore))}%;"></div>
			</div>
			<div class="risk-meter-scale mb-3" aria-hidden="true">
				<span>0</span>
				<span>50</span>
				<span>100</span>
			</div>
			<ul class="check-result-meta mb-0">
				<li><i class="bi bi-database-check me-2"></i>${dbLabel}</li>
				<li><i class="bi bi-bug-fill me-2"></i>${malwareLabel}</li>
				<li><i class="bi bi-globe2 me-2"></i>${internetLabel}</li>
				<li><i class="bi bi-shield-lock me-2"></i>Режим: ${result.internet.usedEdgeFunction ? 'Разширена проверка (Edge Function)' : 'Базова проверка (fallback)'}</li>
			</ul>
			${(result.warnings || []).length ? `<div class="check-result-warning mt-3"><i class="bi bi-exclamation-triangle me-2"></i>${escapeHtml(result.warnings[0])}</div>` : ''}
			${maliciousRows ? `<hr class="my-3"><h6 class="mb-2">Съвпадения в зловредни ресурси</h6><ul class="check-result-list mb-0">${maliciousRows}</ul>` : ''}
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
		rememberRecentCheck(value, result);
		renderRecentChecks(readStoredRecentChecks());

		const toastMessage = result.verdict === 'unknown'
			? 'Проверката е непълна: външните източници не отговориха надеждно.'
			: result.isSuspicious
				? `Открити са рискови сигнали (индекс ${result.riskScore}/100).`
				: 'Проверката приключи без рискови сигнали.';
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
		const badge = badgeByVerdict(item.verdict);

		return `
			<div class="recent-check-item">
				<span class="check-target"><i class="bi ${icon}"></i>${escapeHtml(target)}</span>
				<span class="badge ${badge.className} rounded-pill">${badge.label}</span>
			</div>
		`;
	}).join('');
}

async function loadRecentChecks() {
	const stored = readStoredRecentChecks();
	if (stored.length) {
		renderRecentChecks(stored);
		return;
	}

	try {
		const data = await getRecentApprovedScamChecks(RECENT_CHECKS_LIMIT);
		const normalized = (data || []).map((item) => ({
			input: detectTargetValue(item),
			verdict: 'danger',
			checkedAt: item.created_at || null,
		}));
		saveStoredRecentChecks(normalized);
		renderRecentChecks(normalized);
	} catch {
		renderRecentChecks([]);
	}
}

if (form) {
	form.addEventListener('submit', handleSubmit);
}

loadRecentChecks();
