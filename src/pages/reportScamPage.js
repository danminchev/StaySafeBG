import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getCurrentUser } from '../services/authService.js';
import { createScamReport, attachReportFile } from '../services/reportsService.js';
import { uploadEvidenceFile } from '../services/storageService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';

function showMessage(message, type = 'danger') {
	const form = document.querySelector('form');
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
		showMessage('Трябва да сте влезли, за да докладвате измама.');
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

	const sourceFields = parseSource(source);
	const reportTitle = `${finalScamType.toUpperCase()} - ${source || 'Без източник'}`;

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

	const form = document.querySelector('form');
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
		form.addEventListener('submit', handleReportSubmit);
	}
}

initReportScamPage();
