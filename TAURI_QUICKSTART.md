# Ink & Quill - Tauri Desktop App Quick Start Guide

This guide will help you get started with building and running the Ink & Quill desktop application using Tauri.

## Prerequisites

Before you begin, make sure you have the following installed:

### For All Platforms
- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install)

### Platform-Specific Requirements

#### Windows
- Microsoft Visual Studio C++ Build Tools
- WebView2 (comes with Windows 11 and recent Windows 10 updates)

#### macOS
- Xcode Command Line Tools (`xcode-select --install`)

#### Linux
- `build-essential`
- `libwebkit2gtk-4.0-dev`
- `libgtk-3-dev`
- Additional packages (see [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

## Building the Application

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/yourusername/ink-and-quill.git
   cd ink-and-quill
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Run the development version:
   \`\`\`bash
   npm run tauri:dev
   \`\`\`
   This will start both the Next.js development server and the Tauri development window.

4. Build the production version:
   \`\`\`bash
   npm run tauri:build
   \`\`\`
   This will create a distributable application in the `src-tauri/target/release/bundle` directory.

## Application Structure

- `src-tauri/`: Contains the Rust code for the Tauri application
- `src-tauri/tauri.conf.json`: Configuration file for Tauri
- `src-tauri/src/main.rs`: Main Rust entry point for the Tauri application
- `lib/project-io.ts`: Handles file operations, with special handling for Tauri
- `components/`: React components for the application UI

## Features

- **File Operations**: Save and load .quill project files
- **Project Management**: Create, edit, and organize writing projects
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Native Performance**: Uses native file dialogs and file system operations

## Troubleshooting

### Common Issues

1. **Rust Compilation Errors**:
   - Make sure you have the latest version of Rust installed
   - Try running `rustup update`

2. **Missing Dependencies**:
   - Check the platform-specific requirements above
   - On Linux, make sure you have all required packages installed

3. **Build Errors**:
   - Clear the build cache: `npm run clean`
   - Reinstall dependencies: `npm install`

### Getting Help

If you encounter any issues, please:
1. Check the [Tauri documentation](https://tauri.app/v1/guides/)
2. Open an issue on the GitHub repository

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
\`\`\`

## Update the README.md with Tauri Information
