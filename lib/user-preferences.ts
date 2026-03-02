"use client"

import { isTauri } from "./environment"

export type AppTheme = "light" | "dark" | "system"

export function normalizeTheme(value: unknown): AppTheme {
  if (value === "light" || value === "dark" || value === "system") {
    return value
  }
  // Legacy theme migration
  if (value === "muted-elegance") {
    return "system"
  }
  return "system"
}

// Define the user preferences interface
export interface UserPreferences {
  theme: AppTheme
  fontSize: string
  projectDirectory: string
  recentProjects: RecentProject[]
}

// Define the recent project interface
export interface RecentProject {
  name: string
  path: string
  lastModified: string
}

// Default preferences
const defaultPreferences: UserPreferences = {
  theme: "system",
  fontSize: "16",
  projectDirectory: "",
  recentProjects: [],
}

// Maximum number of recent projects to store
const MAX_RECENT_PROJECTS = 10

function normalizeRecentProject(entry: unknown): RecentProject | null {
  if (!entry || typeof entry !== "object") return null

  const value = entry as Record<string, unknown>

  let normalizedName = typeof value.name === "string" ? value.name.trim() : ""
  if (!normalizedName && value.name && typeof value.name === "object") {
    const nested = value.name as Record<string, unknown>
    const nestedMetadata = nested.metadata as Record<string, unknown> | undefined
    if (typeof nestedMetadata?.name === "string") {
      normalizedName = nestedMetadata.name.trim()
    } else if (typeof nested.name === "string") {
      normalizedName = nested.name.trim()
    }
  }
  if (!normalizedName) {
    const metadata = value.metadata as Record<string, unknown> | undefined
    normalizedName = typeof metadata?.name === "string" ? metadata.name.trim() : "Untitled Project"
  }

  const path = typeof value.path === "string" ? value.path : ""
  if (!path.trim()) return null

  const lastModified = typeof value.lastModified === "string" ? value.lastModified : new Date().toISOString()

  return {
    name: normalizedName,
    path,
    lastModified,
  }
}

function normalizePreferences(raw: unknown): UserPreferences {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const rawRecent = Array.isArray(value.recentProjects) ? value.recentProjects : []
  const normalizedRecent = rawRecent.map(normalizeRecentProject).filter((entry): entry is RecentProject => Boolean(entry))

  const seenPaths = new Set<string>()
  const dedupedRecent: RecentProject[] = []
  for (const project of normalizedRecent) {
    if (seenPaths.has(project.path)) continue
    seenPaths.add(project.path)
    dedupedRecent.push(project)
    if (dedupedRecent.length >= MAX_RECENT_PROJECTS) break
  }

  return {
    theme: normalizeTheme(value.theme),
    fontSize: typeof value.fontSize === "string" && value.fontSize ? value.fontSize : defaultPreferences.fontSize,
    projectDirectory:
      typeof value.projectDirectory === "string" ? value.projectDirectory : defaultPreferences.projectDirectory,
    recentProjects: dedupedRecent,
  }
}

// Get the app config directory for Tauri
async function getAppConfigDir(): Promise<string> {
  if (!isTauri) return ""

  try {
    // Get the app config directory from Tauri
    const appConfigDir = await window.__TAURI__.path.appConfigDir()

    // Create the directory if it doesn't exist
    const exists = await window.__TAURI__.fs.exists(appConfigDir)
    if (!exists) {
      await window.__TAURI__.fs.createDir(appConfigDir, { recursive: true })
    }

    return appConfigDir
  } catch (error) {
    console.error("Failed to get app config directory:", error)
    return ""
  }
}

// Get the preferences file path
async function getPreferencesFilePath(): Promise<string> {
  if (!isTauri) return ""

  const appConfigDir = await getAppConfigDir()
  return `${appConfigDir}/preferences.json`
}

// Load preferences from storage
export async function loadPreferences(): Promise<UserPreferences> {
  try {
    if (isTauri) {
      // Get the preferences file path
      const preferencesFilePath = await getPreferencesFilePath()

      // Check if the file exists
      const exists = await window.__TAURI__.fs.exists(preferencesFilePath)
      if (!exists) {
        // Create the file with default preferences
        await savePreferences(defaultPreferences)
        return defaultPreferences
      }

      // Read the file
      const preferencesContent = await window.__TAURI__.fs.readTextFile(preferencesFilePath)

      // Parse the JSON
      try {
        const parsed = JSON.parse(preferencesContent)
        const preferences = normalizePreferences(parsed)
        return preferences
      } catch (error) {
        console.error("Failed to parse preferences:", error)
        // If parsing fails, return default preferences
        return { ...defaultPreferences }
      }
    } else {
      // Use localStorage in browser environment
      const preferencesString = localStorage.getItem("ink-and-quill-preferences")
      if (!preferencesString) {
        // Save default preferences
        await savePreferences(defaultPreferences)
        return defaultPreferences
      }

      // Parse the JSON
      try {
        const parsed = JSON.parse(preferencesString)
        const preferences = normalizePreferences(parsed)
        return preferences
      } catch (error) {
        console.error("Failed to parse preferences:", error)
        // If parsing fails, return default preferences
        return { ...defaultPreferences }
      }
    }
  } catch (error) {
    console.error("Failed to load preferences:", error)
    // If loading fails, return default preferences
    return { ...defaultPreferences }
  }
}

// Save preferences to storage
export async function savePreferences(preferences: UserPreferences): Promise<void> {
  try {
    if (isTauri) {
      // Get the preferences file path
      const preferencesFilePath = await getPreferencesFilePath()

      // Write the file
      await window.__TAURI__.fs.writeTextFile({
        path: preferencesFilePath,
        contents: JSON.stringify(preferences, null, 2),
      })
    } else {
      // Use localStorage in browser environment
      localStorage.setItem("ink-and-quill-preferences", JSON.stringify(preferences))
    }
  } catch (error) {
    console.error("Failed to save preferences:", error)
    throw error
  }
}

// Update a single preference
export async function updatePreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): Promise<void> {
  try {
    // Load current preferences
    const preferences = await loadPreferences()

    // Update the preference
    if (key === "theme") {
      preferences.theme = normalizeTheme(value)
    } else {
      preferences[key] = value
    }

    // Save the updated preferences
    await savePreferences(preferences)
  } catch (error) {
    console.error(`Failed to update preference ${key}:`, error)
    throw error
  }
}

// Add a project to recent projects
export async function addRecentProject(name: string, path: string): Promise<void> {
  try {
    // Load current preferences
    const preferences = await loadPreferences()

    // Create the new recent project
    const newRecentProject: RecentProject = {
      name,
      path,
      lastModified: new Date().toISOString(),
    }

    // Remove the project if it already exists
    const filteredProjects = preferences.recentProjects.filter((project) => project.path !== path)

    // Add the new project to the beginning of the list
    preferences.recentProjects = [newRecentProject, ...filteredProjects].slice(0, MAX_RECENT_PROJECTS)

    // Save the updated preferences
    await savePreferences(preferences)
  } catch (error) {
    console.error("Failed to add recent project:", error)
    // Don't throw, just log the error
  }
}

// Remove a project from recent projects
export async function removeRecentProject(path: string): Promise<void> {
  try {
    // Load current preferences
    const preferences = await loadPreferences()

    // Remove the project
    preferences.recentProjects = preferences.recentProjects.filter((project) => project.path !== path)

    // Save the updated preferences
    await savePreferences(preferences)
  } catch (error) {
    console.error("Failed to remove recent project:", error)
    // Don't throw, just log the error
  }
}
