# Mower.io

A cross-platform Splix.io-style territory capture game with lawn mowers.

## Running in Replit
The project is set up to run immediately. Simply click the big "Run" button at the top of your Replit workspace. 
This starts the `Start application` workflow, which runs the Vite dev server (`npm run dev:client`) on port 5000.

## Converting to a Native iOS/Android App with Capacitor

Because this application uses a single web codebase (HTML, CSS, React, Canvas) and does not rely on backend server-side rendering for its core frontend views, it is a perfect candidate to be wrapped as a native mobile app using [Capacitor](https://capacitorjs.com/).

Follow these steps to generate mobile apps:

### 1. Build the Web Assets
First, compile your Vite project into static files:
```bash
npm run build
```
This outputs your optimized web app into the `dist/public` folder.

### 2. Initialize Capacitor
Install Capacitor dependencies:
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Mower.io" "com.example.mowerio" --web-dir dist/public
```

### 3. Add Platforms
Add the Android and iOS platforms to your project:
```bash
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios
```

### 4. Sync the Build
Copy your web build into the native projects:
```bash
npx cap sync
```

### 5. Open and Build (Requires Local Machine/Mac)
To compile the final binary, you need Xcode (for iOS) or Android Studio (for Android):
```bash
npx cap open ios
# or
npx cap open android
```

From there, you can build the `.apk`/`.aab` or `.ipa` and distribute your game on the App Store and Google Play!

## Features Included
- **Canvas Rendering**: High-performance rendering for grids, trails, and territory.
- **PWA Ready**: Includes a `manifest.json` and a Service Worker (`sw.js`) so users can "Install to Home Screen" from their browser.
- **Touch Controls**: Mobile users can swipe to steer their mower.
- **Keyboard Controls**: Desktop users can use WASD or Arrow Keys.
- **Mockup Game Engine**: Fully functional frontend territory capture algorithm (flood fill) with simulated bot opponents.