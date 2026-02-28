import { computeContentHash, type DocumentData, type DocumentSnapshot, type SnapshotTrigger } from "@/lib/project-types"

export type DiffSegmentType = "equal" | "insert" | "delete"

export interface DiffSegment {
  type: DiffSegmentType
  text: string
}

interface SnapshotCreateOptions {
  note?: string
  trigger?: SnapshotTrigger
  createdAt?: string
}

const decodeHtmlEntities = (value: string): string => {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }

  const doc = new DOMParser().parseFromString(value, "text/html")
  return doc.documentElement.textContent || ""
}

export const htmlToPlainText = (content: string): string => {
  if (!content) return ""

  const withBreaks = content
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\/\s*div\s*>/gi, "\n")
    .replace(/<\/\s*h[1-6]\s*>/gi, "\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
  const withoutTags = withBreaks.replace(/<[^>]*>/g, " ")
  const decoded = decodeHtmlEntities(withoutTags)

  return decoded
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export const computeWordCountFromHtml = (content: string): number => {
  return htmlToPlainText(content)
    .split(/\s+/)
    .filter(Boolean).length
}

export const createSnapshotRecord = (document: DocumentData, options: SnapshotCreateOptions = {}): DocumentSnapshot => {
  const createdAt = options.createdAt ?? new Date().toISOString()
  const content = document.content || ""
  const note = options.note?.trim()

  return {
    id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    note: note || undefined,
    contentHash: computeContentHash(content),
    content,
    wordCount: Number.isFinite(document.wordCount) ? document.wordCount : computeWordCountFromHtml(content),
    trigger: options.trigger ?? "manual",
  }
}

export const appendSnapshotWithLimit = (
  existingSnapshots: DocumentSnapshot[],
  nextSnapshot: DocumentSnapshot,
  maxSnapshotsPerDocument: number,
): DocumentSnapshot[] => {
  const latestSnapshot = existingSnapshots[existingSnapshots.length - 1]
  if (latestSnapshot && latestSnapshot.contentHash === nextSnapshot.contentHash) {
    return existingSnapshots
  }

  const appended = [...existingSnapshots, nextSnapshot]
  const safeMax = Math.max(1, Math.round(maxSnapshotsPerDocument))
  if (appended.length <= safeMax) return appended
  return appended.slice(appended.length - safeMax)
}

export const formatSnapshotTrigger = (trigger: SnapshotTrigger): string => {
  switch (trigger) {
    case "manual-save":
      return "Manual Save"
    case "interval":
      return "Interval"
    case "before-restore":
      return "Safety"
    default:
      return "Manual"
  }
}

const tokenizeForDiff = (value: string): string[] => {
  return value.match(/\w+|[^\w\s]|\s+/g) ?? []
}

const mergeDiffSegments = (segments: DiffSegment[]): DiffSegment[] => {
  if (segments.length === 0) return segments

  const merged: DiffSegment[] = [segments[0]]
  for (let index = 1; index < segments.length; index += 1) {
    const current = segments[index]
    const previous = merged[merged.length - 1]
    if (previous.type === current.type) {
      previous.text += current.text
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

export const buildInlineDiff = (beforeText: string, afterText: string): DiffSegment[] => {
  if (beforeText === afterText) {
    return beforeText ? [{ type: "equal", text: beforeText }] : []
  }

  const beforeTokens = tokenizeForDiff(beforeText)
  const afterTokens = tokenizeForDiff(afterText)

  if (beforeTokens.length === 0) {
    return [{ type: "insert", text: afterText }]
  }
  if (afterTokens.length === 0) {
    return [{ type: "delete", text: beforeText }]
  }

  if (beforeTokens.length * afterTokens.length > 1_200_000) {
    return [
      { type: "delete", text: beforeText },
      { type: "insert", text: afterText },
    ]
  }

  const rows = beforeTokens.length + 1
  const cols = afterTokens.length + 1
  const lcsMatrix = Array.from({ length: rows }, () => new Uint16Array(cols))

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      if (beforeTokens[row - 1] === afterTokens[col - 1]) {
        lcsMatrix[row][col] = lcsMatrix[row - 1][col - 1] + 1
      } else {
        lcsMatrix[row][col] = Math.max(lcsMatrix[row - 1][col], lcsMatrix[row][col - 1])
      }
    }
  }

  const reversedSegments: DiffSegment[] = []
  let row = beforeTokens.length
  let col = afterTokens.length

  while (row > 0 || col > 0) {
    if (row > 0 && col > 0 && beforeTokens[row - 1] === afterTokens[col - 1]) {
      reversedSegments.push({ type: "equal", text: beforeTokens[row - 1] })
      row -= 1
      col -= 1
      continue
    }

    if (col > 0 && (row === 0 || lcsMatrix[row][col - 1] >= lcsMatrix[row - 1][col])) {
      reversedSegments.push({ type: "insert", text: afterTokens[col - 1] })
      col -= 1
      continue
    }

    reversedSegments.push({ type: "delete", text: beforeTokens[row - 1] })
    row -= 1
  }

  reversedSegments.reverse()
  return mergeDiffSegments(reversedSegments).filter((segment) => segment.text.length > 0)
}
