"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createEmptyProject } from "@/lib/project-manager"
import type { QuillProject } from "@/lib/project-types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileIcon, FolderIcon } from "lucide-react"
// Update the handleFileChange function to use the new loadProjectZip function
import { loadProjectZip } from "@/lib/project-io"
import { loadPreferences, addRecentProject } from "@/lib/user-preferences"
import { isTauri } from "@/lib/environment"
import JSZip from "jszip"

// Check if we're running in Tauri
const ipcRenderer =
  typeof window !== "undefined" && (window as any).electron ? (window as any).electron.ipcRenderer : null

// Update the ProjectDialogProps interface to include the selectedNodeId parameter
interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateProject: (project: QuillProject, selectedNodeId?: string | null) => void
  onOpenProject: (project: QuillProject, selectedNodeId?: string | null) => void
  initialTab?: "new" | "open"
}

export function ProjectDialog({
  open,
  onOpenChange,
  onCreateProject,
  onOpenProject,
  initialTab = "new",
}: ProjectDialogProps) {
  const [activeTab, setActiveTab] = useState<"new" | "open">(initialTab)
  const [projectName, setProjectName] = useState("Untitled Project")
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Update the useEffect to handle tab changes when initialTab changes
  // Add this after the state declarations
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  // Update the handleCreateProject function
  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      setError("Project name cannot be empty")
      return
    }

    try {
      const newProject = createEmptyProject(projectName.trim())

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

      // Pass the Scene 1 ID to be selected
      const sceneId = findSceneId(newProject.treeStructure)
      onCreateProject(newProject, sceneId)
      onOpenChange(false)

      // Get preferred directory from preferences
      const preferences = await loadPreferences()
      const preferredDirectory = preferences.projectDirectory

      if (isTauri && preferredDirectory) {
        // Save the project to the preferred directory
        try {
          const filename = `${newProject.metadata.name}.quill`
          const fullPath = `${preferredDirectory}/${filename}`

          // Check if directory exists, create if it doesn't
          const dirExists = await window.__TAURI__.fs.exists(preferredDirectory)
          if (!dirExists) {
            await window.__TAURI__.fs.createDir(preferredDirectory, { recursive: true })
          }

          // Save the project
          const zip = new JSZip()
          zip.file("project.json", new Blob([JSON.stringify(newProject, null, 2)], { type: "application/json" }))
          const zipData = await zip.generateAsync({
            type: "uint8array",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
          })

          await window.__TAURI__.fs.writeBinaryFile(fullPath, zipData)

          // Add to recent projects
          await addRecentProject(newProject.metadata.name, fullPath)
        } catch (error) {
          console.error("Failed to save new project:", error)
        }
      } else {
        // For browser, just add to recent projects with a placeholder path
        await addRecentProject(newProject.metadata.name, `browser:${newProject.metadata.name}`)
      }

      // Reset form
      setProjectName("Untitled Project")
      setError(null)
    } catch (error) {
      console.error("Failed to create project:", error)
      setError("Failed to create project. Please try again.")
    }
  }

  // Update the handleFileChange function
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setError(null)

      // Use the loadProjectZip function from project-io.ts
      // For browser, we don't have a real file path
      const project = await loadProjectZip(file, `browser:${file.name}`)

      // Validate the loaded project
      if (!project.treeStructure || !Array.isArray(project.treeStructure) || project.treeStructure.length === 0) {
        console.error("Invalid tree structure in loaded project:", project)
        setError("The project file has an invalid tree structure.")
        return
      }

      // Find the Scene 1 document ID to select it by default
      const sceneId = findSceneId(project.treeStructure)
      onOpenProject(project, sceneId)
      onOpenChange(false)

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Failed to open project:", error)
      setError(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  // Update the handleOpenFileClick function
  const handleOpenFileClick = async () => {
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
          const sceneId = findSceneId(project.treeStructure)

          // Open the project
          onOpenProject(project, sceneId)
          onOpenChange(false)
        }
      } catch (error) {
        console.error("Failed to open project:", error)
        setError(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    } else {
      // Fallback for browser environment during development
      fileInputRef.current?.click()
    }
  }

  // Add this helper function to find the Scene 1 ID
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ink & Quill Project</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab as any} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New Project</TabsTrigger>
            <TabsTrigger value="open">Open Project</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <div className="bg-muted p-4 rounded-md">
              <div className="flex items-center space-x-2 mb-2">
                <FolderIcon className="h-4 w-4" />
                <span className="font-medium">Default Project Structure</span>
              </div>
              <div className="pl-6 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <FolderIcon className="h-3 w-3" />
                  <span>Manuscript</span>
                </div>
                <div className="pl-5">
                  <div className="flex items-center space-x-2">
                    <FolderIcon className="h-3 w-3" />
                    <span>Chapter 1</span>
                  </div>
                  <div className="pl-5 flex items-center space-x-2">
                    <FileIcon className="h-3 w-3" />
                    <span>Scene 1</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="open" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Select Project File</Label>
              <div className="flex items-center space-x-2">
                <Button onClick={handleOpenFileClick} className="flex-1">
                  Choose .quill File
                </Button>
                <input type="file" ref={fileInputRef} accept=".quill" className="hidden" onChange={handleFileChange} />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <p className="text-sm text-muted-foreground mt-2">
                Open a .quill project file to continue working on an existing project.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {activeTab === "new" ? (
            <Button onClick={handleCreateProject}>Create Project</Button>
          ) : (
            <Button onClick={handleOpenFileClick}>Open Project</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
