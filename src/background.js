// Reddit User Profile Search - Background Script
import "./lib/webextension-polyfill.js";

// Storage for user data
const userDataCache = new Map();

// Rate limiting for API calls
class RateLimiter {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.rateLimit = 60;
        this.lastRequestTime = 0;
    }

    async updateRateLimit() {
        const { rateLimit } = await browser.storage.sync.get(['rateLimit']);
        this.rateLimit = rateLimit || 60;
    }

    async addToQueue(request) {
        return new Promise((resolve, reject) => {
            this.queue.push({ request, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;
        try {
            await this.updateRateLimit();

            while (this.queue.length > 0) {
                const { request, resolve, reject } = this.queue.shift();
                
                try {
                    const now = Date.now();
                    const timeSinceLastRequest = now - this.lastRequestTime;
                    const minInterval = 60000 / this.rateLimit;
                    const delay = Math.max(0, minInterval - timeSinceLastRequest);

                    if (delay > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    this.lastRequestTime = Date.now();
                    const result = await request();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }
        } catch (error) {
            console.error("Profile Analyzer: Error processing queue.", error);
            this.queue.forEach(item => item.reject(error));
            this.queue = [];
        } finally {
            this.processing = false;
        }
    }
}

const rateLimiter = new RateLimiter();

// Message handler
browser.runtime.onMessage.addListener(async (message, sender) => {
    try {
        switch (message.action) {
            case 'storePosts':
                return await handleStorePosts(message);
            
            case 'storeComments':
                return await handleStoreComments(message);
            
            case 'analyzeProfile':
                return await handleAnalyzeProfile(message);
            
            case 'getStoredData':
                return await handleGetStoredData(message);
            
            default:
                console.log('Unknown action:', message.action);
                return { error: 'Unknown action' };
        }
    } catch (error) {
        console.error('Error handling message:', error);
        return { error: error.message };
    }
});

// Handle storing posts
async function handleStorePosts(message) {
    const { username, posts } = message;
    
    if (!userDataCache.has(username)) {
        userDataCache.set(username, {});
    }
    
    const userData = userDataCache.get(username);
    userData.posts = posts;
    userData.postsLoadedAt = new Date().toISOString();
    
    console.log(`Profile Analyzer: Stored ${posts.length} posts for u/${username}`);
    return { success: true, count: posts.length };
}

// Handle storing comments
async function handleStoreComments(message) {
    const { username, comments } = message;
    
    if (!userDataCache.has(username)) {
        userDataCache.set(username, {});
    }
    
    const userData = userDataCache.get(username);
    userData.comments = comments;
    userData.commentsLoadedAt = new Date().toISOString();
    
    console.log(`Profile Analyzer: Stored ${comments.length} comments for u/${username}`);
    return { success: true, count: comments.length };
}

// Handle profile analysis
async function handleAnalyzeProfile(message) {
    const { username, question } = message;
    
    // Get API configuration
    const { apiKey, baseUrl, model } = await browser.storage.sync.get(['apiKey', 'baseUrl', 'model']);
    
    if (!apiKey) {
        return { error: 'API key not configured. Please set it in the extension options.' };
    }
    
    if (!baseUrl) {
        return { error: 'Base URL not configured. Please set it in the extension options.' };
    }
    
    if (!model) {
        return { error: 'Model not configured. Please set it in the extension options.' };
    }
    
    // Get user data
    const userData = userDataCache.get(username);
    if (!userData || (!userData.posts && !userData.comments)) {
        return { error: 'No data loaded for this user. Please load posts or comments first.' };
    }
    
    try {
        const response = await rateLimiter.addToQueue(() => 
            callGeminiApi(username, userData, question, apiKey, baseUrl, model)
        );
        
        return { answer: response };
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return { error: `API Error: ${error.message}` };
    }
}

// Handle getting stored data
async function handleGetStoredData(message) {
    const { username } = message;
    const userData = userDataCache.get(username);
    
    return {
        posts: userData?.posts || [],
        comments: userData?.comments || [],
        postsLoadedAt: userData?.postsLoadedAt,
        commentsLoadedAt: userData?.commentsLoadedAt
    };
}

// Call Gemini API
async function callGeminiApi(username, userData, question, apiKey, baseUrl, model) {
    // Prepare the context from user data
    let context = `You are analyzing the Reddit profile of user "u/${username}". `;
    
    if (userData.posts && userData.posts.length > 0) {
        context += `\n\nPOSTS (${userData.posts.length} total):\n`;
        userData.posts.slice(0, 50).forEach((post, index) => {
            context += `${index + 1}. [${post.subreddit}] "${post.title}" (${post.score} points)\n`;
            if (post.body) {
                context += `   Body: ${post.body.substring(0, 200)}${post.body.length > 200 ? '...' : ''}\n`;
            }
        });
        
        if (userData.posts.length > 50) {
            context += `... and ${userData.posts.length - 50} more posts\n`;
        }
    }
    
    if (userData.comments && userData.comments.length > 0) {
        context += `\n\nCOMMENTS (${userData.comments.length} total):\n`;
        userData.comments.slice(0, 50).forEach((comment, index) => {
            context += `${index + 1}. [${comment.subreddit}] ${comment.body.substring(0, 150)}${comment.body.length > 150 ? '...' : ''} (${comment.score} points)\n`;
        });
        
        if (userData.comments.length > 50) {
            context += `... and ${userData.comments.length - 50} more comments\n`;
        }
    }
    
    context += `\n\nUser Question: ${question}\n\nPlease provide a helpful analysis based on the available data. Be specific and reference actual posts/comments when relevant.`;
    
    // Prepare API URL
    let apiUrl = baseUrl;
    if (apiUrl.endsWith('/')) {
        apiUrl = apiUrl.slice(0, -1);
    }
    
    // Handle different API endpoints
    if (apiUrl.includes('generativelanguage.googleapis.com')) {
        // Gemini API endpoint
        apiUrl = `${apiUrl}/models/${model}:generateContent`;
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: context
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000
            }
        };
        
        const response = await fetch(`${apiUrl}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Unexpected response format from Gemini API');
        }
    } else {
        // OpenAI-compatible API endpoint
        apiUrl = `${apiUrl}/chat/completions`;
        
        const requestBody = {
            model: model,
            messages: [{
                role: "user",
                content: context
            }],
            temperature: 0.7,
            max_tokens: 1000
        };
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content;
        } else {
            throw new Error('Unexpected response format from API');
        }
    }
}

// Handle keyboard commands
browser.commands.onCommand.addListener(async (command) => {
    switch (command) {
        case 'toggle-extension':
            const { extensionEnabled } = await browser.storage.sync.get(['extensionEnabled']);
            const newState = !extensionEnabled;
            await browser.storage.sync.set({ extensionEnabled: newState });
            
            // Notify all tabs
            const tabs = await browser.tabs.query({ url: "*://*.reddit.com/*" });
            for (const tab of tabs) {
                try {
                    await browser.tabs.sendMessage(tab.id, {
                        action: 'toggleExtension',
                        enabled: newState
                    });
                } catch (error) {
                    // Tab might not have content script loaded
                }
            }
            break;
            
        case 'analyze-profile':
            // This would trigger analysis on the current tab
            const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
            if (activeTab && activeTab.url.includes('reddit.com')) {
                try {
                    await browser.tabs.sendMessage(activeTab.id, {
                        action: 'triggerAnalysis'
                    });
                } catch (error) {
                    console.log('Could not trigger analysis on current tab');
                }
            }
            break;
    }
});

// Clean up old data periodically (every hour)
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [username, userData] of userDataCache.entries()) {
        const postsAge = userData.postsLoadedAt ? new Date(userData.postsLoadedAt).getTime() : 0;
        const commentsAge = userData.commentsLoadedAt ? new Date(userData.commentsLoadedAt).getTime() : 0;
        
        // Remove data older than 1 hour
        if (postsAge < oneHourAgo && commentsAge < oneHourAgo) {
            userDataCache.delete(username);
            console.log(`Profile Analyzer: Cleaned up old data for u/${username}`);
        }
    }
}, 60 * 60 * 1000); // Run every hour