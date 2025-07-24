(async () => {
    try {
        // Use chrome.storage for compatibility
        const storage = await chrome.storage.sync.get(['darkMode', 'automaticDarkMode']);
        const manualDarkMode = storage.darkMode || false;
        const automaticDarkMode = storage.automaticDarkMode !== undefined ? storage.automaticDarkMode : true;

        if (automaticDarkMode) {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark-mode');
            }
        } else if (manualDarkMode) {
            document.documentElement.classList.add('dark-mode');
        }
    } catch (e) {
        // Ignore errors, default to light mode
        console.log('Dark mode init error:', e);
    }
})();