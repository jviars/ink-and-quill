"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { FolderOpen, FileText, Clock, ArrowRight, Trash2 } from "lucide-react"
import { InkAndQuillLogo } from "@/components/quill-logo"
import { useTheme } from "next-themes"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { QuillProject } from "@/lib/project-types"
import { createEmptyProject } from "@/lib/project-manager"
import { loadProjectZip } from "@/lib/project-io"

// Import the user preferences functions
import { loadPreferences, addRecentProject, removeRecentProject, type RecentProject } from "@/lib/user-preferences"
import { isTauri } from "@/lib/environment"

interface WelcomeScreenProps {
  onCreateProject: (project: QuillProject, selectedNodeId?: string | null) => void
  onOpenProject: (project: QuillProject, selectedNodeId?: string | null) => void
}

export function WelcomeScreen({ onCreateProject, onOpenProject }: WelcomeScreenProps) {
  const [animationComplete, setAnimationComplete] = useState(false)
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load recent projects from preferences
  useEffect(() => {
    const loadRecentProjectsList = async () => {
      try {
        const prefs = await loadPreferences()
        setRecentProjects(prefs.recentProjects)
      } catch (error) {
        console.error("Failed to load recent projects:", error)
        // Don't show error to user, just log it
      }
    }

    loadRecentProjectsList()

    // Start animation after component mounts
    const timer = setTimeout(() => {
      setAnimationComplete(true)
    }, 1000) // Reduced animation time

    return () => clearTimeout(timer)
  }, [])

  const handleNewProject = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Create a new project with default name
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

      // Pass the Scene 1 ID to be selected
      const sceneId = findSceneId(newProject.treeStructure)

      // Create the project
      onCreateProject(newProject, sceneId)
    } catch (error) {
      console.error("Error creating new project:", error)
      setError("Failed to create new project. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenProject = async () => {
    try {
      setIsLoading(true)
      setError(null)

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

            // Load the project from the file content
            const project = await loadProjectZip(fileContent)

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
            const sceneId = findSceneId(project.treeStructure)

            // Add to recent projects
            await addRecentProject(project.metadata.name, selected as string)

            // Open the project
            onOpenProject(project, sceneId)
          }
        } catch (error) {
          console.error("Failed to open project:", error)
          setError(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      } else {
        // Fallback for browser environment - use file input
        if (fileInputRef.current) {
          fileInputRef.current.click()
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handle file selection (for browser fallback)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsLoading(true)
      setError(null)

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

      // Pass the Scene 1 ID to be selected
      const sceneId = findSceneId(project.treeStructure)

      // Add to recent projects with a browser placeholder path
      await addRecentProject(project.metadata.name, `browser:${file.name}`)

      // Open the project
      onOpenProject(project, sceneId)

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Failed to open project:", error)
      setError(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle opening a recent project
  const handleOpenRecentProject = async (project: RecentProject) => {
    try {
      setIsLoading(true)
      setError(null)

      if (isTauri) {
        // Check if the file exists
        const exists = await window.__TAURI__.fs.exists(project.path)
        if (!exists) {
          setError(`Project file not found: ${project.path}`)
          await removeRecentProject(project.path)
          setRecentProjects((prev) => prev.filter((p) => p.path !== project.path))
          return
        }

        // Read the file using Tauri's fs API
        const fileContent = await window.__TAURI__.fs.readBinaryFile(project.path)

        // Load the project from the file content
        const loadedProject = await loadProjectZip(fileContent)

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
        const sceneId = findSceneId(loadedProject.treeStructure)

        // Open the project
        onOpenProject(loadedProject, sceneId)
      } else {
        // In browser environment, we can't directly access the file
        // So we need to prompt the user to select it
        setError(
          "In the desktop app, this would open the project directly. Please use the Open Project button to select the file manually.",
        )
        handleOpenProject()
      }
    } catch (error) {
      console.error("Failed to open recent project:", error)
      setError(`Error loading project: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle removing a recent project
  const handleRemoveRecentProject = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      // Remove from state
      const updatedProjects = recentProjects.filter((project) => project.path !== path)
      setRecentProjects(updatedProjects)

      // Update preferences
      await removeRecentProject(path)
    } catch (error) {
      console.error("Failed to remove recent project:", error)
      // Don't show error to user, just log it
    }
  }

  // Get theme-specific styles
  const getCardClass = () => {
    if (theme === "muted-elegance") {
      return "bg-[#4D4D4D]/90 border-[#666666] hover:bg-[#5A5A5A]/90"
    } else if (theme === "dark") {
      return "dark:bg-gray-800/90 dark:border-gray-700 dark:hover:bg-gray-700/90"
    } else {
      return "bg-white/90 hover:bg-white/95"
    }
  }

  const getBackgroundClass = () => {
    if (theme === "muted-elegance") {
      return "bg-[#565656]"
    } else if (theme === "dark") {
      return "bg-gray-950"
    } else {
      return "bg-gray-50"
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/images/background_for_quill.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Overlay for better text visibility */}
      <div className="absolute inset-0 bg-black/10 z-10" />

      {/* Content */}
      <div className="relative z-20 container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <motion.div
          className="flex items-center justify-center mb-12 pt-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <InkAndQuillLogo className="h-12 w-12 mr-4" />
          <h1
            className="text-5xl font-bold text-white drop-shadow-md"
            style={{ fontFamily: "var(--font-dancing-script)" }}
          >
            Ink & Quill
          </h1>
        </motion.div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/80 text-white rounded-md shadow-md">
            <p>{error}</p>
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Create New */}
          <motion.div
            className="flex flex-col"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: animationComplete ? 1 : 0, x: animationComplete ? 0 : -20 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="mb-4 flex items-center">
              <FileText className="mr-2 h-5 w-5 text-white" />
              <h2 className="text-xl font-semibold text-white drop-shadow-sm">Create New</h2>
            </div>
            <Card className={`${getCardClass()} transition-colors duration-200`}>
              <CardContent className="p-6">
                <p className="mb-6 text-sm">
                  Start a fresh writing project with our default structure or customize it to your needs.
                </p>
                <Button className="w-full" onClick={handleNewProject} disabled={isLoading}>
                  {isLoading ? "Creating..." : "New Project"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Middle column - Open Existing */}
          <motion.div
            className="flex flex-col"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: animationComplete ? 1 : 0, y: animationComplete ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="mb-4 flex items-center">
              <FolderOpen className="mr-2 h-5 w-5 text-white" />
              <h2 className="text-xl font-semibold text-white drop-shadow-sm">Open Existing</h2>
            </div>
            <Card className={`${getCardClass()} transition-colors duration-200`}>
              <CardContent className="p-6">
                <p className="mb-6 text-sm">
                  Continue working on an existing Quill project by opening a .quill file from your computer.
                </p>
                <Button variant="outline" className="w-full" onClick={handleOpenProject} disabled={isLoading}>
                  {isLoading ? "Opening..." : "Open Project"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Right column - Recent Projects */}
          <motion.div
            className="flex flex-col"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: animationComplete ? 1 : 0, x: animationComplete ? 0 : 20 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <div className="mb-4 flex items-center">
              <Clock className="mr-2 h-5 w-5 text-white" />
              <h2 className="text-xl font-semibold text-white drop-shadow-sm">Recent Projects</h2>
            </div>
            <Card className={`${getCardClass()} transition-colors duration-200`}>
              <CardContent className="p-6">
                {recentProjects.length > 0 ? (
                  <div className="space-y-3">
                    {recentProjects.map((project, index) => (
                      <div key={`${project.path}-${index}`}>
                        <div
                          className="flex items-center justify-between p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer group"
                          onClick={() => !isLoading && handleOpenRecentProject(project)}
                        >
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-gray-500" />
                            <div>
                              <p className="font-medium text-sm">{project.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(project.lastModified).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleRemoveRecentProject(project.path, e)}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {index < recentProjects.length - 1 && <Separator className="my-1" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">No recent projects</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Replace the footer with "Welcome Home" in cursive */}
        <motion.div
          className="mt-24 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: animationComplete ? 1 : 0, scale: animationComplete ? 1 : 0.9 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          <h2
            className="text-6xl text-white drop-shadow-lg"
            style={{
              fontFamily: "var(--font-dancing-script)",
              textShadow: "0 4px 6px rgba(0, 0, 0, 0.2)",
            }}
          >
            Welcome to your home for creative writing
          </h2>
        </motion.div>
      </div>
      {/* Hidden file input for opening projects (browser fallback) */}
      <input type="file" ref={fileInputRef} className="hidden" accept=".quill" onChange={handleFileChange} />
    </div>
  )
}
