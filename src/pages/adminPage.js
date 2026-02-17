import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getCurrentUser } from '../services/authService.js';
import { getUserRole } from '../services/rolesService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';
import { createArticle, getAdminArticles, getArticleById, updateArticle } from '../services/articlesService.js';
import { getAdminReports, getAdminReportById, getAdminReportStats, getEvidenceFileSignedUrl, updateReportStatus } from '../services/reportsService.js';
import { showToast } from '../utils/notifications.js';

const state = {
    articles: [],
    reports: [],
    selectedReportId: null
};

const predefinedCategories = new Set([
    'phishing',
    'shopping',
    'online_shopping',
    'investment',
    'security',
    'identity_theft',
    'tech_support',
    'job_scams',
    'phone',
    'romance',
    'social',
    'crypto',
    'marketplace'
]);

const dom = {
    container: document.getElementById('page-content'),
    createSaveBtn: document.getElementById('btn-save-article'),
    updateBtn: document.getElementById('btn-update-article'),
    refreshBtn: document.getElementById('btn-refresh-articles'),
    articlesBody: document.getElementById('admin-articles-body'),
    reportsBody: document.getElementById('admin-reports-body'),
    stats: {
        pending: document.getElementById('admin-stat-pending'),
        approved: document.getElementById('admin-stat-approved')
    },
    reportReview: {
        id: document.getElementById('review-report-id'),
        title: document.getElementById('review-report-title'),
        type: document.getElementById('review-report-type'),
        category: document.getElementById('review-report-category'),
        source: document.getElementById('review-report-source'),
        description: document.getElementById('review-report-description'),
        status: document.getElementById('review-report-status'),
        files: document.getElementById('review-report-files'),
        approveBtn: document.getElementById('btn-approve-report'),
        rejectBtn: document.getElementById('btn-reject-report')
    },
    create: {
        title: document.getElementById('article-title'),
        category: document.getElementById('article-category'),
        categoryOtherWrap: document.getElementById('article-category-other-wrap'),
        categoryOther: document.getElementById('article-category-other'),
        content: document.getElementById('article-content'),
        published: document.getElementById('article-published'),
        form: document.getElementById('create-article-form')
    },
    edit: {
        id: document.getElementById('edit-article-id'),
        title: document.getElementById('edit-article-title'),
        category: document.getElementById('edit-article-category'),
        categoryOtherWrap: document.getElementById('edit-article-category-other-wrap'),
        categoryOther: document.getElementById('edit-article-category-other'),
        content: document.getElementById('edit-article-content'),
        published: document.getElementById('edit-article-published')
    }
};

function showForbidden(message) {
    const container = dom.container;
	if (!container) return;

    container.style.display = 'block';
	container.innerHTML = `
		<div class="alert alert-danger" role="alert">${message}</div>
		<a href="index.html" class="btn btn-primary mt-2">Към началната страница</a>
	`;
}

// Ensure bootstrap is available
const bootstrap = window.bootstrap;

function formatDate(dateValue) {
    if (!dateValue) return 'Без дата';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Без дата';

    return new Intl.DateTimeFormat('bg-BG', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

function getCategoryName(category) {
    const map = {
        phishing: 'Фишинг',
        phone: 'Телефонна измама',
        shopping: 'Пазаруване',
        online_shopping: 'Онлайн пазаруване',
        investment: 'Инвестиции',
        security: 'Сигурност',
        identity_theft: 'Кражба на самоличност',
        tech_support: 'Техническа поддръжка',
        job_scams: 'Работа',
        romance: 'Романтична измама',
        social: 'Социални мрежи',
        social_media: 'Социални мрежи',
        crypto: 'Крипто измама',
        marketplace: 'Marketplace измама',
        other: 'Друго'
    };

    return map[category] || 'Общи';
}

function getReportStatusMeta(status) {
    const statusMap = {
        pending: { label: 'Чакащ', className: 'bg-danger' },
        approved: { label: 'Потвърден', className: 'bg-success' },
        rejected: { label: 'Отхвърлен', className: 'bg-secondary' }
    };

    return statusMap[status] || { label: status || 'Неизвестен', className: 'bg-secondary' };
}

function getReportSource(report) {
    return report.url || report.phone || report.iban || 'Не е посочен';
}

function getReportStatusPriority(status) {
    const priorityMap = {
        pending: 0,
        approved: 1,
        rejected: 2
    };

    return priorityMap[status] ?? 99;
}

function renderReportsTable() {
    if (!dom.reportsBody) return;

    dom.reportsBody.textContent = '';

    if (state.reports.length === 0) {
        dom.reportsBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Няма доклади за показване.</td></tr>';
        return;
    }

    state.reports.forEach((report, index) => {
        const row = document.createElement('tr');
        const statusMeta = getReportStatusMeta(report.status);

        const indexCell = document.createElement('th');
        indexCell.scope = 'row';
        indexCell.textContent = String(index + 1);

        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(report.created_at);

        const typeCell = document.createElement('td');
        typeCell.textContent = report.scam_type || getCategoryName(report.category);

        const sourceCell = document.createElement('td');
        sourceCell.textContent = getReportSource(report);

        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `badge ${statusMeta.className}`;
        statusBadge.textContent = statusMeta.label;
        statusCell.appendChild(statusBadge);

        const actionsCell = document.createElement('td');
        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'btn btn-sm btn-outline-primary';
        viewBtn.dataset.action = 'review-report';
        viewBtn.dataset.reportId = report.id;
        viewBtn.textContent = 'Преглед';

        actionsCell.appendChild(viewBtn);

        row.appendChild(indexCell);
        row.appendChild(dateCell);
        row.appendChild(typeCell);
        row.appendChild(sourceCell);
        row.appendChild(statusCell);
        row.appendChild(actionsCell);

        dom.reportsBody.appendChild(row);
    });
}

async function loadAdminReports() {
    if (!dom.reportsBody) return;

    dom.reportsBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Зареждане...</td></tr>';

    try {
        const { data } = await getAdminReports({ limit: 20 });
        state.reports = (data || []).sort((firstReport, secondReport) => {
            const statusPriorityDiff = getReportStatusPriority(firstReport.status) - getReportStatusPriority(secondReport.status);
            if (statusPriorityDiff !== 0) return statusPriorityDiff;

            const firstTime = new Date(firstReport.created_at).getTime();
            const secondTime = new Date(secondReport.created_at).getTime();
            return secondTime - firstTime;
        });
        renderReportsTable();
    } catch (error) {
        console.error('Error loading admin reports:', error);
        dom.reportsBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Грешка при зареждане на доклади.</td></tr>';
        showToast('Неуспешно зареждане на доклади.', 'error');
    }
}

async function loadAdminReportStats() {
    if (!dom.stats.pending || !dom.stats.approved) return;

    try {
        const stats = await getAdminReportStats();
        dom.stats.pending.textContent = stats.pendingCount.toLocaleString('bg-BG');
        dom.stats.approved.textContent = stats.approvedCount.toLocaleString('bg-BG');
    } catch (error) {
        console.error('Error loading report stats:', error);
        dom.stats.pending.textContent = '-';
        dom.stats.approved.textContent = '-';
    }
}

function setReportReviewLoadingState(message = 'Зареждане...') {
    if (!dom.reportReview.title) return;

    dom.reportReview.title.textContent = message;
    dom.reportReview.type.textContent = '-';
    dom.reportReview.category.textContent = '-';
    dom.reportReview.source.textContent = '-';
    dom.reportReview.description.textContent = '-';
    dom.reportReview.status.className = 'badge bg-secondary';
    dom.reportReview.status.textContent = '-';
    dom.reportReview.files.textContent = 'Зареждане...';
}

async function renderReportFiles(files) {
    if (!dom.reportReview.files) return;

    dom.reportReview.files.textContent = '';

    if (!files || files.length === 0) {
        dom.reportReview.files.textContent = 'Няма прикачени файлове.';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'mb-0 ps-3';

    const fileItems = await Promise.all(files.map(async (file) => {
        try {
            const signedUrl = await getEvidenceFileSignedUrl(file.file_path);
            return {
                file,
                signedUrl
            };
        } catch {
            return {
                file,
                signedUrl: null
            };
        }
    }));

    fileItems.forEach(({ file, signedUrl }) => {
        const item = document.createElement('li');
        if (signedUrl) {
            const link = document.createElement('a');
            link.href = signedUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = file.file_path.split('/').pop() || 'Файл';
            item.appendChild(link);
        } else {
            item.textContent = `${file.file_path.split('/').pop() || 'Файл'} (недостъпен)`;
        }
        list.appendChild(item);
    });

    dom.reportReview.files.appendChild(list);
}

async function openReportReview(reportId) {
    if (!reportId) return;

    state.selectedReportId = reportId;
    if (dom.reportReview.id) {
        dom.reportReview.id.value = reportId;
    }
    setReportReviewLoadingState();
    openModal('reportReviewModal');

    try {
        const report = await getAdminReportById(reportId);
        const statusMeta = getReportStatusMeta(report.status);
        dom.reportReview.title.textContent = report.title || 'Без заглавие';
        dom.reportReview.type.textContent = report.scam_type || 'Не е посочен';
        dom.reportReview.category.textContent = getCategoryName(report.category);
        dom.reportReview.source.textContent = getReportSource(report);
        dom.reportReview.description.textContent = report.description || 'Без описание';
        dom.reportReview.status.className = `badge ${statusMeta.className}`;
        dom.reportReview.status.textContent = statusMeta.label;

        await renderReportFiles(report.files);

        const isPending = report.status === 'pending';
        dom.reportReview.approveBtn.disabled = !isPending;
        dom.reportReview.rejectBtn.disabled = !isPending;
    } catch (error) {
        console.error('Error loading report details:', error);
        setReportReviewLoadingState('Грешка при зареждане');
        dom.reportReview.files.textContent = 'Неуспешно зареждане на файлове.';
        dom.reportReview.approveBtn.disabled = true;
        dom.reportReview.rejectBtn.disabled = true;
        showToast('Неуспешно зареждане на доклада.', 'error');
    }
}

async function changeSelectedReportStatus(status) {
    const reportId = state.selectedReportId || dom.reportReview.id?.value;
    if (!reportId) return;

    const button = status === 'approved' ? dom.reportReview.approveBtn : dom.reportReview.rejectBtn;
    const otherButton = status === 'approved' ? dom.reportReview.rejectBtn : dom.reportReview.approveBtn;
    const originalText = button.textContent;

    try {
        button.disabled = true;
        otherButton.disabled = true;
        button.textContent = 'Запазване...';

        await updateReportStatus(reportId, status);

        showToast(status === 'approved' ? 'Докладът е добавен като потвърдена измама.' : 'Докладът е отхвърлен.', 'success');

        closeModal('reportReviewModal');
        state.selectedReportId = null;

        await Promise.all([
            loadAdminReports(),
            loadAdminReportStats()
        ]);
    } catch (error) {
        console.error('Error updating report status:', error);
        showToast('Неуспешна промяна на статуса на доклада.', 'error');
    } finally {
        button.textContent = originalText;
    }
}

function toggleOtherCategoryInput(selectEl, inputWrap, inputEl) {
    if (!selectEl || !inputWrap || !inputEl) return;
    const isOther = selectEl.value === 'other';
    inputWrap.classList.toggle('d-none', !isOther);
    if (!isOther) {
        inputEl.value = '';
    }
}

function resolveCategoryValue(selectEl, otherInputEl) {
    if (!selectEl) return '';
    if (selectEl.value !== 'other') return selectEl.value;
    return otherInputEl?.value.trim() || '';
}

function closeModal(modalId) {
    if (!bootstrap) return;
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
}

function openModal(modalId) {
    if (!bootstrap) return;
    const modalEl = document.getElementById(modalId);
    if (!modalEl) return;

    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
}

function renderArticlesTable() {
    if (!dom.articlesBody) return;

    dom.articlesBody.textContent = '';

    if (state.articles.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.className = 'text-center text-muted py-4';
        cell.textContent = 'Няма налични статии.';
        row.appendChild(cell);
        dom.articlesBody.appendChild(row);
        return;
    }

    state.articles.forEach((article) => {
        const row = document.createElement('tr');

        const titleCell = document.createElement('td');
        titleCell.className = 'fw-semibold';
        titleCell.textContent = article.title || 'Без заглавие';

        const categoryCell = document.createElement('td');
        categoryCell.textContent = getCategoryName(article.category);

        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `badge ${article.is_published ? 'bg-success' : 'bg-secondary'}`;
        statusBadge.textContent = article.is_published ? 'Публикувана' : 'Чернова';
        statusCell.appendChild(statusBadge);

        const dateCell = document.createElement('td');
        dateCell.textContent = formatDate(article.created_at);

        const actionsCell = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-sm btn-outline-primary';
        editBtn.dataset.action = 'edit-article';
        editBtn.dataset.articleId = article.id;
        editBtn.textContent = 'Редактирай';
        actionsCell.appendChild(editBtn);

        row.appendChild(titleCell);
        row.appendChild(categoryCell);
        row.appendChild(statusCell);
        row.appendChild(dateCell);
        row.appendChild(actionsCell);

        dom.articlesBody.appendChild(row);
    });
}

async function loadAdminArticles() {
    if (!dom.articlesBody) return;

    dom.articlesBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Зареждане...</td></tr>';

    try {
        const { data } = await getAdminArticles();
        state.articles = data || [];
        renderArticlesTable();
    } catch (error) {
        console.error('Error loading admin articles:', error);
        dom.articlesBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Грешка при зареждане на статии.</td></tr>';
        showToast('Неуспешно зареждане на статии.', 'error');
    }
}

async function initAdminPage() {
	await renderHeader();
	renderFooter();

	if (!hasSupabaseConfig) {
		showForbidden('Админ панелът изисква активирана Supabase конфигурация.');
		return;
	}

	try {
		const user = await getCurrentUser();
		if (!user) {
			showForbidden('Трябва да сте влезли с админ акаунт.');
			return;
		}

		const role = await getUserRole(user.id);
		if (role !== 'admin') {
			// Redirect immediately if not admin
			window.location.replace('index.html');
			return;
		}

		// Proceed to render admin content...
		renderAdminContent();

	} catch (error) {
		console.error('Admin check failed:', error);
		window.location.replace('index.html');
	}
}

function renderAdminContent() {
    const container = dom.container;
	if (!container) return;
    
    container.style.display = 'block'; 
    // Instead of overwriting, we can just log success or initialize specific JS components if needed.
    console.log('Admin content rendered successfully');
    
    // Initialize event listeners for admin actions
    initArticleCreation();
	initArticleEditing();
	initReportReviewing();
	loadAdminReports();
	loadAdminReportStats();
	loadAdminArticles();
}

function initReportReviewing() {
    if (dom.reportsBody) {
        dom.reportsBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const viewButton = target.closest('button[data-action="review-report"]');
            if (!viewButton) return;

            const reportId = viewButton.dataset.reportId;
            if (!reportId) return;

            try {
                viewButton.disabled = true;
                await openReportReview(reportId);
            } finally {
                viewButton.disabled = false;
            }
        });
    }

    if (dom.reportReview.approveBtn) {
        dom.reportReview.approveBtn.addEventListener('click', () => changeSelectedReportStatus('approved'));
    }

    if (dom.reportReview.rejectBtn) {
        dom.reportReview.rejectBtn.addEventListener('click', () => changeSelectedReportStatus('rejected'));
    }
}

function initArticleCreation() {
	const saveBtn = dom.createSaveBtn;
    if (!saveBtn) return;

	if (dom.create.category) {
		dom.create.category.addEventListener('change', () => {
			toggleOtherCategoryInput(dom.create.category, dom.create.categoryOtherWrap, dom.create.categoryOther);
		});
	}

    saveBtn.addEventListener('click', async () => {
        const titleInput = dom.create.title;
        const categoryInput = dom.create.category;
        const categoryOtherInput = dom.create.categoryOther;
        const contentInput = dom.create.content;
        const publishedInput = dom.create.published;
        const categoryValue = resolveCategoryValue(categoryInput, categoryOtherInput);

        if (!titleInput?.value || !categoryInput?.value || !contentInput?.value || !categoryValue) {
            showToast('Моля попълнете всички полета.', 'warning');
            return;
        }

        const newArticle = {
            title: titleInput.value,
            category: categoryValue,
            content: contentInput.value,
            is_published: publishedInput.checked,
            tags: [] // default empty tags
        };

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Запазване...';

            await createArticle(newArticle);

            showToast('Статията е създадена успешно!', 'success');

            closeModal('createArticleModal');

            // Clear form
            dom.create.form?.reset();
			toggleOtherCategoryInput(dom.create.category, dom.create.categoryOtherWrap, dom.create.categoryOther);
            await loadAdminArticles();

        } catch (error) {
            console.error('Error creating article:', error);
            showToast('Възникна грешка при създаването на статията: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Запази статията';
        }
    });
}

function initArticleEditing() {
    if (dom.refreshBtn) {
        dom.refreshBtn.addEventListener('click', () => {
            loadAdminArticles();
        });
    }

    if (dom.articlesBody) {
        dom.articlesBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const editButton = target.closest('button[data-action="edit-article"]');
            if (!editButton) return;

            const articleId = editButton.dataset.articleId;
            if (!articleId) return;

            try {
                editButton.disabled = true;
                const article = await getArticleById(articleId);
                if (!article) {
                    showToast('Статията не беше намерена.', 'warning');
                    return;
                }

                dom.edit.id.value = article.id;
                dom.edit.title.value = article.title || '';
                if (predefinedCategories.has(article.category)) {
                    dom.edit.category.value = article.category;
                    toggleOtherCategoryInput(dom.edit.category, dom.edit.categoryOtherWrap, dom.edit.categoryOther);
                } else {
                    dom.edit.category.value = 'other';
                    toggleOtherCategoryInput(dom.edit.category, dom.edit.categoryOtherWrap, dom.edit.categoryOther);
                    dom.edit.categoryOther.value = article.category || '';
                }
                dom.edit.content.value = article.content || '';
                dom.edit.published.checked = Boolean(article.is_published);

                openModal('editArticleModal');
            } catch (error) {
                console.error('Error opening article editor:', error);
                showToast('Неуспешно отваряне на статия за редакция.', 'error');
            } finally {
                editButton.disabled = false;
            }
        });
    }

    if (dom.updateBtn) {
		if (dom.edit.category) {
			dom.edit.category.addEventListener('change', () => {
				toggleOtherCategoryInput(dom.edit.category, dom.edit.categoryOtherWrap, dom.edit.categoryOther);
			});
		}

        dom.updateBtn.addEventListener('click', async () => {
            const articleId = dom.edit.id.value;
            const title = dom.edit.title.value.trim();
			const category = resolveCategoryValue(dom.edit.category, dom.edit.categoryOther);
            const content = dom.edit.content.value.trim();
            const isPublished = dom.edit.published.checked;

            if (!articleId || !title || !category || !content) {
                showToast('Моля попълнете всички задължителни полета.', 'warning');
                return;
            }

            try {
                dom.updateBtn.disabled = true;
                dom.updateBtn.textContent = 'Запазване...';

                await updateArticle(articleId, {
                    title,
                    category,
                    content,
                    is_published: isPublished,
                    tags: []
                });

                showToast('Статията е обновена успешно.', 'success');
                closeModal('editArticleModal');
                await loadAdminArticles();
            } catch (error) {
                console.error('Error updating article:', error);
                showToast('Неуспешно запазване на промените.', 'error');
            } finally {
                dom.updateBtn.disabled = false;
                dom.updateBtn.textContent = 'Запази промените';
            }
        });
    }
}

initAdminPage();
