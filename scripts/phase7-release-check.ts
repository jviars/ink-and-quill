import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { performance } from "node:perf_hooks"
import {
  createEmptyProject,
  normalizeProject,
  type DocumentData,
  type QuillProject,
  type TreeNode,
} from "../lib/project-types"
import { buildCompileBundle } from "../lib/compile-pipeline"
import {
  appendSnapshotWithLimit,
  buildInlineDiff,
  computeWordCountFromHtml,
  createSnapshotRecord,
  htmlToPlainText,
} from "../lib/snapshot-utils"

type TestResult = {
  name: string
  status: "pass" | "fail"
  durationMs: number
  error?: string
}

interface SectionSummary {
  title: string
  results: TestResult[]
}

const runTest = async (name: string, testFn: () => void | Promise<void>): Promise<TestResult> => {
  const started = performance.now()
  try {
    await testFn()
    return {
      name,
      status: "pass",
      durationMs: performance.now() - started,
    }
  } catch (error) {
    return {
      name,
      status: "fail",
      durationMs: performance.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const moduleExports = <T extends object>(importedModule: any): T => {
  return (importedModule?.default ?? importedModule) as T
}

const summarizeSection = (title: string, results: TestResult[]): SectionSummary => ({ title, results })

const passCount = (results: TestResult[]): number => results.filter((result) => result.status === "pass").length
const failCount = (results: TestResult[]): number => results.filter((result) => result.status === "fail").length

const createDocument = (
  content: string,
  sectionLabel: string,
  overrides?: Partial<DocumentData>,
): DocumentData => {
  const now = new Date().toISOString()
  const words = content
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length

  return {
    content,
    synopsis: `${sectionLabel} synopsis`,
    notes: "",
    wordTarget: 1500,
    snapshots: [],
    comments: [],
    status: "draft",
    label: "none",
    keywords: "",
    metadata: {
      status: "draft",
      label: "none",
      keywords: "",
    },
    wordCount: words,
    createdAt: now,
    lastModified: now,
    ...overrides,
  }
}

const createCompileFixture = (): QuillProject => {
  const project = createEmptyProject("Compile Regression")

  const tree: TreeNode[] = [
    {
      id: "root",
      label: "Compile Regression",
      type: "folder",
      sectionType: "chapter",
      includeInCompile: true,
      children: [
        {
          id: "front-1",
          label: "Title Page",
          type: "document",
          sectionType: "front-matter",
          includeInCompile: true,
          metadataTemplateId: null,
        },
        {
          id: "chapter-1",
          label: "Chapter 1",
          type: "folder",
          sectionType: "chapter",
          includeInCompile: true,
          children: [
            {
              id: "scene-1",
              label: "Scene 1",
              type: "document",
              sectionType: "scene",
              includeInCompile: true,
              metadataTemplateId: null,
            },
            {
              id: "scene-hidden",
              label: "Hidden Scene",
              type: "document",
              sectionType: "scene",
              includeInCompile: false,
              metadataTemplateId: null,
            },
          ],
        },
        {
          id: "research-1",
          label: "Reference PDF",
          type: "document",
          sectionType: "research",
          includeInCompile: true,
          metadataTemplateId: null,
        },
        {
          id: "notes-1",
          label: "Author Notes",
          type: "document",
          sectionType: "notes",
          includeInCompile: true,
          metadataTemplateId: null,
        },
        {
          id: "back-1",
          label: "Appendix",
          type: "document",
          sectionType: "back-matter",
          includeInCompile: true,
          metadataTemplateId: null,
        },
      ],
    },
  ]

  project.treeStructure = tree
  project.documents = {
    "front-1": createDocument("<p>Front matter text</p>", "Front Matter", { synopsis: "Front synopsis" }),
    "scene-1": createDocument("<p>The main manuscript scene.</p>", "Scene 1", { synopsis: "Scene synopsis" }),
    "scene-hidden": createDocument("<p>This should not compile.</p>", "Hidden Scene"),
    "research-1": createDocument("<p>Research reference body.</p>", "Research", {
      research: {
        type: "pdf",
        sourceName: "reference.pdf",
        sourcePath: "/tmp/reference.pdf",
        indexedText: "Research reference body.",
        importedAt: new Date().toISOString(),
      },
      synopsis: "Research synopsis",
    }),
    "notes-1": createDocument("<p>Internal notes should be optional.</p>", "Notes"),
    "back-1": createDocument("<p>Back matter section.</p>", "Back Matter", { synopsis: "Back synopsis" }),
  }

  return project
}

const runMigrationTests = async (): Promise<SectionSummary> => {
  const results: TestResult[] = []

  results.push(
    await runTest("normalizes legacy projects with missing settings and document fields", () => {
      const legacy = {
        metadata: {
          name: "Legacy Project",
          version: "1.0.0",
          createdAt: "2024-01-01T00:00:00.000Z",
          lastModified: "2024-01-01T00:00:00.000Z",
        },
        settings: {
          theme: "dark",
          fontSize: "18",
        },
        treeStructure: [
          {
            id: "root",
            label: "Legacy Project",
            type: "folder",
            children: [
              {
                id: "doc-1",
                label: "Scene 1",
                type: "document",
                sectionType: "scene",
              },
            ],
          },
        ],
        documents: {
          "doc-1": {
            content: "<p>Hello legacy world</p>",
            synopsis: "",
            notes: "",
            status: "draft",
            label: "none",
            keywords: "legacy",
          },
        },
      }

      const normalized = normalizeProject(legacy)
      const migratedDoc = normalized.documents["doc-1"]

      assert.equal(normalized.settings.theme, "dark")
      assert.equal(normalized.settings.snapshotSettings.enabled, true)
      assert.equal(normalized.settings.targetsSettings.defaultDocumentWordTarget, 1500)
      assert.equal(Array.isArray(migratedDoc.snapshots), true)
      assert.equal(Array.isArray(migratedDoc.comments), true)
      assert.equal(migratedDoc.wordTarget, 1500)
      assert.equal(migratedDoc.metadata.status, "draft")
      assert.equal(migratedDoc.metadata.keywords, "legacy")
      assert.equal(migratedDoc.wordCount > 0, true)
    }),
  )

  results.push(
    await runTest("fills in missing documents referenced in tree structure", () => {
      const partial = {
        metadata: {
          name: "Tree First",
          version: "0.9.0",
          createdAt: "2024-01-01T00:00:00.000Z",
          lastModified: "2024-01-01T00:00:00.000Z",
        },
        settings: {},
        treeStructure: [
          {
            id: "root",
            label: "Tree First",
            type: "folder",
            children: [{ id: "doc-missing", label: "Recovered Doc", type: "document" }],
          },
        ],
        documents: {},
      }

      const normalized = normalizeProject(partial)
      const recoveredDoc = normalized.documents["doc-missing"]
      assert.ok(recoveredDoc)
      assert.equal(recoveredDoc.content, "")
      assert.equal(recoveredDoc.wordTarget, normalized.settings.targetsSettings.defaultDocumentWordTarget)
    }),
  )

  results.push(
    await runTest("infers research item type from legacy source path during migration", () => {
      const legacyResearch = {
        metadata: {
          name: "Research Legacy",
          version: "1.0.0",
          createdAt: "2024-01-01T00:00:00.000Z",
          lastModified: "2024-01-01T00:00:00.000Z",
        },
        settings: {},
        treeStructure: [
          {
            id: "root",
            label: "Research Legacy",
            type: "folder",
            children: [{ id: "research-doc", label: "Paper", type: "document", sectionType: "research" }],
          },
        ],
        documents: {
          "research-doc": {
            content: "",
            synopsis: "",
            notes: "",
            research: {
              sourcePath: "/Users/test/Paper.pdf",
              sourceName: "Paper.pdf",
            },
          },
        },
      }

      const normalized = normalizeProject(legacyResearch)
      assert.equal(normalized.documents["research-doc"].research?.type, "pdf")
      assert.equal(normalized.documents["research-doc"].research?.sourceName, "Paper.pdf")
    }),
  )

  return summarizeSection("Data Migration Tests", results)
}

const runCompileRegressionTests = async (): Promise<SectionSummary> => {
  const results: TestResult[] = []

  results.push(
    await runTest("manuscript preset excludes research and notes while keeping front/back matter", () => {
      const project = createCompileFixture()
      const bundle = buildCompileBundle(project, "preset-manuscript-docx", "docx")

      const sectionTypes = bundle.segments.map((segment) => segment.sectionType)
      assert.equal(sectionTypes.includes("front-matter"), true)
      assert.equal(sectionTypes.includes("back-matter"), true)
      assert.equal(sectionTypes.includes("research"), false)
      assert.equal(sectionTypes.includes("notes"), false)
      assert.equal(bundle.html.includes("<hr />"), true)
      assert.equal(bundle.segments.some((segment) => segment.id === "scene-hidden"), false)
    }),
  )

  results.push(
    await runTest("full html preset includes research/notes and synopsis text", () => {
      const project = createCompileFixture()
      const bundle = buildCompileBundle(project, "preset-full-html", "html")

      const sectionTypes = bundle.segments.map((segment) => segment.sectionType)
      assert.equal(sectionTypes.includes("research"), true)
      assert.equal(sectionTypes.includes("notes"), true)
      assert.equal(bundle.html.includes("Research synopsis"), true)
      assert.equal(bundle.markdown.includes("Research reference body."), true)
    }),
  )

  results.push(
    await runTest("compile bundle remains fast for medium-large projects", () => {
      const project = createEmptyProject("Perf Compile")
      const root = project.treeStructure[0]
      if (!root.children) root.children = []
      project.documents = {}

      const generatedNodes: TreeNode[] = []
      for (let index = 0; index < 240; index += 1) {
        const docId = `perf-doc-${index}`
        generatedNodes.push({
          id: docId,
          label: `Scene ${index + 1}`,
          type: "document",
          sectionType: "scene",
          includeInCompile: true,
          metadataTemplateId: null,
        })
        project.documents[docId] = createDocument(
          `<p>${"word ".repeat(120)}${index}</p>`,
          `Scene ${index + 1}`,
          { synopsis: `Synopsis ${index + 1}` },
        )
      }

      root.children = generatedNodes
      const started = performance.now()
      const bundle = buildCompileBundle(project, "preset-submission-markdown", "markdown")
      const elapsed = performance.now() - started

      assert.equal(bundle.segments.length, 240)
      assert.ok(elapsed < 8000, `Compile regression budget exceeded: ${elapsed.toFixed(2)}ms`)
    }),
  )

  return summarizeSection("Compile Regression Suite", results)
}

const runSnapshotRecoveryTests = async (): Promise<SectionSummary> => {
  const results: TestResult[] = []

  results.push(
    await runTest("snapshot records preserve trigger/hash and dedupe identical states", () => {
      const baseDoc = createDocument("<p>Hello world</p>", "Base Scene")
      const snapA = createSnapshotRecord(baseDoc, { trigger: "manual", note: "initial" })
      const snapB = createSnapshotRecord(baseDoc, { trigger: "manual-save" })

      const appended = appendSnapshotWithLimit([], snapA, 10)
      const deduped = appendSnapshotWithLimit(appended, snapB, 10)

      assert.equal(snapA.trigger, "manual")
      assert.equal(typeof snapA.contentHash, "string")
      assert.equal(deduped.length, 1)
      assert.equal(deduped[0].note, "initial")
    }),
  )

  results.push(
    await runTest("snapshot retention limit keeps the most recent revisions", () => {
      const firstDoc = createDocument("<p>alpha beta</p>", "Scene A")
      const secondDoc = createDocument("<p>alpha beta gamma</p>", "Scene B")
      const thirdDoc = createDocument("<p>alpha beta gamma delta</p>", "Scene C")

      const snap1 = createSnapshotRecord(firstDoc, { createdAt: "2026-01-01T00:00:00.000Z" })
      const snap2 = createSnapshotRecord(secondDoc, { createdAt: "2026-01-02T00:00:00.000Z" })
      const snap3 = createSnapshotRecord(thirdDoc, { createdAt: "2026-01-03T00:00:00.000Z" })

      const withTwo = appendSnapshotWithLimit(appendSnapshotWithLimit([], snap1, 2), snap2, 2)
      const capped = appendSnapshotWithLimit(withTwo, snap3, 2)

      assert.equal(capped.length, 2)
      assert.equal(capped[0].id, snap2.id)
      assert.equal(capped[1].id, snap3.id)
    }),
  )

  results.push(
    await runTest("inline diff + plain text conversion support safe restore comparisons", () => {
      const before = htmlToPlainText("<p>Hello&nbsp;world</p><p>Old text</p>")
      const after = htmlToPlainText("<p>Hello world</p><p>New text appears</p>")
      const diff = buildInlineDiff(before, after)
      const inserts = diff.filter((segment) => segment.type === "insert").map((segment) => segment.text).join("")

      assert.equal(computeWordCountFromHtml("<p>Hello world from snapshot</p>"), 4)
      assert.equal(inserts.toLowerCase().includes("new"), true)
    }),
  )

  return summarizeSection("Snapshot Recovery Tests", results)
}

interface MockTauriState {
  dirs: Set<string>
  textFiles: Map<string, string>
  binaryFiles: Map<string, Uint8Array>
  saveDialogPath: string | null
  mkdirCalls: string[]
}

const joinPath = (...parts: string[]): string => {
  const joined = parts
    .map((part) => String(part || "").replace(/(^\/+|\/+$)/g, ""))
    .filter(Boolean)
    .join("/")
  return `/${joined}`
}

const createMockTauriWindow = (state: MockTauriState) => {
  return {
    __TAURI__: {
      invoke: async () => null,
      dialog: {
        open: async () => null,
        save: async () => state.saveDialogPath,
      },
      fs: {
        readTextFile: async (path: string) => {
          const value = state.textFiles.get(path)
          if (value === undefined) throw new Error(`Missing text file: ${path}`)
          return value
        },
        readBinaryFile: async (path: string) => {
          const value = state.binaryFiles.get(path)
          if (!value) throw new Error(`Missing binary file: ${path}`)
          return value
        },
        writeTextFile: async (pathOrOptions: string | { path: string; contents: string }, maybeContents?: string) => {
          const path = typeof pathOrOptions === "string" ? pathOrOptions : pathOrOptions.path
          const contents = typeof pathOrOptions === "string" ? maybeContents ?? "" : pathOrOptions.contents
          state.textFiles.set(path, contents)
        },
        writeBinaryFile: async (path: string, contents: Uint8Array) => {
          state.binaryFiles.set(path, contents)
        },
        exists: async (path: string) => {
          return state.dirs.has(path) || state.textFiles.has(path) || state.binaryFiles.has(path)
        },
        createDir: async (path: string, options?: { recursive?: boolean }) => {
          if (options?.recursive) {
            const parts = path.split("/").filter(Boolean)
            let current = ""
            for (const part of parts) {
              current += `/${part}`
              state.dirs.add(current)
            }
          } else {
            state.dirs.add(path)
          }
          state.mkdirCalls.push(path)
        },
        removeDir: async (path: string) => {
          state.dirs.delete(path)
        },
        removeFile: async (path: string) => {
          state.textFiles.delete(path)
          state.binaryFiles.delete(path)
        },
      },
      path: {
        join: async (...parts: string[]) => joinPath(...parts),
        appDir: async () => "/mock/app",
        appConfigDir: async () => "/mock/app-config",
        homeDir: async () => "/mock/home",
        documentDir: async () => "/mock/documents",
      },
      tauri: {
        convertFileSrc: (path: string) => `asset://${path}`,
      },
    },
  }
}

const runTauriReliabilityChecklist = async (): Promise<SectionSummary> => {
  const results: TestResult[] = []

  results.push(
    await runTest("tauri preferences path initializes config directory and defaults", async () => {
      const state: MockTauriState = {
        dirs: new Set<string>(),
        textFiles: new Map<string, string>(),
        binaryFiles: new Map<string, Uint8Array>(),
        saveDialogPath: "/mock/exports/manual-save.quill",
        mkdirCalls: [],
      }

      ;(globalThis as any).window = createMockTauriWindow(state)
      ;(globalThis as any).localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      }

      const unique = Date.now()
      const environmentModule = moduleExports<{ isTauri: boolean }>(
        await import(`../lib/environment.ts?stability=${unique}`),
      )
      assert.equal(environmentModule.isTauri, true)

      const preferencesModule = moduleExports<{
        loadPreferences: () => Promise<{
          theme: string
        }>
      }>(await import(`../lib/user-preferences.ts?stability=${unique}`))
      const preferences = await preferencesModule.loadPreferences()

      assert.equal(preferences.theme, "system")
      assert.equal(state.textFiles.has("/mock/app-config/preferences.json"), true)
      assert.equal(state.mkdirCalls.some((path) => path.includes("/mock/app-config")), true)
    }),
  )

  results.push(
    await runTest("save/open/restore path works with preferred directory and dialog fallback", async () => {
      const state: MockTauriState = {
        dirs: new Set<string>(["/mock"]),
        textFiles: new Map<string, string>(),
        binaryFiles: new Map<string, Uint8Array>(),
        saveDialogPath: "/mock/exports/dialog-save.quill",
        mkdirCalls: [],
      }

      ;(globalThis as any).window = createMockTauriWindow(state)
      ;(globalThis as any).localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      }

      const unique = Date.now() + 1
      const preferencesModule = moduleExports<{
        savePreferences: (preferences: {
          theme: "light" | "dark" | "system"
          fontSize: string
          projectDirectory: string
          recentProjects: Array<{ name: string; path: string; lastModified: string }>
        }) => Promise<void>
      }>(await import(`../lib/user-preferences.ts?stability=${unique}`))
      const projectIOModule = moduleExports<{
        saveProjectZip: (project: QuillProject) => Promise<{ success: boolean; filePath: string | null }>
        loadProjectZip: (
          file: File | ArrayBuffer | Uint8Array,
          filePath?: string,
        ) => Promise<QuillProject>
      }>(await import(`../lib/project-io.ts?stability=${unique}`))

      await preferencesModule.savePreferences({
        theme: "dark",
        fontSize: "16",
        projectDirectory: "/mock/workspace",
        recentProjects: [],
      })

      const project = createEmptyProject("Reliability Project")
      const firstSave = await projectIOModule.saveProjectZip(project)

      assert.equal(firstSave.success, true)
      assert.equal(firstSave.filePath, "/mock/workspace/Reliability Project.quill")
      assert.equal(state.binaryFiles.has("/mock/workspace/Reliability Project.quill"), true)
      assert.equal(state.dirs.has("/mock/workspace"), true)

      const savedBinary = state.binaryFiles.get("/mock/workspace/Reliability Project.quill")
      assert.ok(savedBinary)
      const loaded = await projectIOModule.loadProjectZip(savedBinary, "/mock/workspace/Reliability Project.quill")
      assert.equal(loaded.metadata.name, "Reliability Project")

      await preferencesModule.savePreferences({
        theme: "dark",
        fontSize: "16",
        projectDirectory: "",
        recentProjects: [],
      })
      const dialogSave = await projectIOModule.saveProjectZip(project)
      assert.equal(dialogSave.filePath, "/mock/exports/dialog-save.quill")
      assert.equal(state.binaryFiles.has("/mock/exports/dialog-save.quill"), true)
    }),
  )

  results.push(
    await runTest("crash-recovery safeguards remain present in workspace bootstrap/save flows", () => {
      const pageSource = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8")

      assert.equal(pageSource.includes("localStorage.setItem(\"quill-autosave-project\""), true)
      assert.equal(pageSource.includes("localStorage.removeItem(\"quill-autosave-project\""), true)
      assert.equal(pageSource.includes("Could not restore your last project"), true)
      assert.equal(pageSource.includes("createWorkspaceProject"), true)
    }),
  )

  results.push(
    await runTest("research quick-reference path remains wired for side-by-side context", () => {
      const pageSource = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8")
      const quickRefSource = readFileSync(resolve(process.cwd(), "components/quick-reference-pane.tsx"), "utf8")

      assert.equal(pageSource.includes("QuickReferencePane"), true)
      assert.equal(pageSource.includes("handleImportResearchFiles"), true)
      assert.equal(quickRefSource.includes("Quick Reference"), true)
    }),
  )

  return summarizeSection("Tauri Reliability Checklist", results)
}

const writeChecklist = (sections: SectionSummary[]) => {
  const generatedAt = new Date().toISOString()
  const lines: string[] = [
    "# Release Candidate Checklist",
    "",
    `Generated: ${generatedAt}`,
    "",
  ]

  for (const section of sections) {
    const sectionPass = passCount(section.results)
    const sectionFail = failCount(section.results)
    const icon = sectionFail === 0 ? "GREEN" : "RED"
    lines.push(`## ${section.title} (${icon})`)
    lines.push("")
    for (const result of section.results) {
      const marker = result.status === "pass" ? "[x]" : "[ ]"
      const time = `${result.durationMs.toFixed(2)}ms`
      const details = result.error ? ` - ${result.error}` : ""
      lines.push(`- ${marker} ${result.name} (${time})${details}`)
    }
    lines.push("")
    lines.push(`Summary: ${sectionPass} passed, ${sectionFail} failed`)
    lines.push("")
  }

  const totalTests = sections.reduce((count, section) => count + section.results.length, 0)
  const totalPassed = sections.reduce((count, section) => count + passCount(section.results), 0)
  const totalFailed = sections.reduce((count, section) => count + failCount(section.results), 0)
  lines.push(`Overall: ${totalPassed}/${totalTests} passed, ${totalFailed} failed`)

  const outputPath = resolve(process.cwd(), "RELEASE_CHECKLIST.md")
  writeFileSync(outputPath, lines.join("\n"))
}

const printResults = (sections: SectionSummary[]) => {
  console.log("Phase 7 Stabilization Results")
  console.log("================================")

  for (const section of sections) {
    console.log(`\n${section.title}`)
    console.log("-".repeat(section.title.length))
    for (const result of section.results) {
      const marker = result.status === "pass" ? "PASS" : "FAIL"
      const details = result.error ? ` | ${result.error}` : ""
      console.log(`${marker} ${result.name} (${result.durationMs.toFixed(2)}ms)${details}`)
    }
    console.log(`Section summary: ${passCount(section.results)} passed, ${failCount(section.results)} failed`)
  }
}

const main = async () => {
  const sections: SectionSummary[] = []
  sections.push(await runMigrationTests())
  sections.push(await runCompileRegressionTests())
  sections.push(await runSnapshotRecoveryTests())
  sections.push(await runTauriReliabilityChecklist())

  printResults(sections)
  writeChecklist(sections)

  const totalFailed = sections.reduce((count, section) => count + failCount(section.results), 0)
  if (totalFailed > 0) {
    console.error(`\nRelease candidate check failed with ${totalFailed} failing tests.`)
    process.exit(1)
  }

  console.log("\nRelease candidate check passed. Checklist is GREEN.")
}

void main()
