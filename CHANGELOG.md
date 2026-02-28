# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-02-28

### Added
- New reusable glass UI primitives (`GlassPanel`, `GlassToolbarGroup`, `GlassIconButton`, `GlassSegmented`) and shared styling tokens.
- Autosave recovery entry point on the startup screen.
- New `System` theme option that follows OS light/dark mode.

### Changed
- Refined the main workspace shell for Tauri: cleaner top controls, improved spacing, and desktop-first panel behavior.
- Revamped the startup experience to be more welcoming and less utilitarian while preserving open/create/recover/recent project workflows.
- Updated default theme behavior to `system` and limited selectable themes to `System`, `Light`, and `Dark`.
- Updated dark mode styling and page contrast for better manuscript readability with a dark app shell.
- Improved Tauri packaging defaults (desktop app-first bundle flow) and refreshed app icon assets used by Tauri bundling.

### Fixed
- Fixed runtime error caused by malformed recent project entries rendering as React children.
- Hardened preference/theme normalization, including migration of legacy `muted-elegance` values to `system`.
- Fixed startup and save flows to avoid unwanted Save/Open dialog behavior during autosave.
- Fixed theme option visibility issues in settings (light option readability in dark UI).

### Removed
- Removed unused legacy code paths/components (`project-dialog`, `tree-view`, legacy `project-manager` module, unused Rust invoke handlers).
- Removed `Muted Elegance` from active theme settings/options.

## [0.1.0] - 2026-02-27

### Added
- Initial release of Ink & Quill.
- Tauri-based desktop application framework.
- Rich-text editor powered by Tiptap.
- Sidebar binder for document and folder organization.
- Inspector pane for tracking synopsis, status, labels, and keywords per document.
- Drag and drop file reordering in the binder.
- Local `.quill` project file saving and loading.
- Manuscript compilation to HTML.
- Dark mode and custom themes (System, Light, Dark, Muted Elegance).
