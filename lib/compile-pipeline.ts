import type { CompileOutputFormat, CompilePreset, QuillProject, SectionType, TreeNode } from "./project-types"

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

const sanitizeFileName = (value: string): string => {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim()
  return cleaned || "Untitled Project"
}

const normalizeSectionType = (node: TreeNode): SectionType => {
  if (node.sectionType) return node.sectionType
  if (node.type === "folder") return "chapter"
  return "scene"
}

const isSectionIncludedByPreset = (sectionType: SectionType, preset: CompilePreset): boolean => {
  if (sectionType === "front-matter") return preset.includeFrontMatter
  if (sectionType === "back-matter") return preset.includeBackMatter
  if (sectionType === "research") return preset.includeResearch
  if (sectionType === "notes") return preset.includeNotes
  return true
}

export interface CompileSegment {
  kind: "folder" | "document"
  id: string
  title: string
  sectionType: SectionType
  level: number
  html: string
  synopsis?: string
}

export interface CompileBundle {
  title: string
  fileNameBase: string
  outputFormat: CompileOutputFormat
  preset: CompilePreset
  segments: CompileSegment[]
  html: string
  markdown: string
  text: string
}

const buildSegments = (project: QuillProject, preset: CompilePreset): CompileSegment[] => {
  const segments: CompileSegment[] = []

  const visit = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      const includeInCompile = node.includeInCompile ?? true
      if (!includeInCompile) continue

      const sectionType = normalizeSectionType(node)
      if (!isSectionIncludedByPreset(sectionType, preset)) continue

      const headingLevel = preset.headingMode === "project-hierarchy" ? Math.min(Math.max(depth + 1, 1), 6) : 2

      if (node.type === "folder") {
        if (node.id !== "root") {
          segments.push({
            kind: "folder",
            id: node.id,
            title: node.label,
            sectionType,
            level: headingLevel,
            html: "",
          })
        }

        if (node.children?.length) {
          visit(node.children, depth + 1)
        }
        continue
      }

      const doc = project.documents[node.id]
      if (!doc) continue

      segments.push({
        kind: "document",
        id: node.id,
        title: node.label,
        sectionType,
        level: headingLevel,
        html: doc.content || "",
        synopsis: doc.synopsis || "",
      })
    }
  }

  visit(project.treeStructure, 0)
  return segments
}

const getSeparatorHtml = (preset: CompilePreset): string => {
  if (preset.nodeSeparator === "line") return "\n<hr />\n"
  if (preset.nodeSeparator === "page-break") return '\n<div style="page-break-after: always;"></div>\n'
  return "\n"
}

const getSeparatorMarkdown = (preset: CompilePreset): string => {
  if (preset.nodeSeparator === "line") return "\n\n---\n\n"
  if (preset.nodeSeparator === "page-break") return "\n\n\\pagebreak\n\n"
  return "\n\n"
}

const renderHtml = (project: QuillProject, preset: CompilePreset, segments: CompileSegment[]): string => {
  const bodyParts: string[] = [`<h1>${escapeHtml(project.metadata.name)}</h1>`]
  const separator = getSeparatorHtml(preset)

  segments.forEach((segment, index) => {
    if (segment.title) {
      bodyParts.push(`<h${segment.level}>${escapeHtml(segment.title)}</h${segment.level}>`)
    }

    if (segment.kind === "document") {
      if (preset.includeSynopsis && segment.synopsis) {
        bodyParts.push(`<p><em>${escapeHtml(segment.synopsis)}</em></p>`)
      }
      if (segment.html) {
        bodyParts.push(segment.html)
      } else {
        bodyParts.push("<p></p>")
      }
    }

    if (index < segments.length - 1) {
      bodyParts.push(separator)
    }
  })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(project.metadata.name)}</title>
</head>
<body>
${bodyParts.join("\n")}
</body>
</html>`
}

const renderMarkdown = (project: QuillProject, preset: CompilePreset, segments: CompileSegment[]): string => {
  const parts: string[] = [`# ${project.metadata.name}`]
  const separator = getSeparatorMarkdown(preset)

  segments.forEach((segment, index) => {
    if (segment.title) {
      parts.push(`${"#".repeat(Math.min(Math.max(segment.level, 2), 6))} ${segment.title}`)
    }

    if (segment.kind === "document") {
      if (preset.includeSynopsis && segment.synopsis) {
        parts.push(`_${segment.synopsis}_`)
      }

      const body = stripHtml(segment.html || "")
      if (body) {
        parts.push(body)
      }
    }

    if (index < segments.length - 1) {
      parts.push(separator)
    }
  })

  return parts.join("\n\n").replace(/\n{4,}/g, "\n\n")
}

const renderText = (project: QuillProject, preset: CompilePreset, segments: CompileSegment[]): string => {
  const parts: string[] = [project.metadata.name.toUpperCase()]
  const separator = preset.nodeSeparator === "none" ? "\n" : "\n\n--------------------\n\n"

  segments.forEach((segment, index) => {
    if (segment.title) {
      parts.push(segment.title.toUpperCase())
    }

    if (segment.kind === "document") {
      if (preset.includeSynopsis && segment.synopsis) {
        parts.push(`[Synopsis] ${segment.synopsis}`)
      }

      const body = stripHtml(segment.html || "")
      if (body) {
        parts.push(body)
      }
    }

    if (index < segments.length - 1) {
      parts.push(separator)
    }
  })

  return parts.join("\n\n").replace(/\n{4,}/g, "\n\n")
}

export const getCompilePreset = (project: QuillProject, presetId?: string | null): CompilePreset => {
  const fromProject = project.settings.compilePresets || []
  if (presetId) {
    const matched = fromProject.find((preset) => preset.id === presetId)
    if (matched) return matched
  }

  const defaultPreset =
    fromProject.find((preset) => preset.id === project.settings.defaultCompilePresetId) ??
    fromProject[0]

  if (defaultPreset) return defaultPreset

  // Defensive fallback for corrupted projects.
  return {
    id: "fallback-docx",
    name: "Fallback DOCX",
    outputFormat: "docx",
    includeFrontMatter: true,
    includeBackMatter: true,
    includeResearch: false,
    includeNotes: false,
    includeSynopsis: false,
    headingMode: "project-hierarchy",
    nodeSeparator: "line",
  }
}

export const buildCompileBundle = (
  project: QuillProject,
  presetId?: string | null,
  outputOverride?: CompileOutputFormat | null,
): CompileBundle => {
  const preset = getCompilePreset(project, presetId)
  const outputFormat = outputOverride ?? preset.outputFormat
  const segments = buildSegments(project, preset)
  const html = renderHtml(project, preset, segments)
  const markdown = renderMarkdown(project, preset, segments)
  const text = renderText(project, preset, segments)

  return {
    title: project.metadata.name,
    fileNameBase: sanitizeFileName(project.metadata.name),
    outputFormat,
    preset,
    segments,
    html,
    markdown,
    text,
  }
}
