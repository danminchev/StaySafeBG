import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getCurrentUser } from '../services/authService.js';
import { getUserRole } from '../services/rolesService.js';
import { deleteUserByAdmin, getAdminUsers, updateUserRole } from '../services/adminUsersService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';
import { createArticle, getAdminArticles, getArticleById, updateArticle, deleteArticle } from '../services/newsService.js';
import {
    deleteAdminReport,
    getAdminReports,
    getAdminReportById,
    getAdminReportStats,
    getEvidenceFileSignedUrl,
    updateAdminReport,
    updateReportStatus
} from '../services/reportsService.js';
import { showToast } from '../utils/notifications.js';

const state = {
    articles: [],
    reports: [],
    users: [],
    selectedReportId: null,
    currentUserId: null,
    currentUserRole: 'user'
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
    dashboardTitle: document.getElementById('dashboard-title'),
    usersSection: document.getElementById('admin-users-section'),
    usersStatCard: document.getElementById('admin-users-stat-card'),
    createSaveBtn: document.getElementById('btn-save-article'),
    updateBtn: document.getElementById('btn-update-article'),
    refreshBtn: document.getElementById('btn-refresh-articles'),
    reportsRefreshBtn: document.getElementById('btn-refresh-reports'),
    articlesBody: document.getElementById('admin-articles-body'),
    usersRefreshBtn: document.getElementById('btn-refresh-users'),
    usersBody: document.getElementById('admin-users-body'),
    reportsBody: document.getElementById('admin-reports-body'),
    stats: {
        pending: document.getElementById('admin-stat-pending'),
        approved: document.getElementById('admin-stat-approved'),
        users: document.getElementById('admin-stat-users')
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
    reportEdit: {
        id: document.getElementById('edit-report-id'),
        title: document.getElementById('edit-report-title'),
        type: document.getElementById('edit-report-type'),
        category: document.getElementById('edit-report-category'),
        url: document.getElementById('edit-report-url'),
        phone: document.getElementById('edit-report-phone'),
        iban: document.getElementById('edit-report-iban'),
        description: document.getElementById('edit-report-description'),
        status: document.getElementById('edit-report-status'),
        updateBtn: document.getElementById('btn-update-report')
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
    },
    view: {
        title: document.getElementById('view-article-title'),
        category: document.getElementById('view-article-category'),
        date: document.getElementById('view-article-date'),
        content: document.getElementById('view-article-content')
    },
    userView: {
        id: document.getElementById('view-user-id'),
        title: document.getElementById('viewUserModalLabel'),
        name: document.getElementById('view-user-name'),
        email: document.getElementById('view-user-email'),
        created: document.getElementById('view-user-created'),
        roleSection: document.getElementById('view-user-role-section'),
        roleSelect: document.getElementById('view-user-role-select'),
        saveRoleBtn: document.getElementById('btn-update-user-role')
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

function canManageUsers() {
    return state.currentUserRole === 'admin';
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

function formatDateTime(dateValue) {
    if (!dateValue) return 'Няма данни';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Няма данни';

    return new Intl.DateTimeFormat('bg-BG', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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

function getReportTypeName(report) {
    const scamType = report?.scam_type?.trim();
    if (scamType) {
        const normalizedType = scamType.toLowerCase();
        if (predefinedCategories.has(normalizedType) || normalizedType === 'other') {
            return getCategoryName(normalizedType);
        }

        return scamType;
    }

    return getCategoryName(report?.category);
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

function toNullIfEmpty(value) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
}

function renderUsersTable() {
    if (!dom.usersBody) return;

    dom.usersBody.textContent = '';

    if (state.users.length === 0) {
        dom.usersBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Няма потребители за показване.</td></tr>';
        return;
    }

    state.users.forEach((user) => {
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        nameCell.textContent = user.full_name || 'Без име';

        const emailCell = document.createElement('td');
        emailCell.textContent = user.email || 'Без имейл';

        const roleCell = document.createElement('td');
        const roleBadge = document.createElement('span');
        const normalizedRole = user.role || 'user';
        if (normalizedRole === 'admin') {
            roleBadge.className = 'badge bg-primary';
            roleBadge.textContent = 'Админ';
        } else if (normalizedRole === 'moderator') {
            roleBadge.className = 'badge bg-success';
            roleBadge.textContent = 'Модератор';
        } else {
            roleBadge.className = 'badge bg-secondary';
            roleBadge.textContent = 'Потребител';
        }
        roleCell.appendChild(roleBadge);

        const createdCell = document.createElement('td');
        createdCell.textContent = formatDate(user.created_at);

        const lastLoginCell = document.createElement('td');
        lastLoginCell.textContent = formatDateTime(user.last_sign_in_at);

        const actionsCell = document.createElement('td');
        actionsCell.className = 'text-end';
        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'd-inline-flex justify-content-end gap-2';
        
        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'btn btn-sm btn-outline-primary';
        viewBtn.dataset.action = 'view-user';
        viewBtn.dataset.userId = user.user_id;
        viewBtn.textContent = 'Преглед';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-sm btn-outline-success';
        editBtn.dataset.action = 'edit-user';
        editBtn.dataset.userId = user.user_id;
        editBtn.textContent = 'Редактирай';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-sm btn-outline-danger';
        deleteBtn.dataset.action = 'delete-user';
        deleteBtn.dataset.userId = user.user_id;
        deleteBtn.textContent = 'Изтрий';

        if (user.user_id === state.currentUserId) {
            deleteBtn.disabled = true;
            deleteBtn.title = 'Не може да изтриете собствения си акаунт';
        }
        
        actionsWrap.appendChild(viewBtn);
        actionsWrap.appendChild(editBtn);
        actionsWrap.appendChild(deleteBtn);
        actionsCell.appendChild(actionsWrap);

        row.appendChild(nameCell);
        row.appendChild(emailCell);
        row.appendChild(roleCell);
        row.appendChild(createdCell);
        row.appendChild(lastLoginCell);
        row.appendChild(actionsCell);

        dom.usersBody.appendChild(row);
    });
}

async function openUserModal(userId, mode = 'view') {
    if (!userId) return;
    const user = state.users.find(u => u.user_id === userId);
    if (!user) {
        showToast('Потребителят не е намерен.', 'error');
        return;
    }

    if (dom.userView.id) dom.userView.id.value = user.user_id;
    if (dom.userView.name) dom.userView.name.textContent = user.full_name || 'Няма име';
    if (dom.userView.email) dom.userView.email.textContent = user.email || 'Няма имейл';
    if (dom.userView.created) dom.userView.created.textContent = formatDate(user.created_at);
    
    // Set current role in dropdown
    if (dom.userView.roleSelect) {
        const currentRole = user.role || 'user';
        // Ensure options exist for non-standard roles or just default to user
        const options = Array.from(dom.userView.roleSelect.options).map(o => o.value);
        if (options.includes(currentRole)) {
            dom.userView.roleSelect.value = currentRole;
        } else {
            dom.userView.roleSelect.value = 'user';
        }
    }

    const isEditMode = mode === 'edit';
    if (dom.userView.title) {
        dom.userView.title.textContent = isEditMode ? 'Редакция на потребител' : 'Преглед на потребител';
    }
    if (dom.userView.roleSection) {
        dom.userView.roleSection.classList.toggle('d-none', !isEditMode);
    }
    if (dom.userView.roleSelect) {
        dom.userView.roleSelect.disabled = !isEditMode;
    }
    if (dom.userView.saveRoleBtn) {
        dom.userView.saveRoleBtn.classList.toggle('d-none', !isEditMode);
    }

    openModal('viewUserModal');
}

async function handleUpdateUserRole() {
    const userId = dom.userView.id?.value;
    const newRole = dom.userView.roleSelect?.value;
    const btn = dom.userView.saveRoleBtn;

    if (!userId || !newRole) return;

    // Safety check
    if (userId === state.currentUserId && newRole !== 'admin') {
         if(!confirm('Внимание! Опитвате се да премахнете собствените си админ права. Сигурни ли сте? Това ще ви изхвърли от панела.')) {
             return;
         }
    }

    const originalText = btn.textContent;
    try {
        btn.disabled = true;
        btn.textContent = 'Запазване...';

        await updateUserRole(userId, newRole);
        showToast(`Ролята е променена успешно на "${newRole}".`, 'success');
        closeModal('viewUserModal');
        await loadAdminUsers();
    } catch (error) {
        console.error('Failed to update role:', error);
        showToast('Грешка при обновяване на ролята: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function loadAdminUsers() {
    if (!dom.usersBody) return;

    dom.usersBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Зареждане...</td></tr>';

    try {
        const users = await getAdminUsers();
        state.users = users || [];
        if (dom.stats.users) {
            dom.stats.users.textContent = state.users.length.toLocaleString('bg-BG');
        }
        renderUsersTable();
    } catch (error) {
        console.error('Error loading users:', error);
        dom.usersBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Грешка при зареждане на потребители.</td></tr>';
        if (dom.stats.users) {
            dom.stats.users.textContent = '-';
        }
        showToast('Неуспешно зареждане на потребители.', 'error');
    }
}

async function deleteAdminUser(userId, button) {
    if (!userId) return;

    const user = state.users.find((currentUser) => currentUser.user_id === userId);
    const displayName = user?.full_name || user?.email || 'този потребител';
    const isConfirmed = window.confirm(`Сигурни ли сте, че искате да изтриете ${displayName}?`);
    if (!isConfirmed) return;

    const originalText = button?.textContent || 'Изтрий';

    try {
        if (button) {
            button.disabled = true;
            button.textContent = 'Изтриване...';
        }

        await deleteUserByAdmin(userId);
        showToast('Потребителят е изтрит успешно.', 'success');
        await loadAdminUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Неуспешно изтриване на потребителя.', 'error');
    } finally {
        if (button) {
            button.textContent = originalText;
        }
    }
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
        typeCell.textContent = getReportTypeName(report);

        const sourceCell = document.createElement('td');
        sourceCell.textContent = getReportSource(report);

        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `badge ${statusMeta.className}`;
        statusBadge.textContent = statusMeta.label;
        statusCell.appendChild(statusBadge);

        const actionsCell = document.createElement('td');
        actionsCell.className = 'text-end';
        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'd-inline-flex justify-content-end gap-2';

        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'btn btn-sm btn-outline-primary';
        viewBtn.dataset.action = 'review-report';
        viewBtn.dataset.reportId = report.id;
        viewBtn.textContent = 'Преглед';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-sm btn-outline-success';
        editBtn.dataset.action = 'edit-report';
        editBtn.dataset.reportId = report.id;
        editBtn.textContent = 'Редактирай';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-sm btn-outline-danger';
        deleteBtn.dataset.action = 'delete-report';
        deleteBtn.dataset.reportId = report.id;
        deleteBtn.textContent = 'Изтрий';

        actionsWrap.appendChild(viewBtn);
        actionsWrap.appendChild(editBtn);
        actionsWrap.appendChild(deleteBtn);
        actionsCell.appendChild(actionsWrap);

        row.appendChild(indexCell);
        row.appendChild(dateCell);
        row.appendChild(typeCell);
        row.appendChild(sourceCell);
        row.appendChild(statusCell);
        row.appendChild(actionsCell);

        dom.reportsBody.appendChild(row);
    });
}

async function openReportEdit(reportId) {
    if (!reportId) return;

    try {
        const report = await getAdminReportById(reportId);
        dom.reportEdit.id.value = report.id;
        dom.reportEdit.title.value = report.title || '';
        dom.reportEdit.type.value = report.scam_type || '';
        dom.reportEdit.category.value = predefinedCategories.has(report.category) || report.category === 'other'
            ? report.category
            : 'other';
        dom.reportEdit.url.value = report.url || '';
        dom.reportEdit.phone.value = report.phone || '';
        dom.reportEdit.iban.value = report.iban || '';
        dom.reportEdit.description.value = report.description || '';
        dom.reportEdit.status.value = report.status || 'pending';
        openModal('editReportModal');
    } catch (error) {
        console.error('Error opening report editor:', error);
        showToast('Неуспешно отваряне на доклада за редакция.', 'error');
    }
}

async function saveEditedReport() {
    const reportId = dom.reportEdit.id?.value;
    if (!reportId) {
        showToast('Липсва избран доклад за редакция.', 'warning');
        return;
    }

    const title = dom.reportEdit.title.value.trim();
    const category = dom.reportEdit.category.value;
    const description = dom.reportEdit.description.value.trim();
    const status = dom.reportEdit.status.value;

    if (!title || !category || !description || !status) {
        showToast('Моля попълнете задължителните полета.', 'warning');
        return;
    }

    const button = dom.reportEdit.updateBtn;
    const originalText = button?.textContent || 'Запази промените';

    try {
        if (button) {
            button.disabled = true;
            button.textContent = 'Запазване...';
        }

        await updateAdminReport(reportId, {
            title,
            category,
            description,
            scam_type: toNullIfEmpty(dom.reportEdit.type.value),
            url: toNullIfEmpty(dom.reportEdit.url.value),
            phone: toNullIfEmpty(dom.reportEdit.phone.value),
            iban: toNullIfEmpty(dom.reportEdit.iban.value),
            status
        });

        closeModal('editReportModal');
        showToast('Докладът е редактиран успешно.', 'success');

        await Promise.all([
            loadAdminReports(),
            loadAdminReportStats()
        ]);
    } catch (error) {
        console.error('Error updating report:', error);
        showToast('Неуспешно запазване на доклада.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

async function deleteSelectedReport(reportId, button) {
    if (!reportId) return;

    const isConfirmed = window.confirm('Сигурни ли сте, че искате да изтриете този доклад?');
    if (!isConfirmed) return;

    const originalText = button?.textContent || 'Изтрий';

    try {
        if (button) {
            button.disabled = true;
            button.textContent = 'Изтриване...';
        }

        await deleteAdminReport(reportId);
        showToast('Докладът е изтрит успешно.', 'success');

        await Promise.all([
            loadAdminReports(),
            loadAdminReportStats()
        ]);
    } catch (error) {
        console.error('Error deleting report:', error);
        showToast('Неуспешно изтриване на доклада.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
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
        dom.reportReview.type.textContent = getReportTypeName(report) || 'Не е посочен';
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
        cell.textContent = 'Няма налични новини.';
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
        actionsCell.className = 'text-end';
        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'd-inline-flex justify-content-end gap-2';

        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'btn btn-sm btn-outline-primary';
        viewBtn.dataset.action = 'view-article';
        viewBtn.dataset.articleId = article.id;
        viewBtn.textContent = 'Преглед';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-sm btn-outline-success';
        editBtn.dataset.action = 'edit-article';
        editBtn.dataset.articleId = article.id;
        editBtn.textContent = 'Редактирай';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-sm btn-outline-danger';
        deleteBtn.dataset.action = 'delete-article';
        deleteBtn.dataset.articleId = article.id;
        deleteBtn.textContent = 'Изтрий';

        actionsWrap.appendChild(viewBtn);
        actionsWrap.appendChild(editBtn);
        actionsWrap.appendChild(deleteBtn);
        actionsCell.appendChild(actionsWrap);

        row.appendChild(titleCell);
        row.appendChild(categoryCell);
        row.appendChild(statusCell);
        row.appendChild(dateCell);
        row.appendChild(actionsCell);

        dom.articlesBody.appendChild(row);
    });
}

async function openViewArticleModal(articleId) {
    if (!articleId || !dom.view.title) return;

    try {
        const article = await getArticleById(articleId);
        if (!article) {
            showToast('Новината не е намерена.', 'warning');
            return;
        }

        dom.view.title.textContent = article.title || 'Без заглавие';
        
        if (dom.view.category) {
            dom.view.category.textContent = getCategoryName(article.category);
            dom.view.category.className = 'badge bg-primary'; 
        }

        if (dom.view.date) {
            dom.view.date.textContent = formatDate(article.created_at);
        }

        if (dom.view.content) {
             // Handle simple text formatting
            const safeContent = article.content 
                ? article.content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>')
                : 'Няма съдържание.';
            dom.view.content.innerHTML = safeContent;
        }

        openModal('viewArticleModal');
    } catch (error) {
        console.error('Error opening article details:', error);
        showToast('Неуспешно зареждане на детайли за новината.', 'error');
    }
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
        dom.articlesBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Грешка при зареждане на новини.</td></tr>';
        showToast('Неуспешно зареждане на новини.', 'error');
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
        if (role !== 'admin' && role !== 'moderator') {
			// Redirect immediately if not admin
			window.location.replace('index.html');
			return;
		}

        state.currentUserId = user.id;
        state.currentUserRole = role;

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

    if (dom.dashboardTitle) {
        dom.dashboardTitle.textContent = state.currentUserRole === 'moderator' ? 'Модератор Панел' : 'Админ Панел';
    }

    if (!canManageUsers()) {
        if (dom.usersSection) {
            dom.usersSection.style.display = 'none';
        }
        if (dom.usersStatCard) {
            dom.usersStatCard.style.display = 'none';
        }
    }
    
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

    if (canManageUsers()) {
        initUserManagement();
        loadAdminUsers();
    }
}

function initUserManagement() {
    if (dom.usersRefreshBtn) {
        dom.usersRefreshBtn.addEventListener('click', () => {
            loadAdminUsers();
        });
    }

    if (dom.userView.saveRoleBtn) {
        dom.userView.saveRoleBtn.addEventListener('click', () => {
            handleUpdateUserRole();
        });
    }

    if (dom.usersBody) {
        dom.usersBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const btn = target.closest('button[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const userId = btn.dataset.userId;

            if (action === 'delete-user') {
                 await deleteAdminUser(userId, btn);
                 return;
            }

            if (action === 'view-user') {
                await openUserModal(userId, 'view');
                return;
            }

            if (action === 'edit-user') {
                await openUserModal(userId, 'edit');
                return;
            }
        });
    }
}

function initReportReviewing() {
    if (dom.reportsRefreshBtn) {
        dom.reportsRefreshBtn.addEventListener('click', () => {
            loadAdminReports();
            loadAdminReportStats();
        });
    }

    if (dom.reportsBody) {
        dom.reportsBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const reportButton = target.closest('button[data-action]');
            if (!reportButton) return;

            const action = reportButton.dataset.action;
            if (!action) return;

            const reportId = reportButton.dataset.reportId;
            if (!reportId) return;

            try {
                reportButton.disabled = true;

                if (action === 'review-report') {
                    await openReportReview(reportId);
                    return;
                }

                if (action === 'edit-report') {
                    await openReportEdit(reportId);
                    return;
                }

                if (action === 'delete-report') {
                    await deleteSelectedReport(reportId, reportButton);
                }
            } finally {
                reportButton.disabled = false;
            }
        });
    }

    if (dom.reportReview.approveBtn) {
        dom.reportReview.approveBtn.addEventListener('click', () => changeSelectedReportStatus('approved'));
    }

    if (dom.reportReview.rejectBtn) {
        dom.reportReview.rejectBtn.addEventListener('click', () => changeSelectedReportStatus('rejected'));
    }

    if (dom.reportEdit.updateBtn) {
        dom.reportEdit.updateBtn.addEventListener('click', () => {
            saveEditedReport();
        });
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

            showToast('Новината е създадена успешно!', 'success');

            closeModal('createArticleModal');

            // Clear form
            dom.create.form?.reset();
			toggleOtherCategoryInput(dom.create.category, dom.create.categoryOtherWrap, dom.create.categoryOther);
            await loadAdminArticles();

        } catch (error) {
            console.error('Error creating article:', error);
            showToast('Възникна грешка при създаването на новината: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Запази новината';
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

            const button = target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const articleId = button.dataset.articleId;

            if (!action || !articleId) return;

            if (action === 'view-article') {
                // Modified: Open in modal instead of new tab
                // window.open(`news-details.html?id=${articleId}`, '_blank');
                try {
                    button.disabled = true;
                    await openViewArticleModal(articleId);
                } finally {
                    button.disabled = false;
                }
                return;
            }

            if (action === 'delete-article') {
                if (confirm('Сигурни ли сте, че искате да изтриете тази новина?')) {
                    const originalText = button.textContent;
                    try {
                        button.disabled = true;
                        button.textContent = 'Изтриване...';
                        await deleteArticle(articleId);
                        showToast('Новината е изтрита успешно.', 'success');
                        await loadAdminArticles();
                    } catch (error) {
                        console.error('Error deleting article:', error);
                        showToast('Неуспешно изтриване на новина.', 'error');
                    } finally {
                        button.disabled = false;
                        button.textContent = originalText;
                    }
                }
                return;
            }

            if (action === 'edit-article') {
                try {
                    button.disabled = true;
                    const article = await getArticleById(articleId);
                    if (!article) {
                        showToast('Новината не беше намерена.', 'warning');
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
                    showToast('Неуспешно отваряне на новина за редакция.', 'error');
                } finally {
                    button.disabled = false;
                }
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

                showToast('Новината е обновена успешно.', 'success');
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
