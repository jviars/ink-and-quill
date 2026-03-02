"use client"

/* -------------------------------------------------------------------
   lib/project-io.ts
   -------------------------------------------------------------------
   Handles saving & loading ".quill" project archives.
   A .quill file is just a ZIP with:
     ├── project.json   (metadata, tree, settings, docs)
     └── assets/        (any images or binary blobs referenced in docs)
-------------------------------------------------------------------- */

import JSZip from "jszip"
import FileSaver from "file-saver"
import { normalizeProject, type QuillProject } from "./project-types"
import { addRecentProject, loadPreferences } from "./user-preferences"
import { isTauri } from "./environment"

export interface SaveProjectResult {
  success: boolean
  filePath: string | null
}

/* ---------- helpers ------------------------------------------------ */
const toProjectJson = (data: unknown) => JSON.stringify(data, null, 2)
const sanitizeProjectFileName = (value: string): string =>
  value.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || "Untitled Project"
const ensureQuillExtension = (path: string): string => (path.toLowerCase().endsWith(".quill") ? path : `${path}.quill`)

/* ---------- public API --------------------------------------------- */
// Replace the saveProjectZip function with this enhanced version
export async function saveProjectZip(project: QuillProject): Promise<SaveProjectResult> {
  const normalizedProject = normalizeProject(project)
  normalizedProject.metadata.lastModified = new Date().toISOString()

  const zip = new JSZip()
  zip.file("project.json", toProjectJson(normalizedProject))

  // If your TipTap docs embed <img src="data:..."> you may want to
  // strip those out and write them under assets/ here.
  // TODO: Extract and store embedded images from TipTap content

  // Get preferred directory from preferences
  const preferences = await loadPreferences()
  const preferredDirectory = preferences.projectDirectory
  const filename = `${sanitizeProjectFileName(normalizedProject.metadata.name)}.quill`

  if (isTauri) {
    try {
      // Generate the ZIP as a Uint8Array for Tauri
      const zipData = await zip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      })

      // Create the full path
      let fullPath: string
      if (preferredDirectory) {
        // Check if directory exists, create if it doesn't
        const dirExists = await window.__TAURI__.fs.exists(preferredDirectory)
        if (!dirExists) {
          await window.__TAURI__.fs.createDir(preferredDirectory, { recursive: true })
        }
        if (window.__TAURI__?.path?.join) {
          fullPath = await window.__TAURI__.path.join(preferredDirectory, filename)
        } else {
          fullPath = `${preferredDirectory}/${filename}`
        }
      } else {
        // Use Tauri's dialog to ask for save location
        const selected = await window.__TAURI__.dialog.save({
          filters: [{ name: "Quill Project", extensions: ["quill"] }],
          defaultPath: filename,
        })
        fullPath = typeof selected === "string" ? ensureQuillExtension(selected) : ""
      }

      if (fullPath) {
        // Write the file using Tauri's fs API
        const normalizedFullPath = ensureQuillExtension(fullPath)
        await window.__TAURI__.fs.writeBinaryFile(normalizedFullPath, zipData)
        console.log(`Project saved to ${normalizedFullPath}`)

        // Add to recent projects
        await addRecentProject(normalizedProject.metadata.name, normalizedFullPath)

        return { success: true, filePath: normalizedFullPath }
      }
      return { success: false, filePath: null }
    } catch (error) {
      console.error("Failed to save file with Tauri:", error)
      throw error
    }
  } else {
    // Fallback for browser environment during development
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
    FileSaver.saveAs(blob, filename)

    // For browser, we can't store the actual file path
    // but we can still add to recent projects with a placeholder path
    await addRecentProject(normalizedProject.metadata.name, `browser:${normalizedProject.metadata.name}`)

    return { success: true, filePath: null }
  }
}

// Add this function to handle directory selection in a desktop environment
export async function selectDirectory(initialPath?: string): Promise<string | null> {
  if (isTauri) {
    try {
      // Use Tauri's dialog API
      const selected = await window.__TAURI__.dialog.open({
        directory: true,
        multiple: false,
        defaultPath: initialPath,
      })

      return (selected as string) || null
    } catch (error) {
      console.error("Failed to open directory dialog:", error)
      return null
    }
  }

  // Browser fallback: no directory picker support here.
  return null
}

export async function loadProjectZip(file: File | ArrayBuffer | Uint8Array, filePath?: string): Promise<QuillProject> {
  try {
    const zip = await JSZip.loadAsync(file)
    const projectFile = zip.file("project.json")

    if (!projectFile) {
      throw new Error("Invalid .quill archive: missing project.json")
    }

    const projectStr = await projectFile.async("text")
    const parsed = JSON.parse(projectStr)
    const project = normalizeProject(parsed)

    // If a file path was provided, add to recent projects
    if (filePath && isTauri) {
      await addRecentProject(project.metadata.name, filePath)
    }

    return project
  } catch (error) {
    console.error("Error loading project:", error)
    throw new Error(`Failed to load project: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Helper function to extract embedded images from TipTap content
// This is a placeholder for future implementation
export function extractEmbeddedImages(content: string): {
  newContent: string
  images: Array<{ id: string; data: string }>
} {
  // Implementation would:
  // 1. Find all <img src="data:..."> tags
  // 2. Extract the base64 data
  // 3. Replace with <img src="asset://id"> references
  // 4. Return the modified content and extracted images

  return { newContent: content, images: [] }
}

// Helper function to rehydrate embedded images in TipTap content
// This is a placeholder for future implementation
export function rehydrateEmbeddedImages(content: string, images: Array<{ id: string; data: string }>): string {
  // Implementation would:
  // 1. Find all <img src="asset://id"> references
  // 2. Replace with the corresponding base64 data

  return content
}
