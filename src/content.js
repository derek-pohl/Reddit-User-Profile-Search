// Reddit User Profile Search - Content Script
// webextension-polyfill.js is loaded before this script in manifest.json

let isExtensionEnabled = true;
let currentUsername = null;
let analysisUI = null;

// Function to detect if we're on a Reddit user profile page
function detectUserProfile() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    // Match user profile URLs: /user/username or /u/username
    const userMatch = pathname.match(/^\/(?:user|u)\/([^\/]+)(?:\/.*)?$/);
    if (userMatch) {
        return userMatch[1]; // Return username
    }
    return null;
}

// Function to check if we're on posts or comments page
function getProfileSection() {
    const pathname = window.location.pathname;
    if (pathname.includes('/submitted')) return 'posts';
    if (pathname.includes('/comments')) return 'comments';
    return 'overview'; // Default profile view
}

// Function to extract posts from the submitted page
async function extractPosts(username) {
    const posts = [];

    // Navigate to submitted page if not already there
    const submittedUrl = `https://www.reddit.com/user/${username}/submitted/`;
    if (!window.location.href.includes('/submitted')) {
        // Auto-navigate to the submitted page
        window.location.href = submittedUrl;
        return { posts: [], needsNavigation: submittedUrl };
    }

    // Extract posts from current page using updated selectors
    const postElements = document.querySelectorAll('shreddit-post');

    for (const postEl of postElements) {
        try {
            // Updated selectors based on actual Reddit HTML structure
            const titleEl = postEl.querySelector('a[slot="title"], #post-title-t3_\\w+');
            const subredditEl = postEl.querySelector('[data-testid="subreddit-name"]');
            const scoreEl = postEl.querySelector('[score]');
            const timeEl = postEl.querySelector('faceplate-timeago time');
            const bodyEl = postEl.querySelector('[slot="text-body"] .md, [id$="-post-rtjson-content"]');

            // Get post attributes directly from shreddit-post element
            const postTitle = postEl.getAttribute('post-title') || titleEl?.textContent?.trim() || '';
            const subredditName = postEl.getAttribute('subreddit-prefixed-name') || subredditEl?.textContent?.trim() || '';
            const postScore = postEl.getAttribute('score') || extractScore(scoreEl?.textContent || '0');
            const createdTimestamp = postEl.getAttribute('created-timestamp') || timeEl?.getAttribute('datetime') || '';
            const postBody = bodyEl?.textContent?.trim() || '';
            const postUrl = postEl.getAttribute('permalink') || titleEl?.href || '';

            if (postTitle) {
                posts.push({
                    title: postTitle,
                    subreddit: subredditName.replace('r/', ''),
                    score: typeof postScore === 'string' ? parseInt(postScore, 10) : postScore,
                    time: createdTimestamp,
                    body: postBody,
                    url: postUrl.startsWith('/') ? `https://www.reddit.com${postUrl}` : postUrl
                });
            }
        } catch (error) {
            console.log('Error extracting post:', error);
        }
    }

    return { posts, needsNavigation: null };
}

// Function to extract comments from the comments page
async function extractComments(username) {
    const comments = [];

    // Navigate to comments page if not already there
    const commentsUrl = `https://www.reddit.com/user/${username}/comments/`;
    if (!window.location.href.includes('/comments')) {
        // Auto-navigate to the comments page
        window.location.href = commentsUrl;
        return { comments: [], needsNavigation: commentsUrl };
    }

    // Extract comments from current page using updated selectors
    const commentElements = document.querySelectorAll('shreddit-profile-comment');

    for (const commentEl of commentElements) {
        try {
            // Updated selectors based on actual Reddit HTML structure
            const bodyEl = commentEl.querySelector('[id$="-post-rtjson-content"], .md');
            const subredditEl = commentEl.querySelector('[data-testid="subreddit-name"], [data-testid="location-anchor"]');
            const scoreEl = commentEl.querySelector('shreddit-comment-action-row[score]');
            const timeEl = commentEl.querySelector('faceplate-timeago time');
            const postTitleEl = commentEl.querySelector('h2 a, [class*="text-neutral-content-strong font-normal"]');

            // Get comment attributes and content
            const commentId = commentEl.getAttribute('comment-id') || '';
            const commentBody = bodyEl?.textContent?.trim() || '';
            const subredditName = subredditEl?.textContent?.trim() || '';
            const commentScore = scoreEl?.getAttribute('score') || '0';
            const commentTime = timeEl?.getAttribute('datetime') || timeEl?.textContent || '';
            const postTitle = postTitleEl?.textContent?.trim() || '';
            const commentUrl = commentEl.getAttribute('href') || '';

            if (commentBody) {
                comments.push({
                    body: commentBody,
                    subreddit: subredditName.replace('r/', ''),
                    score: parseInt(commentScore, 10) || 0,
                    time: commentTime,
                    context: postTitle,
                    url: commentUrl.startsWith('/') ? `https://www.reddit.com${commentUrl}` : commentUrl,
                    id: commentId
                });
            }
        } catch (error) {
            console.log('Error extracting comment:', error);
        }
    }

    return { comments, needsNavigation: null };
}

// Helper function to extract numeric score from text
function extractScore(scoreText) {
    const match = scoreText.match(/(-?\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

// Function to create the analysis UI
function createAnalysisUI(username) {
    console.log('Creating UI for username:', username);

    // Remove existing UI if present
    const existing = document.getElementById('reddit-profile-search');
    if (existing) {
        existing.remove();
    }

    // Create main container with inline styles for maximum visibility
    const ui = document.createElement('div');
    ui.id = 'reddit-profile-search';
    ui.style.cssText = `
        position: fixed !important;
        top: 80px !important;
        right: 20px !important;
        width: 350px !important;
        background: #ffffff !important;
        border: 3px solid #ff4500 !important;
        border-radius: 12px !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
        z-index: 999999 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        color: #1a1a1b !important;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
        background: #ff4500 !important;
        color: white !important;
        padding: 12px 16px !important;
        border-radius: 9px 9px 0 0 !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
    `;

    const title = document.createElement('h3');
    title.textContent = `🔍 Profile Search - u/${username}`;
    title.style.cssText = `
        margin: 0 !important;
        font-size: 16px !important;
        font-weight: 600 !important;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        background: none !important;
        border: none !important;
        color: white !important;
        font-size: 24px !important;
        cursor: pointer !important;
        padding: 0 !important;
        width: 30px !important;
        height: 30px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    `;

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Create content area
    const content = document.createElement('div');
    content.style.cssText = `
        padding: 16px !important;
    `;

    // Create action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex !important;
        gap: 8px !important;
        margin-bottom: 16px !important;
    `;

    const loadPostsBtn = document.createElement('button');
    loadPostsBtn.textContent = 'Load Posts';
    loadPostsBtn.style.cssText = `
        flex: 1 !important;
        background: #0079d3 !important;
        color: white !important;
        border: none !important;
        padding: 10px 12px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-size: 13px !important;
        font-weight: 500 !important;
    `;

    const loadCommentsBtn = document.createElement('button');
    loadCommentsBtn.textContent = 'Load Comments';
    loadCommentsBtn.style.cssText = `
        flex: 1 !important;
        background: #46d160 !important;
        color: white !important;
        border: none !important;
        padding: 10px 12px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-size: 13px !important;
        font-weight: 500 !important;
    `;

    buttonContainer.appendChild(loadPostsBtn);
    buttonContainer.appendChild(loadCommentsBtn);

    // Create status display
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = `
        background: #f8f9fa !important;
        padding: 12px !important;
        border-radius: 6px !important;
        margin-bottom: 16px !important;
        font-size: 13px !important;
    `;
    statusDiv.innerHTML = `
        <div style="margin-bottom: 4px !important;">
            <strong>Posts:</strong> <span id="postsCount">Not loaded</span>
        </div>
        <div>
            <strong>Comments:</strong> <span id="commentsCount">Not loaded</span>
        </div>
    `;

    // Create chat area
    const chatMessages = document.createElement('div');
    chatMessages.id = 'chatMessages';
    chatMessages.style.cssText = `
        height: 200px !important;
        border: 1px solid #e0e0e0 !important;
        border-radius: 6px !important;
        padding: 12px !important;
        overflow-y: auto !important;
        background: #fafafa !important;
        margin-bottom: 12px !important;
        font-size: 13px !important;
    `;

    // Create input area
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
        display: flex !important;
        gap: 8px !important;
    `;

    const chatInput = document.createElement('textarea');
    chatInput.id = 'chatInput';
    chatInput.placeholder = 'Ask about this user...';
    chatInput.style.cssText = `
        flex: 1 !important;
        border: 1px solid #ccc !important;
        border-radius: 6px !important;
        padding: 8px !important;
        resize: vertical !important;
        min-height: 36px !important;
        max-height: 100px !important;
        font-family: inherit !important;
        font-size: 13px !important;
    `;

    const sendBtn = document.createElement('button');
    sendBtn.id = 'sendMessage';
    sendBtn.textContent = 'Send';
    sendBtn.disabled = true;
    sendBtn.style.cssText = `
        background: #ff4500 !important;
        color: white !important;
        border: none !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        height: fit-content !important;
        align-self: flex-end !important;
    `;

    inputContainer.appendChild(chatInput);
    inputContainer.appendChild(sendBtn);

    // Assemble the UI
    content.appendChild(buttonContainer);
    content.appendChild(statusDiv);
    content.appendChild(chatMessages);
    content.appendChild(inputContainer);

    ui.appendChild(header);
    ui.appendChild(content);

    // Add to page
    document.body.appendChild(ui);
    console.log('UI added to page');

    // Add event listeners
    closeBtn.onclick = () => {
        ui.remove();
        analysisUI = null;
        console.log('UI closed');
    };

    loadPostsBtn.onclick = () => {
        console.log('Load posts clicked');
        loadUserPosts(username);
    };

    loadCommentsBtn.onclick = () => {
        console.log('Load comments clicked');
        loadUserComments(username);
    };

    sendBtn.onclick = sendChatMessage;

    chatInput.oninput = (e) => {
        sendBtn.disabled = !e.target.value.trim();
        sendBtn.style.background = sendBtn.disabled ? '#ccc !important' : '#ff4500 !important';
    };

    chatInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) sendChatMessage();
        }
    };

    // Add initial message
    addChatMessage('system', `Ready to analyze u/${username}! Load their posts or comments first.`);

    analysisUI = ui;
    return ui;
}

// Function to load user posts
async function loadUserPosts(username) {
    const loadBtn = document.getElementById('loadPosts');
    const countEl = document.getElementById('postsCount');

    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading...';
    countEl.textContent = 'Loading...';

    try {
        const result = await extractPosts(username);

        if (result.needsNavigation) {
            countEl.textContent = 'Navigating...';
            addChatMessage('system', `Navigating to posts page...`);
            // The navigation happens in extractPosts, so we just wait
            return;
        }

        countEl.textContent = `${result.posts.length} loaded`;
        loadBtn.textContent = 'Reload Posts';
        loadBtn.disabled = false;

        // Send posts to background script
        browser.runtime.sendMessage({
            action: 'storePosts',
            username: username,
            posts: result.posts
        });

        addChatMessage('system', `Loaded ${result.posts.length} posts. You can now ask questions about them.`);

    } catch (error) {
        console.error('Error loading posts:', error);
        countEl.textContent = 'Error loading';
        loadBtn.textContent = 'Retry';
        loadBtn.disabled = false;
        addChatMessage('system', 'Error loading posts. Please try again.');
    }
}

// Function to load user comments
async function loadUserComments(username) {
    const loadBtn = document.getElementById('loadComments');
    const countEl = document.getElementById('commentsCount');

    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading...';
    countEl.textContent = 'Loading...';

    try {
        const result = await extractComments(username);

        if (result.needsNavigation) {
            countEl.textContent = 'Navigating...';
            addChatMessage('system', `Navigating to comments page...`);
            // The navigation happens in extractComments, so we just wait
            return;
        }

        countEl.textContent = `${result.comments.length} loaded`;
        loadBtn.textContent = 'Reload Comments';
        loadBtn.disabled = false;

        // Send comments to background script
        browser.runtime.sendMessage({
            action: 'storeComments',
            username: username,
            comments: result.comments
        });

        addChatMessage('system', `Loaded ${result.comments.length} comments. You can now ask questions about them.`);

    } catch (error) {
        console.error('Error loading comments:', error);
        countEl.textContent = 'Error loading';
        loadBtn.textContent = 'Retry';
        loadBtn.disabled = false;
        addChatMessage('system', 'Error loading comments. Please try again.');
    }
}

// Function to add chat message
function addChatMessage(type, content) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${type}`;
    
    // For AI responses, parse markdown formatting
    if (type === 'ai') {
        messageEl.innerHTML = parseMarkdown(content);
    } else {
        messageEl.textContent = content;
    }

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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

// Function to send chat message
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendMessage');
    const message = input.value.trim();

    if (!message) return;

    // Add user message
    addChatMessage('user', message);

    // Clear input and disable send button
    input.value = '';
    sendBtn.disabled = true;

    try {
        // Send to background script for AI analysis
        const response = await browser.runtime.sendMessage({
            action: 'analyzeProfile',
            username: currentUsername,
            question: message
        });

        if (response && response.answer) {
            addChatMessage('ai', response.answer);
        } else {
            addChatMessage('system', 'No response received. Please check your API configuration.');
        }

    } catch (error) {
        console.error('Error sending message:', error);
        addChatMessage('system', 'Error processing your question. Please try again.');
    }
}

// Function to check if extension is enabled
async function checkExtensionStatus() {
    try {
        const result = await browser.storage.sync.get(['extensionEnabled']);
        isExtensionEnabled = result.extensionEnabled !== false; // Default to true
    } catch (error) {
        console.error('Error checking extension status:', error);
        isExtensionEnabled = true;
    }
}

// Main function to initialize the extension
async function initializeExtension() {
    console.log('Reddit Profile Search: Initializing extension...');
    console.log('Current URL:', window.location.href);
    console.log('Current pathname:', window.location.pathname);

    await checkExtensionStatus();
    console.log('Extension enabled:', isExtensionEnabled);

    if (!isExtensionEnabled) {
        console.log('Extension is disabled, exiting');
        return;
    }

    const username = detectUserProfile();
    console.log('Detected username:', username);

    // Update current username but don't auto-create UI
    if (username) {
        currentUsername = username;
        console.log('Ready for user:', username);
    } else {
        currentUsername = null;
        // Remove UI if we're not on a profile page
        if (analysisUI) {
            console.log('Not on profile page, removing UI');
            analysisUI.remove();
            analysisUI = null;
        }
    }
}

// Function to toggle UI visibility
function toggleUI() {
    console.log('Toggle UI called');
    
    if (!currentUsername) {
        console.log('No username detected, cannot show UI');
        return;
    }
    
    if (analysisUI) {
        console.log('UI exists, removing it');
        analysisUI.remove();
        analysisUI = null;
    } else {
        console.log('Creating UI for user:', currentUsername);
        createAnalysisUI(currentUsername);
    }
}

// Listen for URL changes
let currentUrl = window.location.href;

function handleUrlChange() {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        setTimeout(initializeExtension, 500); // Small delay for page to load
    }
}

// Override pushState and replaceState
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function (...args) {
    originalPushState.apply(history, args);
    handleUrlChange();
};

history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    handleUrlChange();
};

// Listen for popstate events
window.addEventListener('popstate', handleUrlChange);

// Listen for messages from background script and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleExtension') {
        isExtensionEnabled = message.enabled;
        if (!isExtensionEnabled && analysisUI) {
            analysisUI.remove();
            analysisUI = null;
            currentUsername = null;
        } else if (isExtensionEnabled) {
            initializeExtension();
        }
    } else if (message.action === 'toggleUI') {
        console.log('Received toggleUI message');
        toggleUI();
    } else if (message.action === 'loadPosts') {
        console.log('Received loadPosts message for:', message.username);
        handleLoadPosts(message.username).then(sendResponse);
        return true; // Keep message channel open for async response
    } else if (message.action === 'loadComments') {
        console.log('Received loadComments message for:', message.username);
        handleLoadComments(message.username).then(sendResponse);
        return true; // Keep message channel open for async response
    }
});

// Handle load posts request from popup
async function handleLoadPosts(username) {
    try {
        const result = await extractPosts(username);
        
        if (result.needsNavigation) {
            // Navigate to posts page
            window.location.href = result.needsNavigation;
            return { success: false, message: 'Navigating to posts page...' };
        }
        
        // Send posts to background script
        await browser.runtime.sendMessage({
            action: 'storePosts',
            username: username,
            posts: result.posts
        });
        
        return { success: true, count: result.posts.length };
    } catch (error) {
        console.error('Error loading posts:', error);
        return { success: false, message: 'Error loading posts' };
    }
}

// Handle load comments request from popup
async function handleLoadComments(username) {
    try {
        const result = await extractComments(username);
        
        if (result.needsNavigation) {
            // Navigate to comments page
            window.location.href = result.needsNavigation;
            return { success: false, message: 'Navigating to comments page...' };
        }
        
        // Send comments to background script
        await browser.runtime.sendMessage({
            action: 'storeComments',
            username: username,
            comments: result.comments
        });
        
        return { success: true, count: result.comments.length };
    } catch (error) {
        console.error('Error loading comments:', error);
        return { success: false, message: 'Error loading comments' };
    }
}

// Add a visible test indicator
function addTestIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'reddit-extension-test';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        background: red;
        color: white;
        padding: 5px 10px;
        z-index: 99999;
        font-size: 12px;
        border-radius: 3px;
    `;
    indicator.textContent = 'Reddit Extension Loaded';
    document.body.appendChild(indicator);

    // Remove after 3 seconds
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired');
    addTestIndicator();
    initializeExtension();
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded fired (loading state)');
        addTestIndicator();
        initializeExtension();
    });
} else {
    console.log('Document already loaded, initializing immediately');
    addTestIndicator();
    initializeExtension();
}