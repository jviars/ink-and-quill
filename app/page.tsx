"use client"

import type React from "react"

import { useState, useEffect, startTransition, useRef } from "react"
import { List, Settings, FileText, Save, FolderOpen, Pencil, Check, X, LogOut, Printer, Maximize, Minimize } from "lucide-react"
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
import { WelcomeScreen } from "@/components/welcome-screen"
import FileSidebar from "@/components/file-sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Import the new project-io functions
import { saveProjectZip, loadProjectZip } from "@/lib/project-io"
import { saveAs } from "file-saver"
import { extractCurrentProject, createEmptyProject } from "@/lib/project-types"
import { loadPreferences, normalizeTheme, updatePreference } from "@/lib/user-preferences"
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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const clearAutosaveBackup = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("quill-autosave-project")
    }
  }

  // Add this useEffect to load preferences
  useEffect(() => {
    loadPreferences()
      .then((prefs) => {
        // Apply preferences
        if (prefs.theme) {
          setTheme(normalizeTheme(prefs.theme))
        }
        if (prefs.fontSize) {
          setFontSize(prefs.fontSize)
        }
      })
      .catch((error) => {
        console.error("Failed to load preferences:", error)
      })
  }, []) // Remove setTheme from dependencies to avoid infinite loop

  useEffect(() => {
    // Initialize treeData with a default structure if it's empty
    if (!treeData || treeData.length === 0) {
      const defaultTree = [
        {
          id: "root",
          label: "My Project",
          type: "folder" as const,
          children: [],
        },
      ]
      setTreeData(defaultTree)
    }
  }, [treeData])

  // Handle creating a new project
  const handleNewProject = () => {
    const newProject = createEmptyProject("Untitled Project")

    // Find the Scene 1 document ID to select it by default
    const findSceneId = (nodes: any[]): string | null => {
      for (const node of nodes) {
        if (node.label === "Scene 1" && node.type === "document") {
          return node.id
        }
        if (node.children) {
          const id = findSceneId(node.children)
          if (id) return id
        }
      }
      return null
    }

    const sceneId = findSceneId(newProject.treeStructure)

    // Update state with the new project
    setCurrentProject(newProject)
    setProjectName(newProject.metadata.name)
    setTreeData(newProject.treeStructure)
    setDocuments(newProject.documents)
    setSelectedNode(sceneId)
    setProjectFilePath(null)
    clearAutosaveBackup()

    // Show success notification
    setShowSaveNotification(true)
    setTimeout(() => {
      setShowSaveNotification(false)
    }, 2000)
  }

  // Update the handleOpenProjectFile function
  const handleOpenProjectFile = async () => {
    if (isTauri) {
      try {
        // Use Tauri's dialog API to select a file
        const selected = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [
            {
              name: "Quill Projects",
              extensions: ["quill"],
            },
          ],
        })

        if (selected) {
          // Read the file using Tauri's fs API
          const fileContent = await window.__TAURI__.fs.readBinaryFile(selected as string)

          // Load the project from the file content, passing the file path
          const project = await loadProjectZip(fileContent, selected as string)

          // Find the Scene 1 document ID to select it by default
          const findSceneId = (nodes: any[]): string | null => {
            for (const node of nodes) {
              if (node.label === "Scene 1" && node.type === "document") {
                return node.id
              }
              if (node.children) {
                const id = findSceneId(node.children)
                if (id) return id
              }
            }
            return null
          }

          const sceneId = findSceneId(project.treeStructure)

          // Update state with the loaded project
          setCurrentProject(project)
          setProjectName(project.metadata.name)
          setTreeData(project.treeStructure)
          setDocuments(project.documents || {})
          setSelectedNode(sceneId)
          setProjectFilePath(selected as string)
          clearAutosaveBackup()

          // Apply project settings
          if (project.settings.theme) {
            const normalizedTheme = normalizeTheme(project.settings.theme)
            setTheme(normalizedTheme)
            // Update theme preference
            await updatePreference("theme", normalizedTheme)
          }
          if (project.settings.fontSize) {
            setFontSize(project.settings.fontSize)
            // Update fontSize preference
            await updatePreference("fontSize", project.settings.fontSize)
          }

          // Show success notification
          setShowSaveNotification(true)
          setTimeout(() => {
            setShowSaveNotification(false)
          }, 2000)
        }
      } catch (error) {
        console.error("Failed to open project:", error)
        alert(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    } else {
      // Fallback for browser environment - use file input
      if (fileInputRef.current) {
        fileInputRef.current.click()
      }
    }
  }

  // Handle file selection (for browser fallback)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // Load the project from the file
      const project = await loadProjectZip(file)

      // Find the Scene 1 document ID to select it by default
      const findSceneId = (nodes: any[]): string | null => {
        for (const node of nodes) {
          if (node.label === "Scene 1" && node.type === "document") {
            return node.id
          }
          if (node.children) {
            const id = findSceneId(node.children)
            if (id) return id
          }
        }
        return null
      }

      const sceneId = findSceneId(project.treeStructure)

      // Update state with the loaded project
      setCurrentProject(project)
      setProjectName(project.metadata.name)
      setTreeData(project.treeStructure)
      setDocuments(project.documents || {})
      setSelectedNode(sceneId)
      // Browsers don't support retaining path references, we rely on indexedDB or manual download
      setProjectFilePath(null)
      clearAutosaveBackup()

      // Apply project settings
      if (project.settings.theme) {
        setTheme(normalizeTheme(project.settings.theme))
      }
      if (project.settings.fontSize) {
        setFontSize(project.settings.fontSize)
      }

      // Show success notification
      setShowSaveNotification(true)
      setTimeout(() => {
        setShowSaveNotification(false)
      }, 2000)

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Failed to open project:", error)
      alert(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Ensure theme is only accessed client-side to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Initialize documents only once on mount
  useEffect(() => {
    // Only initialize if documents is empty and we haven't already initialized
    if (Object.keys(documents).length === 0 && !currentProject) {
      setDocuments({})
    }
  }, []) // Empty dependency array ensures this only runs once on mount

  // Add a function to check and create the project directory if it doesn't exist
  // Add this after the useEffect hooks
  useEffect(() => {
    // Check if the preferred project directory exists and create it if needed
    const checkProjectDirectory = async () => {
      if (typeof window !== "undefined") {
        const prefs = await loadPreferences()
        const preferredDirectory = prefs.projectDirectory

        if (preferredDirectory && isTauri) {
          try {
            // Check if directory exists
            const exists = await window.__TAURI__.fs.exists(preferredDirectory)
            if (!exists) {
              // Create directory if it doesn't exist
              await window.__TAURI__.fs.createDir(preferredDirectory, { recursive: true })
              console.log(`Created project directory: ${preferredDirectory}`)
            } else {
              console.log(`Project directory exists: ${preferredDirectory}`)
            }
          } catch (error) {
            console.error("Error checking/creating project directory:", error)
          }
        } else if (preferredDirectory) {
          console.log("Project directory set to:", preferredDirectory)
        }
      }
    }

    checkProjectDirectory()
  }, [])

  // Update the handleCreateProject function to accept and use the selectedNodeId parameter
  const handleCreateProject = (project: QuillProject, selectedNodeId?: string | null, filePath: string | null = null) => {
    setCurrentProject(project)
    setProjectName(project.metadata.name)
    setTreeData(project.treeStructure)
    setDocuments(project.documents)
    setProjectFilePath(filePath)
    clearAutosaveBackup()

    // Apply project settings
    if (project.settings.theme) {
      setTheme(normalizeTheme(project.settings.theme))
    }
    if (project.settings.fontSize) {
      setFontSize(project.settings.fontSize)
    }

    // Select the provided node ID (Scene 1) if available
    if (selectedNodeId) {
      setSelectedNode(selectedNodeId)
    }

    setShowSaveNotification(true)
    setTimeout(() => {
      setShowSaveNotification(false)
    }, 2000)
  }

  // Update the handleOpenProject function to properly handle recent projects
  const handleOpenProject = (project: QuillProject, selectedNodeId?: string | null, filePath: string | null = null) => {
    // Make sure we have a valid tree structure
    if (!project.treeStructure || !Array.isArray(project.treeStructure) || project.treeStructure.length === 0) {
      console.error("Invalid tree structure in project:", project)
      alert("The project file has an invalid structure. Please try another file.")
      return
    }

    startTransition(() => {
      // Set the current project first
      setCurrentProject(project)
      setProjectFilePath(filePath)
      clearAutosaveBackup()

      // Set project name
      setProjectName(project.metadata.name)

      // Set the tree data - this is critical for the sidebar
      setTreeData(project.treeStructure)

      // Set documents
      setDocuments(project.documents || {})

      // Apply project settings
      if (project.settings.theme) {
        setTheme(normalizeTheme(project.settings.theme))
      }
      if (project.settings.fontSize) {
        setFontSize(project.settings.fontSize)
      }

      // If a specific node ID is provided, use it
      if (selectedNodeId) {
        setSelectedNode(selectedNodeId)
      } else {
        // Otherwise, find Scene 1 or another document to select
        const findSceneOne = (nodes: TreeNode[]): string | null => {
          for (const node of nodes) {
            if (node.label === "Scene 1" && node.type === "document") {
              return node.id
            }
            if (node.children && node.children.length > 0) {
              const docId = findSceneOne(node.children)
              if (docId) return docId
            }
          }
          return null
        }

        // Try to find Scene 1 first
        const sceneOneId = findSceneOne(project.treeStructure)

        // If Scene 1 is found, select it; otherwise find any document
        if (sceneOneId) {
          setSelectedNode(sceneOneId)
        } else {
          // Fallback to finding any document
          const findFirstDocument = (nodes: TreeNode[]): string | null => {
            for (const node of nodes) {
              if (node.type === "document") {
                return node.id
              }
              if (node.children && node.children.length > 0) {
                const docId = findFirstDocument(node.children)
                if (docId) return docId
              }
            }
            return null
          }

          const docId = findFirstDocument(project.treeStructure) || project.treeStructure[0]?.id || null
          setSelectedNode(docId)
        }
      }
    })

    // Show success notification
    setShowSaveNotification(true)
    setTimeout(() => {
      setShowSaveNotification(false)
    }, 2000)
  }

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

  // If no project is loaded, show the welcome screen
  if (!currentProject) {
    return <WelcomeScreen onCreateProject={handleCreateProject} onOpenProject={handleOpenProject} />
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
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setCurrentProject(null)
                          setProjectFilePath(null)
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Return to Welcome Screen</span>
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

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {/* Hidden file input for opening projects (browser fallback) */}
      <input type="file" ref={fileInputRef} className="hidden" accept=".quill" onChange={handleFileChange} />
    </div>
  )
}
