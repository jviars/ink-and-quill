# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-02-28

### Added
- Real compile pipeline with section-aware inclusion rules, compile presets, and multi-format outputs (`DOCX`, `Markdown`, `HTML`, `TXT`).
- Custom metadata architecture with editable metadata fields/templates and section-type template defaults.
- Snapshot system with per-document snapshots (timestamp, note, content hash, trigger), plus manual and automatic triggers.
- Snapshot compare and restore workflows in the inspector, including safety snapshots before restore.
- Inline comments/annotations anchored to editor selections, with inspector thread editing and resolve/reopen states.
- Flow Mode for editing multiple binder documents in one continuous writing surface with per-document persistence.
- Targets Dashboard with session/document/project word goals, live progress bars, pacing, streak stats, and per-document targets.
- Native desktop menu event bridge for `New`, `Open`, `Save`, and `Settings` actions in Tauri.
- Research workflow foundation: binder support for typed research items (`PDF`, `image`, `link`, `note`).
- Quick Reference pane for side-by-side writing + research without leaving manuscript context.
- Basic research import/index/preview flow for desktop: import files into binder, index text notes, preview PDFs/images, and manage link references.
- Phase 7 stabilization suite (`pnpm run test:stabilization`) covering:
  - data migration regression tests,
  - compile pipeline regression + performance sanity checks,
  - snapshot recovery/diff/retention tests,
  - Tauri reliability checks for preferences initialization, open/save/restore flows, and crash-recovery safeguards.
- Generated release candidate artifact: `RELEASE_CHECKLIST.md` with per-check pass/fail status.
- Explicit `Save Project` and `Save Project As...` actions in the in-app project menu.
- Native Tauri `Save Project As...` menu item with `CmdOrCtrl+Shift+S` accelerator and app event wiring.

### Changed
- Startup now opens directly into the workspace and attempts to restore the previously opened project.
- When a previous project path is missing, the app now shows a recovery message and creates a new workspace project automatically.
- Slash command UX was refined: menu positioning follows the typed slash context, and it closes when slash text becomes normal prose.
- Theme preference behavior was hardened around system/default handling and persistence across launches.
- Project schema metadata version advanced to `1.2.0` for research item persistence.
- Application and Tauri package manifests were versioned to `0.2.0`.
- Project ZIP persistence was hardened by writing `project.json` as serialized JSON text (cross-runtime compatible) instead of Blob-only packaging.
- Increased top-left Ink & Quill branding size for stronger app identity and readability.

### Fixed
- Fixed a Tauri crash path when using `Open Project` from the native menu while a project session was active.
- Fixed autosave/save flows to avoid unwanted dialog prompts and improved Tauri save-path handling.
- Fixed dark-mode contrast regressions, including manuscript/paper readability tuning for low-light writing.
- Fixed first-launch startup instability by hardening autosave backup storage access and aligning background save serialization.

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
