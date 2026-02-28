"use client"

import { isTauri } from "./environment"

// Define the user preferences interface
export interface UserPreferences {
  theme: string
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
  theme: "light",
  fontSize: "16",
  projectDirectory: "",
  recentProjects: [],
}

// Maximum number of recent projects to store
const MAX_RECENT_PROJECTS = 10

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
        const preferences = JSON.parse(preferencesContent) as UserPreferences
        return preferences
      } catch (error) {
        console.error("Failed to parse preferences:", error)
        // If parsing fails, return default preferences
        return defaultPreferences
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
        const preferences = JSON.parse(preferencesString) as UserPreferences
        return preferences
      } catch (error) {
        console.error("Failed to parse preferences:", error)
        // If parsing fails, return default preferences
        return defaultPreferences
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
    preferences[key] = value

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
