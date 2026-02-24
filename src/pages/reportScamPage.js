import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getCurrentUser } from '../services/authService.js';
import { createScamReport, attachReportFile } from '../services/reportsService.js';
import { uploadEvidenceFile } from '../services/storageService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function showMessage(message, type = 'danger') {
	const form = document.getElementById('report-scam-form');
	if (!form) return;

	let alertEl = document.getElementById('report-message');
	if (!alertEl) {
		alertEl = document.createElement('div');
		alertEl.id = 'report-message';
		alertEl.className = 'alert mt-3';
		form.prepend(alertEl);
	}

	alertEl.className = `alert alert-${type} mt-3`;
	alertEl.textContent = message;
}

function renderReportAuthNotice(form) {
	if (!form) return;

	const modalBody = form.closest('.modal-body') || form.parentElement;
	const modalTitle = form.closest('.modal-content')?.querySelector('.modal-title');
	if (!modalBody) return;

	let notice = document.getElementById('report-auth-required-message');
	if (!notice) {
		notice = document.createElement('div');
		notice.id = 'report-auth-required-message';
		notice.className = 'ss-report-auth-gate mb-2';
		notice.innerHTML = `
			<div class="ss-report-auth-gate__glow" aria-hidden="true"></div>
			<div class="ss-report-auth-gate__content">
				<div class="ss-report-auth-gate__icon" aria-hidden="true">
					<i class="bi bi-shield-lock-fill"></i>
				</div>
				<div class="ss-report-auth-gate__kicker">Защитено подаване на доклади</div>
				<h3 class="ss-report-auth-gate__title">Вход или регистрация са необходими, за да подадете доклад</h3>
				<p class="ss-report-auth-gate__text">
					За по-голяма проследяемост, сигурност и защита от злоупотреби приемаме доклади само от регистрирани потребители.
					Ако вече имате профил, влезте. Ако сте нов потребител, създайте акаунт и продължете с подаването.
				</p>
				<div class="ss-report-auth-gate__actions">
					<a href="login.html" class="btn btn-primary btn-lg">Вход</a>
					<a href="register.html" class="btn btn-outline-light btn-lg">Регистрация</a>
				</div>
				<p class="ss-report-auth-gate__footnote mb-0">
					След вход ще получите достъп до формата за докладване.
				</p>
			</div>
		`;
		modalBody.append(notice);
	}

	if (modalTitle) {
		modalTitle.textContent = 'Достъп до форма за доклад';
	}

	form.classList.add('d-none');
}

function clearReportAuthNotice() {
	const notice = document.getElementById('report-auth-required-message');
	if (notice) {
		notice.remove();
	}

	const modalTitle = document.querySelector('.ss-report-popup .modal-title');
	if (modalTitle) {
		modalTitle.textContent = 'Форма за доклад';
	}
}

async function enforceReportAuthRequirement(form) {
	let user = null;

	try {
		user = await getCurrentUser();
	} catch {
		user = null;
	}

	if (!user) {
		renderReportAuthNotice(form);
		return null;
	}

	clearReportAuthNotice();
	form.classList.remove('d-none');
	return user;
}

function parseSource(source) {
	const value = source.trim();
	if (!value) {
		return { url: null, phone: null, iban: null };
	}

	if (/^bg\d{2}[a-z0-9]{4}\d{6}[a-z0-9]{8}$/i.test(value.replace(/\s+/g, ''))) {
		return { url: null, phone: null, iban: value };
	}

	if (/^[+\d\s()-]{6,}$/.test(value)) {
		return { url: null, phone: value, iban: null };
	}

	return {
		url: value,
		phone: null,
		iban: null,
	};
}

function getScamTypeLabel(scamTypeKey) {
	const labels = {
		phishing: 'Фишинг',
		phone: 'Телефонна измама',
		investment: 'Инвестиционна измама',
		shopping: 'Онлайн пазаруване',
		online_shopping: 'Онлайн пазаруване',
		social_media: 'Социални мрежи',
		identity_theft: 'Кражба на самоличност',
		job_scam: 'Измама с работа',
		job_scams: 'Измама с работа',
		crypto: 'Крипто измама',
		marketplace: 'Marketplace измама',
		romance: 'Романтична измама',
		other: 'Друго'
	};

	const normalizedKey = String(scamTypeKey || '').trim().toLowerCase();
	return labels[normalizedKey] || scamTypeKey;
}

async function handleReportSubmit(event) {
	event.preventDefault();

	if (!hasSupabaseConfig) {
		showMessage('Липсва Supabase конфигурация. Добавете VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env файла.');
		return;
	}

	let user;
	try {
		user = await getCurrentUser();
	} catch {
		user = null;
	}

	if (!user) {
		showMessage('\u041d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e \u0435 \u0434\u0430 \u0441\u0442\u0435 \u0432\u043b\u0435\u0437\u043b\u0438 \u0438\u043b\u0438 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u0430\u043d\u0438, \u0437\u0430 \u0434\u0430 \u043f\u043e\u0434\u0430\u0434\u0435\u0442\u0435 \u0434\u043e\u043a\u043b\u0430\u0434.');
		window.setTimeout(() => {
			window.location.href = 'login.html';
		}, 900);
		return;
	}

	const scamType = document.getElementById('scamType')?.value || '';
	const scamTypeOther = document.getElementById('scamTypeOther')?.value.trim() || '';
	const source = document.getElementById('scamSource')?.value || '';
	const description = document.getElementById('description')?.value.trim() || '';
	const files = document.getElementById('evidence')?.files || [];

	if (!scamType || scamType === 'Изберете тип измама...') {
		showMessage('Моля, изберете тип измама.');
		return;
	}

	if (scamType === 'other' && !scamTypeOther) {
		showMessage('Моля, въведете какъв тип е измамата.');
		return;
	}

	if (!description || description.length < 15) {
		showMessage('Моля, добавете описание поне 15 символа.');
		return;
	}

	const finalScamType = scamType === 'other' ? scamTypeOther : scamType;
	const finalCategory = scamType === 'other' ? 'other' : scamType;
	const scamTypeLabel = scamType === 'other'
		? scamTypeOther
		: getScamTypeLabel(finalScamType);

	const sourceFields = parseSource(source);
	const reportTitle = `${scamTypeLabel} - ${source || 'Без източник'}`;

	const submitButton = event.target.querySelector('button[type="submit"]');
	if (submitButton) {
		submitButton.disabled = true;
		submitButton.textContent = 'Изпращане...';
	}

	try {
		const report = await createScamReport({
			title: reportTitle,
			description,
			category: finalCategory,
			scamType: finalScamType,
			...sourceFields,
			createdBy: user.id,
		});

		for (const file of Array.from(files)) {
			const uploadResult = await uploadEvidenceFile({
				userId: user.id,
				reportId: report.id,
				file,
			});

			await attachReportFile({
				reportId: report.id,
				filePath: uploadResult.path,
				mimeType: uploadResult.mimeType,
			});
		}

		showMessage('Докладът е изпратен успешно. Благодарим за съдействието!', 'success');
		event.target.reset();
	} catch (error) {
		showMessage(error.message || 'Възникна грешка при изпращане на доклада.');
	} finally {
		if (submitButton) {
			submitButton.disabled = false;
			submitButton.textContent = 'Изпрати доклад';
		}
	}
}

async function initReportScamPage() {
	await renderHeader();
	renderFooter();

	const form = document.getElementById('report-scam-form');
	const scamTypeSelect = document.getElementById('scamType');
	const scamTypeOtherWrap = document.getElementById('scamTypeOtherWrap');
	const scamTypeOtherInput = document.getElementById('scamTypeOther');

	if (scamTypeSelect && scamTypeOtherWrap && scamTypeOtherInput) {
		scamTypeSelect.addEventListener('change', () => {
			const isOther = scamTypeSelect.value === 'other';
			scamTypeOtherWrap.classList.toggle('d-none', !isOther);
			if (isOther) {
				scamTypeOtherInput.focus();
			} else {
				scamTypeOtherInput.value = '';
			}
		});
	}

	if (form) {
		form.classList.add('d-none');
		await enforceReportAuthRequirement(form);
		form.addEventListener('submit', handleReportSubmit);
	}
}

initReportScamPage();

