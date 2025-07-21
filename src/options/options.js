const apiKeyInput = document.getElementById('apiKey');
const baseUrlInput = document.getElementById('baseUrl');
const modelInput = document.getElementById('model');
const rateLimitInput = document.getElementById('rateLimit');
const whitelistedSubsInput = document.getElementById('whitelistedSubs');
const blockDisplayModeInput = document.getElementById('blockDisplayMode');
const scoreFilterModeSelect = document.getElementById('scoreFilterMode');
const scoreThresholdInput = document.getElementById('scoreThreshold');
const statusEl = document.getElementById('status');
const logContainer = document.getElementById('logContainer');
const refreshLogButton = document.getElementById('refreshLogButton');
const clearLogButton = document.getElementById('clearLogButton');
const conditionalFiltersSection = document.getElementById('conditionalFiltersSection');

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
        
        // Hide save bar on activity log tab
        if (targetTab === 'activity') {

        }
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

// Initialize score filter mode handling
function updateScoreFilterUI() {
    const mode = scoreFilterModeSelect.value;
    
    if (mode === 'conditional') {
        conditionalFiltersSection.classList.remove('hidden');
        // Set appropriate threshold suggestion for conditional mode
        if (scoreThresholdInput.value === '0') {
            scoreThresholdInput.value = '1';
        }
    } else {
        conditionalFiltersSection.classList.add('hidden');
        // Set appropriate threshold suggestion for hide mode
        if (mode === 'hide' && scoreThresholdInput.value === '1') {
            scoreThresholdInput.value = '0';
        }
    }
}

scoreFilterModeSelect.addEventListener('change', () => {
    updateScoreFilterUI();
    saveOptions();
});

// Show save bar when form inputs change
[apiKeyInput, baseUrlInput, modelInput, rateLimitInput, whitelistedSubsInput, scoreThresholdInput].forEach(input => {
    if (input) {
        input.addEventListener('input', () => {
            saveOptions();
        });
    }
});

blockDisplayModeInput.addEventListener('input', () => {
    saveOptions();
});

function saveOptions() {
    const apiKey = apiKeyInput.value;
    const baseUrl = baseUrlInput.value;
    const model = modelInput.value;
    const rateLimit = parseInt(rateLimitInput.value) || 60;
    const scoreFilterMode = scoreFilterModeSelect.value;
    const scoreThreshold = parseInt(scoreThresholdInput.value) || 1;
    
    // Get whitelisted subreddits
    const whitelistedSubs = whitelistedSubsInput.value
        .split('\n')
        .map(sub => sub.trim().toLowerCase())
        .filter(sub => sub.length > 0);
    
    // Get enabled filters
    const enabledFilters = {};
    filterToggles.forEach(toggle => {
        const filterId = toggle.dataset.toggle;
        enabledFilters[filterId] = toggle.classList.contains('enabled');
    });
    
    // Validate required fields
    if (!apiKey || !baseUrl || !model) {
        showStatus('API Key, Base URL, and Model are required!', 'error');
        return;
    }
    
    // Validate rate limit
    if (rateLimit < 1 || rateLimit > 600) {
        showStatus('Rate limit must be between 1 and 600 requests per minute!', 'error');
        return;
    }
    
    // Validate score threshold
    if (scoreThreshold < -100 || scoreThreshold > 100) {
        showStatus('Score threshold must be between -100 and 100!', 'error');
        return;
    }

    const darkMode = document.querySelector('[data-toggle="dark-mode"]').classList.contains('enabled');
    const automaticDarkMode = document.querySelector('[data-toggle="automatic-dark-mode"]').classList.contains('enabled');
    const blockDisplayMode = parseInt(blockDisplayModeInput.value);
    
    browser.storage.sync.set({ 
        apiKey, 
        baseUrl, 
        model, 
        rateLimit, 
        enabledFilters, 
        whitelistedSubs,
        scoreFilterMode,
        scoreThreshold,
        darkMode,
        automaticDarkMode,
        blockDisplayMode
    }).then(() => {
        showStatus('Settings saved successfully!', 'success');
    }).catch(error => {
        showStatus('Failed to save settings: ' + error.message, 'error');
    });
}

function showStatus(message, type) {
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
        'enabledFilters', 
        'whitelistedSubs',
        'scoreFilterMode',
        'scoreThreshold',
        'darkMode',
        'automaticDarkMode',
        'blockDisplayMode'
    ]).then((result) => {
        apiKeyInput.value = result.apiKey || '';
        baseUrlInput.value = result.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai';
        modelInput.value = result.model || 'gemma-3-27b-it';
        rateLimitInput.value = result.rateLimit || 30;
        scoreFilterModeSelect.value = result.scoreFilterMode || 'conditional';
        
        // Set default threshold based on mode if not previously set
        const defaultThreshold = (result.scoreFilterMode || 'conditional') === 'hide' ? 0 : 1;
        scoreThresholdInput.value = result.scoreThreshold !== undefined ? result.scoreThreshold : defaultThreshold;
        
        // Restore whitelisted subreddits
        const whitelistedSubs = result.whitelistedSubs || [];
        whitelistedSubsInput.value = whitelistedSubs.join('\n');
        
        // Restore filter states with new defaults for score-based filtering
        const enabledFilters = result.enabledFilters || {
            'extension-enabled': true,
            'json-output': false,
            // Always check filters (regardless of score)
            politics: false,
            unfunny: false,
            ragebait: false,
            loweffort: false,
            advertisement: false,
            // Conditional filters (only for low-scoring posts)
            'conditional-politics': false,
            'conditional-unfunny': false,
            'conditional-ragebait': false,
            'conditional-loweffort': false,
            'conditional-advertisement': false,
            // Page settings
            circlejerk: false,
            'home-page': true,
            'popular-page': true,
            'all-page': true,
            'subreddit-page': true
        };
        
        filterToggles.forEach(toggle => {
            const filterId = toggle.dataset.toggle;
            
            if (enabledFilters[filterId]) {
                toggle.classList.add('enabled');
            } else {
                toggle.classList.remove('enabled');
            }
        });

        // Restore dark mode settings
        if (result.darkMode) {
            document.querySelector('[data-toggle="dark-mode"]').classList.add('enabled');
        }
        // Set automatic dark mode to true by default
        const automaticDarkMode = result.automaticDarkMode !== undefined ? result.automaticDarkMode : true;
        if (automaticDarkMode) {
            document.querySelector('[data-toggle="automatic-dark-mode"]').classList.add('enabled');
        }

        blockDisplayModeInput.value = result.blockDisplayMode !== undefined ? result.blockDisplayMode : 2;

        applyTheme();
        
        // Update UI based on score filter mode
        updateScoreFilterUI();
    });
}

function applyTheme() {
    const darkModeToggle = document.querySelector('[data-toggle="dark-mode"]');
    const automaticDarkModeToggle = document.querySelector('[data-toggle="automatic-dark-mode"]');

    const manualDarkMode = darkModeToggle.classList.contains('enabled');
    const automaticDarkMode = automaticDarkModeToggle.classList.contains('enabled');

    if (automaticDarkMode) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark-mode', prefersDark);
    } else {
        document.documentElement.classList.toggle('dark-mode', manualDarkMode);
    }
}

async function renderLogs() {
    logContainer.innerHTML = 'Loading...';
    
    try {
        const { activityLog = [] } = await browser.storage.local.get('activityLog');

        if (activityLog.length === 0) {
            logContainer.innerHTML = 'No activity recorded yet.';
            return;
        }

        logContainer.innerHTML = ''; // Clear previous logs

        for (const entry of activityLog) {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'log-entry';

            const timestamp = new Date(entry.timestamp).toLocaleString();

            entryDiv.innerHTML = `
                <p><strong>Timestamp:</strong> ${timestamp}</p>
                <p><strong>Post:</strong> "${escapeHtml(entry.post.title)}" in ${escapeHtml(entry.post.subreddit)}</p>
                <p><strong>Score:</strong> ${entry.post.score !== undefined && entry.post.score !== null ? entry.post.score : 'N/A'} upvotes</p>
                <p><strong>Action:</strong> ${escapeHtml(entry.action)}</p>
                <p><strong>Reason:</strong> ${escapeHtml(entry.reason)}</p>
                <details>
                    <summary>View API Request & Response</summary>
                    <h4>Request Prompt:</h4>
                    <pre>${escapeHtml(entry.apiData?.prompt || 'N/A')}</pre>
                    <h4>Full API Response:</h4>
                    <pre>${escapeHtml(JSON.stringify(entry.apiData?.responseData || {note: "No response data"}, null, 2))}</pre>
                </details>
            `;
            logContainer.appendChild(entryDiv);
        }
    } catch (error) {
        logContainer.innerHTML = `Error loading logs: ${escapeHtml(error.message)}`;
    }
}

function clearLogs() {
    if (confirm('Are you sure you want to clear all activity logs?')) {
        browser.storage.local.remove('activityLog').then(() => {
            renderLogs();
            showStatus('Activity logs cleared!', 'success');
        }).catch(error => {
            showStatus('Failed to clear logs: ' + error.message, 'error');
        });
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
    renderLogs();
    updateScoreFilterUI();

    const darkModeToggle = document.querySelector('[data-toggle="dark-mode"]');
    const automaticDarkModeToggle = document.querySelector('[data-toggle="automatic-dark-mode"]');

    darkModeToggle.addEventListener('click', applyTheme);
    automaticDarkModeToggle.addEventListener('click', applyTheme);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
});

// Event listeners
refreshLogButton.addEventListener('click', renderLogs);
clearLogButton.addEventListener('click', clearLogs);

document.getElementById('exportButton').addEventListener('click', exportSettings);
document.getElementById('importButton').addEventListener('click', () => {
    document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', importSettings);


// --- Data Management ---

async function exportSettings() {
    try {
        const settings = await browser.storage.sync.get(null); // Get all settings
        const settingsJson = JSON.stringify(settings, null, 2);
        const blob = new Blob([settingsJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'noise-filter-settings.json';
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
            if (typeof settings !== 'object' || settings === null || !settings.apiKey) {
                throw new Error('Invalid or corrupted settings file.');
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


browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.enabledFilters) {
        restoreOptions();
    }
});
