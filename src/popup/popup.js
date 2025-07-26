// Reddit User Profile Search - Popup Script

let currentTab = null;
let currentUsername = null;

// DOM elements
const currentUserEl = document.getElementById('currentUser');
const postsStatusEl = document.getElementById('postsStatus');
const commentsStatusEl = document.getElementById('commentsStatus');
const loadPostsBtn = document.getElementById('loadPostsBtn');
const loadCommentsBtn = document.getElementById('loadCommentsBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const notRedditMessage = document.getElementById('notRedditMessage');
const mainContent = document.getElementById('mainContent');

// Apply color scheme
async function applyColorScheme() {
    try {
        const result = await chrome.storage.sync.get(['colorScheme']);
        const colorScheme = result.colorScheme || 'orange';

        // Remove all existing color scheme classes
        document.documentElement.classList.remove('color-orange', 'color-blue', 'color-green', 'color-purple', 'color-gray');

        // Apply the selected color scheme
        if (colorScheme && colorScheme !== 'orange') {
            document.documentElement.classList.add(`color-${colorScheme}`);
        }
    } catch (error) {
        console.error('Error applying color scheme:', error);
    }
}

// Save popup state
async function savePopupState() {
    if (!currentUsername) return;

    const state = {
        username: currentUsername,
        postsStatus: postsStatusEl.textContent,
        commentsStatus: commentsStatusEl.textContent,
        chatHistory: chatMessages.innerHTML,
        timestamp: Date.now()
    };

    try {
        await chrome.storage.local.set({ [`popup_${currentUsername}`]: state });
    } catch (error) {
        console.error('Error saving popup state:', error);
    }
}

// Restore popup state
async function restorePopupState(username) {
    try {
        const result = await chrome.storage.local.get([`popup_${username}`]);
        const state = result[`popup_${username}`];

        if (state && state.timestamp) {
            // Only restore if the state is less than 1 hour old
            const oneHour = 60 * 60 * 1000;
            if (Date.now() - state.timestamp < oneHour) {
                postsStatusEl.textContent = state.postsStatus || 'Not loaded';
                commentsStatusEl.textContent = state.commentsStatus || 'Not loaded';

                if (state.chatHistory) {
                    chatMessages.innerHTML = state.chatHistory;
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                } else {
                    chatMessages.innerHTML = `
                        <div class="chat-message system">
                            Ready to analyze u/${username}! Load their posts or comments first.
                        </div>
                    `;
                }

                return true; // State was restored
            }
        }
    } catch (error) {
        console.error('Error restoring popup state:', error);
    }

    return false; // No state to restore
}

// Clear popup state for a user
async function clearPopupState(username) {
    try {
        await chrome.storage.local.remove([`popup_${username}`]);
    } catch (error) {
        console.error('Error clearing popup state:', error);
    }
}

// Clear old popup states (keep only current user and recent ones)
async function cleanupOldStates(currentUser) {
    try {
        const result = await chrome.storage.local.get();
        const oneHour = 60 * 60 * 1000;
        const now = Date.now();

        for (const key in result) {
            if (key.startsWith('popup_')) {
                const username = key.replace('popup_', '');
                const state = result[key];

                // Remove if it's old or if it's not the current user and we're switching
                if (!state.timestamp ||
                    now - state.timestamp > oneHour ||
                    (currentUser && username !== currentUser)) {
                    await chrome.storage.local.remove([key]);
                }
            }
        }
    } catch (error) {
        console.error('Error cleaning up old states:', error);
    }
}

// Initialize popup
async function initializePopup() {
    try {
        // Apply color scheme first
        await applyColorScheme();

        // Get current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Tabs query result:', tabs);

        if (!tabs || tabs.length === 0) {
            addChatMessage('system', 'Could not access current tab. Please refresh the page and try again.');
            return;
        }

        const tab = tabs[0];
        currentTab = tab;
        console.log('Current tab:', tab);

        // Check if we're on Reddit
        if (!tab.url || !tab.url.includes('reddit.com')) {
            showNotRedditMessage();
            return;
        }

        // Check if we're on a user profile page
        const username = extractUsernameFromUrl(tab.url);
        if (username) {
            currentUsername = username;
            currentUserEl.textContent = `u/${username}`;
            loadPostsBtn.disabled = false;
            loadCommentsBtn.disabled = false;

            // Clean up old states and try to restore current user's state
            await cleanupOldStates(username);
            const stateRestored = await restorePopupState(username);

            if (!stateRestored) {
                // Clear the default message only if no state was restored
                chatMessages.innerHTML = `
                    <div class="chat-message system">
                        Ready to analyze u/${username}! Load their posts or comments first.
                    </div>
                `;
            }
        } else {
            currentUserEl.textContent = 'Not on user profile';
            addChatMessage('system', 'Please navigate to a Reddit user profile page (e.g., reddit.com/user/username)');
        }

    } catch (error) {
        console.error('Error initializing popup:', error);
        addChatMessage('system', 'Error initializing extension. Please try again.');
    }
}

// Extract username from Reddit URL
function extractUsernameFromUrl(url) {
    const match = url.match(/reddit\.com\/(?:user|u)\/([^\/\?]+)/);
    return match ? match[1] : null;
}

// Show not Reddit message
function showNotRedditMessage() {
    notRedditMessage.style.display = 'block';
    mainContent.style.display = 'none';
}

// Add message to chat
function addChatMessage(type, content) {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${type}`;

    // For AI responses, parse markdown formatting
    if (type === 'ai') {
        messageEl.innerHTML = parseMarkdown(content);
    } else {
        messageEl.textContent = content;
    }

    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Simple markdown parser for basic formatting
function parseMarkdown(text) {
    // Escape HTML to prevent XSS
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // Parse markdown formatting
    html = html
        // Bold text: **text** or __text__
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')

        // Italic text: *text* or _text_
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')

        // Code blocks: ```code```
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')

        // Inline code: `code`
        .replace(/`([^`]+)`/g, '<code>$1</code>')

        // Line breaks
        .replace(/\n/g, '<br>');

    return html;
}

// Send message to content script
async function sendMessageToContentScript(message) {
    try {
        console.log('Sending message to content script:', message);
        console.log('Current tab:', currentTab);
        const response = await chrome.tabs.sendMessage(currentTab.id, message);
        console.log('Content script response:', response);
        return response;
    } catch (error) {
        console.error('Error sending message to content script:', error);
        console.error('Current tab ID:', currentTab?.id);
        console.error('Message was:', message);
        throw error;
    }
}

// Load user posts
async function loadPosts() {
    if (!currentUsername) return;

    loadPostsBtn.disabled = true;
    loadPostsBtn.textContent = 'Loading...';
    postsStatusEl.textContent = 'Loading...';

    try {
        console.log('Sending loadPosts message for:', currentUsername);
        const response = await sendMessageToContentScript({
            action: 'loadPosts',
            username: currentUsername
        });

        console.log('Received response:', response);

        if (response && response.success) {
            postsStatusEl.textContent = `${response.count} loaded`;
            addChatMessage('system', `Loaded ${response.count} posts successfully.`);
            await savePopupState();
        } else if (response && response.message && response.message.includes('Navigating')) {
            // Handle navigation case - don't show error, show navigation message
            postsStatusEl.textContent = 'Navigating...';
            addChatMessage('system', response.message);

            // Wait for navigation and try again
            setTimeout(async () => {
                try {
                    const retryResponse = await sendMessageToContentScript({
                        action: 'loadPosts',
                        username: currentUsername
                    });

                    if (retryResponse && retryResponse.success) {
                        postsStatusEl.textContent = `${retryResponse.count} loaded`;
                        addChatMessage('system', `Loaded ${retryResponse.count} posts successfully.`);
                        await savePopupState();
                    } else if (!retryResponse || !retryResponse.message || !retryResponse.message.includes('Navigating')) {
                        postsStatusEl.textContent = 'Error loading';
                        const errorMsg = retryResponse?.message || 'Error loading posts. Please try again.';
                        addChatMessage('system', errorMsg);
                    }
                } catch (retryError) {
                    console.error('Error in retry loadPosts:', retryError);
                    postsStatusEl.textContent = 'Error loading';
                    addChatMessage('system', 'Error loading posts after navigation. Please try again.');
                } finally {
                    loadPostsBtn.disabled = false;
                    loadPostsBtn.textContent = 'Load Posts';
                }
            }, 2000); // Wait 2 seconds for navigation to complete
            return; // Don't reset button state yet
        } else {
            postsStatusEl.textContent = 'Error loading';
            const errorMsg = response?.message || 'Error loading posts. Please try again.';
            addChatMessage('system', errorMsg);
            console.error('Load posts failed:', response);
        }
    } catch (error) {
        console.error('Error in loadPosts:', error);
        postsStatusEl.textContent = 'Error loading';
        addChatMessage('system', `Error: ${error.message}`);
    } finally {
        loadPostsBtn.disabled = false;
        loadPostsBtn.textContent = 'Load Posts';
    }
}

// Load user comments
async function loadComments() {
    if (!currentUsername) return;

    loadCommentsBtn.disabled = true;
    loadCommentsBtn.textContent = 'Loading...';
    commentsStatusEl.textContent = 'Loading...';

    try {
        console.log('Sending loadComments message for:', currentUsername);
        const response = await sendMessageToContentScript({
            action: 'loadComments',
            username: currentUsername
        });

        console.log('Received response:', response);

        if (response && response.success) {
            commentsStatusEl.textContent = `${response.count} loaded`;
            addChatMessage('system', `Loaded ${response.count} comments successfully.`);
            await savePopupState();
        } else if (response && response.message && response.message.includes('Navigating')) {
            // Handle navigation case - don't show error, show navigation message
            commentsStatusEl.textContent = 'Navigating...';
            addChatMessage('system', response.message);

            // Wait for navigation and try again
            setTimeout(async () => {
                try {
                    const retryResponse = await sendMessageToContentScript({
                        action: 'loadComments',
                        username: currentUsername
                    });

                    if (retryResponse && retryResponse.success) {
                        commentsStatusEl.textContent = `${retryResponse.count} loaded`;
                        addChatMessage('system', `Loaded ${retryResponse.count} comments successfully.`);
                        await savePopupState();
                    } else if (!retryResponse || !retryResponse.message || !retryResponse.message.includes('Navigating')) {
                        commentsStatusEl.textContent = 'Error loading';
                        const errorMsg = retryResponse?.message || 'Error loading comments. Please try again.';
                        addChatMessage('system', errorMsg);
                    }
                } catch (retryError) {
                    console.error('Error in retry loadComments:', retryError);
                    commentsStatusEl.textContent = 'Error loading';
                    addChatMessage('system', 'Error loading comments after navigation. Please try again.');
                } finally {
                    loadCommentsBtn.disabled = false;
                    loadCommentsBtn.textContent = 'Load Comments';
                }
            }, 2000); // Wait 2 seconds for navigation to complete
            return; // Don't reset button state yet
        } else {
            commentsStatusEl.textContent = 'Error loading';
            const errorMsg = response?.message || 'Error loading comments. Please try again.';
            addChatMessage('system', errorMsg);
            console.error('Load comments failed:', response);
        }
    } catch (error) {
        console.error('Error in loadComments:', error);
        commentsStatusEl.textContent = 'Error loading';
        addChatMessage('system', `Error: ${error.message}`);
    } finally {
        loadCommentsBtn.disabled = false;
        loadCommentsBtn.textContent = 'Load Comments';
    }
}

// Send chat message
async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message || !currentUsername) return;

    // Add user message
    addChatMessage('user', message);

    // Clear input and disable send button
    chatInput.value = '';
    sendBtn.disabled = true;

    try {
        console.log('Sending analyzeProfile message:', { action: 'analyzeProfile', username: currentUsername, question: message });

        // Send to background script for AI analysis
        const response = await chrome.runtime.sendMessage({
            action: 'analyzeProfile',
            username: currentUsername,
            question: message
        });

        console.log('Received analyzeProfile response:', response);

        if (response && response.answer) {
            addChatMessage('ai', response.answer);
            await savePopupState();
        } else if (response && response.error) {
            addChatMessage('system', `Error: ${response.error}`);
            await savePopupState();
        } else {
            addChatMessage('system', 'No response received. Please check your API configuration in the options.');
            await savePopupState();
            console.error('Unexpected response format:', response);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        addChatMessage('system', `Error processing your question: ${error.message}`);
        await savePopupState();
    }
}

// Open options page
function openOptionsPage() {
    chrome.runtime.openOptionsPage();
}

// Event listeners
loadPostsBtn.addEventListener('click', loadPosts);
loadCommentsBtn.addEventListener('click', loadComments);
sendBtn.addEventListener('click', sendChatMessage);
document.getElementById('optionsBtn').addEventListener('click', openOptionsPage);

chatInput.addEventListener('input', (e) => {
    sendBtn.disabled = !e.target.value.trim();
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) {
            sendChatMessage();
        }
    }
});

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', initializePopup);