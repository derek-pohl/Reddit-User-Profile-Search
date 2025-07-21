import "./lib/webextension-polyfill.js";

const MAX_LOG_ENTRIES = 50;

// Rate limiting implementation
class RateLimiter {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.rateLimit = 60; // requests per minute
        this.lastRequestTime = 0;
    }

    async updateRateLimit() {
        const { rateLimit } = await browser.storage.sync.get(['rateLimit']);
        this.rateLimit = rateLimit || 60;
    }

    async addToQueue(request, tabId) {
        return new Promise((resolve, reject) => {
            this.queue.push({ request, resolve, reject, tabId });
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
                    // Calculate delay needed to maintain rate limit (requests per minute)
                    const now = Date.now();
                    const timeSinceLastRequest = now - this.lastRequestTime;
                    const minInterval = 60000 / this.rateLimit; // milliseconds between requests (60000ms = 1 minute)
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
            console.error("Noise Filter: Error processing queue. Rejecting remaining items.", error);
            this.queue.forEach(item => item.reject(error));
            this.queue = [];
        } finally {
            this.processing = false;
        }
    }

    cancelByTabId(tabId) {
        this.queue = this.queue.filter(item => {
            if (item.tabId === tabId) {
                item.reject(new Error(`Request cancelled for tab ${tabId} due to navigation.`));
                return false; // Remove from queue
            }
            return true; // Keep in queue
        });
    }
}

const rateLimiter = new RateLimiter();

browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message.action === "analyzePost") {
        const { post, scoreFilterMode, scoreThreshold } = message;
        const tabId = sender.tab.id;

        const { apiKey, baseUrl, model, enabledFilters, whitelistedSubs, blockDisplayMode } = await browser.storage.sync.get(['apiKey', 'baseUrl', 'model', 'enabledFilters', 'whitelistedSubs', 'blockDisplayMode']);
        
        // Check if extension is enabled
        const defaultFilters = {
            'extension-enabled': true,
            'json-output': false,
            unfunny: false,
            politics: false,
            ragebait: false,
            loweffort: false,
            advertisement: false,
            // Conditional filters for low-scoring posts
            'conditional-politics': false,
            'conditional-unfunny': false,
            'conditional-ragebait': false,
            'conditional-loweffort': false,
            'conditional-advertisement': false,
            circlejerk: false
        };
        const activeFilters = { ...defaultFilters, ...enabledFilters };
        
        if (!activeFilters['extension-enabled']) {
            console.log("Noise Filter: Extension is disabled. Skipping analysis.");
            await logActivity(post, { skipped: true, reason: 'Extension disabled' }, 'disabled', 'Extension is disabled');
            return;
        }
        
        if (!apiKey) {
            console.warn("Noise Filter: API key not set. Please set it in the extension options.");
            return; // Don't proceed without an API key
        }
        if (!baseUrl) {
            console.warn("Noise Filter: Base URL not set. Please set it in the extension options.");
            return; // Don't proceed without a base URL
        }
        if (!model) {
            console.warn("Noise Filter: Model not set. Please set it in the extension options.");
            return; // Don't proceed without a model
        }

        // Extract subreddit name without r/ prefix
        const subredditName = post.subreddit.replace(/^r\//, '').toLowerCase();
        
        // Check if subreddit is whitelisted
        const whitelistedSubreddits = whitelistedSubs || [];
        if (whitelistedSubreddits.includes(subredditName)) {
            console.log(`Noise Filter: Skipping analysis for whitelisted subreddit: ${post.subreddit}`);
            await logActivity(post, { skipped: true, reason: 'Whitelisted subreddit' }, 'whitelisted', 'Subreddit is whitelisted');
            return;
        }
        
        // Check circlejerk filter setting        
        // If circlejerk filtering is disabled and this is a circlejerk subreddit, skip it
        if (!activeFilters.circlejerk && subredditName.includes('circlejerk')) {
            console.log(`Noise Filter: Skipping analysis for circlejerk subreddit: ${post.subreddit}`);
            await logActivity(post, { skipped: true, reason: 'Circlejerk subreddit (filtering disabled)' }, 'circlejerk-skip', 'Circlejerk filtering is disabled');
            return;
        }

        try {
            // Add the API call to the rate-limited queue
            const apiResult = await rateLimiter.addToQueue(() => 
                callOpenAIApi(post, apiKey, baseUrl, model, enabledFilters, activeFilters['json-output'], scoreFilterMode, scoreThreshold),
                tabId
            );
            
            const { prompt, responseData, parsedResponse } = apiResult;
            const apiResponse = { prompt, responseData, parsedResponse };

            if (parsedResponse && parsedResponse.blocked_topic !== "safe") {
                // Send a message back to the content script to update the post's UI
                browser.tabs.sendMessage(sender.tab.id, {
                    action: "hidePost",
                    postId: post.id,
                    reason: parsedResponse.blocked_reason,
                    topic: parsedResponse.blocked_topic,
                    blockDisplayMode: blockDisplayMode // Pass the display mode
                }).catch(err => {
                    console.log(`Noise Filter: Could not send 'hidePost' message to tab ${sender.tab.id}. It may have been closed.`, err);
                });
                await logActivity(post, apiResponse, `hide (${parsedResponse.blocked_topic})`, parsedResponse.blocked_reason);
            } else {
                // Post was deemed safe, but check if it should be hidden in "hide" mode
                if (scoreFilterMode === 'hide' && post.score <= scoreThreshold) {
                    // In hide mode, posts at or below threshold are hidden even if they passed the "always check" filters
                    browser.tabs.sendMessage(sender.tab.id, {
                        action: "hidePost",
                        postId: post.id,
                        reason: `Post score ${post.score} is at or below threshold ${scoreThreshold}`,
                        topic: "hide-low-score",
                        blockDisplayMode: blockDisplayMode // Pass the display mode
                    }).catch(err => {
                        console.log(`Noise Filter: Could not send 'hidePost' message to tab ${sender.tab.id}. It may have been closed.`, err);
                    });
                    await logActivity(post, apiResponse, 'hide (low-score)', `Post score ${post.score} is at or below threshold ${scoreThreshold}`);
                } else {
                    await logActivity(post, apiResponse, 'safe', 'Post was deemed safe.');
                }
            }
        } catch (error) {
            const isCancellation = error.message.startsWith('Request cancelled');
            const actionTaken = isCancellation ? 'cancelled' : 'error';
            const reason = isCancellation ? 'Request cancelled due to navigation' : error.message;
            
            if (!isCancellation) {
                console.error("Noise Filter: Error analyzing post.", error);
            }
            await logActivity(post, { error: error.message }, actionTaken, reason);
        }
    } else if (message.action === "tabUnloading") {
        if (sender.tab && sender.tab.id) {
            console.log(`Noise Filter: Tab ${sender.tab.id} is unloading. Clearing pending analysis requests.`);
            rateLimiter.cancelByTabId(sender.tab.id);
        }
    } else if (message.action === "tabNavigating") {
        if (sender.tab && sender.tab.id) {
            console.log(`Noise Filter: Tab ${sender.tab.id} is navigating from ${message.oldUrl} to ${message.newUrl}. Clearing pending analysis requests.`);
            rateLimiter.cancelByTabId(sender.tab.id);
        }
    }
});

async function logActivity(post, apiData, action, reason) {
    const { activityLog = [] } = await browser.storage.local.get('activityLog');

    const logEntry = {
        timestamp: new Date().toISOString(),
        post,
        apiData,
        action,
        reason,
    };

    const newLog = [logEntry, ...activityLog].slice(0, MAX_LOG_ENTRIES);
    await browser.storage.local.set({ activityLog: newLog });
}

async function callOpenAIApi(post, apiKey, baseUrl, model, enabledFilters = {}, forceJsonOutput = true, scoreFilterMode = 'conditional', scoreThreshold = 1) {
    // Build the content types list based on enabled filters and score-based filtering mode
    const contentTypes = [];
    const filterDescriptions = {
        unfunny: 'unfunny jokes, such as those that are cringe. Normal jokes are OK.',
        politics: 'politics which criticise a political figure, or a political party, or simply mention a political figure. Note that public figures unrelated to politics is not politics',
        ragebait: 'rage-bait',
        loweffort: 'low-effort content, this can mean a post that the writer of the post could have EASILY used google. If a hard google search would need to be used, it\'s not low effort. Some posts may ask a question that\'s more open ended which doesn\'t always make them low effort. low effort content can also be unrelated to asking questions,',
        advertisement: 'advertisements toward services or products. Reviews of a product are not advertisements, but posts that are clearly trying to sell something are advertisements',
    };

    // Default filters configuration for score-based filtering
    const defaultFilters = {
        'extension-enabled': true,
        // Always check filters (regardless of score)
        unfunny: false,
        politics: false,
        ragebait: false,
        loweffort: false,
        advertisement: false,
        // Conditional filters (only for low-scoring posts)
        'conditional-politics': false,
        'conditional-unfunny': false,
        'conditional-ragebait': false,
        'conditional-loweffort': false,
        'conditional-advertisement': false
    };

    const activeFilters = { ...defaultFilters, ...enabledFilters };
    const activeTags = [];
    const postScore = post.score || 0;

    // Determine which filters to apply based on score-based filtering mode
    if (scoreFilterMode === 'all') {
        // Mode 1: Check all posts regardless of score - use always-check filters
        Object.keys(filterDescriptions).forEach(key => {
            if (activeFilters[key]) {
                contentTypes.push(filterDescriptions[key]);
                activeTags.push(key);
            }
        });
    } else if (scoreFilterMode === 'conditional') {
        // Mode 2: Apply different filters based on post score
        if (postScore <= scoreThreshold) {
            // For low-scoring posts, use conditional filters
            Object.keys(filterDescriptions).forEach(key => {
                const conditionalKey = `conditional-${key}`;
                if (activeFilters[conditionalKey]) {
                    contentTypes.push(filterDescriptions[key]);
                    activeTags.push(key);
                }
            });
        }
        
        // Always apply the "always check" filters regardless of score
        Object.keys(filterDescriptions).forEach(key => {
            if (activeFilters[key]) {
                // Avoid duplicates
                if (!activeTags.includes(key)) {
                    contentTypes.push(filterDescriptions[key]);
                    activeTags.push(key);
                }
            }
        });
    } else if (scoreFilterMode === 'hide') {
        // Mode 3: For posts at or below threshold, first check "always check" filters
        // Then hide if they don't match any filters
        
        // Always apply the "always check" filters regardless of score
        Object.keys(filterDescriptions).forEach(key => {
            if (activeFilters[key]) {
                contentTypes.push(filterDescriptions[key]);
                activeTags.push(key);
            }
        });
        
        // If post is at or below threshold and doesn't match any "always check" filters,
        // we'll handle the hiding after the AI analysis
    }

    // Special handling for hide mode with no filters
    if (scoreFilterMode === 'hide' && contentTypes.length === 0 && postScore <= scoreThreshold) {
        // No "always check" filters are enabled, so hide the post immediately
        return {
            prompt: 'Hide mode - no always-check filters enabled',
            responseData: { choices: [{ message: { content: '{"blocked_topic": "hide-low-score", "blocked_reason": "Post score too low", "post_description": "Hidden due to low score"}' } }] },
            parsedResponse: { blocked_topic: "hide-low-score", blocked_reason: `Post score ${postScore} is at or below threshold ${scoreThreshold}`, post_description: "Hidden due to low score" }
        };
    }

    // If no filters are enabled, don't block anything
    if (contentTypes.length === 0) {
        return {
            prompt: 'No content filters enabled',
            responseData: { choices: [{ message: { content: '{"blocked_topic": "safe", "blocked_reason": "No filters enabled", "post_description": "Analysis skipped"}' } }] },
            parsedResponse: { blocked_topic: "safe", blocked_reason: "No filters enabled", post_description: "Analysis skipped" }
        };
    }

    const prompt = `You are a content detector. You block content on reddit which is of NO intrinsic value to the user.

The user has determined that these type of posts are of no value to them:

${contentTypes.join('\n')}

Remember, if the post doesn't resemble any of these, put "safe" for the "blocked_reason" and "blocked_topic" otherwise use the tags "${activeTags.join('", "')}" along with a reason why in the "blocked_reason"

Remember, the sub name is also important. Eg, r/shittymoviedetails is designed to have shitty posts with shitty titles!

Based on this and the post at the top, respond ONLY in JSON format, such as in the example below (in this example, the user has determined that they don't want to see politics):

{
  "post_description": "News article about Donald Trump's Political Actions.",
  "blocked_reason": "Focuses on a United States political figure, which is politics",
  "blocked_topic": "politics"
}

Sub Name: ${post.subreddit}
Post Score: ${postScore} upvotes
Post:

Title: ${post.title}
Body Text: ${post.body}
`;

    // Use the base URL as provided by the user
    let apiUrl = baseUrl;
    // Remove trailing slash if present
    if (apiUrl.endsWith('/')) {
        apiUrl = apiUrl.slice(0, -1);
    }
    // Append the chat completions endpoint
    apiUrl = `${apiUrl}/chat/completions`;
    
    const requestBody = {
        model: model,
        messages: [
            {
                role: "user",
                content: prompt
            }
        ],
        temperature: 0.1
    };

    // Only add response_format if forceJsonOutput is enabled
    if (forceJsonOutput) {
        requestBody.response_format = { type: "json_object" };
    }
    
    const fetchOptions = {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    };

    const response = await fetch(apiUrl, fetchOptions);

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Noise Filter: API Error Body:", errorBody);
        throw new Error(`API call failed with status: ${response.status}`);
    }
    
    const responseData = await response.json();
    
    // Safely access the response text to prevent crashes on unexpected API responses
    const responseText = responseData.choices?.[0]?.message?.content;
    if (!responseText) {
        console.error("Noise Filter: Unexpected API response structure.", responseData);
        throw new Error("Invalid response structure from OpenAI API.");
    }

    let parsedResponse;
    if (forceJsonOutput) {
        // The API response is a stringified JSON, so it needs to be parsed.
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (error) {
            console.error("Noise Filter: Failed to parse JSON response:", responseText);
            throw new Error("Invalid JSON response from API.");
        }
    } else {
        // For non-JSON responses, try to extract the information from plain text
        try {
            // Try to parse as JSON first, in case the model returns JSON anyway
            parsedResponse = JSON.parse(responseText);
        } catch {
            // If not JSON, parse the plain text response
            parsedResponse = parseNonJsonResponse(responseText);
        }
    }

    return {
        prompt,
        responseData,
        parsedResponse
    };
}

function parseNonJsonResponse(responseText) {
    // Simple text parsing for non-JSON responses
    // Look for key phrases that indicate blocking
    const lowerText = responseText.toLowerCase();
    
    // Check for explicit "safe" indication
    if (lowerText.includes('safe') || lowerText.includes('not blocked') || lowerText.includes('allow')) {
        return {
            blocked_topic: "safe",
            blocked_reason: "Post was deemed safe",
            post_description: responseText.substring(0, 100) + "..."
        };
    }
    
    // Check for different content types
    const contentTypes = ['politics', 'political', 'unfunny', 'cringe', 'rage', 'bait', 'low-effort', 'low effort', 'advertisement', 'ad', 'promote'];
    
    for (const type of contentTypes) {
        if (lowerText.includes(type)) {
            let topic = type;
            if (type === 'political') topic = 'politics';
            if (type === 'cringe') topic = 'unfunny';
            if (type === 'rage' || type === 'bait') topic = 'ragebait';
            if (type === 'low-effort' || type === 'low effort') topic = 'loweffort';
            if (type === 'ad' || type === 'promote') topic = 'advertisement';
            
            return {
                blocked_topic: topic,
                blocked_reason: `Content appears to be ${type}`,
                post_description: responseText.substring(0, 100) + "..."
            };
        }
    }
    
    // Default to safe if no blocking indicators found
    return {
        blocked_topic: "safe",
        blocked_reason: "No blocking indicators found in response",
        post_description: responseText.substring(0, 100) + "..."
    };
}

browser.commands.onCommand.addListener((command) => {
    browser.storage.sync.get('enabledFilters').then((result) => {
        const enabledFilters = result.enabledFilters || {};
        let filterToToggle = null;

        switch (command) {
            case 'toggle-extension':
                filterToToggle = 'extension-enabled';
                break;
            case 'toggle-home-page':
                filterToToggle = 'home-page';
                break;
            case 'toggle-popular-page':
                filterToToggle = 'popular-page';
                break;
            case 'toggle-all-page':
                filterToToggle = 'all-page';
                break;
            case 'toggle-subreddit-page':
                filterToToggle = 'subreddit-page';
                break;
        }

        if (filterToToggle) {
            enabledFilters[filterToToggle] = !enabledFilters[filterToToggle];
            browser.storage.sync.set({ enabledFilters });
        }
    });
});