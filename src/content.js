// Reddit User Profile Search - Content Script
import "./lib/webextension-polyfill.js";

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
    if (analysisUI) {
        analysisUI.remove();
    }
    
    const ui = document.createElement('div');
    ui.id = 'reddit-profile-analyzer';
    ui.innerHTML = `
        <div class="analyzer-container">
            <div class="analyzer-header">
                <h3>🔍 Profile Analyzer - u/${username}</h3>
                <button class="close-btn" id="closeAnalyzer">×</button>
            </div>
            <div class="analyzer-content">
                <div class="data-status">
                    <div class="status-item">
                        <span class="status-label">Posts:</span>
                        <span class="status-value" id="postsCount">Loading...</span>
                        <button class="load-btn" id="loadPosts">Load Posts</button>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Comments:</span>
                        <span class="status-value" id="commentsCount">Loading...</span>
                        <button class="load-btn" id="loadComments">Load Comments</button>
                    </div>
                </div>
                <div class="chat-container">
                    <div class="chat-messages" id="chatMessages"></div>
                    <div class="chat-input-container">
                        <textarea id="chatInput" placeholder="Ask something about this user's profile..." rows="2"></textarea>
                        <button id="sendMessage" disabled>Send</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        #reddit-profile-analyzer {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            max-height: 600px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .analyzer-container {
            display: flex;
            flex-direction: column;
            height: 100%;
        }
        
        .analyzer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            border-radius: 8px 8px 0 0;
        }
        
        .analyzer-header h3 {
            margin: 0;
            font-size: 16px;
            color: #333;
        }
        
        .close-btn {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .analyzer-content {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            max-height: 500px;
            overflow: hidden;
        }
        
        .data-status {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }
        
        .status-label {
            font-weight: 600;
            min-width: 80px;
        }
        
        .status-value {
            color: #666;
            flex: 1;
        }
        
        .load-btn {
            background: #0079d3;
            color: white;
            border: none;
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .load-btn:hover {
            background: #0066cc;
        }
        
        .load-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .chat-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            flex: 1;
            min-height: 200px;
        }
        
        .chat-messages {
            flex: 1;
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 12px;
            background: #fafafa;
        }
        
        .chat-message {
            margin-bottom: 12px;
            padding: 8px;
            border-radius: 4px;
        }
        
        .chat-message.user {
            background: #e3f2fd;
            margin-left: 20px;
        }
        
        .chat-message.ai {
            background: #f1f8e9;
            margin-right: 20px;
        }
        
        .chat-message.system {
            background: #fff3e0;
            font-style: italic;
            text-align: center;
        }
        
        .chat-input-container {
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }
        
        #chatInput {
            flex: 1;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 8px;
            resize: vertical;
            font-family: inherit;
        }
        
        #sendMessage {
            background: #0079d3;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        
        #sendMessage:hover:not(:disabled) {
            background: #0066cc;
        }
        
        #sendMessage:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        @media (prefers-color-scheme: dark) {
            #reddit-profile-analyzer {
                background: #1a1a1b;
                border-color: #343536;
                color: #d7dadc;
            }
            
            .analyzer-header {
                background: #272729;
                border-color: #343536;
            }
            
            .analyzer-header h3 {
                color: #d7dadc;
            }
            
            .chat-messages {
                background: #272729;
                border-color: #343536;
            }
            
            #chatInput {
                background: #272729;
                border-color: #343536;
                color: #d7dadc;
            }
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(ui);
    
    // Add event listeners
    document.getElementById('closeAnalyzer').addEventListener('click', () => {
        ui.remove();
        analysisUI = null;
    });
    
    document.getElementById('loadPosts').addEventListener('click', () => loadUserPosts(username));
    document.getElementById('loadComments').addEventListener('click', () => loadUserComments(username));
    document.getElementById('sendMessage').addEventListener('click', sendChatMessage);
    
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    document.getElementById('chatInput').addEventListener('input', (e) => {
        const sendBtn = document.getElementById('sendMessage');
        sendBtn.disabled = !e.target.value.trim();
    });
    
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
    messageEl.textContent = content;
    
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
    await checkExtensionStatus();
    
    if (!isExtensionEnabled) {
        return;
    }
    
    const username = detectUserProfile();
    if (username && username !== currentUsername) {
        currentUsername = username;
        
        // Create analysis UI
        createAnalysisUI(username);
        
        // Auto-load data based on current page
        const section = getProfileSection();
        if (section === 'posts') {
            setTimeout(() => loadUserPosts(username), 2000);
        } else if (section === 'comments') {
            setTimeout(() => loadUserComments(username), 2000);
        }
    } else if (!username && analysisUI) {
        // Not on a profile page, remove UI
        analysisUI.remove();
        analysisUI = null;
        currentUsername = null;
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

history.pushState = function(...args) {
    originalPushState.apply(history, args);
    handleUrlChange();
};

history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    handleUrlChange();
};

// Listen for popstate events
window.addEventListener('popstate', handleUrlChange);

// Listen for messages from background script
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
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeExtension);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}