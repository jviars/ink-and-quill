# WiX Toolset Troubleshooting

If you're encountering issues with `candle.exe` during the Tauri build process, try these solutions:

## 1. Install WiX Toolset Manually

1. Download and install the WiX Toolset v3.11.2 from: https://github.com/wixtoolset/wix3/releases/tag/wix3112rtm
2. Make sure it's added to your PATH environment variable

## 2. Run as Administrator

Run your command prompt or terminal as Administrator when building the Tauri application.

## 3. Disable Antivirus Temporarily

Some antivirus software may interfere with the WiX toolset. Try temporarily disabling your antivirus during the build process.

## 4. Skip MSI Creation

If you only need the executable and not the installer, you can modify your build command:

\`\`\`
npm run tauri build -- --target nsis
\`\`\`

This will use NSIS instead of WiX for packaging.

## 5. Clean Build

Try cleaning your project and rebuilding:

\`\`\`
npm run tauri clean
npm run tauri build
\`\`\`

## 6. Check Environment Variables

Ensure that the WiX toolset binaries are in your PATH environment variable.
