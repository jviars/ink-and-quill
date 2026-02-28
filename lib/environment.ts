/**
 * Environment detection utilities
 */

// Check if we're running in Tauri
export const isTauri = typeof window !== "undefined" && window.__TAURI__ !== undefined

// Check if we're running in Electron
export const isElectron = typeof window !== "undefined" && !!(window as any).electron

// Check if we're running in a browser (not Tauri or Electron)
export const isBrowser = typeof window !== "undefined" && !isTauri && !isElectron

// Get the platform (OS) we're running on
export function getPlatform(): "windows" | "macos" | "linux" | "unknown" {
  if (typeof window === "undefined") return "unknown"

  if (isTauri) {
    // In Tauri, we can get the OS from the navigator
    const platform = navigator.platform.toLowerCase()
    if (platform.includes("win")) return "windows"
    if (platform.includes("mac")) return "macos"
    if (platform.includes("linux")) return "linux"
  }

  // Fallback to navigator.platform
  const platform = navigator.platform.toLowerCase()
  if (platform.includes("win")) return "windows"
  if (platform.includes("mac")) return "macos"
  if (platform.includes("linux")) return "linux"

  return "unknown"
}

// Check if we're in development mode
export const isDevelopment = process.env.NODE_ENV === "development"
