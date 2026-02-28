import type { DocumentComment } from "@/lib/project-types"

export interface EditorCommentDraft {
  id: string
  text: string
  quote?: string
}

export const createCommentId = (): string => {
  return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const normalizeAnchorText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim()
}

export const extractCommentAnchorsFromHtml = (content: string): Record<string, string[]> => {
  if (!content) return {}

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(content, "text/html")
    const anchorMap: Record<string, string[]> = {}
    const markedSpans = doc.querySelectorAll("span[data-comment-id]")

    markedSpans.forEach((element) => {
      const commentId = element.getAttribute("data-comment-id")
      if (!commentId) return
      const anchorText = normalizeAnchorText(element.textContent || "")
      if (!anchorText) return
      const existing = anchorMap[commentId] ?? []
      if (!existing.includes(anchorText)) {
        anchorMap[commentId] = [...existing, anchorText]
      }
    })

    return anchorMap
  }

  const anchorMap: Record<string, string[]> = {}
  const markerPattern = /<span[^>]*data-comment-id="([^"]+)"[^>]*>([\s\S]*?)<\/span>/gi
  let match = markerPattern.exec(content)
  while (match) {
    const commentId = match[1]
    const rawText = match[2]?.replace(/<[^>]*>/g, " ") ?? ""
    const anchorText = normalizeAnchorText(rawText)
    if (commentId && anchorText) {
      const existing = anchorMap[commentId] ?? []
      if (!existing.includes(anchorText)) {
        anchorMap[commentId] = [...existing, anchorText]
      }
    }
    match = markerPattern.exec(content)
  }

  return anchorMap
}

export const sortCommentsByCreatedAt = (comments: DocumentComment[]): DocumentComment[] => {
  return [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}
