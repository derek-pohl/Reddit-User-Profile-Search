# 🔍 Reddit User Profile Analyzer

A browser extension that provides the ability to search into Reddit user profiles. Ask away using either the Hack Club API or Google's Gemini API and 2.5 Flash model.

## Installation

### Chrome/Chromium
1. Download the latest release from the chrome web store or build from source
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `dist/chromium` folder

### Firefox
1. Download the latest release from the firefox add on store or build from source
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on"
4. Select the `manifest.json` file from the `dist/firefox` folder

## 🛠️ Setup & Configuration

### Option 1: Hack Club API (Recommended)
1. Install the extension
2. The Hack Club API is enabled by default - no setup required!
3. Start analyzing profiles immediately

### Option 2: Google Gemini API
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Open the extension options page
3. Toggle off "Use Hack Club API"
4. Enter your Gemini API key
5. Save settings

## How to Use

### Basic Usage
1. **Navigate** to any Reddit user profile:
   - `https://www.reddit.com/user/username goes here/`

2. **Activate** the extension:
   - Click the extension icon in your browser toolbar

3. **Load Data**:
   - Click "Load Posts" to analyze their submissions
   - Click "Load Comments" to analyze their comments
   - The extension will navigate to the appropriate pages automatically

4. **Ask Away**:
   ```
   "What are this user's main interests?"
   "How active are they in programming subreddits?"
   "What's their general sentiment in comments?"
   "Do they prefer certain types of content?"
   ```

## 🔧 Building from Source

### Prerequisites
- Node.js 16+ and npm
- Git

### Build Steps
```bash
# Clone the repository
git clone https://github.com/yourusername/reddit-profile-analyzer.git
cd reddit-profile-analyzer

# Install dependencies
npm install

# Build for Chrome
npm run build:chromium

# Build for Firefox  
npm run build:firefox

# Build both
npm run build
```

Built extensions will be in the `dist/` folder.

##  Customization

### Themes
Choose from 5 built-in color schemes:
- **Orange** (Default)
- **Blue**
- **Green**
- **Purple**
- **Gray**

##  Privacy & Security

- **Local Processing**: All analysis happens locally with your chosen AI service
- **No Data Storage**: User data is only cached temporarily during your session
- **Respect Privacy**: Only analyzes publicly available Reddit data
- **No Tracking**: Extension doesn't collect or store personal information
- **Remember that the Hack Club API saves all data entered in and out.**