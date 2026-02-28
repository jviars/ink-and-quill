"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { List, Settings, FileText, Save, FolderOpen, Pencil, Check, X, Printer, Maximize, Minimize } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TiptapEditor } from "@/components/tiptap-editor"
import { Outliner } from "@/components/outliner"
import { Inspector } from "@/components/inspector"
import { useTheme } from "next-themes"
import { ResizableSidebar } from "@/components/resizable"
import { SettingsDialog } from "@/components/settings-dialog"
import { InkAndQuillLogo } from "@/components/quill-logo"
import { Input } from "@/components/ui/input"
import type { QuillProject, DocumentData, TreeNode } from "@/lib/project-types"
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
import { extractCurrentProject, createEmptyProject } from "@/lib/project-types"
import { addRecentProject, loadPreferences, normalizeTheme, updatePreference, type AppTheme } from "@/lib/user-preferences"
import HTMLToDOCX from "html-to-docx"
import JSZip from "jszip"
import { cn } from "@/lib/utils"
import { GlassIconButton, GlassPanel, GlassSegmented, GlassToolbarGroup } from "@/components/glass-ui"

// Import environment check
import { isTauri } from "@/lib/environment"

// Change the viewMode type to remove "corkboard"
export default function Dashboard() {
  const [viewMode, setViewMode] = useState<"document" | "outliner">("document")
  const [focusMode, setFocusMode] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  const [showSaveNotification, setShowSaveNotification] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<QuillProject | null>(null)
  const [projectFilePath, setProjectFilePath] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Record<string, DocumentData>>({})
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [projectName, setProjectName] = useState("Untitled Project")
  const [fontSize, setFontSize] = useState("16")
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [editedProjectName, setEditedProjectName] = useState(projectName)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [isProjectBootstrapComplete, setIsProjectBootstrapComplete] = useState(false)
  const [startupMessage, setStartupMessage] = useState<string | null>(null)
  const bootstrappedProjectRef = useRef(false)
  const lastPersistedThemeRef = useRef<AppTheme | null>(null)
  const menuActionsRef = useRef({
    newProject: () => {},
    openProject: () => {},
    saveProject: () => {},
    openSettings: () => {},
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const clearAutosaveBackup = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("quill-autosave-project")
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

        if (prefs.fontSize) {
          setFontSize(prefs.fontSize)
        }
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

  const showProjectSavedNotification = () => {
    setShowSaveNotification(true)
    setTimeout(() => {
      setShowSaveNotification(false)
    }, 2000)
  }

  const normalizeProjectName = (value: unknown): string => {
    return typeof value === "string" && value.trim() ? value.trim() : "Untitled Project"
  }

  const normalizeDialogPath = (selection: unknown): string | null => {
    if (typeof selection === "string" && selection) return selection
    if (Array.isArray(selection) && typeof selection[0] === "string" && selection[0]) return selection[0]
    if (selection && typeof selection === "object") {
      const maybePath = (selection as { path?: unknown }).path
      if (typeof maybePath === "string" && maybePath) return maybePath
    }
    return null
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

  const applyProjectToState = (project: QuillProject, filePath: string | null, preferredNodeId?: string | null) => {
    const safeName = normalizeProjectName(project.metadata?.name)
    const selectedId = preferredNodeId ?? findPreferredDocumentId(project.treeStructure)

    setCurrentProject({
      ...project,
      metadata: {
        ...project.metadata,
        name: safeName,
      },
    })
    setProjectName(safeName)
    setTreeData(project.treeStructure)
    setDocuments(project.documents || {})
    setSelectedNode(selectedId)
    setProjectFilePath(filePath)
    clearAutosaveBackup()

    if (project.settings.theme) {
      setTheme(normalizeTheme(project.settings.theme))
    }
    if (project.settings.fontSize) {
      setFontSize(project.settings.fontSize)
    }
  }

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
    if (project.settings.fontSize) {
      await updatePreference("fontSize", project.settings.fontSize)
    }
  }

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
        alert(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
      return
    }

    // Fallback for browser environment - use file input
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

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
              await openProjectFromPath(lastProjectPath)
              if (!cancelled) {
                setStartupMessage(null)
              }
              return
            }
          }

          const { project, filePath } = await createWorkspaceProject()
          if (!cancelled) {
            applyProjectToState(project, filePath)
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
          applyProjectToState(newProject, null)
          setStartupMessage(null)
        }
      } catch (error) {
        console.error("Failed to bootstrap project:", error)
        if (isTauri && window.__TAURI__?.fs && window.__TAURI__?.path) {
          try {
            const { project, filePath } = await createWorkspaceProject()
            if (!cancelled) {
              applyProjectToState(project, filePath)
              setStartupMessage("Could not restore your last project. A new workspace project was created instead.")
            }
            return
          } catch (workspaceError) {
            console.error("Failed to create fallback workspace project:", workspaceError)
          }
        }

        const fallbackProject = createEmptyProject("Untitled Project")
        if (!cancelled) {
          applyProjectToState(fallbackProject, null)
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
    const timer = setTimeout(() => {
      handleSaveProject(true) // Pass true to indicate it's an auto-save (silent)
    }, 3000)

    return () => clearTimeout(timer)
  }, [treeData, documents, theme, fontSize, projectName])

  // Replace the handleSaveProject function with this updated version
  // isAutoSave flag prevents showing the success notification when saving in the background
  const handleSaveProject = async (isAutoSave = false) => {
    try {
      // Create or update the project
      const updatedProject = extractCurrentProject(
        currentProject,
        projectName,
        treeData,
        documents,
        normalizeTheme(theme),
        fontSize,
      )

      // Update the current project state
      setCurrentProject(updatedProject)

      // In Tauri, if we have a known file path we just silent-write it right back to disk.
      // If we don't have a path, we fall back to saveProjectZip which triggers a native Save As dialog or browser download.
      if (isTauri && projectFilePath) {
        try {
          const zip = new JSZip()
          zip.file("project.json", new Blob([JSON.stringify(updatedProject, null, 2)], { type: "application/json" }))

          const zipData = await zip.generateAsync({
            type: "uint8array",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
          })

          await window.__TAURI__.fs.writeBinaryFile(projectFilePath, zipData)
          console.log(`Auto-saved project silently to ${projectFilePath}`)
          clearAutosaveBackup()

        } catch (error) {
          console.error("Failed background discrete save:", error)
          if (isAutoSave) {
            localStorage.setItem("quill-autosave-project", JSON.stringify(updatedProject))
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
          localStorage.setItem("quill-autosave-project", JSON.stringify(updatedProject))
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
          localStorage.setItem("quill-autosave-project", JSON.stringify(updatedProject))
          console.log("Browser auto-save backed up to localStorage")
        }
      }
    } catch (error) {
      console.error("Failed to save project:", error)
      if (!isAutoSave) {
        alert("Failed to save project. Please try again.")
      }
    }
  }

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

  const handleTreeChange = (updatedTreeData: TreeNode[]) => {
    setTreeData(updatedTreeData)

    const allowed = new Set(collectDocIds(updatedTreeData))

    // prune documents that no longer exist in binder
    setDocuments((prev) => {
      const next: typeof prev = {}
      for (const [id, doc] of Object.entries(prev)) {
        if (allowed.has(id)) next[id] = doc
      }
      return next
    })

    // if selected node was deleted, select another doc
    if (selectedNode && !allowed.has(selectedNode)) {
      const firstDoc = collectDocIds(updatedTreeData)[0] ?? null
      setSelectedNode(firstDoc)
    }
  }

  const handleCompile = async () => {
    let compiledContent = `<h1>${projectName}</h1>\n`

    const gatherContent = (nodes: TreeNode[], level = 1) => {
      for (const node of nodes) {
        if (node.type === "folder") {
          compiledContent += `<h${level + 1}>${node.label}</h${level + 1}>\n`
          if (node.children) {
            gatherContent(node.children, level + 1)
          }
        } else if (node.type === "document") {
          const doc = documents[node.id]
          if (doc) {
            compiledContent += `<h${level + 1}>${node.label}</h${level + 1}>\n`
            if (doc.content) {
              compiledContent += `${doc.content}\n`
            }
          }
        }
      }
    }

    gatherContent(treeData)

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${projectName}</title>
</head>
<body>
${compiledContent}
</body>
</html>`

    try {
      // Convert the HTML to a DOCX Blob
      const docxBuffer = await HTMLToDOCX(fullHtml, null, {
        title: projectName,
        creator: "Ink & Quill"
      })
      const blob = new Blob([docxBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })

      if (isTauri) {
        const selectedPath = await window.__TAURI__.dialog.save({
          filters: [{ name: "Word Document", extensions: ["docx"] }],
          defaultPath: `${projectName}.docx`,
        })
        if (selectedPath) {
          // Tauri fs needs a Uint8Array, so we convert the Blob via ArrayBuffer
          const arrayBuffer = await blob.arrayBuffer()
          const uint8Array = new Uint8Array(arrayBuffer)
          await window.__TAURI__.fs.writeBinaryFile(selectedPath, uint8Array)
          setShowSaveNotification(true)
          setTimeout(() => setShowSaveNotification(false), 2000)
        }
      } else {
        saveAs(blob, `${projectName}.docx`)
        setShowSaveNotification(true)
        setTimeout(() => setShowSaveNotification(false), 2000)
      }
    } catch (error) {
      console.error("Compile error:", error)
      alert("Failed to export manuscript.")
    }
  }

  useEffect(() => {
    menuActionsRef.current = {
      newProject: handleNewProject,
      openProject: () => {
        void handleOpenProjectFile()
      },
      saveProject: () => {
        void handleSaveProject(false)
      },
      openSettings: () => {
        setSettingsOpen(true)
      },
    }
  }, [handleNewProject, handleOpenProjectFile, handleSaveProject])

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

  if (!preferencesLoaded || !isProjectBootstrapComplete || !currentProject) {
    return <div className={cn("app-shell app-workspace", isTauri && "tauri-desktop")} />
  }

  // Sidebar content
  const sidebarContent = (
    <div className="h-full min-h-0 overflow-hidden pane-surface">
      <FileSidebar
        initialTree={treeData || []}
        onTreeChange={handleTreeChange}
        selectedNode={selectedNode || ""}
        onNodeSelect={setSelectedNode}
        documents={documents}
      />
    </div>
  )

  // Main content - remove the corkboard view
  const mainContent = (
    <>
      <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        {viewMode === "document" && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden view-transition entered">
            <TiptapEditor
              selectedNode={selectedNode || ""}
              onContentChange={(content) => {
                if (selectedNode) {
                  // Calculate word count from the HTML content
                  const wordCount = content
                    .replace(/<[^>]*>/g, " ") // Remove HTML tags
                    .split(/\s+/) // Split by whitespace
                    .filter(Boolean).length // Remove empty strings

                  // Use functional update to ensure we're working with latest state
                  setDocuments((prev) => {
                    // Create a new document if it doesn't exist
                    if (!prev[selectedNode]) {
                      return {
                        ...prev,
                        [selectedNode]: {
                          content,
                          wordCount,
                          synopsis: "",
                          notes: "",
                          status: "to-do",
                          label: "none",
                          createdAt: new Date().toISOString(),
                          lastModified: new Date().toISOString(),
                        },
                      }
                    }

                    // Update existing document if content has changed
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
                }
              }}
              initialContent={selectedNode ? documents[selectedNode]?.content : undefined}
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
              onDocumentUpdate={(id, data) => {
                setDocuments((prev) => ({
                  ...prev,
                  [id]: {
                    ...(prev[id] || {}),
                    ...data,
                    lastModified: new Date().toISOString(),
                  },
                }))
              }}
            />
          </div>
        )}
      </div>
      <div
        className="min-h-0 border-l border-white/10 transition-all duration-300 ease-in-out"
        style={{
          width: focusMode ? "0px" : "18.5rem",
          opacity: focusMode ? 0 : 1,
          overflow: "hidden",
        }}
      >
        <div className="h-full min-h-0 w-[18.5rem] p-2 pl-3">
          <GlassPanel className="pane-surface h-full min-h-0 overflow-hidden rounded-2xl">
            <Inspector
              selectedNode={selectedNode || ""}
              documents={documents}
              onDocumentUpdate={(id, data) => {
                setDocuments((prev) => ({
                  ...prev,
                  [id]: {
                    ...(prev[id] || {}),
                    ...data,
                    lastModified: new Date().toISOString(),
                  },
                }))
              }}
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
                  <InkAndQuillLogo className="h-5 w-5" />
                  <h1 className="text-sm font-semibold tracking-wide font-cursive" style={{ fontFamily: "var(--font-dancing-script)" }}>
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
                      <GlassIconButton onClick={handleCompile} aria-label="Compile manuscript">
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
                </GlassSegmented>

                <GlassToolbarGroup>
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

      {startupMessage && (
        <div className="fixed bottom-4 left-4 max-w-[min(640px,calc(100vw-2rem))] rounded border border-amber-400/40 bg-amber-500/20 px-4 py-2 text-sm text-amber-100 shadow-lg">
          {startupMessage}
        </div>
      )}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {/* Hidden file input for opening projects (browser fallback) */}
      <input type="file" ref={fileInputRef} className="hidden" accept=".quill" onChange={handleFileChange} />
    </div>
  )
}
