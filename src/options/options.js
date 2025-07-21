// Reddit User Profile Search - Options Script

const apiKeyInput = document.getElementById('apiKey');
const baseUrlInput = document.getElementById('baseUrl');
const modelInput = document.getElementById('model');
const rateLimitInput = document.getElementById('rateLimit');
const maxPostsInput = document.getElementById('maxPosts');
const maxCommentsInput = document.getElementById('maxComments');

// Tab and content filter elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const filterToggles = document.querySelectorAll('.toggle-switch');

// Initialize tab functionality
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;
        
        // Update tab buttons
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update tab content
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
});

// Initialize filter toggles
filterToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
        const isEnabled = toggle.classList.contains('enabled');
        
        if (isEnabled) {
            toggle.classList.remove('enabled');
        } else {
            toggle.classList.add('enabled');
        }
        
        saveOptions();
    });
});

// Show save bar when form inputs change
[apiKeyInput, baseUrlInput, modelInput, rateLimitInput, maxPostsInput, maxCommentsInput].forEach(input => {
    if (input) {
        input.addEventListener('input', () => {
            saveOptions();
        });
    }
});

function saveOptions() {
    const apiKey = apiKeyInput.value;
    const baseUrl = baseUrlInput.value;
    const model = modelInput.value;
    const rateLimit = parseInt(rateLimitInput.value) || 60;
    const maxPosts = parseInt(maxPostsInput.value) || 50;
    const maxComments = parseInt(maxCommentsInput.value) || 50;
    
    // Get enabled filters
    const enabledFilters = {};
    filterToggles.forEach(toggle => {
        const filterId = toggle.dataset.toggle;
        enabledFilters[filterId] = toggle.classList.contains('enabled');
    });
    
    // Validate required fields
    if (!apiKey) {
        showStatus('API Key is required!', 'error');
        return;
    }
    
    if (!baseUrl) {
        showStatus('Base URL is required!', 'error');
        return;
    }
    
    if (!model) {
        showStatus('Model is required!', 'error');
        return;
    }
    
    // Validate rate limit
    if (rateLimit < 1 || rateLimit > 600) {
        showStatus('Rate limit must be between 1 and 600 requests per minute!', 'error');
        return;
    }
    
    // Validate max posts/comments
    if (maxPosts < 1 || maxPosts > 100) {
        showStatus('Maximum posts must be between 1 and 100!', 'error');
        return;
    }
    
    if (maxComments < 1 || maxComments > 100) {
        showStatus('Maximum comments must be between 1 and 100!', 'error');
        return;
    }

    const darkMode = document.querySelector('[data-toggle="dark-mode"]')?.classList.contains('enabled') || false;
    const automaticDarkMode = document.querySelector('[data-toggle="automatic-dark-mode"]')?.classList.contains('enabled') || false;
    const extensionEnabled = document.querySelector('[data-toggle="extension-enabled"]')?.classList.contains('enabled') || true;
    const autoLoad = document.querySelector('[data-toggle="auto-load"]')?.classList.contains('enabled') || false;
    
    browser.storage.sync.set({ 
        apiKey, 
        baseUrl, 
        model, 
        rateLimit,
        maxPosts,
        maxComments,
        extensionEnabled,
        autoLoad,
        darkMode,
        automaticDarkMode
    }).then(() => {
        showStatus('Settings saved successfully!', 'success');
        
        // Notify content scripts about settings change
        browser.tabs.query({ url: "*://*.reddit.com/*" }).then(tabs => {
            tabs.forEach(tab => {
                browser.tabs.sendMessage(tab.id, {
                    action: 'settingsChanged'
                }).catch(() => {
                    // Tab might not have content script loaded
                });
            });
        });
    }).catch(error => {
        showStatus('Failed to save settings: ' + error.message, 'error');
    });
}

function showStatus(message, type) {
    // Create status element if it doesn't exist
    let statusEl = document.getElementById('status');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'status';
        statusEl.className = 'status-message';
        document.body.appendChild(statusEl);
    }
    
    statusEl.textContent = message;
    statusEl.className = `status-message show ${type}`;
    setTimeout(() => {
        statusEl.className = 'status-message';
    }, 3000);
}

function restoreOptions() {
    browser.storage.sync.get([
        'apiKey', 
        'baseUrl', 
        'model', 
        'rateLimit',
        'maxPosts',
        'maxComments',
        'extensionEnabled',
        'autoLoad',
        'darkMode',
        'automaticDarkMode'
    ]).then((result) => {
        apiKeyInput.value = result.apiKey || '';
        baseUrlInput.value = result.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
        modelInput.value = result.model || 'gemini-1.5-flash';
        rateLimitInput.value = result.rateLimit || 60;
        maxPostsInput.value = result.maxPosts || 50;
        maxCommentsInput.value = result.maxComments || 50;
        
        // Restore toggle states
        const extensionEnabled = result.extensionEnabled !== false; // Default to true
        const autoLoad = result.autoLoad || false;
        const darkMode = result.darkMode || false;
        const automaticDarkMode = result.automaticDarkMode !== false; // Default to true
        
        if (extensionEnabled) {
            document.querySelector('[data-toggle="extension-enabled"]')?.classList.add('enabled');
        }
        
        if (autoLoad) {
            document.querySelector('[data-toggle="auto-load"]')?.classList.add('enabled');
        }
        
        if (darkMode) {
            document.querySelector('[data-toggle="dark-mode"]')?.classList.add('enabled');
        }
        
        if (automaticDarkMode) {
            document.querySelector('[data-toggle="automatic-dark-mode"]')?.classList.add('enabled');
        }

        applyTheme();
    });
}

function applyTheme() {
    const darkModeToggle = document.querySelector('[data-toggle="dark-mode"]');
    const automaticDarkModeToggle = document.querySelector('[data-toggle="automatic-dark-mode"]');

    const manualDarkMode = darkModeToggle?.classList.contains('enabled') || false;
    const automaticDarkMode = automaticDarkModeToggle?.classList.contains('enabled') !== false; // Default to true

    if (automaticDarkMode) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark-mode', prefersDark);
    } else {
        document.documentElement.classList.toggle('dark-mode', manualDarkMode);
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return String(unsafe);
    }
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();

    const darkModeToggle = document.querySelector('[data-toggle="dark-mode"]');
    const automaticDarkModeToggle = document.querySelector('[data-toggle="automatic-dark-mode"]');

    darkModeToggle?.addEventListener('click', applyTheme);
    automaticDarkModeToggle?.addEventListener('click', applyTheme);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
});

// Export/Import functionality
document.getElementById('exportButton')?.addEventListener('click', exportSettings);
document.getElementById('importButton')?.addEventListener('click', () => {
    document.getElementById('importFile')?.click();
});
document.getElementById('importFile')?.addEventListener('change', importSettings);

async function exportSettings() {
    try {
        const settings = await browser.storage.sync.get(null);
        const settingsJson = JSON.stringify(settings, null, 2);
        const blob = new Blob([settingsJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'reddit-profile-analyzer-settings.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showStatus('Settings exported successfully!', 'success');
    } catch (error) {
        showStatus(`Failed to export settings: ${error.message}`, 'error');
    }
}

function importSettings(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const settings = JSON.parse(e.target.result);
            
            // Basic validation
            if (typeof settings !== 'object' || settings === null) {
                throw new Error('Invalid settings file format.');
            }

            // Clear existing settings before importing
            await browser.storage.sync.clear();
            
            // Set the new settings
            await browser.storage.sync.set(settings);

            showStatus('Settings imported successfully! Reloading...', 'success');
            
            // Reload the options page to reflect the new settings
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            showStatus(`Failed to import settings: ${error.message}`, 'error');
        } finally {
            // Reset the file input so the same file can be loaded again
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

// Listen for storage changes
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
        // Restore options when settings change
        restoreOptions();
    }
});