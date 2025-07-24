// Reddit User Profile Search - Options Script

const apiKeyInput = document.getElementById('apiKey');

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
if (apiKeyInput) {
    apiKeyInput.addEventListener('input', () => {
        saveOptions();
    });
}

// Save options
async function saveOptions() {
    const apiKey = apiKeyInput?.value || '';
    
    const extensionEnabled = document.querySelector('[data-toggle="extension-enabled"]')?.classList.contains('enabled') || true;
    const autoLoad = document.querySelector('[data-toggle="auto-load"]')?.classList.contains('enabled') || false;
    const darkMode = document.querySelector('[data-toggle="dark-mode"]')?.classList.contains('enabled') || false;
    const automaticDarkMode = document.querySelector('[data-toggle="automatic-dark-mode"]')?.classList.contains('enabled') || false;
    
    chrome.storage.sync.set({ 
        apiKey,
        extensionEnabled,
        autoLoad,
        darkMode,
        automaticDarkMode
    }).then(() => {
        console.log('Settings saved successfully');
        // Notify content scripts about settings change
        chrome.tabs.query({url: "*://*.reddit.com/*"}).then(tabs => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'settingsUpdated',
                    settings: { extensionEnabled, autoLoad }
                }).catch(() => {
                    // Ignore errors for tabs without content script
                });
            });
        });
    }).catch(error => {
        console.error('Error saving options:', error);
    });
}

// Restore options
async function restoreOptions() {
    try {
        const result = await chrome.storage.sync.get([
            'apiKey',
            'extensionEnabled', 
            'autoLoad',
            'darkMode',
            'automaticDarkMode'
        ]);
        
        if (result.apiKey && apiKeyInput) {
            apiKeyInput.value = result.apiKey;
        }
        
        const extensionEnabled = result.extensionEnabled !== false; // Default to true
        const autoLoad = result.autoLoad === true; // Only true if explicitly set
        const darkMode = result.darkMode === true; // Only true if explicitly set
        const automaticDarkMode = result.automaticDarkMode === true; // Only true if explicitly set
        
        // Clear all toggles first, then set the enabled ones
        document.querySelectorAll('.toggle-switch').forEach(toggle => {
            toggle.classList.remove('enabled');
        });
        
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
    } catch (error) {
        console.error('Error restoring options:', error);
    }
}

function applyTheme() {
    const darkModeToggle = document.querySelector('[data-toggle="dark-mode"]');
    const automaticDarkModeToggle = document.querySelector('[data-toggle="automatic-dark-mode"]');

    const manualDarkMode = darkModeToggle?.classList.contains('enabled') || false;
    const automaticDarkMode = automaticDarkModeToggle?.classList.contains('enabled') || false;

    let shouldUseDarkMode = manualDarkMode;

    if (automaticDarkMode) {
        shouldUseDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (shouldUseDarkMode) {
        document.documentElement.classList.add('dark-mode');
    } else {
        document.documentElement.classList.remove('dark-mode');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();

    const darkModeToggle = document.querySelector('[data-toggle="dark-mode"]');
    const automaticDarkModeToggle = document.querySelector('[data-toggle="automatic-dark-mode"]');

    darkModeToggle?.addEventListener('click', applyTheme);
    automaticDarkModeToggle?.addEventListener('click', applyTheme);

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
});