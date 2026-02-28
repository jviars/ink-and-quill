/**
 * Ink & Quill - Build Instructions
 *
 * After updating the project files, follow these steps to build the application:
 *
 * 1. Clean install dependencies:
 *    rm -rf node_modules package-lock.json
 *    npm install
 *
 * 2. Test the Tauri development build:
 *    npm run tauri:dev
 *
 * 3. Build the production application:
 *    npm run tauri:build
 *
 * 4. Find your built application:
 *    - macOS: src-tauri/target/release/bundle/macos/Ink & Quill.app
 *    - Windows: src-tauri/target/release/bundle/msi/Ink & Quill_0.1.0_x64_en-US.msi
 *    - Linux: src-tauri/target/release/bundle/appimage/ink-and-quill_0.1.0_amd64.AppImage
 *
 * Troubleshooting:
 * - If you encounter any issues, check the installed versions:
 *   npm ls react
 *   npm ls date-fns
 *
 * - Make sure Tauri CLI is properly installed:
 *   npx tauri --version
 *
 * - For macOS users, ensure you have Xcode Command Line Tools:
 *   xcode-select --install
 *
 * - For Windows users, ensure you have Microsoft Visual Studio C++ Build Tools
 *
 * - For Linux users, ensure you have the required dependencies:
 *   sudo apt update && sudo apt install libwebkit2gtk-4.0-dev \
 *     build-essential curl wget libssl-dev libgtk-3-dev \
 *     libayatana-appindicator3-dev librsvg2-dev
 */
