# Mac Build Instructions for Ink & Quill

This document provides instructions for building Ink & Quill on macOS.

## Prerequisites

1. **Node.js and npm**: Make sure you have Node.js 18+ and npm installed
2. **Rust and Cargo**: Required for Tauri development
3. **Xcode Command Line Tools**: Required for building native components

## Installation Steps

1. **Install Rust (if not already installed)**:
   \`\`\`bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   \`\`\`

2. **Install Xcode Command Line Tools**:
   \`\`\`bash
   xcode-select --install
   \`\`\`

3. **Clone the repository**:
   \`\`\`bash
   git clone <repository-url>
   cd ink-and-quill
   \`\`\`

4. **Install dependencies**:
   \`\`\`bash
   npm install
   \`\`\`
   
   If you encounter any issues with specific packages, try:
   \`\`\`bash
   npm install --legacy-peer-deps
   \`\`\`

## Building the Application

1. **Development mode**:
   \`\`\`bash
   npm run tauri:dev
   \`\`\`

2. **Production build**:
   \`\`\`bash
   npm run tauri:build
   \`\`\`
   
   This will create a macOS application in the `src-tauri/target/release/bundle/macos` directory.

## Troubleshooting

### Common Issues

1. **Missing dependencies**:
   If you encounter errors about missing dependencies, try:
   \`\`\`bash
   brew install openssl libuv
   \`\`\`

2. **Code signing issues**:
   For development, you can disable code signing by modifying `src-tauri/tauri.conf.json`:
   \`\`\`json
   "macOS": {
     "frameworks": [],
     "minimumSystemVersion": "",
     "signingIdentity": null,
     "entitlements": null
   }
   \`\`\`

3. **Build errors**:
   If you encounter build errors, try cleaning the project:
   \`\`\`bash
   npm run tauri clean
   \`\`\`

4. **TipTap version issues**:
   If you encounter issues with TipTap packages, ensure all TipTap packages are using the same version (2.1.12 is recommended).

## Creating a Distribution

To create a distributable application:

1. **Build the application**:
   \`\`\`bash
   npm run tauri:build
   \`\`\`

2. **Create a DMG (optional)**:
   You can use a tool like `create-dmg` to create a DMG installer:
   \`\`\`bash
   npm install -g create-dmg
   create-dmg src-tauri/target/release/bundle/macos/Ink\ \&\ Quill.app
   \`\`\`

## Support

If you encounter any issues not covered in this guide, please open an issue in the repository or contact the development team.
