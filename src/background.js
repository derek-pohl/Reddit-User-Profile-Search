// Reddit User Profile Search - Background Script
importScripts('./lib/webextension-polyfill.js');

// Storage for user data
const userDataCache = new Map();

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);

    // Handle async operations
    (async () => {
        try {
            let result;
            switch (message.action) {
                case 'storePosts':
                    result = await handleStorePosts(message);
                    break;

                case 'storeComments':
                    result = await handleStoreComments(message);
                    break;

                case 'analyzeProfile':
                    result = await handleAnalyzeProfile(message);
                    break;

                default:
                    console.log('Unknown message action:', message.action);
                    result = { error: 'Unknown action' };
            }
            sendResponse(result);
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    })();

    // Return true to indicate we'll send a response asynchronously
    return true;
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

    console.log(`Stored ${posts.length} posts for u/${username}`);
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

    console.log(`Stored ${comments.length} comments for u/${username}`);
    return { success: true, count: comments.length };
}

// Handle profile analysis
async function handleAnalyzeProfile(message) {
    console.log('Analyzing profile:', message);
    const { username, question } = message;

    // Get API key
    const { apiKey } = await chrome.storage.sync.get(['apiKey']);
    console.log('API key:', apiKey ? 'SET' : 'NOT SET');

    if (!apiKey) {
        return { error: 'API key not configured. Please set it in the extension options.' };
    }

    // Get user data
    const userData = userDataCache.get(username);
    console.log('User data:', userData ? {
        hasPosts: !!userData.posts,
        postsCount: userData.posts?.length || 0,
        hasComments: !!userData.comments,
        commentsCount: userData.comments?.length || 0
    } : 'NO DATA');

    if (!userData || (!userData.posts && !userData.comments)) {
        return { error: 'No data loaded for this user. Please load posts or comments first.' };
    }

    try {
        console.log('Calling Gemini API...');
        const response = await callGeminiAPI(username, userData, question, apiKey);
        console.log('API response received');
        return { answer: response };
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return { error: `API Error: ${error.message}` };
    }
}

// Call Gemini API using the new @google/genai library approach
async function callGeminiAPI(username, userData, question, apiKey) {
    console.log('callGeminiAPI called with:', { username, question, apiKey: apiKey ? 'SET' : 'NOT SET' });

    // Prepare the context from user data
    let context = `You are analyzing the Reddit profile of user "u/${username}". `;

    if (userData.posts && userData.posts.length > 0) {
        context += `\n\nPOSTS (${userData.posts.length} total):\n`;
        userData.posts.forEach((post, index) => {
            context += `${index + 1}. [${post.subreddit}] "${post.title}" (${post.score} points)\n`;
            if (post.body) {
                context += `   Body: ${post.body.substring(0, 200)}${post.body.length > 200 ? '...' : ''}\n`;
            }
        });
    }

    if (userData.comments && userData.comments.length > 0) {
        context += `\n\nCOMMENTS (${userData.comments.length} total):\n`;
        userData.comments.forEach((comment, index) => {
            context += `${index + 1}. [${comment.subreddit}] ${comment.body.substring(0, 150)}${comment.body.length > 150 ? '...' : ''} (${comment.score} points)\n`;
        });
    }

    context += `\n\nUser Question: ${question}\n\nPlease provide a helpful analysis based on the available data. Be specific and reference actual posts/comments if needed.\n\nIMPORTANT: Format your response using markdown (use **bold** for emphasis, *italics* for highlights, \`code\` for usernames/subreddits, and bullet points for lists). Keep your response concise, unless if you feel as if it should be longer.`;

    console.log('Context prepared, length:', context.length);
    console.log('Making API call to Gemini...');

    try {
        // Use the new Google GenAI library format with correct model and endpoint
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: context
                    }]
                }],
                generationConfig: {
                    temperature: 0.7
                }
            })
        });

        console.log('API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`Gemini API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        console.log('API response data:', data);

        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            const result = data.candidates[0].content.parts[0].text;
            console.log('Extracted result:', result);
            return result;
        } else {
            console.error('Unexpected response format:', data);
            throw new Error('Unexpected response format from Gemini API');
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw error;
    }
}



console.log('Reddit User Profile Search background script loaded');