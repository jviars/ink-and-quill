# Ink & Quill

A desktop writing application built with Next.js and Tauri.

## Features

- **Document Management**: Create, edit, and organize your writing projects
- **Outliner**: Plan your writing with a powerful outliner
- **Themes**: Choose from Light, Dark, or Muted Elegance themes
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **File Operations**: Save and load your projects as .quill files

## Development

### Prerequisites

- Node.js 18+
- Rust (for Tauri)
- Platform-specific requirements for Tauri (see [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

### Getting Started

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Run the development server:
   \`\`\`bash
   # For web development
   npm run dev
   
   # For Tauri desktop app development
   npm run tauri:dev
   \`\`\`

### Building

\`\`\`bash
# Build the web version
npm run build

# Build the desktop app
npm run tauri:build
\`\`\`

## License

MIT
\`\`\`

## Final Touches - Update the Tauri Configuration
