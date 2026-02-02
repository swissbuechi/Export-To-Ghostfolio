const form = document.getElementById('convertForm');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileLabel = document.getElementById('fileLabel');
const status = document.getElementById('status');
const submitBtn = document.getElementById('submitBtn');
const accountIdInput = document.getElementById('accountId');
const tagIdsInput = document.getElementById('tagIds');
const accountDisplay = document.getElementById('accountDisplay');
const tagsDisplay = document.getElementById('tagsDisplay');

const accountPasteBtn = document.getElementById('accountPasteBtn');
const tagPasteBtn = document.getElementById('tagPasteBtn');
const accountHistoryDropdown = document.getElementById('accountHistoryDropdown');
const tagHistoryDropdown = document.getElementById('tagHistoryDropdown');

const exportBackupBtn = document.getElementById('exportBackupBtn');
const importBackupBtn = document.getElementById('importBackupBtn');
const importBackupInput = document.getElementById('importBackupInput');

const aliasModalOverlay = document.getElementById('aliasModalOverlay');
const aliasModalTitle = document.getElementById('aliasModalTitle');
const aliasModalId = document.getElementById('aliasModalId');
const aliasModalInput = document.getElementById('aliasModalInput');
const aliasModalCancel = document.getElementById('aliasModalCancel');
const aliasModalSave = document.getElementById('aliasModalSave');

const appTitle = document.getElementById('appTitle');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STORAGE_KEYS = {
    accountCurrent: 'ghostfolio_account_id',
    tagCurrent: 'ghostfolio_tag_ids',
    accounts: 'ghostfolio_account_history_v1',
    tags: 'ghostfolio_tag_history_v1'
};

// Reload app on title click
appTitle.addEventListener('click', () => {
    window.location.reload();
});

// History management functions
function loadHistory(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(x => x && typeof x.id === 'string')
            .map(x => ({
                id: String(x.id),
                alias: typeof x.alias === 'string' ? x.alias : '',
                lastUsed: typeof x.lastUsed === 'number' ? x.lastUsed : 0
            }))
            .slice(0, 100);
    } catch {
        return [];
    }
}

function saveHistory(key, items) {
    localStorage.setItem(key, JSON.stringify(items.slice(0, 100)));
}

function upsertHistoryItem(key, id, alias, lastUsed) {
    const history = loadHistory(key);
    const idx = history.findIndex(x => x.id.toLowerCase() === id.toLowerCase());
    const nextItem = {
        id,
        alias: alias ?? (idx >= 0 ? history[idx].alias : ''),
        lastUsed: lastUsed ?? Date.now()
    };
    if (idx >= 0) history.splice(idx, 1);
    history.unshift(nextItem);
    saveHistory(key, history);
}

function removeHistoryItem(key, id) {
    const history = loadHistory(key).filter(x => x.id.toLowerCase() !== id.toLowerCase());
    saveHistory(key, history);
}

function updateAlias(key, id, alias) {
    const history = loadHistory(key);
    const idx = history.findIndex(x => x.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) {
        history.unshift({ id, alias: alias || '', lastUsed: Date.now() });
    } else {
        history[idx] = { ...history[idx], alias: alias || '' };
    }
    saveHistory(key, history);
}

function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatUuidShort(uuid) {
    // Format: first 4 chars + ... + last 4 chars
    // Example: 550e8400-e29b-41d4-a716-446655440000 → 550e...0000
    if (!uuid || uuid.length < 8) return uuid;
    return uuid.substring(0, 4) + '...' + uuid.substring(uuid.length - 4);
}

function updateAccountDisplay() {
    const accountId = accountIdInput.value.trim();
    if (!accountId) {
        accountDisplay.classList.add('empty');
        accountDisplay.innerHTML = '';
        accountDisplay.setAttribute('data-editing', 'false');
        return;
    }

    accountDisplay.classList.remove('empty');
    const history = loadHistory(STORAGE_KEYS.accounts);
    const item = history.find(x => x.id.toLowerCase() === accountId.toLowerCase());
    const alias = item?.alias && item.alias.trim() ? item.alias : formatUuidShort(accountId);

    accountDisplay.innerHTML = `
        <div class="account-bubble">
            <span>${escapeHtml(alias)}</span>
            <span class="account-bubble-remove">×</span>
        </div>
    `;
    accountDisplay.setAttribute('data-editing', 'false');

    // Add click handler to remove button
    const removeBtn = accountDisplay.querySelector('.account-bubble-remove');
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            accountIdInput.value = '';
            localStorage.setItem(STORAGE_KEYS.accountCurrent, '');
            updateAccountDisplay();
        });
    }

    // Add click handler to bubble (not the remove button) to open dropdown
    const bubble = accountDisplay.querySelector('.account-bubble');
    if (bubble) {
        bubble.addEventListener('click', (e) => {
            if (!e.target.classList.contains('account-bubble-remove')) {
                openAccountDropdown();
            }
        });
    }
}

function updateTagsDisplay() {
    const tagIds = tagIdsInput.value.trim();
    if (!tagIds) {
        tagsDisplay.classList.add('empty');
        tagsDisplay.innerHTML = '';
        return;
    }

    tagsDisplay.classList.remove('empty');
    const tagIdArray = tagIds.split(',').map(t => t.trim()).filter(t => t);
    const history = loadHistory(STORAGE_KEYS.tags);

    const bubbles = tagIdArray.map(id => {
        const item = history.find(x => x.id.toLowerCase() === id.toLowerCase());
        const alias = item?.alias && item.alias.trim() ? item.alias : formatUuidShort(id);
        return `
            <div class="tag-bubble" data-id="${escapeHtml(id)}">
                <span>${escapeHtml(alias)}</span>
                <span class="tag-bubble-remove" data-id="${escapeHtml(id)}">×</span>
            </div>
        `;
    }).join('');

    tagsDisplay.innerHTML = bubbles;

    // Add click handlers to remove buttons
    tagsDisplay.querySelectorAll('.tag-bubble-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idToRemove = btn.getAttribute('data-id');
            const currentTags = tagIdsInput.value.split(',').map(t => t.trim()).filter(t => t);
            const newTags = currentTags.filter(t => t.toLowerCase() !== idToRemove.toLowerCase());
            tagIdsInput.value = newTags.join(', ');
            localStorage.setItem(STORAGE_KEYS.tagCurrent, tagIdsInput.value);
            updateTagsDisplay();
        });
    });
}

function renderAccountHistoryDropdown(dropdownEl, key, onSelect) {
    const history = loadHistory(key).sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));

    if (history.length === 0) {
        dropdownEl.innerHTML = '<div class="history-empty">No history yet</div>';
        return;
    }

    dropdownEl.innerHTML = history
        .map(item => {
            const alias = item.alias && item.alias.trim() ? item.alias.trim() : formatUuidShort(item.id);
            return `
                <div class="history-item" data-id="${escapeHtml(item.id)}">
                    <div class="history-item-content">
                        <div class="history-item-alias">${escapeHtml(alias)}</div>
                        <div class="history-item-id">${escapeHtml(item.id)}</div>
                    </div>
                    <div class="history-item-actions">
                        <button type="button" data-action="edit" data-id="${escapeHtml(item.id)}">Edit</button>
                        <button type="button" class="delete-btn" data-action="delete" data-id="${escapeHtml(item.id)}">Del</button>
                    </div>
                </div>
            `;
        })
        .join('');

    dropdownEl.querySelectorAll('.history-item').forEach(row => {
        row.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('button');
            if (actionBtn) return;
            const id = row.getAttribute('data-id');
            if (!id) return;
            onSelect(id);
            updateAccountDisplay();
        });
    });

    dropdownEl.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (!id) return;
            const current = loadHistory(key).find(x => x.id.toLowerCase() === id.toLowerCase());
            openAliasModal(key, id, current?.alias || '');
        });
    });

    dropdownEl.querySelectorAll('button[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (!id) return;
            removeHistoryItem(key, id);
            renderAccountHistoryDropdown(dropdownEl, key, onSelect);
        });
    });
}

function renderTagHistoryDropdown(dropdownEl, key) {
    const history = loadHistory(key).sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));

    if (history.length === 0) {
        dropdownEl.innerHTML = '<div class="history-empty">No tags yet</div>';
        return;
    }

    // Get currently selected tag IDs from input
    const currentValue = tagIdsInput.value.trim();
    const selectedIds = currentValue ? currentValue.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];

    const itemsHtml = history
        .map(item => {
            const alias = item.alias && item.alias.trim() ? item.alias.trim() : formatUuidShort(item.id);
            const isChecked = selectedIds.includes(item.id.toLowerCase());
            return `
                <div class="history-item ${isChecked ? 'selected' : ''}" data-id="${escapeHtml(item.id)}">
                    <input type="checkbox" class="history-item-checkbox" data-id="${escapeHtml(item.id)}" ${isChecked ? 'checked' : ''}>
                    <div class="history-item-content">
                        <div class="history-item-alias">${escapeHtml(alias)}</div>
                        <div class="history-item-id">${escapeHtml(item.id)}</div>
                    </div>
                    <div class="history-item-actions">
                        <button type="button" data-action="edit" data-id="${escapeHtml(item.id)}">Edit</button>
                        <button type="button" class="delete-btn" data-action="delete" data-id="${escapeHtml(item.id)}">Del</button>
                    </div>
                </div>
            `;
        })
        .join('');

    dropdownEl.innerHTML = itemsHtml;

    // Auto-apply checkbox changes
    dropdownEl.querySelectorAll('.history-item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const row = checkbox.closest('.history-item');
            if (checkbox.checked) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }

            // Auto-apply: Update tags immediately
            const selectedCheckboxes = dropdownEl.querySelectorAll('.history-item-checkbox:checked');
            const selectedTagIds = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-id'));

            if (selectedTagIds.length > 0) {
                const value = selectedTagIds.join(', ');
                tagIdsInput.value = value;
                localStorage.setItem(STORAGE_KEYS.tagCurrent, value);

                // Update lastUsed for selected tags
                selectedTagIds.forEach(id => {
                    upsertHistoryItem(STORAGE_KEYS.tags, id, null, Date.now());
                });
            } else {
                tagIdsInput.value = '';
                localStorage.setItem(STORAGE_KEYS.tagCurrent, '');
            }

            updateTagsDisplay();
        });
    });

    // Row click toggles checkbox
    dropdownEl.querySelectorAll('.history-item').forEach(row => {
        row.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('button');
            const checkbox = e.target.closest('.history-item-checkbox');
            if (actionBtn || checkbox) return;

            const checkboxEl = row.querySelector('.history-item-checkbox');
            checkboxEl.checked = !checkboxEl.checked;
            checkboxEl.dispatchEvent(new Event('change'));
        });
    });

    // Edit button
    dropdownEl.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (!id) return;
            const current = loadHistory(key).find(x => x.id.toLowerCase() === id.toLowerCase());
            openAliasModal(key, id, current?.alias || '');
        });
    });

    // Delete button
    dropdownEl.querySelectorAll('button[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (!id) return;
            removeHistoryItem(key, id);
            renderTagHistoryDropdown(dropdownEl, key);
        });
    });
}

function closeDropdowns() {
    accountHistoryDropdown.classList.remove('show');
    tagHistoryDropdown.classList.remove('show');
}

function openAccountDropdown() {
    renderAccountHistoryDropdown(accountHistoryDropdown, STORAGE_KEYS.accounts, (id) => {
        accountIdInput.value = id;
        localStorage.setItem(STORAGE_KEYS.accountCurrent, id);
        upsertHistoryItem(STORAGE_KEYS.accounts, id, null, Date.now());
        closeDropdowns();
    });
    tagHistoryDropdown.classList.remove('show');
    accountHistoryDropdown.classList.add('show');
}

function openTagDropdown() {
    renderTagHistoryDropdown(tagHistoryDropdown, STORAGE_KEYS.tags);
    accountHistoryDropdown.classList.remove('show');
    tagHistoryDropdown.classList.add('show');
}

// Modal functions
let modalContext = null;

function openAliasModal(key, id, existingAlias) {
    modalContext = { key, id };
    aliasModalTitle.textContent = key === STORAGE_KEYS.accounts ? 'Account alias' : 'Tag set alias';
    aliasModalId.textContent = id;
    aliasModalInput.value = existingAlias || '';
    aliasModalOverlay.classList.add('show');
    aliasModalOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => aliasModalInput.focus(), 0);
}

function closeAliasModal() {
    modalContext = null;
    aliasModalOverlay.classList.remove('show');
    aliasModalOverlay.setAttribute('aria-hidden', 'true');
    aliasModalInput.value = '';
}

aliasModalCancel.addEventListener('click', closeAliasModal);
aliasModalOverlay.addEventListener('click', (e) => {
    if (e.target === aliasModalOverlay) closeAliasModal();
});

aliasModalSave.addEventListener('click', () => {
    if (!modalContext) return;
    const alias = aliasModalInput.value.trim();
    updateAlias(modalContext.key, modalContext.id, alias);

    // Refresh displays
    updateAccountDisplay();
    updateTagsDisplay();

    // Refresh dropdowns if they're open
    if (accountHistoryDropdown.classList.contains('show')) {
        renderAccountHistoryDropdown(accountHistoryDropdown, STORAGE_KEYS.accounts, (id) => {
            accountIdInput.value = id;
            localStorage.setItem(STORAGE_KEYS.accountCurrent, id);
            upsertHistoryItem(STORAGE_KEYS.accounts, id, null, Date.now());
            updateAccountDisplay();
            closeDropdowns();
        });
    }
    if (tagHistoryDropdown.classList.contains('show')) {
        renderTagHistoryDropdown(tagHistoryDropdown, STORAGE_KEYS.tags);
    }

    closeAliasModal();
});

// Clipboard paste functions
function extractUuids(text) {
    const matches = String(text || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig);
    return matches ? Array.from(new Set(matches.map(m => m.trim()))) : [];
}

async function pasteAccountId() {
    try {
        const text = await navigator.clipboard.readText();
        const uuids = extractUuids(text);
        if (uuids.length === 0) {
            showStatus('Nothing to paste: clipboard does not contain a UUID.', 'error');
            return;
        }
        const id = uuids[0];
        accountIdInput.value = id;
        localStorage.setItem(STORAGE_KEYS.accountCurrent, id);
        upsertHistoryItem(STORAGE_KEYS.accounts, id, null, Date.now());
        updateAccountDisplay();
        openAccountDropdown();
        showStatus('✓ Pasted Account ID from clipboard.', 'success');
    } catch {
        showStatus('✗ Could not read clipboard (requires HTTPS or permission).', 'error');
    }
}

async function pasteTagIds() {
    try {
        const text = await navigator.clipboard.readText();
        const uuids = extractUuids(text);
        if (uuids.length === 0) {
            showStatus('Nothing to paste: clipboard does not contain a UUID.', 'error');
            return;
        }
        const value = uuids.join(', ');
        tagIdsInput.value = value;
        localStorage.setItem(STORAGE_KEYS.tagCurrent, value);

        // Store each tag individually in history
        uuids.forEach(id => {
            upsertHistoryItem(STORAGE_KEYS.tags, id, null, Date.now());
        });

        updateTagsDisplay();
        openTagDropdown();
        showStatus(`✓ Pasted ${uuids.length} Tag ID${uuids.length === 1 ? '' : 's'} from clipboard.`, 'success');
    } catch {
        showStatus('✗ Could not read clipboard (requires HTTPS or permission).', 'error');
    }
}

accountPasteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    pasteAccountId();
});

tagPasteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    pasteTagIds();
});

// Backup export/import functions
function buildBackupJson() {
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        account: {
            current: localStorage.getItem(STORAGE_KEYS.accountCurrent) || '',
            history: loadHistory(STORAGE_KEYS.accounts)
        },
        tags: {
            current: localStorage.getItem(STORAGE_KEYS.tagCurrent) || '',
            history: loadHistory(STORAGE_KEYS.tags)
        }
    };
}

function applyBackupJson(backup) {
    if (!backup || typeof backup !== 'object') {
        throw new Error('Invalid backup file format.');
    }
    if (backup.version !== 1) {
        throw new Error(`Unsupported backup version: ${backup.version}`);
    }

    const accountHistory = Array.isArray(backup.account?.history) ? backup.account.history : [];
    const tagHistory = Array.isArray(backup.tags?.history) ? backup.tags.history : [];

    const normalizedAccountHistory = accountHistory
        .filter(x => x && typeof x.id === 'string')
        .map(x => ({
            id: String(x.id),
            alias: typeof x.alias === 'string' ? x.alias : '',
            lastUsed: typeof x.lastUsed === 'number' ? x.lastUsed : 0
        }))
        .slice(0, 100);

    const normalizedTagHistory = tagHistory
        .filter(x => x && typeof x.id === 'string')
        .map(x => ({
            id: String(x.id),
            alias: typeof x.alias === 'string' ? x.alias : '',
            lastUsed: typeof x.lastUsed === 'number' ? x.lastUsed : 0
        }))
        .slice(0, 100);

    saveHistory(STORAGE_KEYS.accounts, normalizedAccountHistory);
    saveHistory(STORAGE_KEYS.tags, normalizedTagHistory);

    const accountCurrent = typeof backup.account?.current === 'string' ? backup.account.current.trim() : '';
    const tagsCurrent = typeof backup.tags?.current === 'string' ? backup.tags.current.trim() : '';

    if (accountCurrent) {
        localStorage.setItem(STORAGE_KEYS.accountCurrent, accountCurrent);
        accountIdInput.value = accountCurrent;
        if (uuidRegex.test(accountCurrent)) {
            upsertHistoryItem(STORAGE_KEYS.accounts, accountCurrent, null, Date.now());
        }
        updateAccountDisplay();
    }

    if (tagsCurrent) {
        localStorage.setItem(STORAGE_KEYS.tagCurrent, tagsCurrent);
        tagIdsInput.value = tagsCurrent;
        // Store each tag individually in history
        const tagIdArray = tagsCurrent.split(',').map(t => t.trim()).filter(t => t && uuidRegex.test(t));
        tagIdArray.forEach(id => {
            upsertHistoryItem(STORAGE_KEYS.tags, id, null, Date.now());
        });
        updateTagsDisplay();
    }
}

exportBackupBtn.addEventListener('click', () => {
    try {
        const backup = buildBackupJson();
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'export-to-ghostfolio-ids-backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showStatus('✓ Exported IDs backup.', 'success');
    } catch (err) {
        showStatus('✗ Failed to export backup: ' + err.message, 'error');
    }
});

importBackupBtn.addEventListener('click', () => {
    importBackupInput.click();
});

importBackupInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const json = JSON.parse(text);
        applyBackupJson(json);
        showStatus('✓ Imported backup successfully.', 'success');
    } catch (err) {
        showStatus('✗ Failed to import backup: ' + err.message, 'error');
    } finally {
        importBackupInput.value = '';
    }
});

// Load saved values and seed history
const savedAccountId = localStorage.getItem(STORAGE_KEYS.accountCurrent);
if (savedAccountId) {
    accountIdInput.value = savedAccountId;
    if (uuidRegex.test(savedAccountId.trim())) {
        upsertHistoryItem(STORAGE_KEYS.accounts, savedAccountId.trim(), null, Date.now());
    }
    updateAccountDisplay();
}

const savedTagIds = localStorage.getItem(STORAGE_KEYS.tagCurrent);
if (savedTagIds) {
    tagIdsInput.value = savedTagIds;
    // Store each tag individually in history
    const tagIdArray = savedTagIds.split(',').map(t => t.trim()).filter(t => t && uuidRegex.test(t));
    tagIdArray.forEach(id => {
        upsertHistoryItem(STORAGE_KEYS.tags, id, null, Date.now());
    });
    updateTagsDisplay();
}

// Save on change
accountIdInput.addEventListener('change', () => {
    const value = accountIdInput.value.trim();
    localStorage.setItem(STORAGE_KEYS.accountCurrent, value);
    if (value && uuidRegex.test(value)) {
        upsertHistoryItem(STORAGE_KEYS.accounts, value, null, Date.now());
    }
    updateAccountDisplay();
});

tagIdsInput.addEventListener('change', () => {
    const value = tagIdsInput.value.trim();
    localStorage.setItem(STORAGE_KEYS.tagCurrent, value);
    if (value) {
        // Store each tag individually in history
        const tagIdArray = value.split(',').map(t => t.trim()).filter(t => t && uuidRegex.test(t));
        tagIdArray.forEach(id => {
            upsertHistoryItem(STORAGE_KEYS.tags, id, null, Date.now());
        });
    }
    updateTagsDisplay();
});

// Click displays to open dropdowns
accountDisplay.addEventListener('click', (e) => {
    // If clicking on empty area, allow editing
    if (accountDisplay.classList.contains('empty')) {
        accountDisplay.setAttribute('data-editing', 'true');
        accountDisplay.focus();
        return;
    }

    // If clicking remove button, let that handler take care of it
    if (e.target.classList.contains('account-bubble-remove')) {
        return;
    }

    // If clicking on bubble or anywhere else with content, open dropdown
    openAccountDropdown();
});

tagsDisplay.addEventListener('click', (e) => {
    // If clicking remove button, let that handler take care of it
    if (e.target.classList.contains('tag-bubble-remove')) {
        return;
    }

    // If clicking on empty area, allow editing
    if (tagsDisplay.classList.contains('empty')) {
        tagsDisplay.setAttribute('data-editing', 'true');
        tagsDisplay.focus();
        return;
    }

    // If clicking on bubble, open dropdown
    if (e.target.closest('.tag-bubble')) {
        openTagDropdown();
        return;
    }

    // If clicking empty space between bubbles, enable editing to add more
    const clickedOnBubble = e.target.closest('.tag-bubble');
    if (!clickedOnBubble) {
        tagsDisplay.setAttribute('data-editing', 'true');
        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(tagsDisplay);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        tagsDisplay.focus();
    }
});

// Handle pasted/typed content in account display
accountDisplay.addEventListener('input', () => {
    // Remove empty class when user starts typing
    if (accountDisplay.textContent.trim().length > 0) {
        accountDisplay.classList.remove('empty');
    } else {
        accountDisplay.classList.add('empty');
    }

    const text = accountDisplay.textContent.trim();
    if (text && accountDisplay.getAttribute('data-editing') === 'true') {
        const uuids = extractUuids(text);
        if (uuids.length > 0) {
            const id = uuids[0];
            accountIdInput.value = id;
            localStorage.setItem(STORAGE_KEYS.accountCurrent, id);
            upsertHistoryItem(STORAGE_KEYS.accounts, id, null, Date.now());
            updateAccountDisplay();
        }
    }
});

accountDisplay.addEventListener('blur', () => {
    // If still editing and no valid UUID found, clear display
    if (accountDisplay.getAttribute('data-editing') === 'true') {
        const text = accountDisplay.textContent.trim();
        const uuids = extractUuids(text);

        if (uuids.length === 0) {
            // No valid UUID found
            if (text.length > 0) {
                // Had invalid input, clear it
                accountIdInput.value = '';
                localStorage.setItem(STORAGE_KEYS.accountCurrent, '');
            }
            // Restore display (either empty or existing account)
            updateAccountDisplay();

            // Restore empty class if no account
            if (!accountIdInput.value.trim()) {
                accountDisplay.classList.add('empty');
            }
        }

        // Always reset editing state
        accountDisplay.setAttribute('data-editing', 'false');
    }
});

// Handle pasted/typed content in tags display
tagsDisplay.addEventListener('input', () => {
    // Remove empty class when user starts typing
    if (tagsDisplay.textContent.trim().length > 0) {
        tagsDisplay.classList.remove('empty');
    } else {
        tagsDisplay.classList.add('empty');
    }

    const text = tagsDisplay.textContent.trim();
    if (text && tagsDisplay.getAttribute('data-editing') === 'true') {
        const uuids = extractUuids(text);
        // Only allow single UUID at a time for direct typing
        if (uuids.length === 1) {
            const id = uuids[0];
            // Get existing tags
            const existingTags = tagIdsInput.value.trim();
            const existingTagArray = existingTags ? existingTags.split(',').map(t => t.trim()).filter(t => t) : [];

            // Only add if not already in list
            if (!existingTagArray.some(t => t.toLowerCase() === id.toLowerCase())) {
                existingTagArray.push(id);
                const value = existingTagArray.join(', ');
                tagIdsInput.value = value;
                localStorage.setItem(STORAGE_KEYS.tagCurrent, value);

                // Store in history
                upsertHistoryItem(STORAGE_KEYS.tags, id, null, Date.now());
            }

            updateTagsDisplay();
            tagsDisplay.setAttribute('data-editing', 'false');
        } else if (uuids.length > 1) {
            // Multiple UUIDs detected - show message and only take first one
            const id = uuids[0];
            const existingTags = tagIdsInput.value.trim();
            const existingTagArray = existingTags ? existingTags.split(',').map(t => t.trim()).filter(t => t) : [];

            if (!existingTagArray.some(t => t.toLowerCase() === id.toLowerCase())) {
                existingTagArray.push(id);
                const value = existingTagArray.join(', ');
                tagIdsInput.value = value;
                localStorage.setItem(STORAGE_KEYS.tagCurrent, value);
                upsertHistoryItem(STORAGE_KEYS.tags, id, null, Date.now());
            }

            updateTagsDisplay();
            tagsDisplay.setAttribute('data-editing', 'false');
            showStatus('⚠️ Only one tag at a time. Use the dropdown to select multiple tags, or paste via 📋 button.', 'error');
        }
    }
});

tagsDisplay.addEventListener('blur', () => {
    // If still editing, finalize
    if (tagsDisplay.getAttribute('data-editing') === 'true') {
        const text = tagsDisplay.textContent.trim();
        const uuids = extractUuids(text);

        if (uuids.length === 0) {
            // No valid UUIDs found - restore display to show existing tags
            updateTagsDisplay();

            // Restore empty class if no tags
            if (!tagIdsInput.value.trim()) {
                tagsDisplay.classList.add('empty');
            }
        }

        // Always reset editing state
        tagsDisplay.setAttribute('data-editing', 'false');
    }
});

// Handle Enter key in account display
accountDisplay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        accountDisplay.blur();
    }
});

// Handle Enter key in tags display
tagsDisplay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        tagsDisplay.blur();
    }
});

// Open dropdowns on focus
accountDisplay.addEventListener('focus', () => {
    // Only open dropdown if not in editing mode and has content
    if (accountDisplay.getAttribute('data-editing') !== 'true') {
        openAccountDropdown();
    }
});

tagsDisplay.addEventListener('focus', () => {
    // Only open dropdown if not in editing mode
    if (tagsDisplay.getAttribute('data-editing') !== 'true') {
        openTagDropdown();
    }
});

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    const clickedAccount = e.target.closest('.input-group') === accountDisplay.closest('.input-group');
    const clickedTag = e.target.closest('.input-group') === tagsDisplay.closest('.input-group');
    const inModal = e.target.closest('.modal');

    if (!clickedAccount) accountHistoryDropdown.classList.remove('show');
    if (!clickedTag) tagHistoryDropdown.classList.remove('show');
    if (!inModal && e.target === aliasModalOverlay) {
        closeAliasModal();
    }
});

// Escape key closes dropdowns and modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeDropdowns();
        closeAliasModal();
    }
});

// File selection
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        updateFileDisplay(e.target.files[0]);
    }
});

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.csv')) {
        fileInput.files = files;
        updateFileDisplay(files[0]);
    }
});

function updateFileDisplay(file) {
    fileLabel.innerHTML = `<span class="file-name">${file.name}</span><br><small>${(file.size / 1024).toFixed(1)} KB</small>`;
    dropZone.classList.add('has-file');
}

function showStatus(message, type) {
    status.className = 'status ' + type;
    status.innerHTML = message;
}

// Form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    const accountId = accountIdInput.value.trim();
    const tagIds = tagIdsInput.value.trim();

    if (!file || !accountId) {
        showStatus('Please fill in all required fields', 'error');
        return;
    }

    if (!uuidRegex.test(accountId)) {
        showStatus('Invalid Account ID format. Expected UUID format.', 'error');
        return;
    }

    if (tagIds) {
        const tagIdArray = tagIds.split(',').map(t => t.trim()).filter(t => t !== '');
        for (const tagId of tagIdArray) {
            if (!uuidRegex.test(tagId)) {
                showStatus(`Invalid Tag ID format: '${tagId}'. Expected UUID format.`, 'error');
                return;
            }
        }
    }

    upsertHistoryItem(STORAGE_KEYS.accounts, accountId, null, Date.now());
    if (tagIds) {
        // Store each tag individually in history
        const tagIdArray = tagIds.split(',').map(t => t.trim()).filter(t => t);
        tagIdArray.forEach(id => {
            upsertHistoryItem(STORAGE_KEYS.tags, id, null, Date.now());
        });
    }

    submitBtn.disabled = true;
    showStatus('<span class="spinner"></span>Converting... This may take a moment.', 'loading');

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('accountId', accountId);
        if (tagIds) formData.append('tagIds', tagIds);

        const response = await fetch('/convert', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Conversion failed');
        }

        const disposition = response.headers.get('Content-Disposition');
        let filename = 'ghostfolio-import.json';
        if (disposition) {
            const match = disposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showStatus('✓ Conversion successful! File downloaded.', 'success');

    } catch (err) {
        showStatus('✗ ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
    }
});

