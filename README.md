# 🔍 Reddit User Profile Analyzer

A powerful browser extension that provides AI-powered insights into Reddit user profiles. Analyze posting patterns, interests, and behavior with natural language queries using either the free Hack Club API or Google's Gemini API.

![Extension Demo](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox-blue)
![Version](https://img.shields.io/badge/Version-1.0.0-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### 🤖 **Dual AI Support**
- **Hack Club API** (Default) - Free, no API key required
- **Google Gemini API** - Advanced AI with your own API key

### 📊 **Comprehensive Analysis**
- Automatically detects Reddit user profile pages
- Extracts posts from `/submitted/` pages
- Extracts comments from `/comments/` pages
- Analyzes posting patterns, interests, and behavior
- Provides insights on subreddit preferences and activity levels

### 💬 **Interactive Chat Interface**
- Ask natural language questions about any user
- Get detailed, markdown-formatted responses
- Reference specific posts and comments in context
- Persistent chat history during your session

### 🎨 **Customizable Interface**
- Multiple color themes (Orange, Blue, Green, Purple, Gray)
- Dark mode support with automatic system detection
- Responsive design for all screen sizes
- Keyboard shortcuts for quick access

## 🚀 Installation

### Chrome/Chromium
1. Download the latest release or build from source
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `dist/chromium` folder

### Firefox
1. Download the latest release or build from source
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

## 📖 How to Use

### Basic Usage
1. **Navigate** to any Reddit user profile:
   - `https://www.reddit.com/user/username/`
   - `https://www.reddit.com/u/username/`

2. **Activate** the extension:
   - Press `Alt+Shift+A` to toggle the interface
   - Or click the extension icon in your browser toolbar

3. **Load Data**:
   - Click "Load Posts" to analyze their submissions
   - Click "Load Comments" to analyze their comments
   - The extension will navigate to the appropriate pages automatically

4. **Ask Questions**:
   ```
   "What are this user's main interests?"
   "How active are they in programming subreddits?"
   "What's their general sentiment in comments?"
   "Do they prefer certain types of content?"
   ```

### Advanced Features
- **Keyboard Shortcuts**:
  - `Alt+Shift+A` - Toggle extension interface
  - `Alt+Shift+P` - Quick analyze current profile

- **Multiple Analysis Types**:
  - Posts analysis for content creation patterns
  - Comments analysis for engagement and opinions
  - Combined analysis for comprehensive insights

## 💡 Example Questions

### Content Analysis
- "What topics does this user post about most?"
- "How successful are their posts based on upvotes?"
- "What subreddits do they contribute to?"

### Behavior Analysis  
- "Is this user generally positive or negative in comments?"
- "How often do they engage in discussions?"
- "What's their expertise level in different topics?"

### Community Insights
- "Which communities is this user most active in?"
- "Do they prefer niche or mainstream subreddits?"
- "How do they interact with different types of content?"

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

## 🎨 Customization

### Themes
Choose from 5 built-in color schemes:
- **Orange** (Default) - Warm and friendly
- **Blue** - Professional and clean
- **Green** - Natural and calming  
- **Purple** - Creative and modern
- **Gray** - Minimal and focused

### Dark Mode
- **Manual** - Toggle dark mode on/off
- **Automatic** - Follow your system theme
- **Scheduled** - Set custom dark mode hours

## 🔒 Privacy & Security

- **Local Processing**: All analysis happens locally with your chosen AI service
- **No Data Storage**: User data is only cached temporarily during your session
- **Respect Privacy**: Only analyzes publicly available Reddit data
- **Secure APIs**: All API calls use HTTPS encryption
- **No Tracking**: Extension doesn't collect or store personal information

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Install dependencies
npm install

# Start development mode with auto-reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/reddit-profile-analyzer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/reddit-profile-analyzer/discussions)
- **Email**: support@yourproject.com

## 🙏 Acknowledgments

- [Hack Club](https://hackclub.com/) for providing free AI API access
- [Google](https://ai.google.dev/) for the Gemini API
- [Reddit](https://reddit.com/) for the platform that makes this analysis possible
- All contributors and users who help improve this extension

---

**⭐ If you find this extension helpful, please consider giving it a star on GitHub!**
