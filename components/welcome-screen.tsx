"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { FolderOpen, FileText, Clock, RotateCcw, AlertCircle } from "lucide-react"
import { InkAndQuillLogo } from "@/components/quill-logo"
import { GlassPanel } from "@/components/glass-ui"
import { Button } from "@/components/ui/button"
import type { QuillProject, TreeNode } from "@/lib/project-types"
import { createEmptyProject } from "@/lib/project-types"
import { loadProjectZip } from "@/lib/project-io"
import { loadPreferences, addRecentProject, removeRecentProject, type RecentProject } from "@/lib/user-preferences"
import { isTauri } from "@/lib/environment"
import { cn } from "@/lib/utils"

interface WelcomeScreenProps {
  onCreateProject: (project: QuillProject, selectedNodeId?: string | null, filePath?: string | null) => void
  onOpenProject: (project: QuillProject, selectedNodeId?: string | null, filePath?: string | null) => void
}

function findPreferredDocumentId(nodes: TreeNode[]): string | null {
  let firstDoc: string | null = null

  const visit = (list: TreeNode[]): boolean => {
    for (const node of list) {
      if (node.type === "document") {
        if (node.label === "Scene 1") {
          firstDoc = node.id
          return true
        }
        if (!firstDoc) firstDoc = node.id
      }
      if (node.children?.length && visit(node.children)) {
        return true
      }
    }
    return false
  }

  visit(nodes)
  return firstDoc
}

function isProjectValid(project: QuillProject | null): project is QuillProject {
  return Boolean(project?.metadata && Array.isArray(project.treeStructure) && project.documents)
}

export function WelcomeScreen({ onCreateProject, onOpenProject }: WelcomeScreenProps) {
  const [animationReady, setAnimationReady] = useState(false)
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAutosaveBackup, setHasAutosaveBackup] = useState(false)
  const [backupTimestamp, setBackupTimestamp] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const prefs = await loadPreferences()
        setRecentProjects(prefs.recentProjects || [])
      } catch (loadError) {
        console.error("Failed to load recent projects:", loadError)
      }

      try {
        const backup = localStorage.getItem("quill-autosave-project")
        if (!backup) return
        const parsed = JSON.parse(backup) as QuillProject
        if (isProjectValid(parsed)) {
          setHasAutosaveBackup(true)
          setBackupTimestamp(parsed.metadata?.lastModified || null)
        }
      } catch (backupError) {
        console.error("Failed to parse autosave backup:", backupError)
      }
    }

    bootstrap()
    const timer = setTimeout(() => setAnimationReady(true), 220)
    return () => clearTimeout(timer)
  }, [])

  const refreshRecentProjects = async () => {
    try {
      const prefs = await loadPreferences()
      setRecentProjects(prefs.recentProjects || [])
    } catch (loadError) {
      console.error("Failed to refresh recent projects:", loadError)
    }
  }

  const openProjectFromData = async (project: QuillProject, filePath: string | null) => {
    const selectedNodeId = findPreferredDocumentId(project.treeStructure)
    onOpenProject(project, selectedNodeId, filePath)
  }

  const handleNewProject = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const newProject = createEmptyProject("Untitled Project")
      const sceneId = findPreferredDocumentId(newProject.treeStructure)
      onCreateProject(newProject, sceneId, null)
    } catch (createError) {
      console.error("Error creating new project:", createError)
      setError("Failed to create a new project.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenProject = async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (isTauri) {
        const selected = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [{ name: "Quill Projects", extensions: ["quill"] }],
        })

        if (!selected) return

        const filePath = selected as string
        const fileContent = await window.__TAURI__.fs.readBinaryFile(filePath)
        const project = await loadProjectZip(fileContent, filePath)
        await addRecentProject(project.metadata.name, filePath)
        await openProjectFromData(project, filePath)
        await refreshRecentProjects()
        return
      }

      fileInputRef.current?.click()
    } catch (openError) {
      console.error("Failed to open project:", openError)
      setError(`Error loading project: ${openError instanceof Error ? openError.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenRecent = async (recent: RecentProject) => {
    try {
      if (!isTauri || !recent.path || recent.path.startsWith("browser:")) {
        setError("This recent project entry is not available directly in the desktop app.")
        return
      }

      setIsLoading(true)
      setError(null)

      const exists = await window.__TAURI__.fs.exists(recent.path)
      if (!exists) {
        await removeRecentProject(recent.path)
        await refreshRecentProjects()
        setError(`Project not found on disk: ${recent.path}`)
        return
      }

      const fileContent = await window.__TAURI__.fs.readBinaryFile(recent.path)
      const project = await loadProjectZip(fileContent, recent.path)
      await openProjectFromData(project, recent.path)
    } catch (recentError) {
      console.error("Failed to open recent project:", recentError)
      setError(`Failed to open recent project: ${recentError instanceof Error ? recentError.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecoverAutosave = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const backup = localStorage.getItem("quill-autosave-project")
      if (!backup) {
        setHasAutosaveBackup(false)
        setBackupTimestamp(null)
        setError("No autosave backup found.")
        return
      }

      const parsed = JSON.parse(backup) as QuillProject
      if (!isProjectValid(parsed)) {
        throw new Error("Autosave data is invalid")
      }

      await openProjectFromData(parsed, null)
    } catch (recoverError) {
      console.error("Failed to recover autosave:", recoverError)
      setError(`Could not recover autosave: ${recoverError instanceof Error ? recoverError.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsLoading(true)
      setError(null)

      const project = await loadProjectZip(file)
      await addRecentProject(project.metadata.name, `browser:${file.name}`)
      await openProjectFromData(project, null)
      await refreshRecentProjects()
    } catch (openError) {
      console.error("Failed to open selected project file:", openError)
      setError(`Error loading project: ${openError instanceof Error ? openError.message : "Unknown error"}`)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("welcome-shell app-workspace relative min-h-screen overflow-hidden px-5 py-6", isTauri && "tauri-desktop")}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-14 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-8 top-8 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1380px] flex-col gap-6">
        <motion.header
          className="glass-toolbar rounded-2xl px-6 py-5"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: animationReady ? 1 : 0, y: animationReady ? 0 : -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <InkAndQuillLogo className="h-8 w-8" />
              <div>
                <h1 className="text-lg font-semibold tracking-wide">Welcome Back to Ink & Quill</h1>
                <p className="text-sm text-muted-foreground">Open a manuscript, recover your last session, or start something new.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic">“Every draft begins with one brave sentence.”</p>
          </div>
        </motion.header>

        {error && (
          <div className="glass-panel flex items-start gap-2 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: animationReady ? 1 : 0, x: animationReady ? 0 : -12 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <GlassPanel className="h-full rounded-2xl p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">Start Writing</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose how you want to jump in today.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                  onClick={handleNewProject}
                  disabled={isLoading}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">New Project</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Create a fresh project with a starter manuscript layout.</p>
                </button>

                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                  onClick={handleOpenProject}
                  disabled={isLoading}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Open Project</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Load an existing `.quill` file from your device.</p>
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={handleNewProject} disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create Project"}
                </Button>
                <Button variant="outline" onClick={handleOpenProject} disabled={isLoading}>
                  {isLoading ? "Opening..." : "Open Project"}
                </Button>
                {hasAutosaveBackup && (
                  <Button variant="secondary" onClick={handleRecoverAutosave} disabled={isLoading}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Recover Autosave
                  </Button>
                )}
              </div>
              {backupTimestamp && (
                <p className="mt-3 text-xs text-muted-foreground">Last autosave: {new Date(backupTimestamp).toLocaleString()}</p>
              )}
            </GlassPanel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: animationReady ? 1 : 0, x: animationReady ? 0 : 12 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <GlassPanel className="h-full rounded-2xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent Projects</h2>
              </div>
              {recentProjects.length > 0 ? (
                <div className="space-y-2">
                  {recentProjects.slice(0, 10).map((project) => (
                    <button
                      key={typeof project.path === "string" ? project.path : String(project.path)}
                      type="button"
                      onClick={() => handleOpenRecent(project)}
                      className="flex w-full flex-col rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
                      disabled={isLoading}
                    >
                      <span className="truncate text-sm font-medium">
                        {typeof project.name === "string" ? project.name : "Untitled Project"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {new Date(
                          typeof project.lastModified === "string" ? project.lastModified : Date.now(),
                        ).toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent projects yet. Your latest projects will show up here.</p>
              )}
            </GlassPanel>
          </motion.div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept=".quill" onChange={handleFileChange} />
    </div>
  )
}
