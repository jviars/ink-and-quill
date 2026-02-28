# Release Candidate Checklist

Generated: 2026-02-28T16:56:23.906Z

## Data Migration Tests (GREEN)

- [x] normalizes legacy projects with missing settings and document fields (1.47ms)
- [x] fills in missing documents referenced in tree structure (0.10ms)
- [x] infers research item type from legacy source path during migration (0.19ms)

Summary: 3 passed, 0 failed

## Compile Regression Suite (GREEN)

- [x] manuscript preset excludes research and notes while keeping front/back matter (0.64ms)
- [x] full html preset includes research/notes and synopsis text (0.21ms)
- [x] compile bundle remains fast for medium-large projects (3.21ms)

Summary: 3 passed, 0 failed

## Snapshot Recovery Tests (GREEN)

- [x] snapshot records preserve trigger/hash and dedupe identical states (0.13ms)
- [x] snapshot retention limit keeps the most recent revisions (0.06ms)
- [x] inline diff + plain text conversion support safe restore comparisons (0.51ms)

Summary: 3 passed, 0 failed

## Tauri Reliability Checklist (GREEN)

- [x] tauri preferences path initializes config directory and defaults (6.67ms)
- [x] save/open/restore path works with preferred directory and dialog fallback (48.47ms)
- [x] crash-recovery safeguards remain present in workspace bootstrap/save flows (0.21ms)
- [x] research quick-reference path remains wired for side-by-side context (0.14ms)

Summary: 4 passed, 0 failed

Overall: 13/13 passed, 0 failed