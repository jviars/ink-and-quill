"use client"

import type React from "react"

import { useState, useEffect, startTransition, useRef } from "react"
import { Book, List, Settings, FileText, Save, FolderOpen, Pencil, Check, X, LogOut, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
import { extractCurrentProject } from "@/lib/project-types"
import { createEmptyProject } from "@/lib/project-manager"

// Import user preferences
import { loadPreferences, updatePreference } from "@/lib/user-preferences"
import type { UserPreferences } from "@/lib/user-preferences"

// Import environment check
import { isTauri } from "@/lib/environment"

// Change the viewMode type to remove "corkboard"
export default function Dashboard() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [viewMode, setViewMode] = useState<"document" | "outliner">("document")
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  const [showSaveNotification, setShowSaveNotification] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<QuillProject | null>(null)
  const [documents, setDocuments] = useState<Record<string, DocumentData>>({})
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [projectName, setProjectName] = useState("Untitled Project")
  const [fontSize, setFontSize] = useState("16")
  const [isEditingProjectName, setIsEditingProjectName] = useState(false)
  const [editedProjectName, setEditedProjectName] = useState(projectName)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add this useEffect to load preferences
  useEffect(() => {
    loadPreferences()
      .then((prefs) => {
        setPreferences(prefs)

        // Apply preferences
        if (prefs.theme) {
          setTheme(prefs.theme)
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
          type: "folder",
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

          // Apply project settings
          if (project.settings.theme) {
            setTheme(project.settings.theme)
            // Update theme preference
            await updatePreference("theme", project.settings.theme)
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

      // Apply project settings
      if (project.settings.theme) {
        setTheme(project.settings.theme)
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

  // Initialize documents only once on mount
  useEffect(() => {
    // Only initialize if documents is empty and we haven't already initialized
    if (Object.keys(documents).length === 0 && !currentProject) {
      console.log("Initializing empty documents object")
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

  const getHeaderClass = () => {
    if (theme === "muted-elegance") {
      return "bg-[#565656] border-[#666666]"
    } else if (theme === "dark") {
      return "dark:bg-gray-950 dark:border-gray-800"
    } else {
      return "bg-white"
    }
  }

  const getSidebarClass = () => {
    if (theme === "muted-elegance") {
      return "bg-[#4D4D4D]"
    } else if (theme === "dark") {
      return "dark:bg-gray-900"
    } else {
      return "bg-gray-50"
    }
  }

  // Update the handleCreateProject function to accept and use the selectedNodeId parameter
  const handleCreateProject = (project: QuillProject, selectedNodeId?: string | null) => {
    setCurrentProject(project)
    setProjectName(project.metadata.name)
    setTreeData(project.treeStructure)
    setDocuments(project.documents)

    // Apply project settings
    if (project.settings.theme) {
      setTheme(project.settings.theme)
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
  const handleOpenProject = (project: QuillProject, selectedNodeId?: string | null) => {
    // Log the project data for debugging
    console.log("Opening project:", project)
    console.log("Tree structure before setting state:", project.treeStructure)

    // Make sure we have a valid tree structure
    if (!project.treeStructure || !Array.isArray(project.treeStructure) || project.treeStructure.length === 0) {
      console.error("Invalid tree structure in project:", project)
      alert("The project file has an invalid structure. Please try another file.")
      return
    }

    startTransition(() => {
      // Set the current project first
      setCurrentProject(project)

      // Set project name
      setProjectName(project.metadata.name)

      // Set the tree data - this is critical for the sidebar
      setTreeData(project.treeStructure)
      console.log("Tree data set to:", project.treeStructure)

      // Set documents
      setDocuments(project.documents || {})

      // Apply project settings
      if (project.settings.theme) {
        setTheme(project.settings.theme)
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
          console.log("Selected document ID:", docId)
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
  const handleSaveProject = async () => {
    try {
      // Create or update the project
      const updatedProject = extractCurrentProject(
        currentProject,
        projectName,
        treeData,
        documents,
        theme || "light",
        fontSize,
      )

      // Update the current project state
      setCurrentProject(updatedProject)

      // Save the project using the new ZIP-based function
      await saveProjectZip(updatedProject)

      // Show success notification
      setShowSaveNotification(true)
      setTimeout(() => {
        setShowSaveNotification(false)
      }, 2000)
    } catch (error) {
      console.error("Failed to save project:", error)
      // Show error notification
      alert("Failed to save project. Please try again.")
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
    console.log("Tree data changed, updating state:", updatedTreeData)
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
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5rem; }
  </style>
</head>
<body>
${compiledContent}
</body>
</html>`

    if (isTauri) {
      try {
        const selectedPath = await window.__TAURI__.dialog.save({
          filters: [{ name: "HTML Document", extensions: ["html"] }],
          defaultPath: `${projectName}.html`,
        })
        if (selectedPath) {
          await window.__TAURI__.fs.writeTextFile(selectedPath, fullHtml)
          setShowSaveNotification(true)
          setTimeout(() => setShowSaveNotification(false), 2000)
        }
      } catch (error) {
        console.error("Compile error:", error)
        alert("Failed to export manuscript.")
      }
    } else {
      const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" })
      saveAs(blob, `${projectName}.html`)
      setShowSaveNotification(true)
      setTimeout(() => setShowSaveNotification(false), 2000)
    }
  }

  // Keep the handleCreateNote function for potential future use
  const handleCreateNote = (title: string, content: string) => {
    // Generate a unique ID for the new note
    const newId = `note-${Date.now()}`

    // Create a new document
    const now = new Date().toISOString()
    const newDocuments = {
      ...documents,
      [newId]: {
        content: `<p>${content}</p>`,
        synopsis: content,
        notes: "",
        status: "to-do",
        label: "none",
        wordCount: content.split(/\s+/).filter(Boolean).length,
        createdAt: now,
        lastModified: now,
      },
    }
    setDocuments(newDocuments)

    // Add the new document to the tree structure at the root level
    const newTreeData = [
      ...treeData,
      {
        id: newId,
        label: title,
        type: "document",
      },
    ]
    setTreeData(newTreeData)

    // Select the new note
    setSelectedNode(newId)
  }

  // Keep the handleDeleteNote function for potential future use
  const handleDeleteNote = (id: string) => {
    try {
      // Check if the ID exists in documents - but don't return an error if it doesn't
      const documentExists = !!documents[id]

      // If document exists, remove it from documents state
      const newDocuments = { ...documents }
      if (documentExists) {
        delete newDocuments[id]
      }

      // Remove the node from the tree structure
      // This is a safer implementation that won't cause infinite recursion
      const removeNodeFromTree = (nodes: TreeNode[]): TreeNode[] => {
        return nodes
          .map((node) => {
            // If this is the node to remove, return null to filter it out later
            if (node.id === id) {
              return null
            }

            // If this node has children, process them recursively
            if (node.children && node.children.length > 0) {
              const newChildren = removeNodeFromTree(node.children).filter(Boolean) as TreeNode[]
              return { ...node, children: newChildren }
            }

            // Otherwise, return the node unchanged
            return node
          })
          .filter(Boolean) as TreeNode[] // Filter out null values
      }

      const newTreeData = removeNodeFromTree([...treeData])

      // Find a new node to select BEFORE updating state
      let newSelectedNode = selectedNode
      if (selectedNode === id) {
        // Find the first available document ID or use a default
        const availableDocIds = Object.keys(newDocuments)
        newSelectedNode = availableDocIds.length > 0 ? availableDocIds[0] : ""
      }

      // Update state in the correct order
      if (documentExists) {
        setDocuments(newDocuments)
      }
      setTreeData(newTreeData)

      // Only update selected node if needed and if we have a valid node to select
      if (selectedNode === id && newSelectedNode) {
        setSelectedNode(newSelectedNode)
      }
    } catch (error) {
      console.error("Error deleting note:", error)
      // Show error notification to user
      alert("An error occurred while deleting the note. Please try again.")
    }
  }

  // If no project is loaded, show the welcome screen
  if (!currentProject) {
    return <WelcomeScreen onCreateProject={handleCreateProject} onOpenProject={handleOpenProject} />
  }

  // Sidebar content
  const sidebarContent = (
    <div className={`h-full flex flex-col ${getSidebarClass()}`}>
      <div className={`p-2 border-b ${theme === "muted-elegance" ? "border-[#666666]" : "dark:border-gray-800"}`}>
        {isEditingProjectName ? (
          <div className="flex items-center gap-2">
            <Input
              value={editedProjectName}
              onChange={(e) => setEditedProjectName(e.target.value)}
              className="h-9"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveProjectName()
                } else if (e.key === "Escape") {
                  setIsEditingProjectName(false)
                }
              }}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSaveProjectName}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditingProjectName(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              className="flex-1 justify-start overflow-hidden"
              onClick={() => {
                if (currentProject) {
                  setIsEditingProjectName(true)
                  setEditedProjectName(projectName)
                }
              }}
            >
              <Book className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">{projectName}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="ml-1 h-8 w-8"
              onClick={() => {
                setIsEditingProjectName(true)
                setEditedProjectName(projectName)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <FileSidebar
          initialTree={treeData || []}
          onTreeChange={handleTreeChange}
          selectedNode={selectedNode}
          onNodeSelect={setSelectedNode}
          documents={documents}
        />
      </div>
    </div>
  )

  // Main content - remove the corkboard view
  const mainContent = (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === "document" && (
          <div className="flex-1 flex flex-col overflow-hidden view-transition entered">
            <TiptapEditor
              selectedNode={selectedNode}
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
                      console.log(`Creating new document for ${selectedNode}`)
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
                      console.log(`Updating content for ${selectedNode}`)
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
              initialContent={selectedNode && documents[selectedNode]?.content}
            />
          </div>
        )}
        {viewMode === "outliner" && (
          <div className="flex-1 flex flex-col overflow-hidden view-transition entered">
            <Outliner
              treeData={treeData}
              documents={documents}
              selectedNode={selectedNode}
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
        className={`w-64 border-l ${getSidebarClass()}`}
        style={{ borderColor: theme === "muted-elegance" ? "#666666" : "" }}
      >
        <Inspector
          selectedNode={selectedNode}
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
      </div>
    </>
  )

  return (
    <div className="flex h-screen flex-col">
      <header className={`border-b ${getHeaderClass()}`}>
        <div className="flex h-14 items-center px-4 justify-between">
          <div className="flex items-center">
            <InkAndQuillLogo className="h-6 w-6 mr-2" />
            <h1 className="text-lg font-semibold font-cursive" style={{ fontFamily: "var(--font-dancing-script)" }}>
              Ink & Quill
            </h1>
          </div>
          <div className="flex items-center">
            <Separator orientation="vertical" className="mx-2 h-6" />
            <div className="flex items-center space-x-1 ml-2">
              <TooltipProvider>
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Project Options</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleNewProject}>
                      <FileText className="mr-2 h-4 w-4" />
                      <span>New Project</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenProjectFile}>
                      <FolderOpen className="mr-2 h-4 w-4" />
                      <span>Open Project</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setCurrentProject(null)}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Return to Welcome Screen</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleSaveProject}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save Project</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleCompile}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Compile Manuscript</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        <div
          className={`flex items-center px-4 h-10 border-t ${theme === "muted-elegance" ? "border-[#666666]" : "dark:border-gray-800"}`}
        >
          <TooltipProvider>
            <div className="flex items-center space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "document" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewMode("document")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Document View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "outliner" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewMode("outliner")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Outliner View</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </header>

      <ResizableSidebar sidebarContent={sidebarContent}>{mainContent}</ResizableSidebar>

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
