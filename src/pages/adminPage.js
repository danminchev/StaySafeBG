import { renderHeader } from '../components/header.js';
import { renderFooter } from '../components/footer.js';
import { getCurrentUser } from '../services/authService.js';
import { getUserRole } from '../services/rolesService.js';
import { deleteUserByAdmin, getAdminUsers, updateUserRole } from '../services/adminUsersService.js';
import { hasSupabaseConfig } from '../services/supabaseClient.js';
import { createArticle, getAdminArticles, getArticleById, updateArticle, deleteArticle } from '../services/tipsService.js';
import {
    deleteAdminReport,
    getAdminReports,
    getAdminReportById,
    getAdminReportStats,
    getEvidenceFileSignedUrl,
    updateAdminReport,
    updateReportStatus
} from '../services/reportsService.js';
import {
    createTrustedPhishingDomain,
    deleteTrustedPhishingDomain,
    getTrustedPhishingDomains,
    updateTrustedPhishingDomain
} from '../services/trustedDomainsService.js';
import {
    createMaliciousResource,
    deleteMaliciousResource,
    getMaliciousResources,
    updateMaliciousResource
} from '../services/maliciousResourcesService.js';
import { showToast } from '../utils/notifications.js';

const state = {
    articles: [],
    articlesFilter: {
        search: '',
        status: 'all',
        category: 'all'
    },
    reports: [],
    reportsFilter: {
        search: '',
        status: 'all'
    },
    maliciousResources: [],
    maliciousResourcesFilter: {
        search: '',
        type: 'all',
        status: 'all'
    },
    phishingDomains: [],
    phishingDomainsFilter: {
        search: '',
        status: 'all',
        risk: 'all'
    },
    users: [],
    usersFilter: {
        search: '',
        role: 'all'
    },
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
    reportFilters: {
        searchInput: document.getElementById('admin-reports-search-input'),
        statusSelect: document.getElementById('admin-reports-status-filter'),
        clearBtn: document.getElementById('btn-clear-report-filters')
    },
    articlesBody: document.getElementById('admin-articles-body'),
    articleFilters: {
        searchInput: document.getElementById('admin-articles-search-input'),
        statusSelect: document.getElementById('admin-articles-status-filter'),
        categorySelect: document.getElementById('admin-articles-category-filter'),
        clearBtn: document.getElementById('btn-clear-article-filters')
    },
    usersRefreshBtn: document.getElementById('btn-refresh-users'),
    usersBody: document.getElementById('admin-users-body'),
    usersFilters: {
        searchInput: document.getElementById('admin-users-search-input'),
        roleSelect: document.getElementById('admin-users-role-filter'),
        clearBtn: document.getElementById('btn-clear-user-filters')
    },
    reportsBody: document.getElementById('admin-reports-body'),
    phishingDomainsRefreshBtn: document.getElementById('btn-refresh-phishing-domains'),
    phishingDomainsBody: document.getElementById('admin-phishing-domains-body'),
    maliciousResourcesRefreshBtn: document.getElementById('btn-refresh-malicious-resources'),
    maliciousResourcesBody: document.getElementById('admin-malicious-resources-body'),
    maliciousResourceForm: document.getElementById('add-malicious-resource-form'),
    maliciousResourceFields: {
        value: document.getElementById('malicious-resource-value-input'),
        type: document.getElementById('malicious-resource-type-input'),
        source: document.getElementById('malicious-resource-source-input'),
        confidence: document.getElementById('malicious-resource-confidence-input'),
        risk: document.getElementById('malicious-resource-risk-input'),
        status: document.getElementById('malicious-resource-status-input'),
        threatName: document.getElementById('malicious-resource-threat-name-input'),
        notes: document.getElementById('malicious-resource-notes-input'),
        submit: document.getElementById('btn-add-malicious-resource')
    },
    maliciousResourceFilters: {
        searchInput: document.getElementById('malicious-resource-search-input'),
        typeSelect: document.getElementById('malicious-resource-type-filter'),
        statusSelect: document.getElementById('malicious-resource-status-filter'),
        clearBtn: document.getElementById('btn-clear-malicious-resource-filters')
    },
    phishingDomainForm: document.getElementById('add-phishing-domain-form'),
    phishingDomainFields: {
        domain: document.getElementById('phishing-domain-input'),
        source: document.getElementById('phishing-domain-source-input'),
        confidence: document.getElementById('phishing-domain-confidence-input'),
        notes: document.getElementById('phishing-domain-notes-input'),
        submit: document.getElementById('btn-add-phishing-domain')
    },
    phishingDomainFilters: {
        searchInput: document.getElementById('phishing-domain-search-input'),
        statusSelect: document.getElementById('phishing-domain-status-filter'),
        riskSelect: document.getElementById('phishing-domain-risk-filter'),
        clearBtn: document.getElementById('btn-clear-phishing-domain-filters')
    },
    phishingDomainEdit: {
        form: document.getElementById('edit-phishing-domain-form'),
        id: document.getElementById('edit-phishing-domain-id'),
        domain: document.getElementById('edit-phishing-domain-name'),
        source: document.getElementById('edit-phishing-domain-source'),
        confidence: document.getElementById('edit-phishing-domain-confidence'),
        risk: document.getElementById('edit-phishing-domain-risk'),
        status: document.getElementById('edit-phishing-domain-status'),
        notes: document.getElementById('edit-phishing-domain-notes'),
        updateBtn: document.getElementById('btn-update-phishing-domain')
    },
    maliciousResourceEdit: {
        id: document.getElementById('edit-malicious-resource-id'),
        value: document.getElementById('edit-malicious-resource-value'),
        type: document.getElementById('edit-malicious-resource-type'),
        source: document.getElementById('edit-malicious-resource-source'),
        confidence: document.getElementById('edit-malicious-resource-confidence'),
        risk: document.getElementById('edit-malicious-resource-risk'),
        status: document.getElementById('edit-malicious-resource-status'),
        threatName: document.getElementById('edit-malicious-resource-threat-name'),
        isActive: document.getElementById('edit-malicious-resource-active'),
        notes: document.getElementById('edit-malicious-resource-notes'),
        updateBtn: document.getElementById('btn-update-malicious-resource')
    },
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
        pendingBtn: document.getElementById('btn-pending-report'),
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

    const search = state.usersFilter.search.trim().toLowerCase();
    const roleFilter = state.usersFilter.role;
    const filteredUsers = state.users.filter((user) => {
        const normalizedRole = String(user.role || 'user').toLowerCase();
        const roleMatch = roleFilter === 'all' || normalizedRole === roleFilter;
        if (!roleMatch) return false;
        if (!search) return true;

        const haystack = `${user.full_name || ''} ${user.email || ''} ${normalizedRole}`.toLowerCase();
        return haystack.includes(search);
    });

    if (filteredUsers.length === 0) {
        dom.usersBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Няма потребители по зададените филтри.</td></tr>';
        return;
    }

    filteredUsers.forEach((user) => {
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

    const search = state.reportsFilter.search.trim().toLowerCase();
    const statusFilter = state.reportsFilter.status;
    const filteredReports = state.reports.filter((report) => {
        const normalizedStatus = String(report.status || '').toLowerCase();
        if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;

        if (!search) return true;

        const typeName = getReportTypeName(report);
        const source = getReportSource(report);
        const category = getCategoryName(report.category);
        const haystack = `${report.title || ''} ${typeName || ''} ${source || ''} ${category || ''} ${normalizedStatus}`.toLowerCase();
        return haystack.includes(search);
    });

    if (filteredReports.length === 0) {
        dom.reportsBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Няма доклади по зададените филтри.</td></tr>';
        return;
    }

    filteredReports.forEach((report, index) => {
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
    if (dom.reportReview.pendingBtn) dom.reportReview.pendingBtn.disabled = true;
    if (dom.reportReview.approveBtn) dom.reportReview.approveBtn.disabled = true;
    if (dom.reportReview.rejectBtn) dom.reportReview.rejectBtn.disabled = true;
}

function setReviewStatusActionState(currentStatus) {
    if (dom.reportReview.pendingBtn) {
        dom.reportReview.pendingBtn.disabled = currentStatus === 'pending';
    }

    if (dom.reportReview.approveBtn) {
        dom.reportReview.approveBtn.disabled = currentStatus === 'approved';
    }

    if (dom.reportReview.rejectBtn) {
        dom.reportReview.rejectBtn.disabled = currentStatus === 'rejected';
    }
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

        setReviewStatusActionState(report.status);
    } catch (error) {
        console.error('Error loading report details:', error);
        setReportReviewLoadingState('Грешка при зареждане');
        dom.reportReview.files.textContent = 'Неуспешно зареждане на файлове.';
        showToast('Неуспешно зареждане на доклада.', 'error');
    }
}

async function changeSelectedReportStatus(status) {
    const reportId = state.selectedReportId || dom.reportReview.id?.value;
    if (!reportId) return;

    const statusButtons = {
        pending: dom.reportReview.pendingBtn,
        approved: dom.reportReview.approveBtn,
        rejected: dom.reportReview.rejectBtn
    };

    const button = statusButtons[status];
    if (!button) return;

    const allButtons = Object.values(statusButtons).filter(Boolean);
    const originalText = button.textContent;

    try {
        allButtons.forEach((currentButton) => {
            currentButton.disabled = true;
        });
        button.textContent = 'Запазване...';

        await updateReportStatus(reportId, status);

        const successMessageMap = {
            pending: 'Докладът е маркиран като чакащ.',
            approved: 'Докладът е маркиран като потвърден.',
            rejected: 'Докладът е маркиран като отхвърлен.'
        };

        showToast(successMessageMap[status] || 'Статусът е променен успешно.', 'success');

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

function getPhishingRiskLevel(item) {
    const direct = String(item?.risk_level || '').trim().toLowerCase();
    if (direct === 'low' || direct === 'medium' || direct === 'high') {
        return direct;
    }

    const confidence = Number(item?.confidence);
    if (!Number.isFinite(confidence)) return 'medium';
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
}

function getPhishingRiskMeta(riskLevel) {
    const normalized = String(riskLevel || '').trim().toLowerCase();
    if (normalized === 'low') {
        return { value: 'low', label: 'Нисък риск', className: 'bg-success' };
    }
    if (normalized === 'high') {
        return { value: 'high', label: 'Висок риск', className: 'bg-danger' };
    }
    return { value: 'medium', label: 'Среден риск', className: 'bg-warning text-dark' };
}

function findPhishingDomainById(id) {
    return state.phishingDomains.find((item) => String(item.id) === String(id));
}

function getMaliciousRiskMeta(riskLevel) {
    return getPhishingRiskMeta(riskLevel);
}

function getMaliciousStatusMeta(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'online') return { value: 'online', label: 'Онлайн', className: 'bg-danger' };
    if (normalized === 'offline') return { value: 'offline', label: 'Офлайн', className: 'bg-secondary' };
    return { value: 'unknown', label: 'Неизвестен', className: 'bg-warning text-dark' };
}

function getMaliciousTypeLabel(type) {
    const normalized = String(type || '').trim().toLowerCase();
    const map = {
        url: 'URL',
        domain: 'Домейн',
        ip: 'IP',
        hash: 'Hash',
        file: 'Файл',
        other: 'Друго'
    };
    return map[normalized] || 'Друго';
}

function findMaliciousResourceById(id) {
    return state.maliciousResources.find((item) => String(item.id) === String(id));
}

async function openEditPhishingDomainModal(domainId) {
    const item = findPhishingDomainById(domainId);
    if (!item) {
        showToast('Домейнът не е намерен.', 'warning');
        return;
    }

    if (dom.phishingDomainEdit.id) dom.phishingDomainEdit.id.value = item.id || '';
    if (dom.phishingDomainEdit.domain) dom.phishingDomainEdit.domain.value = item.domain || '';
    if (dom.phishingDomainEdit.source) dom.phishingDomainEdit.source.value = item.source || 'manual';
    if (dom.phishingDomainEdit.confidence) {
        dom.phishingDomainEdit.confidence.value = Number(item.confidence || 0).toFixed(2);
    }
    if (dom.phishingDomainEdit.risk) {
        dom.phishingDomainEdit.risk.value = getPhishingRiskMeta(getPhishingRiskLevel(item)).value;
    }
    if (dom.phishingDomainEdit.status) {
        dom.phishingDomainEdit.status.value = item.is_active ? 'active' : 'inactive';
    }
    if (dom.phishingDomainEdit.notes) {
        dom.phishingDomainEdit.notes.value = item.notes || '';
    }

    openModal('editPhishingDomainModal');
}

async function saveEditedPhishingDomain() {
    const id = dom.phishingDomainEdit.id?.value;
    if (!id) {
        showToast('Липсва идентификатор на домейн.', 'error');
        return;
    }

    const source = dom.phishingDomainEdit.source?.value?.trim() || 'manual';
    const confidence = Number(dom.phishingDomainEdit.confidence?.value);
    const riskLevel = dom.phishingDomainEdit.risk?.value || 'medium';
    const status = dom.phishingDomainEdit.status?.value || 'active';
    const notes = dom.phishingDomainEdit.notes?.value?.trim() || '';

    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        showToast('Доверието трябва да е число между 0 и 1.', 'warning');
        return;
    }

    const button = dom.phishingDomainEdit.updateBtn;
    const original = button?.textContent || '';

    try {
        if (button) {
            button.disabled = true;
            button.textContent = 'Запазване...';
        }

        await updateTrustedPhishingDomain(id, {
            source,
            confidence,
            risk_level: riskLevel,
            is_active: status === 'active',
            notes
        });

        closeModal('editPhishingDomainModal');
        showToast('Промените по домейна са запазени.', 'success');
        await loadPhishingDomains();
    } catch (error) {
        console.error('Error saving phishing domain:', error);
        showToast('Неуспешно записване на домейна.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = original;
        }
    }
}

function renderArticlesTable() {
    if (!dom.articlesBody) return;

    dom.articlesBody.textContent = '';

    if (state.articles.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.className = 'text-center text-muted py-4';
        cell.textContent = 'Няма налични съвети.';
        row.appendChild(cell);
        dom.articlesBody.appendChild(row);
        return;
    }

    const search = state.articlesFilter.search.trim().toLowerCase();
    const statusFilter = state.articlesFilter.status;
    const categoryFilter = state.articlesFilter.category;
    const filteredArticles = state.articles.filter((article) => {
        const category = String(article.category || '').toLowerCase();
        const statusValue = article.is_published ? 'published' : 'draft';

        if (statusFilter !== 'all' && statusFilter !== statusValue) return false;
        if (categoryFilter !== 'all' && categoryFilter !== category) return false;

        if (!search) return true;
        const localizedCategory = getCategoryName(article.category).toLowerCase();
        const haystack = `${article.title || ''} ${category} ${localizedCategory}`.toLowerCase();
        return haystack.includes(search);
    });

    if (filteredArticles.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.className = 'text-center text-muted py-4';
        cell.textContent = 'Няма съвети по зададените филтри.';
        row.appendChild(cell);
        dom.articlesBody.appendChild(row);
        return;
    }

    filteredArticles.forEach((article) => {
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
            showToast('Съветът не е намерен.', 'warning');
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
        showToast('Неуспешно зареждане на детайли за съвета.', 'error');
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
        dom.articlesBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Грешка при зареждане на съвети.</td></tr>';
        showToast('Неуспешно зареждане на съвети.', 'error');
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
    initPhishingDomainsManagement();
    initMaliciousResourcesManagement();
	loadAdminReports();
	loadAdminReportStats();
	loadAdminArticles();
    loadPhishingDomains();
    loadMaliciousResources();

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

    if (dom.usersFilters.searchInput) {
        dom.usersFilters.searchInput.addEventListener('input', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            state.usersFilter.search = target.value || '';
            renderUsersTable();
        });
    }

    if (dom.usersFilters.roleSelect) {
        dom.usersFilters.roleSelect.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) return;
            state.usersFilter.role = target.value || 'all';
            renderUsersTable();
        });
    }

    if (dom.usersFilters.clearBtn) {
        dom.usersFilters.clearBtn.addEventListener('click', () => {
            state.usersFilter.search = '';
            state.usersFilter.role = 'all';

            if (dom.usersFilters.searchInput) dom.usersFilters.searchInput.value = '';
            if (dom.usersFilters.roleSelect) dom.usersFilters.roleSelect.value = 'all';

            renderUsersTable();
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

    if (dom.reportFilters.searchInput) {
        dom.reportFilters.searchInput.addEventListener('input', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            state.reportsFilter.search = target.value || '';
            renderReportsTable();
        });
    }

    if (dom.reportFilters.statusSelect) {
        dom.reportFilters.statusSelect.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) return;
            state.reportsFilter.status = target.value || 'all';
            renderReportsTable();
        });
    }

    if (dom.reportFilters.clearBtn) {
        dom.reportFilters.clearBtn.addEventListener('click', () => {
            state.reportsFilter.search = '';
            state.reportsFilter.status = 'all';

            if (dom.reportFilters.searchInput) dom.reportFilters.searchInput.value = '';
            if (dom.reportFilters.statusSelect) dom.reportFilters.statusSelect.value = 'all';

            renderReportsTable();
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

    if (dom.reportReview.pendingBtn) {
        dom.reportReview.pendingBtn.addEventListener('click', () => changeSelectedReportStatus('pending'));
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

function renderPhishingDomainsTable() {
    if (!dom.phishingDomainsBody) return;

    dom.phishingDomainsBody.textContent = '';

    const search = state.phishingDomainsFilter.search.trim().toLowerCase();
    const status = state.phishingDomainsFilter.status;
    const risk = state.phishingDomainsFilter.risk;
    const filtered = state.phishingDomains.filter((item) => {
        const isActive = Boolean(item.is_active);
        const riskLevel = getPhishingRiskLevel(item);
        const statusMatch = status === 'all'
            || (status === 'active' && isActive)
            || (status === 'inactive' && !isActive);
        const riskMatch = risk === 'all' || risk === riskLevel;

        if (!statusMatch) return false;
        if (!riskMatch) return false;
        if (!search) return true;

        const haystack = `${item.domain || ''} ${item.source || ''} ${item.notes || ''}`.toLowerCase();
        return haystack.includes(search);
    });

    if (!filtered.length) {
        dom.phishingDomainsBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Няма добавени домейни.</td></tr>';
        return;
    }

    filtered.forEach((item) => {
        const row = document.createElement('tr');
        const riskMeta = getPhishingRiskMeta(getPhishingRiskLevel(item));
        const statusBadge = item.is_active
            ? '<span class="badge bg-success">Active</span>'
            : '<span class="badge bg-secondary">Inactive</span>';

        row.innerHTML = `
            <td class="fw-semibold">${item.domain || '-'}</td>
            <td>${item.source || '-'}</td>
            <td>${Number(item.confidence || 0).toFixed(2)}</td>
            <td><span class="badge ${riskMeta.className}">${riskMeta.label}</span></td>
            <td>${statusBadge}</td>
            <td>${formatDateTime(item.updated_at || item.last_seen_at || item.created_at)}</td>
            <td class="text-end">
                <div class="d-inline-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit-domain" data-domain-id="${item.id}">
                        Редактирай
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-${item.is_active ? 'warning' : 'success'}" data-action="${item.is_active ? 'deactivate-domain' : 'activate-domain'}" data-domain-id="${item.id}">
                        ${item.is_active ? 'Деактивирай' : 'Активирай'}
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-domain" data-domain-id="${item.id}">
                        Изтрий
                    </button>
                </div>
            </td>
        `;

        dom.phishingDomainsBody.appendChild(row);
    });
}

async function loadPhishingDomains() {
    if (!dom.phishingDomainsBody) return;
    dom.phishingDomainsBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Зареждане...</td></tr>';

    try {
        state.phishingDomains = await getTrustedPhishingDomains();
        renderPhishingDomainsTable();
    } catch (error) {
        console.error('Error loading phishing domains:', error);
        dom.phishingDomainsBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Грешка при зареждане на домейни.</td></tr>';
        showToast('Неуспешно зареждане на phishing домейни.', 'error');
    }
}

async function handleCreatePhishingDomain(event) {
    event.preventDefault();

    const domain = dom.phishingDomainFields.domain?.value?.trim();
    if (!domain) {
        showToast('Въведете домейн.', 'warning');
        return;
    }

    const source = dom.phishingDomainFields.source?.value?.trim() || 'manual';
    const confidence = Number(dom.phishingDomainFields.confidence?.value || 0.95);
    const notes = dom.phishingDomainFields.notes?.value?.trim() || '';

    const submitBtn = dom.phishingDomainFields.submit;
    const original = submitBtn?.textContent || '';

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Запазване...';
        }

        await createTrustedPhishingDomain({ domain, source, confidence, notes });
        showToast('Домейнът е добавен успешно.', 'success');
        dom.phishingDomainForm?.reset();
        if (dom.phishingDomainFields.source) dom.phishingDomainFields.source.value = 'manual';
        if (dom.phishingDomainFields.confidence) dom.phishingDomainFields.confidence.value = '0.95';
        await loadPhishingDomains();
    } catch (error) {
        console.error('Error creating phishing domain:', error);
        showToast('Неуспешно добавяне на домейн.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
    }
}

async function handlePhishingDomainAction(action, id, button) {
    if (!id) return;
    const original = button?.textContent || '';

    try {
        if (button) {
            button.disabled = true;
            button.textContent = '...';
        }

        if (action === 'edit-domain') {
            await openEditPhishingDomainModal(id);
            return;
        }

        if (action === 'activate-domain') {
            await updateTrustedPhishingDomain(id, { is_active: true });
            showToast('Домейнът е активиран.', 'success');
        } else if (action === 'deactivate-domain') {
            await updateTrustedPhishingDomain(id, { is_active: false });
            showToast('Домейнът е деактивиран.', 'success');
        } else if (action === 'delete-domain') {
            const ok = window.confirm('Сигурни ли сте, че искате да изтриете този домейн?');
            if (!ok) return;
            await deleteTrustedPhishingDomain(id);
            showToast('Домейнът е изтрит.', 'success');
        }

        await loadPhishingDomains();
    } catch (error) {
        console.error('Error updating phishing domain:', error);
        showToast('Неуспешна операция върху домейн.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = original;
        }
    }
}

function initPhishingDomainsManagement() {
    if (dom.phishingDomainsRefreshBtn) {
        dom.phishingDomainsRefreshBtn.addEventListener('click', () => {
            loadPhishingDomains();
        });
    }

    if (dom.phishingDomainForm) {
        dom.phishingDomainForm.addEventListener('submit', handleCreatePhishingDomain);
    }

    if (dom.phishingDomainEdit.updateBtn) {
        dom.phishingDomainEdit.updateBtn.addEventListener('click', () => {
            saveEditedPhishingDomain();
        });
    }

    if (dom.phishingDomainFilters.searchInput) {
        dom.phishingDomainFilters.searchInput.addEventListener('input', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            state.phishingDomainsFilter.search = target.value || '';
            renderPhishingDomainsTable();
        });
    }

    if (dom.phishingDomainFilters.statusSelect) {
        dom.phishingDomainFilters.statusSelect.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) return;
            state.phishingDomainsFilter.status = target.value || 'all';
            renderPhishingDomainsTable();
        });
    }

    if (dom.phishingDomainFilters.riskSelect) {
        dom.phishingDomainFilters.riskSelect.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) return;
            state.phishingDomainsFilter.risk = target.value || 'all';
            renderPhishingDomainsTable();
        });
    }

    if (dom.phishingDomainFilters.clearBtn) {
        dom.phishingDomainFilters.clearBtn.addEventListener('click', () => {
            state.phishingDomainsFilter.status = 'all';
            state.phishingDomainsFilter.risk = 'all';

            if (dom.phishingDomainFilters.statusSelect) dom.phishingDomainFilters.statusSelect.value = 'all';
            if (dom.phishingDomainFilters.riskSelect) dom.phishingDomainFilters.riskSelect.value = 'all';

            renderPhishingDomainsTable();
        });
    }

    if (dom.phishingDomainsBody) {
        dom.phishingDomainsBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const btn = target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = btn.dataset.domainId;
            await handlePhishingDomainAction(action, id, btn);
        });
    }
}

function renderMaliciousResourcesTable() {
    if (!dom.maliciousResourcesBody) return;

    dom.maliciousResourcesBody.textContent = '';

    const search = state.maliciousResourcesFilter.search.trim().toLowerCase();
    const type = state.maliciousResourcesFilter.type;
    const status = state.maliciousResourcesFilter.status;

    const filtered = state.maliciousResources.filter((item) => {
        const itemType = String(item.resource_type || '').toLowerCase();
        const itemStatus = String(item.status || '').toLowerCase();
        if (type !== 'all' && itemType !== type) return false;
        if (status !== 'all' && itemStatus !== status) return false;
        if (!search) return true;

        const haystack = `${item.resource_value || ''} ${item.threat_name || ''} ${item.source || ''} ${item.notes || ''}`.toLowerCase();
        return haystack.includes(search);
    });

    if (!filtered.length) {
        dom.maliciousResourcesBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Няма добавени зловредни ресурси.</td></tr>';
        return;
    }

    filtered.forEach((item) => {
        const row = document.createElement('tr');
        const riskMeta = getMaliciousRiskMeta(item.risk_level);
        const statusMeta = getMaliciousStatusMeta(item.status);
        const activeBadge = item.is_active
            ? '<span class="badge bg-success">Активен</span>'
            : '<span class="badge bg-secondary">Скрит</span>';

        row.innerHTML = `
            <td>
                <div class="fw-semibold">${item.resource_value || '-'}</div>
                <div class="small text-muted">${item.threat_name || '-'}</div>
            </td>
            <td>${getMaliciousTypeLabel(item.resource_type)}</td>
            <td><span class="badge ${riskMeta.className}">${riskMeta.label}</span></td>
            <td>
                <div><span class="badge ${statusMeta.className}">${statusMeta.label}</span></div>
                <div class="small mt-1">${activeBadge}</div>
            </td>
            <td>${item.source || '-'}</td>
            <td>${formatDateTime(item.updated_at || item.last_seen_at || item.created_at)}</td>
            <td class="text-end">
                <div class="d-inline-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit-malicious-resource" data-resource-id="${item.id}">Редактирай</button>
                    <button type="button" class="btn btn-sm btn-outline-${item.is_active ? 'warning' : 'success'}" data-action="${item.is_active ? 'deactivate-malicious-resource' : 'activate-malicious-resource'}" data-resource-id="${item.id}">
                        ${item.is_active ? 'Деактивирай' : 'Активирай'}
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-malicious-resource" data-resource-id="${item.id}">Изтрий</button>
                </div>
            </td>
        `;

        dom.maliciousResourcesBody.appendChild(row);
    });
}

async function loadMaliciousResources() {
    if (!dom.maliciousResourcesBody) return;
    dom.maliciousResourcesBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Зареждане...</td></tr>';

    try {
        state.maliciousResources = await getMaliciousResources();
        renderMaliciousResourcesTable();
    } catch (error) {
        console.error('Error loading malicious resources:', error);
        dom.maliciousResourcesBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Грешка при зареждане на зловредни ресурси.</td></tr>';
        showToast('Неуспешно зареждане на зловредни ресурси.', 'error');
    }
}

async function handleCreateMaliciousResource(event) {
    event.preventDefault();

    const resourceValue = dom.maliciousResourceFields.value?.value?.trim();
    if (!resourceValue) {
        showToast('Въведете зловреден ресурс.', 'warning');
        return;
    }

    const submitBtn = dom.maliciousResourceFields.submit;
    const originalText = submitBtn?.textContent || '';

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Запазване...';
        }

        await createMaliciousResource({
            resourceValue,
            resourceType: dom.maliciousResourceFields.type?.value || 'url',
            source: dom.maliciousResourceFields.source?.value || 'manual',
            confidence: Number(dom.maliciousResourceFields.confidence?.value || 0.95),
            riskLevel: dom.maliciousResourceFields.risk?.value || 'high',
            status: dom.maliciousResourceFields.status?.value || 'online',
            threatName: dom.maliciousResourceFields.threatName?.value || '',
            notes: dom.maliciousResourceFields.notes?.value || ''
        });

        showToast('Зловредният ресурс е добавен успешно.', 'success');
        dom.maliciousResourceForm?.reset();
        if (dom.maliciousResourceFields.source) dom.maliciousResourceFields.source.value = 'manual';
        if (dom.maliciousResourceFields.confidence) dom.maliciousResourceFields.confidence.value = '0.95';
        if (dom.maliciousResourceFields.risk) dom.maliciousResourceFields.risk.value = 'high';
        if (dom.maliciousResourceFields.status) dom.maliciousResourceFields.status.value = 'online';
        if (dom.maliciousResourceFields.type) dom.maliciousResourceFields.type.value = 'url';
        await loadMaliciousResources();
    } catch (error) {
        console.error('Error creating malicious resource:', error);
        showToast('Неуспешно добавяне на зловреден ресурс.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

async function openEditMaliciousResourceModal(resourceId) {
    const item = findMaliciousResourceById(resourceId);
    if (!item) {
        showToast('Ресурсът не е намерен.', 'warning');
        return;
    }

    if (dom.maliciousResourceEdit.id) dom.maliciousResourceEdit.id.value = item.id || '';
    if (dom.maliciousResourceEdit.value) dom.maliciousResourceEdit.value.value = item.resource_value || '';
    if (dom.maliciousResourceEdit.type) dom.maliciousResourceEdit.type.value = item.resource_type || 'url';
    if (dom.maliciousResourceEdit.source) dom.maliciousResourceEdit.source.value = item.source || 'manual';
    if (dom.maliciousResourceEdit.confidence) dom.maliciousResourceEdit.confidence.value = Number(item.confidence || 0).toFixed(2);
    if (dom.maliciousResourceEdit.risk) dom.maliciousResourceEdit.risk.value = getMaliciousRiskMeta(item.risk_level).value;
    if (dom.maliciousResourceEdit.status) dom.maliciousResourceEdit.status.value = getMaliciousStatusMeta(item.status).value;
    if (dom.maliciousResourceEdit.threatName) dom.maliciousResourceEdit.threatName.value = item.threat_name || '';
    if (dom.maliciousResourceEdit.notes) dom.maliciousResourceEdit.notes.value = item.notes || '';
    if (dom.maliciousResourceEdit.isActive) dom.maliciousResourceEdit.isActive.checked = Boolean(item.is_active);

    openModal('editMaliciousResourceModal');
}

async function saveEditedMaliciousResource() {
    const id = dom.maliciousResourceEdit.id?.value;
    const resourceValue = dom.maliciousResourceEdit.value?.value?.trim();
    const confidence = Number(dom.maliciousResourceEdit.confidence?.value);
    if (!id || !resourceValue) {
        showToast('Липсват данни за ресурс.', 'warning');
        return;
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        showToast('Доверието трябва да е число между 0 и 1.', 'warning');
        return;
    }

    const button = dom.maliciousResourceEdit.updateBtn;
    const originalText = button?.textContent || '';

    try {
        if (button) {
            button.disabled = true;
            button.textContent = 'Запазване...';
        }

        await updateMaliciousResource(id, {
            resourceValue,
            resourceType: dom.maliciousResourceEdit.type?.value || 'url',
            source: dom.maliciousResourceEdit.source?.value || 'manual',
            confidence,
            riskLevel: dom.maliciousResourceEdit.risk?.value || 'high',
            status: dom.maliciousResourceEdit.status?.value || 'online',
            threatName: dom.maliciousResourceEdit.threatName?.value || '',
            notes: dom.maliciousResourceEdit.notes?.value || '',
            is_active: Boolean(dom.maliciousResourceEdit.isActive?.checked)
        });

        closeModal('editMaliciousResourceModal');
        showToast('Промените по ресурса са запазени.', 'success');
        await loadMaliciousResources();
    } catch (error) {
        console.error('Error updating malicious resource:', error);
        showToast('Неуспешно записване на ресурс.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

async function handleMaliciousResourceAction(action, id, button) {
    if (!id) return;
    const originalText = button?.textContent || '';

    try {
        if (button) {
            button.disabled = true;
            button.textContent = '...';
        }

        if (action === 'edit-malicious-resource') {
            await openEditMaliciousResourceModal(id);
            return;
        }

        if (action === 'activate-malicious-resource') {
            await updateMaliciousResource(id, { is_active: true });
            showToast('Ресурсът е активиран.', 'success');
        } else if (action === 'deactivate-malicious-resource') {
            await updateMaliciousResource(id, { is_active: false });
            showToast('Ресурсът е деактивиран.', 'success');
        } else if (action === 'delete-malicious-resource') {
            const ok = window.confirm('Сигурни ли сте, че искате да изтриете този зловреден ресурс?');
            if (!ok) return;
            await deleteMaliciousResource(id);
            showToast('Ресурсът е изтрит.', 'success');
        }

        await loadMaliciousResources();
    } catch (error) {
        console.error('Error handling malicious resource action:', error);
        showToast('Неуспешна операция върху зловреден ресурс.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

function initMaliciousResourcesManagement() {
    if (dom.maliciousResourcesRefreshBtn) {
        dom.maliciousResourcesRefreshBtn.addEventListener('click', () => {
            loadMaliciousResources();
        });
    }

    if (dom.maliciousResourceForm) {
        dom.maliciousResourceForm.addEventListener('submit', handleCreateMaliciousResource);
    }

    if (dom.maliciousResourceEdit.updateBtn) {
        dom.maliciousResourceEdit.updateBtn.addEventListener('click', () => {
            saveEditedMaliciousResource();
        });
    }

    if (dom.maliciousResourceFilters.searchInput) {
        dom.maliciousResourceFilters.searchInput.addEventListener('input', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            state.maliciousResourcesFilter.search = target.value || '';
            renderMaliciousResourcesTable();
        });
    }

    if (dom.maliciousResourceFilters.typeSelect) {
        dom.maliciousResourceFilters.typeSelect.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) return;
            state.maliciousResourcesFilter.type = target.value || 'all';
            renderMaliciousResourcesTable();
        });
    }

    if (dom.maliciousResourceFilters.statusSelect) {
        dom.maliciousResourceFilters.statusSelect.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) return;
            state.maliciousResourcesFilter.status = target.value || 'all';
            renderMaliciousResourcesTable();
        });
    }

    if (dom.maliciousResourceFilters.clearBtn) {
        dom.maliciousResourceFilters.clearBtn.addEventListener('click', () => {
            state.maliciousResourcesFilter.search = '';
            state.maliciousResourcesFilter.type = 'all';
            state.maliciousResourcesFilter.status = 'all';

            if (dom.maliciousResourceFilters.searchInput) dom.maliciousResourceFilters.searchInput.value = '';
            if (dom.maliciousResourceFilters.typeSelect) dom.maliciousResourceFilters.typeSelect.value = 'all';
            if (dom.maliciousResourceFilters.statusSelect) dom.maliciousResourceFilters.statusSelect.value = 'all';

            renderMaliciousResourcesTable();
        });
    }

    if (dom.maliciousResourcesBody) {
        dom.maliciousResourcesBody.addEventListener('click', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const btn = target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = btn.dataset.resourceId;
            await handleMaliciousResourceAction(action, id, btn);
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

            showToast('Съветът е създаден успешно!', 'success');

            closeModal('createArticleModal');

            // Clear form
            dom.create.form?.reset();
			toggleOtherCategoryInput(dom.create.category, dom.create.categoryOtherWrap, dom.create.categoryOther);
            await loadAdminArticles();

        } catch (error) {
            console.error('Error creating article:', error);
            showToast('Възникна грешка при създаването на съвета: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Запази съвета';
        }
    });
}

function initArticleEditing() {
    if (dom.refreshBtn) {
        dom.refreshBtn.addEventListener('click', () => {
            loadAdminArticles();
        });
    }

    if (dom.articleFilters.searchInput) {
        dom.articleFilters.searchInput.addEventListener('input', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            state.articlesFilter.search = target.value || '';
            renderArticlesTable();
        });
    }

    if (dom.articleFilters.statusSelect) {
        dom.articleFilters.statusSelect.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) return;
            state.articlesFilter.status = target.value || 'all';
            renderArticlesTable();
        });
    }

    if (dom.articleFilters.categorySelect) {
        dom.articleFilters.categorySelect.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) return;
            state.articlesFilter.category = target.value || 'all';
            renderArticlesTable();
        });
    }

    if (dom.articleFilters.clearBtn) {
        dom.articleFilters.clearBtn.addEventListener('click', () => {
            state.articlesFilter.search = '';
            state.articlesFilter.status = 'all';
            state.articlesFilter.category = 'all';

            if (dom.articleFilters.searchInput) dom.articleFilters.searchInput.value = '';
            if (dom.articleFilters.statusSelect) dom.articleFilters.statusSelect.value = 'all';
            if (dom.articleFilters.categorySelect) dom.articleFilters.categorySelect.value = 'all';

            renderArticlesTable();
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
                // window.open(`tips-details.html?id=${articleId}`, '_blank');
                try {
                    button.disabled = true;
                    await openViewArticleModal(articleId);
                } finally {
                    button.disabled = false;
                }
                return;
            }

            if (action === 'delete-article') {
                if (confirm('Сигурни ли сте, че искате да изтриете този съвет?')) {
                    const originalText = button.textContent;
                    try {
                        button.disabled = true;
                        button.textContent = 'Изтриване...';
                        await deleteArticle(articleId);
                        showToast('Съветът е изтрит успешно.', 'success');
                        await loadAdminArticles();
                    } catch (error) {
                        console.error('Error deleting article:', error);
                        showToast('Неуспешно изтриване на съвет.', 'error');
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
                        showToast('Съветът не беше намерен.', 'warning');
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
                    showToast('Неуспешно отваряне на съвет за редакция.', 'error');
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

                showToast('Съветът е обновен успешно.', 'success');
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

