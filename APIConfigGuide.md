API Setup Guide using the Free Google Gemini API.

The Google Gemini API works best with this project, although any other OpenAI Compatible API can be used. To use the Google Gemini API, for free (no credit card!), follow the guide below.

*note, as this is the recomended config, some of the text fields are already typed in.

1. Use a browser which is logged in to a personal google account.

2. Go to https://aistudio.google.com/apikey

3. Follow instructions, accept terms, etc.

4. Click "+ Create an API key"

5. Click "Search Google Cloud projects" and click the project called "Gemini API"

6. Click "Create API key in existing project"

7. The API key has been generated. Click "Copy" and paste it into the extension options menu in the "API Key" field, in the API Configuration section.

8. Verify that the "Plan" in the 'API Keys" section is NOT listed as "Paid," note that this would only occur if you have used google cloud services in the past. If you have no idea what "google cloud" is, then don't worry and move on.

9. In the API Configuration section (in the Options menu of the extension), set the "Base URL" to https://generativelanguage.googleapis.com/v1beta/openai

10. For the model, enter: gemma-3-27b-it

11. For the Rate Limit, enter: 30

12. Make sure Force JSON Output is OFF, although it should be already.

13. That's it! Now, adjust settings as needed below. Have fun!

My personal "Score-Based Filtering" Settings (I like all of the content filters, although I find the AI can be a little too strict. I only apply the filters when a post only has a score of 2 or below. However, I never want to see politics):

- Select: Check low-scoring posts for specific content
- Set "Score Threshold" to 2

Under "Content Filters for Low-Scoring Posts"

Political Content: OFF

Unfunny Jokes: ON

Rage Bait: ON

Low-Effort Content: ON

Advertisements: ON

Under "Always Check Regardless of Score"

Political Content: ON

Unfunny Jokes: OFF

Rage Bait: OFF

Low-Effort Content: OFF

Advertisements: OFF

Under "Page Filtering," Set all options to "ON"

Under "Whitelisted Subreddits," you may want to put subs like r/meirl or other subs that only have the title of the sub name, as AI may not understand the post as it cannot see the post images.