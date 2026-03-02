"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { List, Settings, FileText, Save, FolderOpen, Pencil, Check, X, Printer, Maximize, Minimize, Rows3, Target, BookOpen, ChevronLeft, ChevronRight } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TiptapEditor } from "@/components/tiptap-editor"
import { Outliner } from "@/components/outliner"
import { Inspector } from "@/components/inspector"
import { FlowMode, type FlowModeDocument } from "@/components/flow-mode"
import { TargetsDashboard } from "@/components/targets-dashboard"
import { QuickReferencePane } from "@/components/quick-reference-pane"
import { useTheme } from "next-themes"
import { ResizableSidebar } from "@/components/resizable"
import { SettingsDialog } from "@/components/settings-dialog"
import { InkAndQuillLogo } from "@/components/quill-logo"
import { Input } from "@/components/ui/input"
import {
  type QuillProject,
  type DocumentData,
  type DocumentComment,
  type DocumentSnapshot,
  type SnapshotTrigger,
  type ResearchItem,
  type ResearchItemType,
  type TargetsSettings,
  type TreeNode,
  type CompileOutputFormat,
  type ProjectSettings,
} from "@/lib/project-types"
import FileSidebar from "@/components/file-sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Import the new project-io functions
import { saveProjectZip, loadProjectZip } from "@/lib/project-io"
import { saveAs } from "file-saver"
import {
  extractCurrentProject,
  createEmptyProject,
  normalizeProject,
  getDefaultProjectSettings,
  buildMetadataDefaults,
  findTemplateForSectionType,
} from "@/lib/project-types"
import { addRecentProject, loadPreferences, normalizeTheme, updatePreference, type AppTheme } from "@/lib/user-preferences"
import HTMLToDOCX from "html-to-docx"
import JSZip from "jszip"
import { cn } from "@/lib/utils"
import { GlassIconButton, GlassPanel, GlassSegmented, GlassToolbarGroup } from "@/components/glass-ui"
import { buildCompileBundle } from "@/lib/compile-pipeline"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Import environment check
import { isTauri } from "@/lib/environment"
import {
  appendSnapshotWithLimit,
  computeWordCountFromHtml,
  createSnapshotRecord,
  htmlToPlainText,
} from "@/lib/snapshot-utils"
import type { EditorCommentDraft } from "@/lib/comment-utils"

// Change the viewMode type to remove "corkboard"
const applySnapshotToDocument = (
  document: DocumentData,
  trigger: SnapshotTrigger,
  maxSnapshotsPerDocument: number,
  options?: {
    note?: string
    includeEmptyDocuments?: boolean
  },
): DocumentData => {
  const includeEmptyDocuments = options?.includeEmptyDocuments ?? false
  if (!includeEmptyDocuments && htmlToPlainText(document.content || "").trim().length === 0) {
    return document
  }

  const nextSnapshot = createSnapshotRecord(document, {
    note: options?.note,
    trigger,
  })

  const existingSnapshots = document.snapshots ?? []
  const nextSnapshots = appendSnapshotWithLimit(existingSnapshots, nextSnapshot, maxSnapshotsPerDocument)
  if (nextSnapshots === existingSnapshots) return document

  return {
    ...document,
    snapshots: nextSnapshots,
    lastModified: new Date().toISOString(),
  }
}

const applySnapshotTriggerToDocuments = (
  sourceDocuments: Record<string, DocumentData>,
  trigger: SnapshotTrigger,
  maxSnapshotsPerDocument: number,
  options?: {
    note?: string
    includeEmptyDocuments?: boolean
  },
): { documents: Record<string, DocumentData>; changed: boolean } => {
  let changed = false
  const nextDocuments: Record<string, DocumentData> = {}

  for (const [documentId, document] of Object.entries(sourceDocuments)) {
    const nextDocument = applySnapshotToDocument(document, trigger, maxSnapshotsPerDocument, options)
    nextDocuments[documentId] = nextDocument
    if (nextDocument !== document) {
      changed = true
    }
  }

  if (!changed) {
    return { documents: sourceDocuments, changed: false }
  }

  return { documents: nextDocuments, changed: true }
}

const findNodeById = (nodes: TreeNode[], nodeId: string): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === nodeId) return node
    if (node.children?.length) {
      const found = findNodeById(node.children, nodeId)
      if (found) return found
    }
  }
  return null
}

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

const getTodayKey = (): string => {
  return new Date().toISOString().slice(0, 10)
}

const calculateProjectWordCount = (sourceDocuments: Record<string, DocumentData>): number => {
  return Object.values(sourceDocuments).reduce((total, document) => total + (document.wordCount || 0), 0)
}

const insertNodeUnderParent = (nodes: TreeNode[], parentId: string | null, newNode: TreeNode): TreeNode[] => {
  if (parentId === null) {
    return [...nodes, newNode]
  }

  return nodes.map((node) => {
    if (node.id === parentId && node.type === "folder") {
      return {
        ...node,
        children: [...(node.children ?? []), newNode],
      }
    }
    if (node.children?.length) {
      return {
        ...node,
        children: insertNodeUnderParent(node.children, parentId, newNode),
      }
    }
    return node
  })
}

const inferResearchTypeFromPath = (path: string): ResearchItemType => {
  const lowerPath = path.toLowerCase()
  if (lowerPath.endsWith(".pdf")) return "pdf"
  if (
    lowerPath.endsWith(".png") ||
    lowerPath.endsWith(".jpg") ||
    lowerPath.endsWith(".jpeg") ||
    lowerPath.endsWith(".gif") ||
    lowerPath.endsWith(".webp") ||
    lowerPath.endsWith(".bmp") ||
    lowerPath.endsWith(".svg") ||
    lowerPath.endsWith(".avif") ||
    lowerPath.endsWith(".tif") ||
    lowerPath.endsWith(".tiff")
  ) {
    return "image"
  }
  return "note"
}

const getFileNameFromPath = (path: string): string => {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

const stripFileExtension = (name: string): string => {
  return name.replace(/\.[^/.]+$/, "")
}

const plainTextToHtml = (value: string): string => {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

  const paragraphs = escaped
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return ""
  return paragraphs.map((line) => `<p>${line}</p>`).join("")
}

const INSPECTOR_WIDTH_REM = 24

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<"document" | "flow" | "outliner" | "targets">("document")
  const [focusMode, setFocusMode] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  const [showSaveNotification, setShowSaveNotification] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<QuillProject | null>(null)
  const [projectFilePath, setProjectFilePath] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Record<string, DocumentData>>({})
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(getDefaultProjectSettings())
  const [projectName, setProjectName] = useState("Untitled Project")
  const [fontSize, setFontSize] = useState("16")
  const [compileDialogOpen, setCompileDialogOpen] = useState(false)
  const [selectedCompilePresetId, setSelectedCompilePresetId] = useState("")
  const [selectedCompileFormat, setSelectedCompileFormat] = useState<CompileOutputFormat>("docx")
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [editedProjectName, setEditedProjectName] = useState(projectName)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [isProjectBootstrapComplete, setIsProjectBootstrapComplete] = useState(false)
  const [startupMessage, setStartupMessage] = useState<string | null>(null)
  const [startupMessageDismissed, setStartupMessageDismissed] = useState(false)
  const [sessionStartedAt, setSessionStartedAt] = useState<string>(new Date().toISOString())
  const [sessionStartWordCount, setSessionStartWordCount] = useState(0)
  const [quickReferenceOpen, setQuickReferenceOpen] = useState(true)
  const [quickReferenceNodeId, setQuickReferenceNodeId] = useState<string | null>(null)
  const lastViewModeRef = useRef(viewMode)
  const bootstrappedProjectRef = useRef(false)
  const previousProjectWordCountRef = useRef(0)
  const lastPersistedThemeRef = useRef<AppTheme | null>(null)
  const lastPersistedFontSizeRef = useRef<string | null>(null)
  const saveInProgressRef = useRef(false)
  const pendingAutoSaveRef = useRef(false)
  const pendingManualSaveRef = useRef(false)
  const applyProjectToStateRef = useRef<(project: QuillProject, filePath: string | null, preferredNodeId?: string | null) => void>(() => {})
  const createWorkspaceProjectRef = useRef<(name?: string) => Promise<{ project: QuillProject; filePath: string }>>(
    async () => {
      throw new Error("Workspace project creator is not initialized.")
    },
  )
  const openProjectFromPathRef = useRef<(filePath: string) => Promise<void>>(async () => {})
  const handleNewProjectRef = useRef<() => Promise<void>>(async () => {})
  const handleOpenProjectFileRef = useRef<() => Promise<void>>(async () => {})
  const handleSaveProjectRef = useRef<(isAutoSave?: boolean) => Promise<void>>(async () => {})
  const handleSaveProjectAsRef = useRef<() => Promise<void>>(async () => {})
  const menuActionsRef = useRef({
    newProject: () => {},
    openProject: () => {},
    saveProject: () => {},
    saveProjectAs: () => {},
    openSettings: () => {},
  })
  const compileFormatLabels: Record<CompileOutputFormat, string> = {
    docx: "DOCX",
    markdown: "Markdown",
    html: "HTML",
    txt: "Plain Text",
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const clearAutosaveBackup = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("quill-autosave-project")
      } catch (error) {
        console.warn("Failed to clear autosave backup:", error)
      }
    }
  }

  const writeAutosaveBackup = (project: QuillProject) => {
    if (typeof window === "undefined") return
    try {
      localStorage.setItem("quill-autosave-project", JSON.stringify(project))
    } catch (error) {
      console.error("Failed to persist autosave backup:", error)
    }
  }

  // Add this useEffect to load preferences
  useEffect(() => {
    let cancelled = false

    const hydratePreferences = async () => {
      try {
        const prefs = await loadPreferences()
        if (cancelled) return

        const preferredTheme = normalizeTheme(prefs.theme)
        setTheme(preferredTheme)
        lastPersistedThemeRef.current = preferredTheme

        const preferredFontSize = normalizeFontSizeValue(prefs.fontSize)
        setFontSize(preferredFontSize)
        lastPersistedFontSizeRef.current = preferredFontSize
      } catch (error) {
        console.error("Failed to load preferences:", error)
      } finally {
        if (!cancelled) {
          setPreferencesLoaded(true)
        }
      }
    }

    hydratePreferences()

    return () => {
      cancelled = true
    }
  }, [setTheme])

  useEffect(() => {
    if (!preferencesLoaded || !theme) return

    const normalized = normalizeTheme(theme)
    if (lastPersistedThemeRef.current === normalized) return

    updatePreference("theme", normalized).catch((error) => {
      console.error("Failed to persist theme preference:", error)
    })

    lastPersistedThemeRef.current = normalized
  }, [preferencesLoaded, theme])

  useEffect(() => {
    if (!preferencesLoaded) return

    const normalized = normalizeFontSizeValue(fontSize)
    if (fontSize !== normalized) {
      setFontSize(normalized)
      return
    }

    if (lastPersistedFontSizeRef.current === normalized) return

    updatePreference("fontSize", normalized).catch((error) => {
      console.error("Failed to persist font size preference:", error)
    })

    lastPersistedFontSizeRef.current = normalized
  }, [preferencesLoaded, fontSize])

  useEffect(() => {
    if (startupMessage) {
      setStartupMessageDismissed(false)
    }
  }, [startupMessage])

  useEffect(() => {
    if (projectSettings.compilePresets.length === 0) return

    const isSelectedValid = projectSettings.compilePresets.some((preset) => preset.id === selectedCompilePresetId)
    if (!isSelectedValid) {
      const fallbackId = projectSettings.defaultCompilePresetId || projectSettings.compilePresets[0].id
      setSelectedCompilePresetId(fallbackId)
      const fallbackPreset = projectSettings.compilePresets.find((preset) => preset.id === fallbackId)
      if (fallbackPreset?.outputFormat) {
        setSelectedCompileFormat(fallbackPreset.outputFormat)
      }
    }
  }, [projectSettings.compilePresets, projectSettings.defaultCompilePresetId, selectedCompilePresetId])

  const showProjectSavedNotification = () => {
    setShowSaveNotification(true)
    setTimeout(() => {
      setShowSaveNotification(false)
    }, 2000)
  }

  const normalizeProjectName = (value: unknown): string => {
    return typeof value === "string" && value.trim() ? value.trim() : "Untitled Project"
  }

  const normalizeFontSizeValue = (value: unknown): string => {
    if (typeof value !== "string") return "16"
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return "16"
    return String(Math.min(36, Math.max(10, parsed)))
  }

  const sanitizeProjectFileNameBase = (value: string): string => {
    return value.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || "Untitled Project"
  }

  const isUntitledProjectFileName = (value: string): boolean => {
    return /^untitled project(?: \d+)?\.quill$/i.test(value.trim())
  }

  const normalizeFilePath = (value: string): string => {
    const trimmed = value.trim()
    if (!trimmed.toLowerCase().startsWith("file://")) return trimmed

    try {
      const parsed = new URL(trimmed)
      let pathname = decodeURIComponent(parsed.pathname || "")
      if (/^\/[a-zA-Z]:/.test(pathname)) {
        pathname = pathname.slice(1)
      }
      return pathname || trimmed
    } catch {
      const withoutScheme = trimmed.replace(/^file:\/\//i, "")
      return decodeURIComponent(withoutScheme.replace(/^\/([a-zA-Z]:)/, "$1"))
    }
  }

  const normalizeDialogPath = (selection: unknown): string | null => {
    const normalizeCandidate = (candidate: unknown): string | null => {
      if (typeof candidate === "string" && candidate.trim()) {
        return normalizeFilePath(candidate)
      }

      if (candidate && typeof candidate === "object") {
        const maybePath = (candidate as { path?: unknown }).path
        if (typeof maybePath === "string" && maybePath.trim()) {
          return normalizeFilePath(maybePath)
        }
      }

      return null
    }

    if (Array.isArray(selection)) {
      for (const entry of selection) {
        const normalized = normalizeCandidate(entry)
        if (normalized) return normalized
      }
      return null
    }

    return normalizeCandidate(selection)
  }

  const findPreferredDocumentId = (nodes: TreeNode[]): string | null => {
    let firstDocument: string | null = null

    const walk = (list: TreeNode[]): boolean => {
      for (const node of list) {
        if (node.type === "document") {
          if (!firstDocument) {
            firstDocument = node.id
          }
          if (node.label === "Scene 1") {
            firstDocument = node.id
            return true
          }
        }

        if (node.children?.length && walk(node.children)) {
          return true
        }
      }

      return false
    }

    walk(nodes)
    return firstDocument
  }

  const createDocumentForNode = (node: TreeNode, settings: ProjectSettings): DocumentData => {
    const now = new Date().toISOString()
    const isResearchNode = node.sectionType === "research"
    const template =
      (node.metadataTemplateId
        ? settings.metadataTemplates.find((entry) => entry.id === node.metadataTemplateId) ?? null
        : null) ?? findTemplateForSectionType(settings.metadataTemplates, node.sectionType ?? "scene")
    const metadata = buildMetadataDefaults(settings.metadataFields, template)

    return {
      content: "",
      synopsis: "",
      notes: "",
      wordTarget: settings.targetsSettings.defaultDocumentWordTarget,
      research: isResearchNode
        ? {
            type: "note",
            importedAt: now,
          }
        : undefined,
      snapshots: [],
      comments: [],
      status: typeof metadata.status === "string" ? metadata.status : "to-do",
      label: typeof metadata.label === "string" ? metadata.label : "none",
      keywords: typeof metadata.keywords === "string" ? metadata.keywords : "",
      metadata,
      wordCount: 0,
      createdAt: now,
      lastModified: now,
    }
  }

  const applyProjectToState = (project: QuillProject, filePath: string | null, preferredNodeId?: string | null) => {
    const normalizedProject = normalizeProject(project)
    const safeName = normalizeProjectName(normalizedProject.metadata?.name)
    const selectedId = preferredNodeId ?? findPreferredDocumentId(normalizedProject.treeStructure)
    const projectWordCount = calculateProjectWordCount(normalizedProject.documents || {})

    setCurrentProject({
      ...normalizedProject,
      metadata: {
        ...normalizedProject.metadata,
        name: safeName,
      },
    })
    setProjectName(safeName)
    setTreeData(normalizedProject.treeStructure)
    setDocuments(normalizedProject.documents || {})
    setProjectSettings(normalizedProject.settings)
    setSelectedNode(selectedId)
    setQuickReferenceNodeId(null)
    setProjectFilePath(filePath)
    setSessionStartedAt(new Date().toISOString())
    setSessionStartWordCount(projectWordCount)
    previousProjectWordCountRef.current = projectWordCount
    clearAutosaveBackup()

    const defaultPresetId = normalizedProject.settings.defaultCompilePresetId || normalizedProject.settings.compilePresets[0]?.id || ""
    setSelectedCompilePresetId(defaultPresetId)
    const preset = normalizedProject.settings.compilePresets.find((entry) => entry.id === defaultPresetId)
    setSelectedCompileFormat((preset?.outputFormat as CompileOutputFormat) ?? "docx")

    if (normalizedProject.settings.theme) {
      setTheme(normalizeTheme(normalizedProject.settings.theme))
    }
    const normalizedFontSize = normalizeFontSizeValue(normalizedProject.settings.fontSize)
    setFontSize(normalizedFontSize)
    lastPersistedFontSizeRef.current = normalizedFontSize
  }
  applyProjectToStateRef.current = applyProjectToState

  const ensureDirectoryExists = async (path: string) => {
    if (!window.__TAURI__?.fs) return
    const exists = await window.__TAURI__.fs.exists(path)
    if (!exists) {
      await window.__TAURI__.fs.createDir(path, { recursive: true })
    }
  }

  const resolveWorkspaceDirectory = async (): Promise<string> => {
    const prefs = await loadPreferences()
    const preferredDirectory = prefs.projectDirectory?.trim()

    if (preferredDirectory) {
      await ensureDirectoryExists(preferredDirectory)
      return preferredDirectory
    }

    const appConfigDir = await window.__TAURI__.path.appConfigDir()
    const workspaceDir = await window.__TAURI__.path.join(appConfigDir, "workspace")
    await ensureDirectoryExists(workspaceDir)
    return workspaceDir
  }

  const createWorkspaceProject = async (name = "Untitled Project"): Promise<{ project: QuillProject; filePath: string }> => {
    const newProject = createEmptyProject(name)
    const workspaceDir = await resolveWorkspaceDirectory()
    const safeName = normalizeProjectName(newProject.metadata.name).replace(/[\\/:*?"<>|]/g, " ").trim() || "Untitled Project"

    let candidatePath = await window.__TAURI__.path.join(workspaceDir, `${safeName}.quill`)
    let suffix = 2
    while (await window.__TAURI__.fs.exists(candidatePath)) {
      candidatePath = await window.__TAURI__.path.join(workspaceDir, `${safeName} ${suffix}.quill`)
      suffix += 1
    }

    const zip = new JSZip()
    zip.file("project.json", JSON.stringify(newProject, null, 2))
    const zipData = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })

    await window.__TAURI__.fs.writeBinaryFile(candidatePath, zipData)
    await addRecentProject(newProject.metadata.name, candidatePath)
    return { project: newProject, filePath: candidatePath }
  }
  createWorkspaceProjectRef.current = createWorkspaceProject

  const openProjectFromPath = async (filePath: string) => {
    if (!window.__TAURI__?.fs) {
      throw new Error("Native file APIs are unavailable.")
    }

    const fileContent = await window.__TAURI__.fs.readBinaryFile(filePath)
    const project = await loadProjectZip(fileContent, filePath)
    applyProjectToState(project, filePath)

    if (project.settings.theme) {
      await updatePreference("theme", normalizeTheme(project.settings.theme))
    }
    await updatePreference("fontSize", normalizeFontSizeValue(project.settings.fontSize))
  }
  openProjectFromPathRef.current = openProjectFromPath

  const handleNewProject = async () => {
    setStartupMessage(null)

    if (isTauri && typeof window !== "undefined" && window.__TAURI__?.fs && window.__TAURI__?.path) {
      try {
        const { project, filePath } = await createWorkspaceProject()
        applyProjectToState(project, filePath)
        showProjectSavedNotification()
        return
      } catch (error) {
        console.error("Failed to create workspace project:", error)
      }
    }

    const newProject = createEmptyProject("Untitled Project")
    applyProjectToState(newProject, null)
    showProjectSavedNotification()
  }
  handleNewProjectRef.current = handleNewProject

  const handleOpenProjectFile = async () => {
    if (isTauri) {
      try {
        if (!window.__TAURI__?.dialog?.open || !window.__TAURI__?.fs?.readBinaryFile) {
          throw new Error("Native dialog APIs are unavailable.")
        }

        const selected = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [
            {
              name: "Quill Projects",
              extensions: ["quill"],
            },
          ],
        })

        const selectedPath = normalizeDialogPath(selected)
        if (!selectedPath) return

        await openProjectFromPath(selectedPath)
        setStartupMessage(null)
        showProjectSavedNotification()
      } catch (error) {
        console.error("Failed to open project:", error)
        if (fileInputRef.current) {
          fileInputRef.current.click()
          return
        }
        alert(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
      return
    }

    // Fallback for browser environment - use file input
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }
  handleOpenProjectFileRef.current = handleOpenProjectFile

  // Handle file selection (for browser fallback)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const project = await loadProjectZip(file)
      applyProjectToState(project, null)
      showProjectSavedNotification()
    } catch (error) {
      console.error("Failed to open project:", error)
      alert(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Ensure theme is only accessed client-side to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!preferencesLoaded || bootstrappedProjectRef.current || typeof window === "undefined") return
    bootstrappedProjectRef.current = true

    let cancelled = false

    const bootstrapProject = async () => {
      try {
        const prefs = await loadPreferences()
        const lastProjectPath =
          prefs.recentProjects.find((project) => typeof project.path === "string" && project.path && !project.path.startsWith("browser:"))
            ?.path ?? null

        if (isTauri && window.__TAURI__?.fs && window.__TAURI__?.path) {
          if (lastProjectPath) {
            const exists = await window.__TAURI__.fs.exists(lastProjectPath)
            if (exists) {
              await openProjectFromPathRef.current(lastProjectPath)
              if (!cancelled) {
                setStartupMessage(null)
              }
              return
            }
          }

          const { project, filePath } = await createWorkspaceProjectRef.current()
          if (!cancelled) {
            applyProjectToStateRef.current(project, filePath)
            if (lastProjectPath) {
              setStartupMessage(`Could not find your previously opened project at ${lastProjectPath}. A new workspace project was created.`)
            } else {
              setStartupMessage(null)
            }
          }
          return
        }

        const newProject = createEmptyProject("Untitled Project")
        if (!cancelled) {
          applyProjectToStateRef.current(newProject, null)
          setStartupMessage(null)
        }
      } catch (error) {
        console.error("Failed to bootstrap project:", error)
        if (isTauri && window.__TAURI__?.fs && window.__TAURI__?.path) {
          try {
            const { project, filePath } = await createWorkspaceProjectRef.current()
            if (!cancelled) {
              applyProjectToStateRef.current(project, filePath)
              setStartupMessage("Could not restore your last project. A new workspace project was created instead.")
            }
            return
          } catch (workspaceError) {
            console.error("Failed to create fallback workspace project:", workspaceError)
          }
        }

        const fallbackProject = createEmptyProject("Untitled Project")
        if (!cancelled) {
          applyProjectToStateRef.current(fallbackProject, null)
          setStartupMessage("Could not restore your last project. A new project has been created instead.")
        }
      } finally {
        if (!cancelled) {
          setIsProjectBootstrapComplete(true)
        }
      }
    }

    bootstrapProject()

    return () => {
      cancelled = true
    }
  }, [preferencesLoaded])

  // Setup auto-save effect
  useEffect(() => {
    // We only want to auto-save if we have a project loaded
    if (!currentProject || !mounted) return

    // Create a timeout to debounce saves
    const timer = window.setTimeout(() => {
      void handleSaveProjectRef.current(true) // Pass true to indicate it's an auto-save (silent)
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [treeData, documents, theme, fontSize, projectName, projectSettings, currentProject, mounted])

  useEffect(() => {
    if (!currentProject || !mounted) return

    const snapshotSettings = projectSettings.snapshotSettings
    if (!snapshotSettings.enabled || !snapshotSettings.autoOnInterval) return

    const intervalMs = snapshotSettings.intervalMinutes * 60 * 1000
    const timer = window.setInterval(() => {
      setDocuments((prev) => {
        const result = applySnapshotTriggerToDocuments(
          prev,
          "interval",
          snapshotSettings.maxSnapshotsPerDocument,
          { includeEmptyDocuments: false },
        )
        return result.changed ? result.documents : prev
      })
    }, intervalMs)

    return () => {
      window.clearInterval(timer)
    }
  }, [currentProject, mounted, projectSettings.snapshotSettings])

  useEffect(() => {
    if (!currentProject || !mounted) return

    const currentProjectWords = calculateProjectWordCount(documents)
    const previousProjectWords = previousProjectWordCountRef.current
    const delta = currentProjectWords - previousProjectWords

    if (delta > 0) {
      const todayKey = getTodayKey()
      setProjectSettings((previousSettings) => {
        const previousToday = previousSettings.targetsSettings.dailyWordHistory[todayKey] ?? 0
        return {
          ...previousSettings,
          targetsSettings: {
            ...previousSettings.targetsSettings,
            dailyWordHistory: {
              ...previousSettings.targetsSettings.dailyWordHistory,
              [todayKey]: previousToday + delta,
            },
          },
        }
      })
    }

    previousProjectWordCountRef.current = currentProjectWords
  }, [documents, currentProject, mounted])

  // Replace the handleSaveProject function with this updated version
  // isAutoSave flag prevents showing the success notification when saving in the background
  const handleSaveProject = async (isAutoSave = false) => {
    if (saveInProgressRef.current) {
      if (isAutoSave) {
        pendingAutoSaveRef.current = true
      } else {
        pendingManualSaveRef.current = true
      }
      return
    }

    saveInProgressRef.current = true

    try {
      let documentsForSave = documents
      if (!isAutoSave && projectSettings.snapshotSettings.enabled && projectSettings.snapshotSettings.autoOnManualSave) {
        const result = applySnapshotTriggerToDocuments(
          documents,
          "manual-save",
          projectSettings.snapshotSettings.maxSnapshotsPerDocument,
          { includeEmptyDocuments: false },
        )
        if (result.changed) {
          documentsForSave = result.documents
          setDocuments(result.documents)
        }
      }

      // Create or update the project
      const updatedProject = extractCurrentProject(
        currentProject,
        projectName,
        treeData,
        documentsForSave,
        normalizeTheme(theme),
        fontSize,
        projectSettings,
      )

      // Update the current project state
      setCurrentProject(updatedProject)

      // In Tauri, if we have a known file path we just silent-write it right back to disk.
      // If we don't have a path, we fall back to saveProjectZip which triggers a native Save As dialog or browser download.
      if (isTauri && projectFilePath) {
        try {
          let targetPath = projectFilePath
          if (!isAutoSave && window.__TAURI__?.path && window.__TAURI__?.fs) {
            const currentFileName = getFileNameFromPath(projectFilePath)
            const safeProjectFileBase = sanitizeProjectFileNameBase(normalizeProjectName(updatedProject.metadata.name))
            const isProjectNameUntitled = /^untitled project$/i.test(safeProjectFileBase)

            if (isUntitledProjectFileName(currentFileName) && !isProjectNameUntitled) {
              const separatorIndex = Math.max(projectFilePath.lastIndexOf("/"), projectFilePath.lastIndexOf("\\"))
              const parentDirectory = separatorIndex >= 0 ? projectFilePath.slice(0, separatorIndex) : ""
              let candidatePath = parentDirectory
                ? await window.__TAURI__.path.join(parentDirectory, `${safeProjectFileBase}.quill`)
                : `${safeProjectFileBase}.quill`
              let suffix = 2

              while (candidatePath !== projectFilePath && await window.__TAURI__.fs.exists(candidatePath)) {
                candidatePath = parentDirectory
                  ? await window.__TAURI__.path.join(parentDirectory, `${safeProjectFileBase} ${suffix}.quill`)
                  : `${safeProjectFileBase} ${suffix}.quill`
                suffix += 1
              }

              targetPath = candidatePath
            }
          }

          const zip = new JSZip()
          zip.file("project.json", JSON.stringify(updatedProject, null, 2))

          const zipData = await zip.generateAsync({
            type: "uint8array",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
          })

          await window.__TAURI__.fs.writeBinaryFile(targetPath, zipData)
          if (targetPath !== projectFilePath) {
            setProjectFilePath(targetPath)
            await addRecentProject(updatedProject.metadata.name, targetPath)
          }
          console.log(`Auto-saved project silently to ${targetPath}`)
          clearAutosaveBackup()

        } catch (error) {
          console.error("Failed background discrete save:", error)
          if (isAutoSave) {
            writeAutosaveBackup(updatedProject)
            console.log("Tauri auto-save fallback backed up to localStorage")
            return
          }
          // If background save fails, trigger the standard save flow
          const result = await saveProjectZip(updatedProject)
          if (result.success && result.filePath) {
            setProjectFilePath(result.filePath)
          }
          if (result.success && !isAutoSave) {
            setShowSaveNotification(true)
            setTimeout(() => setShowSaveNotification(false), 2000)
          }
          if (result.success) {
            clearAutosaveBackup()
          }
        }
      } else {
        // Never open a native Save As dialog from background auto-save in Tauri.
        // Keep a local backup until the user explicitly chooses where to save.
        if (isTauri && isAutoSave && !projectFilePath) {
          writeAutosaveBackup(updatedProject)
          console.log("Tauri auto-save backed up to localStorage (project has no file path yet)")
          return
        }

        // Browser fallback or first-time save in Tauri (no filepath yet)
        // Only trigger explicit save in browser if it's NOT an auto-save (otherwise it spams downloads)
        if (!isAutoSave || (isTauri && !projectFilePath)) {
          const result = await saveProjectZip(updatedProject)
          if (result.success && result.filePath) {
            setProjectFilePath(result.filePath)
          }
          if (result.success && !isAutoSave) {
            setShowSaveNotification(true)
            setTimeout(() => setShowSaveNotification(false), 2000)
          }
          if (result.success) {
            clearAutosaveBackup()
          }
        } else if (!isTauri && isAutoSave) {
          // For browser auto-save, we'll store it in localStorage as a backup
          writeAutosaveBackup(updatedProject)
          console.log("Browser auto-save backed up to localStorage")
        }
      }
    } catch (error) {
      console.error("Failed to save project:", error)
      if (!isAutoSave) {
        alert("Failed to save project. Please try again.")
      }
    } finally {
      saveInProgressRef.current = false

      if (pendingManualSaveRef.current || pendingAutoSaveRef.current) {
        const shouldRunManualSave = pendingManualSaveRef.current
        pendingManualSaveRef.current = false
        pendingAutoSaveRef.current = false
        window.setTimeout(() => {
          void handleSaveProjectRef.current(!shouldRunManualSave)
        }, 0)
      }
    }
  }
  handleSaveProjectRef.current = handleSaveProject

  const handleSaveProjectAs = async () => {
    try {
      const updatedProject = extractCurrentProject(
        currentProject,
        projectName,
        treeData,
        documents,
        normalizeTheme(theme),
        fontSize,
        projectSettings,
      )

      setCurrentProject(updatedProject)

      if (isTauri && window.__TAURI__?.dialog?.save && window.__TAURI__?.fs?.writeBinaryFile) {
        const suggestedName = `${sanitizeProjectFileNameBase(normalizeProjectName(updatedProject.metadata.name))}.quill`
        const selectedPath = await window.__TAURI__.dialog.save({
          filters: [{ name: "Quill Project", extensions: ["quill"] }],
          defaultPath: suggestedName,
        })

        if (!selectedPath) return
        const normalizedSavePath = selectedPath.toLowerCase().endsWith(".quill") ? selectedPath : `${selectedPath}.quill`

        const zip = new JSZip()
        zip.file("project.json", JSON.stringify(updatedProject, null, 2))

        const zipData = await zip.generateAsync({
          type: "uint8array",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        })

        await window.__TAURI__.fs.writeBinaryFile(normalizedSavePath, zipData)
        await addRecentProject(updatedProject.metadata.name, normalizedSavePath)
        setProjectFilePath(normalizedSavePath)
        clearAutosaveBackup()
        showProjectSavedNotification()
        return
      }

      const result = await saveProjectZip(updatedProject)
      if (result.success && result.filePath) {
        setProjectFilePath(result.filePath)
      }
      if (result.success) {
        clearAutosaveBackup()
        showProjectSavedNotification()
      }
    } catch (error) {
      console.error("Failed to save project as:", error)
      alert(`Failed to save project: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }
  handleSaveProjectAsRef.current = handleSaveProjectAs

  const handleSaveProjectName = () => {
    if (editedProjectName.trim()) {
      setProjectName(editedProjectName.trim())

      // Update the current project with the new name
      if (currentProject) {
        const updatedProject = {
          ...currentProject,
          metadata: {
            ...currentProject.metadata,
            name: editedProjectName.trim(),
            lastModified: new Date().toISOString(),
          },
        }
        setCurrentProject(updatedProject)
      }

      setIsEditingProjectName(false)

      // Show save notification
      setShowSaveNotification(true)
      setTimeout(() => {
        setShowSaveNotification(false)
      }, 2000)
    }
  }

  // Handle tree changes from the FileSidebar component
  const collectDocIds = (nodes: TreeNode[], acc: string[] = []) => {
    for (const n of nodes) {
      if (n.type === "document") acc.push(n.id)
      if (n.children?.length) collectDocIds(n.children, acc)
    }
    return acc
  }

  const collectFlowDocuments = (
    nodes: TreeNode[],
    sourceDocuments: Record<string, DocumentData>,
    acc: FlowModeDocument[] = [],
  ): FlowModeDocument[] => {
    for (const node of nodes) {
      if (node.type === "document") {
        const doc = sourceDocuments[node.id]
        acc.push({
          id: node.id,
          title: node.label || "Untitled Document",
          content: doc?.content || "",
        })
      }
      if (node.children?.length) {
        collectFlowDocuments(node.children, sourceDocuments, acc)
      }
    }
    return acc
  }

  const resolveInsertParentId = (nodes: TreeNode[], preferredParentId: string | null): string | null => {
    if (preferredParentId) {
      const candidateParent = findNodeById(nodes, preferredParentId)
      if (candidateParent?.type === "folder") {
        return preferredParentId
      }
    }

    const rootFolder = nodes.find((node) => node.type === "folder" && node.id === "root")
    if (rootFolder) return rootFolder.id

    const firstFolder = nodes.find((node) => node.type === "folder")
    return firstFolder?.id ?? null
  }

  const createResearchDocument = (
    label: string,
    itemType: ResearchItemType,
    options?: {
      sourcePath?: string
      sourceUrl?: string
      sourceName?: string
      indexedText?: string
      initialText?: string
    },
  ): { node: TreeNode; document: DocumentData } => {
    const now = new Date().toISOString()
    const documentId = `research-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const template = findTemplateForSectionType(projectSettings.metadataTemplates, "research")
    const metadata = buildMetadataDefaults(projectSettings.metadataFields, template)
    const noteText = options?.initialText?.trim() || ""
    const indexedText = options?.indexedText || (noteText ? noteText.slice(0, 4000) : undefined)
    const content = noteText ? plainTextToHtml(noteText) : ""
    const wordCount = noteText
      ? noteText
        .split(/\s+/)
        .map((entry) => entry.trim())
        .filter(Boolean).length
      : 0

    return {
      node: {
        id: documentId,
        label,
        type: "document",
        sectionType: "research",
        includeInCompile: false,
        metadataTemplateId: template?.id ?? null,
      },
      document: {
        content,
        synopsis: "",
        notes: "",
        wordTarget: projectSettings.targetsSettings.defaultDocumentWordTarget,
        research: {
          type: itemType,
          sourcePath: options?.sourcePath,
          sourceUrl: options?.sourceUrl,
          sourceName: options?.sourceName,
          indexedText,
          importedAt: now,
        },
        snapshots: [],
        comments: [],
        status: typeof metadata.status === "string" ? metadata.status : "draft",
        label: typeof metadata.label === "string" ? metadata.label : "reference",
        keywords: typeof metadata.keywords === "string" ? metadata.keywords : "research",
        metadata,
        wordCount,
        createdAt: now,
        lastModified: now,
      },
    }
  }

  const handleCreateResearchItem = (preferredParentId: string | null, itemType: ResearchItemType) => {
    let sourceUrl: string | undefined
    let label = itemType === "link" ? "Research Link" : "Research Note"

    if (itemType === "link") {
      const response = window.prompt("Enter the reference URL", "https://")
      if (response === null) return
      const trimmedUrl = response.trim()
      sourceUrl = trimmedUrl || undefined
      if (trimmedUrl) {
        try {
          const parsed = new URL(trimmedUrl)
          if (parsed.hostname) {
            label = parsed.hostname.replace(/^www\./, "")
          }
        } catch {
          label = "Research Link"
        }
      }
    }

    const { node, document } = createResearchDocument(label, itemType, {
      sourceUrl,
    })
    setTreeData((prev) => {
      const parentId = resolveInsertParentId(prev, preferredParentId)
      return insertNodeUnderParent(prev, parentId, node)
    })
    setDocuments((prev) => ({
      ...prev,
      [node.id]: document,
    }))
    setSelectedNode(node.id)
    setQuickReferenceNodeId(node.id)
    setQuickReferenceOpen(true)
  }

  const handleImportResearchFiles = async (preferredParentId: string | null) => {
    if (!isTauri || !window.__TAURI__?.dialog?.open) {
      alert("Research file import is currently available in the desktop app.")
      return
    }

    try {
      const selected = await window.__TAURI__.dialog.open({
        multiple: true,
        filters: [
          {
            name: "Research Files",
            extensions: ["pdf", "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "txt", "md"],
          },
        ],
      })

      const selectedPaths = Array.isArray(selected) ? selected : selected ? [selected] : []
      const normalizedPaths = selectedPaths.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      if (normalizedPaths.length === 0) return

      const nodesToInsert: TreeNode[] = []
      const nextDocuments: Record<string, DocumentData> = {}

      for (const path of normalizedPaths) {
        const sourceName = getFileNameFromPath(path)
        const label = stripFileExtension(sourceName) || "Research Item"
        const itemType = inferResearchTypeFromPath(path)
        let initialText = ""
        let indexedText = ""

        if (itemType === "note" && window.__TAURI__?.fs?.readTextFile) {
          try {
            const importedText = await window.__TAURI__.fs.readTextFile(path)
            initialText = importedText.slice(0, 30000)
            indexedText = importedText.slice(0, 4000)
          } catch (error) {
            console.warn("Could not index text from research file:", path, error)
          }
        }

        const { node, document } = createResearchDocument(label, itemType, {
          sourcePath: path,
          sourceName,
          indexedText: indexedText || undefined,
          initialText: initialText || undefined,
        })

        nodesToInsert.push(node)
        nextDocuments[node.id] = document
      }

      if (nodesToInsert.length === 0) return

      setTreeData((prev) => {
        const parentId = resolveInsertParentId(prev, preferredParentId)
        let updated = prev
        for (const node of nodesToInsert) {
          updated = insertNodeUnderParent(updated, parentId, node)
        }
        return updated
      })

      setDocuments((prev) => ({
        ...prev,
        ...nextDocuments,
      }))

      const firstImportedId = nodesToInsert[0].id
      setSelectedNode(firstImportedId)
      setQuickReferenceNodeId(firstImportedId)
      setQuickReferenceOpen(true)
      showProjectSavedNotification()
    } catch (error) {
      console.error("Failed to import research items:", error)
      alert(`Failed to import research: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleTreeChange = (updatedTreeData: TreeNode[]) => {
    const normalized = normalizeProject({
      metadata: currentProject?.metadata ?? {
        name: projectName,
        version: "1.2.0",
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      },
      settings: {
        ...projectSettings,
        theme: normalizeTheme(theme),
        fontSize,
      },
      treeStructure: updatedTreeData,
      documents,
    })

    setTreeData(normalized.treeStructure)
    setDocuments(normalized.documents)
    setProjectSettings(normalized.settings)

    const allowed = new Set(collectDocIds(normalized.treeStructure))
    if (selectedNode && !allowed.has(selectedNode)) {
      const firstDoc = collectDocIds(normalized.treeStructure)[0] ?? null
      setSelectedNode(firstDoc)
    }
  }

  const updateNodeById = (nodes: TreeNode[], nodeId: string, updater: (node: TreeNode) => TreeNode): TreeNode[] => {
    return nodes.map((node) => {
      if (node.id === nodeId) {
        return updater(node)
      }
      if (node.children?.length) {
        return {
          ...node,
          children: updateNodeById(node.children, nodeId, updater),
        }
      }
      return node
    })
  }

  const handleNodeUpdate = (nodeId: string, patch: Partial<TreeNode>) => {
    setTreeData((prev) => updateNodeById(prev, nodeId, (node) => ({ ...node, ...patch })))
  }

  const handleProjectSettingsUpdate = (nextSettings: ProjectSettings) => {
    const normalized = normalizeProject({
      metadata: currentProject?.metadata ?? {
        name: projectName,
        version: "1.2.0",
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      },
      settings: {
        ...nextSettings,
        theme: normalizeTheme(theme),
        fontSize,
      },
      treeStructure: treeData,
      documents,
    })

    setProjectSettings(normalized.settings)
    setTreeData(normalized.treeStructure)
    setDocuments(normalized.documents)
  }

  const applyDocumentPatch = (documentId: string, data: Partial<DocumentData>) => {
    setDocuments((prev) => {
      const node = findNodeById(treeData, documentId) ?? {
        id: documentId,
        label: "Untitled Document",
        type: "document" as const,
        sectionType: "scene" as const,
        includeInCompile: true,
        metadataTemplateId: null,
      }

      const existing = prev[documentId] ?? createDocumentForNode(node, projectSettings)
      const nextMetadata = {
        ...existing.metadata,
        ...(data.metadata || {}),
      }

      if (typeof data.status === "string") nextMetadata.status = data.status
      if (typeof data.label === "string") nextMetadata.label = data.label
      if (typeof data.keywords === "string") nextMetadata.keywords = data.keywords

      const nextDoc: DocumentData = {
        ...existing,
        ...data,
        metadata: nextMetadata,
        status: typeof nextMetadata.status === "string" ? nextMetadata.status : existing.status,
        label: typeof nextMetadata.label === "string" ? nextMetadata.label : existing.label,
        keywords: typeof nextMetadata.keywords === "string" ? nextMetadata.keywords : existing.keywords,
        lastModified: new Date().toISOString(),
      }

      return {
        ...prev,
        [documentId]: nextDoc,
      }
    })
  }

  const handleResearchItemUpdate = (documentId: string, patch: Partial<ResearchItem>) => {
    setDocuments((prev) => {
      const existingDocument = prev[documentId]
      if (!existingDocument) return prev

      const existingResearch = existingDocument.research ?? { type: "note" as const }
      const nextResearch: ResearchItem = {
        ...existingResearch,
        ...patch,
      }

      return {
        ...prev,
        [documentId]: {
          ...existingDocument,
          research: nextResearch,
          lastModified: new Date().toISOString(),
        },
      }
    })
  }

  const handleCreateDocumentComment = (documentId: string, draft: EditorCommentDraft) => {
    setDocuments((prev) => {
      const existingDocument = prev[documentId]
      if (!existingDocument) return prev

      const now = new Date().toISOString()
      const existingComments = existingDocument.comments ?? []
      const existingIndex = existingComments.findIndex((comment) => comment.id === draft.id)

      let nextComments: DocumentComment[]
      if (existingIndex >= 0) {
        nextComments = existingComments.map((comment) =>
          comment.id === draft.id
            ? {
                ...comment,
                text: draft.text,
                quote: draft.quote,
                updatedAt: now,
              }
            : comment,
        )
      } else {
        nextComments = [
          ...existingComments,
          {
            id: draft.id,
            text: draft.text,
            quote: draft.quote,
            resolved: false,
            createdAt: now,
            updatedAt: now,
          },
        ]
      }

      return {
        ...prev,
        [documentId]: {
          ...existingDocument,
          comments: nextComments,
          lastModified: now,
        },
      }
    })
  }

  const handleTargetsSettingsChange = (patch: Partial<TargetsSettings>) => {
    setProjectSettings((previousSettings) => ({
      ...previousSettings,
      targetsSettings: {
        ...previousSettings.targetsSettings,
        ...patch,
        sessionWordTarget: clampNumber(
          patch.sessionWordTarget ?? previousSettings.targetsSettings.sessionWordTarget,
          100,
          500000,
        ),
        projectWordTarget: clampNumber(
          patch.projectWordTarget ?? previousSettings.targetsSettings.projectWordTarget,
          1000,
          2000000,
        ),
        defaultDocumentWordTarget: clampNumber(
          patch.defaultDocumentWordTarget ?? previousSettings.targetsSettings.defaultDocumentWordTarget,
          100,
          500000,
        ),
        dailyWordHistory: patch.dailyWordHistory ?? previousSettings.targetsSettings.dailyWordHistory,
      },
    }))
  }

  const handleDocumentWordTargetChange = (documentId: string, target: number) => {
    const normalizedTarget = clampNumber(target, 100, 500000)
    setDocuments((previousDocuments) => {
      const existing = previousDocuments[documentId]
      if (!existing) return previousDocuments
      if (existing.wordTarget === normalizedTarget) return previousDocuments

      return {
        ...previousDocuments,
        [documentId]: {
          ...existing,
          wordTarget: normalizedTarget,
          lastModified: new Date().toISOString(),
        },
      }
    })
  }

  const handleResetSessionTargets = () => {
    const currentWords = calculateProjectWordCount(documents)
    setSessionStartedAt(new Date().toISOString())
    setSessionStartWordCount(currentWords)
  }

  const handleCreateDocumentSnapshot = (documentId: string, note?: string) => {
    const snapshotSettings = projectSettings.snapshotSettings
    if (!snapshotSettings.enabled) return

    setDocuments((prev) => {
      const targetDocument = prev[documentId]
      if (!targetDocument) return prev

      const nextDocument = applySnapshotToDocument(targetDocument, "manual", snapshotSettings.maxSnapshotsPerDocument, {
        note,
        includeEmptyDocuments: true,
      })
      if (nextDocument === targetDocument) return prev

      return {
        ...prev,
        [documentId]: nextDocument,
      }
    })
  }

  const handleRestoreDocumentSnapshot = (documentId: string, snapshot: DocumentSnapshot) => {
    const snapshotSettings = projectSettings.snapshotSettings

    setDocuments((prev) => {
      const targetDocument = prev[documentId]
      if (!targetDocument) return prev

      let workingDocument = targetDocument
      if (snapshotSettings.enabled && snapshotSettings.autoBeforeRestore) {
        workingDocument = applySnapshotToDocument(
          workingDocument,
          "before-restore",
          snapshotSettings.maxSnapshotsPerDocument,
          {
            note: `Safety snapshot before restore ${new Date().toLocaleString()}`,
            includeEmptyDocuments: true,
          },
        )
      }

      const restoredDocument: DocumentData = {
        ...workingDocument,
        content: snapshot.content,
        wordCount: Number.isFinite(snapshot.wordCount) ? snapshot.wordCount : computeWordCountFromHtml(snapshot.content),
        lastModified: new Date().toISOString(),
      }

      return {
        ...prev,
        [documentId]: restoredDocument,
      }
    })
  }

  const openCompileDialog = () => {
    const defaultPresetId = selectedCompilePresetId || projectSettings.defaultCompilePresetId || projectSettings.compilePresets[0]?.id || ""
    setSelectedCompilePresetId(defaultPresetId)
    const matchedPreset = projectSettings.compilePresets.find((entry) => entry.id === defaultPresetId)
    if (matchedPreset?.outputFormat) {
      setSelectedCompileFormat(matchedPreset.outputFormat)
    }
    setCompileDialogOpen(true)
  }

  const handleCompile = async () => {
    try {
      const projectForCompile = extractCurrentProject(
        currentProject,
        projectName,
        treeData,
        documents,
        normalizeTheme(theme),
        fontSize,
        projectSettings,
      )

      const bundle = buildCompileBundle(projectForCompile, selectedCompilePresetId, selectedCompileFormat)
      const format = bundle.outputFormat
      const extension = format === "markdown" ? "md" : format

      if (format === "docx") {
        const docxBuffer = await HTMLToDOCX(bundle.html, null, {
          title: bundle.title,
          creator: "Ink & Quill",
        })
        const blob = new Blob([docxBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })

        if (isTauri) {
          const selectedPath = await window.__TAURI__.dialog.save({
            filters: [{ name: "Word Document", extensions: ["docx"] }],
            defaultPath: `${bundle.fileNameBase}.docx`,
          })
          if (!selectedPath) return
          const uint8Array = new Uint8Array(await blob.arrayBuffer())
          await window.__TAURI__.fs.writeBinaryFile(selectedPath, uint8Array)
        } else {
          saveAs(blob, `${bundle.fileNameBase}.docx`)
        }
      } else {
        const content = format === "markdown" ? bundle.markdown : format === "html" ? bundle.html : bundle.text
        const mimeType = format === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8"

        if (isTauri) {
          const selectedPath = await window.__TAURI__.dialog.save({
            filters: [{ name: `${format.toUpperCase()} File`, extensions: [extension] }],
            defaultPath: `${bundle.fileNameBase}.${extension}`,
          })
          if (!selectedPath) return
          await window.__TAURI__.fs.writeTextFile({ path: selectedPath, contents: content })
        } else {
          const blob = new Blob([content], { type: mimeType })
          saveAs(blob, `${bundle.fileNameBase}.${extension}`)
        }
      }

      setCurrentProject(projectForCompile)
      setProjectSettings(projectForCompile.settings)
      setCompileDialogOpen(false)
      showProjectSavedNotification()
    } catch (error) {
      console.error("Compile error:", error)
      alert(`Failed to compile project: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  useEffect(() => {
    if (viewMode === "flow" && lastViewModeRef.current !== "flow") {
      setQuickReferenceOpen(false)
    }
    lastViewModeRef.current = viewMode
  }, [viewMode])

  useEffect(() => {
    menuActionsRef.current = {
      newProject: () => {
        void handleNewProjectRef.current()
      },
      openProject: () => {
        void handleOpenProjectFileRef.current()
      },
      saveProject: () => {
        void handleSaveProjectRef.current(false)
      },
      saveProjectAs: () => {
        void handleSaveProjectAsRef.current()
      },
      openSettings: () => {
        setSettingsOpen(true)
      },
    }
  }, [])

  useEffect(() => {
    if (!isTauri || typeof window === "undefined") return

    const tauriEvent = (window.__TAURI__ as { event?: { listen?: (...args: any[]) => Promise<() => void> } }).event
    if (!tauriEvent?.listen) return

    let alive = true
    let unlistenFns: Array<() => void> = []

    const registerMenuListeners = async () => {
      try {
        const listen = tauriEvent.listen as (event: string, handler: () => void) => Promise<() => void>
        const listeners = await Promise.all([
          listen("menu://new-project", () => menuActionsRef.current.newProject()),
          listen("menu://open-project", () => menuActionsRef.current.openProject()),
          listen("menu://save-project", () => menuActionsRef.current.saveProject()),
          listen("menu://save-project-as", () => menuActionsRef.current.saveProjectAs()),
          listen("menu://open-settings", () => menuActionsRef.current.openSettings()),
        ])

        if (!alive) {
          listeners.forEach((unlisten: () => void) => unlisten())
          return
        }

        unlistenFns = listeners
      } catch (error) {
        console.error("Failed to register native menu listeners:", error)
      }
    }

    registerMenuListeners()

    return () => {
      alive = false
      unlistenFns.forEach((unlisten) => unlisten())
    }
  }, [])

  useEffect(() => {
    if (viewMode !== "document") return
    if (!selectedNode) return
    const selectedTreeNode = findNodeById(treeData, selectedNode)
    if (!selectedTreeNode || selectedTreeNode.type !== "document") return
    const selectedDocument = documents[selectedNode]
    if (selectedTreeNode.sectionType === "research" || selectedDocument?.research) {
      setQuickReferenceNodeId(selectedNode)
      setQuickReferenceOpen(true)
    }
  }, [selectedNode, treeData, documents, viewMode])

  if (!preferencesLoaded || !isProjectBootstrapComplete || !currentProject) {
    return <div className={cn("app-shell app-workspace", isTauri && "tauri-desktop")} />
  }

  const selectedTreeNode = selectedNode ? findNodeById(treeData, selectedNode) : null
  const isDocumentSelected = selectedTreeNode?.type === "document"
  const inspectorVisible = !focusMode && inspectorOpen
  const quickReferenceVisible = !focusMode && (viewMode === "document" || viewMode === "flow") && quickReferenceOpen
  const flowDocuments = collectFlowDocuments(treeData, documents)
  const quickReferenceParentId = selectedTreeNode?.type === "folder" ? selectedTreeNode.id : null

  const quickReferencePane = (
    <div
      className={cn(
        "min-h-0 overflow-hidden transition-[width,opacity,transform] duration-200 ease-out",
        quickReferenceVisible
          ? "w-[22rem] min-w-[20rem] max-w-[26rem] opacity-100 translate-x-0"
          : "w-0 min-w-0 max-w-0 opacity-0 translate-x-2 pointer-events-none",
      )}
    >
      <div className="h-full w-[22rem]">
        <QuickReferencePane
          treeData={treeData}
          documents={documents}
          selectedReferenceId={quickReferenceNodeId}
          onSelectReference={setQuickReferenceNodeId}
          onCreateResearchNote={() => handleCreateResearchItem(quickReferenceParentId, "note")}
          onCreateResearchLink={() => handleCreateResearchItem(quickReferenceParentId, "link")}
          onImportResearchFiles={() => void handleImportResearchFiles(quickReferenceParentId)}
          onUpdateResearchItem={handleResearchItemUpdate}
        />
      </div>
    </div>
  )

  // Sidebar content
  const sidebarContent = (
    <div className="h-full min-h-0 overflow-hidden pane-surface">
      <FileSidebar
        initialTree={treeData || []}
        onTreeChange={handleTreeChange}
        selectedNode={selectedNode || ""}
        onNodeSelect={setSelectedNode}
        documents={documents}
        onCreateResearchItem={handleCreateResearchItem}
        onImportResearchFiles={handleImportResearchFiles}
      />
    </div>
  )

  // Main content - remove the corkboard view
  const mainContent = (
    <>
      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        {viewMode === "document" && (
          <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden view-transition entered">
            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
              {isDocumentSelected ? (
                <TiptapEditor
                  selectedNode={selectedNode || ""}
                  fontSize={fontSize}
                  onFontSizeChange={(nextSize) => {
                    const normalized = normalizeFontSizeValue(nextSize)
                    setFontSize((previous) => (previous === normalized ? previous : normalized))
                  }}
                  onContentChange={(content) => {
                    if (!selectedNode) return

                    const wordCount = content
                      .replace(/<[^>]*>/g, " ")
                      .split(/\s+/)
                      .filter(Boolean).length

                    setDocuments((prev) => {
                      if (!prev[selectedNode]) {
                        const node = findNodeById(treeData, selectedNode)
                        const defaults = node ? createDocumentForNode(node, projectSettings) : createDocumentForNode({
                          id: selectedNode,
                          label: "Untitled Document",
                          type: "document",
                          sectionType: "scene",
                          includeInCompile: true,
                          metadataTemplateId: null,
                        }, projectSettings)
                        return {
                          ...prev,
                          [selectedNode]: {
                            ...defaults,
                            content,
                            wordCount,
                            lastModified: new Date().toISOString(),
                          },
                        }
                      }

                      if (prev[selectedNode].content !== content) {
                        return {
                          ...prev,
                          [selectedNode]: {
                            ...prev[selectedNode],
                            content,
                            wordCount,
                            lastModified: new Date().toISOString(),
                          },
                        }
                      }

                      return prev
                    })
                  }}
                  initialContent={selectedNode ? documents[selectedNode]?.content : undefined}
                  onCommentCreate={(draft) => {
                    if (!selectedNode) return
                    handleCreateDocumentComment(selectedNode, draft)
                  }}
                />
              ) : (
                <div className="flex flex-1 min-h-0 items-center justify-center p-6">
                  <div className="max-w-xl rounded-2xl border border-dashed border-white/20 bg-white/5 px-8 py-10 text-center shadow-sm">
                    <p className="text-base font-semibold text-foreground">Select a document to start writing.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Folders organize your binder. Choose a paper node or create a new file to edit content.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {quickReferencePane}
          </div>
        )}
        {viewMode === "flow" && (
          <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden view-transition entered">
            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
              <FlowMode
                documents={flowDocuments}
                fontSize={fontSize}
                onDocumentChange={(documentId, content) => {
                  const wordCount = content
                    .replace(/<[^>]*>/g, " ")
                    .split(/\s+/)
                    .filter(Boolean).length

                  setDocuments((prev) => {
                    const existingDocument = prev[documentId]
                    if (!existingDocument) return prev
                    if (existingDocument.content === content) return prev
                    return {
                      ...prev,
                      [documentId]: {
                        ...existingDocument,
                        content,
                        wordCount,
                        lastModified: new Date().toISOString(),
                      },
                    }
                  })
                }}
                onCommentCreate={handleCreateDocumentComment}
              />
            </div>
            {quickReferencePane}
          </div>
        )}
        {viewMode === "targets" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden view-transition entered">
            <TargetsDashboard
              treeData={treeData}
              documents={documents}
              selectedDocumentId={selectedTreeNode?.type === "document" ? selectedNode : null}
              targetsSettings={projectSettings.targetsSettings}
              sessionStartedAt={sessionStartedAt}
              sessionStartWordCount={sessionStartWordCount}
              onTargetsSettingsChange={handleTargetsSettingsChange}
              onDocumentTargetChange={handleDocumentWordTargetChange}
              onResetSession={handleResetSessionTargets}
            />
          </div>
        )}
        {viewMode === "outliner" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden view-transition entered">
            <Outliner
              treeData={treeData}
              documents={documents}
              selectedNode={selectedNode || ""}
              onNodeSelect={setSelectedNode}
              onDocumentUpdate={applyDocumentPatch}
            />
          </div>
        )}
      </div>
      <div
        className="min-h-0 border-l border-white/10 transition-all duration-300 ease-in-out"
        style={{
          width: inspectorVisible ? `${INSPECTOR_WIDTH_REM}rem` : "0px",
          opacity: inspectorVisible ? 1 : 0,
          overflow: "hidden",
        }}
      >
        <div className="h-full min-h-0 p-2 pl-3" style={{ width: `${INSPECTOR_WIDTH_REM}rem` }}>
          <GlassPanel className="pane-surface h-full min-h-0 overflow-hidden rounded-2xl">
            <Inspector
              selectedNode={selectedNode || ""}
              selectedTreeNode={selectedTreeNode}
              documents={documents}
              snapshotSettings={projectSettings.snapshotSettings}
              metadataFields={projectSettings.metadataFields}
              metadataTemplates={projectSettings.metadataTemplates}
              onDocumentUpdate={applyDocumentPatch}
              onNodeUpdate={handleNodeUpdate}
              onCreateSnapshot={handleCreateDocumentSnapshot}
              onRestoreSnapshot={handleRestoreDocumentSnapshot}
            />
          </GlassPanel>
        </div>
      </div>
    </>
  )

  return (
    <div className={cn("app-shell app-workspace flex min-h-0 flex-col", isTauri && "tauri-desktop")}>
      <header className="px-3 pt-3 pb-2">
        <div className="px-3 py-2">
          <TooltipProvider>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex items-center gap-2 px-1">
                  <InkAndQuillLogo className="h-7 w-7" />
                  <h1 className="text-base font-semibold tracking-wide font-cursive" style={{ fontFamily: "var(--font-dancing-script)" }}>
                    Ink & Quill
                  </h1>
                </div>

                <GlassToolbarGroup>
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <GlassIconButton aria-label="Project options">
                            <FolderOpen className="h-4 w-4" />
                          </GlassIconButton>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Project Options</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuItem onClick={handleNewProject}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>New Project</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleOpenProjectFile}>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        <span>Open Project</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSaveProject(false)}>
                        <Save className="mr-2 h-4 w-4" />
                        <span>Save Project</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleSaveProjectAs}>
                        <Save className="mr-2 h-4 w-4" />
                        <span>Save Project As...</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GlassIconButton onClick={() => handleSaveProject(false)} aria-label="Save project">
                        <Save className="h-4 w-4" />
                      </GlassIconButton>
                    </TooltipTrigger>
                    <TooltipContent>Save Project</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GlassIconButton onClick={openCompileDialog} aria-label="Compile manuscript">
                        <Printer className="h-4 w-4" />
                      </GlassIconButton>
                    </TooltipTrigger>
                    <TooltipContent>Compile Manuscript</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GlassIconButton onClick={() => setSettingsOpen(true)} aria-label="Open settings">
                        <Settings className="h-4 w-4" />
                      </GlassIconButton>
                    </TooltipTrigger>
                    <TooltipContent>Settings</TooltipContent>
                  </Tooltip>
                </GlassToolbarGroup>
              </div>

              <div className="w-[420px] max-w-full justify-self-center">
                {isEditingProjectName ? (
                  <div className="glass-pill-title flex items-center gap-1 px-2 py-1">
                    <Input
                      value={editedProjectName}
                      onChange={(e) => setEditedProjectName(e.target.value)}
                      className="h-8 border-0 bg-transparent text-center text-sm font-medium shadow-none focus-visible:ring-0"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveProjectName()
                        } else if (e.key === "Escape") {
                          setIsEditingProjectName(false)
                        }
                      }}
                    />
                    <GlassIconButton className="h-8 w-8" onClick={handleSaveProjectName} aria-label="Save project name">
                      <Check className="h-4 w-4" />
                    </GlassIconButton>
                    <GlassIconButton className="h-8 w-8" onClick={() => setIsEditingProjectName(false)} aria-label="Cancel editing project name">
                      <X className="h-4 w-4" />
                    </GlassIconButton>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="glass-pill-title flex h-10 w-full items-center justify-center gap-2 px-4 text-sm font-medium text-foreground transition-colors hover:text-primary"
                    onClick={() => {
                      setIsEditingProjectName(true)
                      setEditedProjectName(projectName)
                    }}
                    title="Rename project"
                  >
                    <span className="truncate">{projectName}</span>
                    <Pencil className="h-3.5 w-3.5 opacity-70" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <GlassSegmented>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GlassIconButton
                        active={viewMode === "document"}
                        onClick={() => setViewMode("document")}
                        aria-label="Document view"
                      >
                        <FileText className="h-4 w-4" />
                      </GlassIconButton>
                    </TooltipTrigger>
                    <TooltipContent>Document View</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GlassIconButton
                        active={viewMode === "outliner"}
                        onClick={() => setViewMode("outliner")}
                        aria-label="Outliner view"
                      >
                        <List className="h-4 w-4" />
                      </GlassIconButton>
                    </TooltipTrigger>
                    <TooltipContent>Outliner View</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GlassIconButton
                        active={viewMode === "flow"}
                        onClick={() => setViewMode("flow")}
                        aria-label="Flow mode"
                      >
                        <Rows3 className="h-4 w-4" />
                      </GlassIconButton>
                    </TooltipTrigger>
                    <TooltipContent>Flow Mode</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GlassIconButton
                        active={viewMode === "targets"}
                        onClick={() => setViewMode("targets")}
                        aria-label="Targets dashboard"
                      >
                        <Target className="h-4 w-4" />
                      </GlassIconButton>
                    </TooltipTrigger>
                    <TooltipContent>Targets Dashboard</TooltipContent>
                  </Tooltip>
                </GlassSegmented>

                <GlassToolbarGroup>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GlassIconButton
                        active={quickReferenceVisible}
                        disabled={focusMode}
                        onClick={() => setQuickReferenceOpen((prev) => !prev)}
                        aria-label="Toggle quick reference pane"
                      >
                        <BookOpen className="h-4 w-4" />
                      </GlassIconButton>
                    </TooltipTrigger>
                    <TooltipContent>{focusMode ? "Disabled in Focus Mode" : "Quick Reference"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GlassIconButton
                        active={inspectorOpen && !focusMode}
                        disabled={focusMode}
                        onClick={() => setInspectorOpen((prev) => !prev)}
                        aria-label="Toggle inspector pane"
                      >
                        {inspectorOpen && !focusMode ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      </GlassIconButton>
                    </TooltipTrigger>
                    <TooltipContent>{focusMode ? "Disabled in Focus Mode" : "Toggle Inspector"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <GlassIconButton active={focusMode} onClick={() => setFocusMode(!focusMode)} aria-label="Toggle focus mode">
                        {focusMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                      </GlassIconButton>
                    </TooltipTrigger>
                    <TooltipContent>Toggle Focus Mode</TooltipContent>
                  </Tooltip>
                </GlassToolbarGroup>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </header>

      <ResizableSidebar sidebarContent={sidebarContent} isCollapsed={focusMode} defaultWidth={292} minWidth={220} maxWidth={460}>
        {mainContent}
      </ResizableSidebar>

      {showSaveNotification && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg notification">
          {currentProject ? "Project saved successfully" : "Project created successfully"}
        </div>
      )}

      {startupMessage && !startupMessageDismissed && (
        <div className="fixed bottom-4 left-4 z-[90] flex w-[min(720px,calc(100vw-2rem))] items-start gap-3 rounded-md border border-amber-700 bg-amber-900 px-4 py-3 text-sm text-amber-50 shadow-xl">
          <p className="flex-1 leading-relaxed">{startupMessage}</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-800 hover:text-white"
              onClick={handleOpenProjectFile}
            >
              Open Project
            </button>
            <button
              type="button"
              className="rounded-md p-1 text-amber-100 transition-colors hover:bg-amber-800 hover:text-white"
              onClick={() => setStartupMessageDismissed(true)}
              aria-label="Dismiss startup message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={compileDialogOpen} onOpenChange={setCompileDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Compile Project</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Preset</p>
              <Select
                value={selectedCompilePresetId}
                onValueChange={(value) => {
                  setSelectedCompilePresetId(value)
                  const matched = projectSettings.compilePresets.find((preset) => preset.id === value)
                  if (matched?.outputFormat) {
                    setSelectedCompileFormat(matched.outputFormat)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select compile preset" />
                </SelectTrigger>
                <SelectContent>
                  {projectSettings.compilePresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const matched = projectSettings.compilePresets.find((preset) => preset.id === selectedCompilePresetId)
                if (!matched?.description) return null
                return <p className="text-xs text-muted-foreground">{matched.description}</p>
              })()}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Output Format</p>
              <Select value={selectedCompileFormat} onValueChange={(value) => setSelectedCompileFormat(value as CompileOutputFormat)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select output format" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(compileFormatLabels) as CompileOutputFormat[]).map((format) => (
                    <SelectItem key={format} value={format}>
                      {compileFormatLabels[format]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompileDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompile}>Compile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        projectSettings={projectSettings}
        onProjectSettingsChange={handleProjectSettingsUpdate}
      />
      {/* Hidden file input for opening projects (browser fallback) */}
      <input type="file" ref={fileInputRef} className="hidden" accept=".quill" onChange={handleFileChange} />
    </div>
  )
}
