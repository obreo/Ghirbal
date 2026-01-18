
<div align="center">

[English](README.md) | [العربية](إقرأني.md)

</div>

---

# Ghirbal | غربال - Safe Web Browser

## 🌐 Overview

Ghirbal is a mobile web browser focused on providing a safe browsing experience by filtering out NSFW content, blocking adult sites, and implementing various content restrictions. The browser is designed to protect users from inappropriate content while maintaining a functional browsing experience.

## 🚀 Features

### Core Safety Features
- **Adult Site Blocking**: Comprehensive blocklist of adult websites and domains. Uses a predefined blocklist with options for customization.
Allows users to add custom domains to the blocklist through local files, manual input, or remote URLs integrated with host based filters(It blocks complete website without specific patterns). Look at `client/lib/Blocklist/blocklist.ts` and `client/lib/Blocklist/endpoints.ts` for more details.
- **Google Safe Search Enforcement**: Forces Google Search safe mode with restricted search detection
- **Reddit NSFW Filtering**: Built-in search in community posts function, hides search bar, and blocks NSFW subreddits and posts.
- **Social Media Restricted Mode**: Instagram is allowed per post/reels direct links only, else blocked. Social media sites are blocked except for Facebook to safe modes where applicable.
- **YouTube Content Control**: Forces restricted search while optionally allowing comments on videos, hides shorts and suggested videos
- **Image and Video Blocking**: Optionally Prevents images and videos from loading on non-whitelisted sites (configurable)
- **Google Access Control**: Restricts Google.com access to only allow navigation from safesearchengine.com, images (optional), shorts and videos tabs are blocked.

### Privacy & Security
- **Permission Gatekeeper**: Granular control over site permissions (camera, microphone, location, storage)
- **Cookie Management**: Advanced cookie handling and clearing
- **Data Isolation**: Site data isolation and clearing capabilities
- **Content Filtering**: JavaScript-based content filtering for visual elements

### User Experience
- **Tab Management**: Multiple tab support with tab switching
- **Bookmark System**: Save and organize favorite sites
- **History Tracking**: Browse history with search capabilities
- **Adaptive UI**: Responsive design that works on various screen sizes
- **Dark/Light Mode**: Automatic theme switching based on system preferences

## 🛠️ Configuration

### Environment Variables (.env)

The application uses environment variables for configuration. To set up:

1. Rename `BLOCKLIST_VARIABLES.env` to `.env`
2. Configure the following variables:

```env
# Enable/disable media blocking (images/videos)
ENABLE_MEDIA_BLOCKING='true'

# Enable/disable Google access control
ENABLE_GOOGLE_ACCESS_CONTROL='true'

# YouTube restricted mode (true = always restricted, false = dynamic)
ENABLE_YOUTUBE_ALWAYS_RESTRICTED='false'

# Enable/disable Google Images blocking
ENABLE_GOOGLE_IMAGES_BLOCKING='true'

# Reddit blocking configuration
WILDCARD_REDDIT_BLOCKED_LIST=["nsfw","key2",...]
SUBREDDIT_PATTERNS_BLOCKED_LIST=["/r/nsfw","/r/subreddit2",...]
```

### App Configuration

Edit `app.json` to customize app settings such as name, icon, splash screen, and theme colors.

### Media Whitelist

In case ENABLE_MEDIA_BLOCKING was set to true, to allow images and videos on specific sites, edit `client/lib/media-whitelist.ts`:

```typescript
export const WHITELISTED_DOMAINS: string[] = [
  "safesearchengine.com",
  "wikipedia.org",
  "khanacademy.org",
  // Add your domains here
];
```

### Site Blocklist

To block additional sites, edit `client/lib/Blocklist/blocklist.ts` with domains you want to block.

## 🏗️ Building the Application

### Prerequisites

- Node.js (v18 or higher)
- Expo CLI
- EAS CLI
- Git
- A compatible development environment (Windows with WSL, Linux, or Mac)
- Android Studio (for Android builds locally)
- Java Development Kit (JDK 11 or higher)
- Xcode (for iOS builds locally on Mac)
- An Expo account

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Ghirbal
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   - Rename `BLOCKLIST_VARIABLES.env` to `.env`
   - Update configuration values as needed

4. **For Windows users using WSL:**
   - Create a symbolic link from Windows directory to WSL home directory:
     ```bash
     # In WSL terminal
     ln -s /mnt/c/Users/USERNAME/DIRECTORY_TO_Ghirbal ~/ghirbal
     cd ~/ghirbal
     ```

5. **Configure Expo:**
   - Copy the backup app configuration from `backups/app.json` to the root directory as `app.json`
   - Sign up for an Expo account at [https://expo.dev](https://expo.dev)
   - Log in to Expo CLI:
     ```bash
     npx expo login
     ```

6. **Build the application using Expo cloud:**
   ```bash
   # Clean prebuild
   npx expo prebuild --clean --platform android
   
   # Build for production
   eas build -p android --profile production
   # Or for iOS
   eas build -p ios --profile production
   ```

7. **Alternative local build (for WSL/Linux/Mac):**
   ```bash
   eas build -p android --profile production --locally
   ```

### Development

For development, you can run:

```bash
# Start App with Expo Go
npx expo start --lan -c

# Android
npx expo run:android

# iOS
npx expo run:ios

# Web
npx expo start --web
```

## 🔐 Permissions

⚠️ **Important Permission Notice**

The application includes experimental system-level permissions that should be kept **OFF by default**. Some sites may function actively even when permissions are disabled due to the browser's JavaScript-based permission gatekeeper system.

### Permission System
- **Camera/Microphone**: Sites must request permission to access camera/microphone
- **Location**: GPS access must be explicitly granted per site
- **File Storage**: File access must be enabled per site
- **Notifications**: Push notifications must be allowed per site
- **Images**: Image loading permissions per site

### Recommended Settings
- Keep system-level permissions OFF by default
- Use the browser's built-in permission system instead
- Grant permissions on a per-site basis as needed
- The JavaScript-based gatekeeper provides sufficient protection

## 📋 Blocklist Configuration

### Site Blocklist (`client/lib/Blocklist/blocklist.ts`)
- Contains a comprehensive list of domains to block
- Automatically loaded and applied to all browsing
- Can be extended with custom domains

### Reddit Blocklist (`.env` configuration)
- `WILDCARD_REDDIT_BLOCKED_LIST`: Wildcard patterns for Reddit blocking
- `SUBREDDIT_PATTERNS_BLOCKED_LIST`: Specific subreddit paths to block
- Blocks any community name containing specified keywords

## 📄 License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).

```
Ghirbal - Browse the web safely
Copyright (C) 2026 Obreo

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 🐛 Issues

If you encounter any issues or have suggestions for improvements, please create an issue in the repository.

- If app is not showing icon or splash screen correctly, ensure you have copied the backup `app.json` from `backups/app.json` to the root directory. And exclude it from .gitignore.

## 🙏 Acknowledgments

- Built with Expo
- Uses react-native-webview for browser functionality
- Includes comprehensive content filtering and safety features
