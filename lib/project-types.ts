export type SectionType = "front-matter" | "chapter" | "scene" | "back-matter" | "notes" | "research"

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  "front-matter": "Front Matter",
  chapter: "Chapter",
  scene: "Scene",
  "back-matter": "Back Matter",
  notes: "Notes",
  research: "Research",
}

export const SECTION_TYPE_VALUES: SectionType[] = [
  "front-matter",
  "chapter",
  "scene",
  "back-matter",
  "notes",
  "research",
]

export type MetadataFieldType = "text" | "long-text" | "number" | "date" | "select" | "multi-select" | "boolean"

export type MetadataValue = string | number | boolean | string[] | null

export interface MetadataFieldDefinition {
  id: string
  name: string
  type: MetadataFieldType
  options?: string[]
  defaultValue?: MetadataValue
  placeholder?: string
}

export interface MetadataTemplate {
  id: string
  name: string
  sectionTypes?: SectionType[]
  fieldDefaults: Record<string, MetadataValue>
}

export type CompileOutputFormat = "docx" | "markdown" | "html" | "txt"
export type CompileSeparator = "none" | "line" | "page-break"
export type CompileHeadingMode = "project-hierarchy" | "flat"
export type SnapshotTrigger = "manual" | "manual-save" | "interval" | "before-restore"
export type ResearchItemType = "pdf" | "image" | "link" | "note"

export interface SnapshotSettings {
  enabled: boolean
  autoOnManualSave: boolean
  autoOnInterval: boolean
  intervalMinutes: number
  maxSnapshotsPerDocument: number
  autoBeforeRestore: boolean
}

export interface TargetsSettings {
  sessionWordTarget: number
  projectWordTarget: number
  defaultDocumentWordTarget: number
  dailyWordHistory: Record<string, number>
}

export interface DocumentSnapshot {
  id: string
  createdAt: string
  note?: string
  contentHash: string
  content: string
  wordCount: number
  trigger: SnapshotTrigger
}

export interface DocumentComment {
  id: string
  text: string
  quote?: string
  resolved: boolean
  createdAt: string
  updatedAt: string
}

export interface ResearchItem {
  type: ResearchItemType
  sourcePath?: string
  sourceUrl?: string
  sourceName?: string
  indexedText?: string
  importedAt?: string
}

export interface CompilePreset {
  id: string
  name: string
  description?: string
  outputFormat: CompileOutputFormat
  includeFrontMatter: boolean
  includeBackMatter: boolean
  includeResearch: boolean
  includeNotes: boolean
  includeSynopsis: boolean
  headingMode: CompileHeadingMode
  nodeSeparator: CompileSeparator
}

export interface ProjectSettings {
  theme: string
  fontSize: string
  snapshotSettings: SnapshotSettings
  targetsSettings: TargetsSettings
  metadataFields: MetadataFieldDefinition[]
  metadataTemplates: MetadataTemplate[]
  compilePresets: CompilePreset[]
  defaultCompilePresetId: string
}

export interface QuillProject {
  metadata: {
    name: string
    version: string
    createdAt: string
    lastModified: string
  }
  settings: ProjectSettings
  treeStructure: TreeNode[]
  documents: Record<string, DocumentData>
}

export interface TreeNode {
  id: string
  label: string
  type: "folder" | "document"
  sectionType?: SectionType
  includeInCompile?: boolean
  metadataTemplateId?: string | null
  children?: TreeNode[]
}

export interface DocumentData {
  content: string
  synopsis: string
  notes: string
  wordTarget: number
  research?: ResearchItem
  snapshots: DocumentSnapshot[]
  comments: DocumentComment[]
  status: string
  label: string
  keywords?: string
  metadata: Record<string, MetadataValue>
  wordCount: number
  createdAt: string
  lastModified: string
}

export type NodeType = "file" | "folder"

export interface FileNode {
  id: string
  name: string
  type: NodeType
  sectionType?: SectionType
  includeInCompile?: boolean
  metadataTemplateId?: string | null
  children?: FileNode[]
  parentId: string | null
}

const DEFAULT_METADATA_FIELDS: MetadataFieldDefinition[] = [
  {
    id: "status",
    name: "Status",
    type: "select",
    options: ["to-do", "draft", "revised", "final"],
    defaultValue: "to-do",
  },
  {
    id: "label",
    name: "Label",
    type: "text",
    defaultValue: "none",
    placeholder: "e.g. Act I, POV, Color",
  },
  {
    id: "keywords",
    name: "Keywords",
    type: "text",
    defaultValue: "",
    placeholder: "Comma-separated tags",
  },
]

const DEFAULT_METADATA_TEMPLATES: MetadataTemplate[] = [
  {
    id: "template-scene",
    name: "Scene Default",
    sectionTypes: ["scene", "chapter"],
    fieldDefaults: {
      status: "to-do",
      label: "none",
      keywords: "",
    },
  },
  {
    id: "template-front",
    name: "Front Matter",
    sectionTypes: ["front-matter"],
    fieldDefaults: {
      status: "draft",
      label: "none",
      keywords: "front-matter",
    },
  },
  {
    id: "template-back",
    name: "Back Matter",
    sectionTypes: ["back-matter"],
    fieldDefaults: {
      status: "draft",
      label: "none",
      keywords: "back-matter",
    },
  },
  {
    id: "template-research",
    name: "Research",
    sectionTypes: ["research", "notes"],
    fieldDefaults: {
      status: "draft",
      label: "reference",
      keywords: "research",
    },
  },
]

const DEFAULT_COMPILE_PRESETS: CompilePreset[] = [
  {
    id: "preset-manuscript-docx",
    name: "Manuscript DOCX",
    description: "Standard manuscript compile with headings and body text.",
    outputFormat: "docx",
    includeFrontMatter: true,
    includeBackMatter: true,
    includeResearch: false,
    includeNotes: false,
    includeSynopsis: false,
    headingMode: "project-hierarchy",
    nodeSeparator: "line",
  },
  {
    id: "preset-submission-markdown",
    name: "Submission Markdown",
    description: "Lean compile for review and version control.",
    outputFormat: "markdown",
    includeFrontMatter: true,
    includeBackMatter: true,
    includeResearch: false,
    includeNotes: false,
    includeSynopsis: false,
    headingMode: "flat",
    nodeSeparator: "line",
  },
  {
    id: "preset-full-html",
    name: "Full HTML",
    description: "Project-wide HTML compile, including research and notes.",
    outputFormat: "html",
    includeFrontMatter: true,
    includeBackMatter: true,
    includeResearch: true,
    includeNotes: true,
    includeSynopsis: true,
    headingMode: "project-hierarchy",
    nodeSeparator: "none",
  },
]

const DEFAULT_SNAPSHOT_SETTINGS: SnapshotSettings = {
  enabled: true,
  autoOnManualSave: true,
  autoOnInterval: false,
  intervalMinutes: 10,
  maxSnapshotsPerDocument: 50,
  autoBeforeRestore: true,
}

const DEFAULT_TARGETS_SETTINGS: TargetsSettings = {
  sessionWordTarget: 1000,
  projectWordTarget: 80000,
  defaultDocumentWordTarget: 1500,
  dailyWordHistory: {},
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null
}

const cloneMetadataFields = (fields: MetadataFieldDefinition[]): MetadataFieldDefinition[] => {
  return fields.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }))
}

const cloneMetadataTemplates = (templates: MetadataTemplate[]): MetadataTemplate[] => {
  return templates.map((template) => ({
    ...template,
    sectionTypes: template.sectionTypes ? [...template.sectionTypes] : undefined,
    fieldDefaults: { ...template.fieldDefaults },
  }))
}

const cloneCompilePresets = (presets: CompilePreset[]): CompilePreset[] => {
  return presets.map((preset) => ({ ...preset }))
}

const cloneSnapshotSettings = (settings: SnapshotSettings): SnapshotSettings => ({
  ...settings,
})

const cloneTargetsSettings = (settings: TargetsSettings): TargetsSettings => ({
  ...settings,
  dailyWordHistory: { ...settings.dailyWordHistory },
})

const computeWordCount = (content: string): number => {
  return content
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length
}

export const computeContentHash = (content: string): string => {
  let hash = 5381
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 33) ^ content.charCodeAt(index)
  }
  return `h${(hash >>> 0).toString(16)}`
}

const normalizeSectionType = (value: unknown, nodeType: TreeNode["type"], label: string): SectionType => {
  if (typeof value === "string" && SECTION_TYPE_VALUES.includes(value as SectionType)) {
    return value as SectionType
  }

  const lowerLabel = label.toLowerCase()
  if (lowerLabel.includes("research")) return "research"
  if (lowerLabel.includes("front")) return "front-matter"
  if (lowerLabel.includes("back")) return "back-matter"
  if (lowerLabel.includes("note")) return "notes"

  return nodeType === "folder" ? "chapter" : "scene"
}

const normalizeMetadataValue = (field: MetadataFieldDefinition, value: unknown): MetadataValue => {
  if (value === null || value === undefined) {
    return field.defaultValue ?? null
  }

  switch (field.type) {
    case "boolean":
      return Boolean(value)
    case "number":
      return typeof value === "number" ? value : Number(value) || 0
    case "multi-select":
      if (Array.isArray(value)) return value.map((item) => String(item))
      if (typeof value === "string") {
        return value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      }
      return []
    default:
      return String(value)
  }
}

const inferResearchItemTypeFromPath = (path: string): ResearchItemType => {
  const lowerPath = path.toLowerCase()
  if (lowerPath.endsWith(".pdf")) return "pdf"
  if (
    lowerPath.endsWith(".png") ||
    lowerPath.endsWith(".jpg") ||
    lowerPath.endsWith(".jpeg") ||
    lowerPath.endsWith(".gif") ||
    lowerPath.endsWith(".webp") ||
    lowerPath.endsWith(".bmp") ||
    lowerPath.endsWith(".svg") ||
    lowerPath.endsWith(".avif") ||
    lowerPath.endsWith(".tif") ||
    lowerPath.endsWith(".tiff")
  ) {
    return "image"
  }
  return "note"
}

const normalizeResearchItem = (value: unknown, now: string): ResearchItem | undefined => {
  if (!isRecord(value)) return undefined

  const sourcePath = typeof value.sourcePath === "string" && value.sourcePath.trim() ? value.sourcePath.trim() : undefined
  const sourceUrl = typeof value.sourceUrl === "string" && value.sourceUrl.trim() ? value.sourceUrl.trim() : undefined
  const sourceName = typeof value.sourceName === "string" && value.sourceName.trim() ? value.sourceName.trim() : undefined
  const indexedText = typeof value.indexedText === "string" && value.indexedText.trim() ? value.indexedText.trim() : undefined
  const importedAt = typeof value.importedAt === "string" && value.importedAt ? value.importedAt : now

  const candidateType = typeof value.type === "string" ? value.type : undefined
  const explicitType: ResearchItemType | null =
    candidateType === "pdf" || candidateType === "image" || candidateType === "link" || candidateType === "note"
      ? candidateType
      : null

  const inferredType: ResearchItemType | null = sourceUrl
    ? "link"
    : sourcePath
      ? inferResearchItemTypeFromPath(sourcePath)
      : null

  const type = explicitType ?? inferredType
  if (!type) return undefined

  return {
    type,
    sourcePath,
    sourceUrl,
    sourceName,
    indexedText,
    importedAt,
  }
}

export const getDefaultProjectSettings = (theme = "system", fontSize = "16"): ProjectSettings => {
  const compilePresets = cloneCompilePresets(DEFAULT_COMPILE_PRESETS)
  return {
    theme,
    fontSize,
    snapshotSettings: cloneSnapshotSettings(DEFAULT_SNAPSHOT_SETTINGS),
    targetsSettings: cloneTargetsSettings(DEFAULT_TARGETS_SETTINGS),
    metadataFields: cloneMetadataFields(DEFAULT_METADATA_FIELDS),
    metadataTemplates: cloneMetadataTemplates(DEFAULT_METADATA_TEMPLATES),
    compilePresets,
    defaultCompilePresetId: compilePresets[0]?.id ?? "preset-manuscript-docx",
  }
}

export const getDefaultMetadataFields = (): MetadataFieldDefinition[] => cloneMetadataFields(DEFAULT_METADATA_FIELDS)
export const getDefaultMetadataTemplates = (): MetadataTemplate[] => cloneMetadataTemplates(DEFAULT_METADATA_TEMPLATES)
export const getDefaultCompilePresets = (): CompilePreset[] => cloneCompilePresets(DEFAULT_COMPILE_PRESETS)

const normalizeMetadataFields = (value: unknown): MetadataFieldDefinition[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return getDefaultMetadataFields()
  }

  const normalized: MetadataFieldDefinition[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (!isRecord(entry)) continue
    const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : ""
    const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : ""
    const type = typeof entry.type === "string" ? (entry.type as MetadataFieldType) : "text"

    if (!id || !name) continue
    if (
      !["text", "long-text", "number", "date", "select", "multi-select", "boolean"].includes(type)
    ) {
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)

    const options = Array.isArray(entry.options)
      ? entry.options.map((item) => String(item)).filter(Boolean)
      : undefined

    normalized.push({
      id,
      name,
      type,
      options: options && options.length > 0 ? options : undefined,
      defaultValue: entry.defaultValue as MetadataValue,
      placeholder: typeof entry.placeholder === "string" ? entry.placeholder : undefined,
    })
  }

  if (normalized.length === 0) {
    return getDefaultMetadataFields()
  }

  return normalized
}

const normalizeMetadataTemplates = (value: unknown, fields: MetadataFieldDefinition[]): MetadataTemplate[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return getDefaultMetadataTemplates()
  }

  const fieldMap = new Map(fields.map((field) => [field.id, field]))
  const normalized: MetadataTemplate[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (!isRecord(entry)) continue
    const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : ""
    const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : ""
    if (!id || !name || seen.has(id)) continue
    seen.add(id)

    const sectionTypes = Array.isArray(entry.sectionTypes)
      ? entry.sectionTypes.filter((item): item is SectionType => typeof item === "string" && SECTION_TYPE_VALUES.includes(item as SectionType))
      : undefined

    const fieldDefaults: Record<string, MetadataValue> = {}
    if (isRecord(entry.fieldDefaults)) {
      for (const [fieldId, fieldValue] of Object.entries(entry.fieldDefaults)) {
        const field = fieldMap.get(fieldId)
        if (!field) continue
        fieldDefaults[fieldId] = normalizeMetadataValue(field, fieldValue)
      }
    }

    normalized.push({
      id,
      name,
      sectionTypes: sectionTypes && sectionTypes.length > 0 ? sectionTypes : undefined,
      fieldDefaults,
    })
  }

  if (normalized.length === 0) {
    return getDefaultMetadataTemplates()
  }

  return normalized
}

const normalizeCompilePresets = (value: unknown): CompilePreset[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return getDefaultCompilePresets()
  }

  const normalized: CompilePreset[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    if (!isRecord(entry)) continue
    const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : ""
    const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : ""
    const outputFormat = typeof entry.outputFormat === "string" ? (entry.outputFormat as CompileOutputFormat) : "docx"

    if (!id || !name || seen.has(id)) continue
    if (!["docx", "markdown", "html", "txt"].includes(outputFormat)) continue
    seen.add(id)

    const nodeSeparator = typeof entry.nodeSeparator === "string" ? (entry.nodeSeparator as CompileSeparator) : "line"
    const headingMode = typeof entry.headingMode === "string" ? (entry.headingMode as CompileHeadingMode) : "project-hierarchy"

    normalized.push({
      id,
      name,
      description: typeof entry.description === "string" ? entry.description : undefined,
      outputFormat,
      includeFrontMatter: typeof entry.includeFrontMatter === "boolean" ? entry.includeFrontMatter : true,
      includeBackMatter: typeof entry.includeBackMatter === "boolean" ? entry.includeBackMatter : true,
      includeResearch: typeof entry.includeResearch === "boolean" ? entry.includeResearch : false,
      includeNotes: typeof entry.includeNotes === "boolean" ? entry.includeNotes : false,
      includeSynopsis: typeof entry.includeSynopsis === "boolean" ? entry.includeSynopsis : false,
      headingMode: headingMode === "flat" ? "flat" : "project-hierarchy",
      nodeSeparator: nodeSeparator === "none" || nodeSeparator === "page-break" ? nodeSeparator : "line",
    })
  }

  if (normalized.length === 0) {
    return getDefaultCompilePresets()
  }

  return normalized
}

const clampInteger = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

const normalizeSnapshotSettings = (value: unknown): SnapshotSettings => {
  const source = isRecord(value) ? value : {}
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_SNAPSHOT_SETTINGS.enabled,
    autoOnManualSave:
      typeof source.autoOnManualSave === "boolean" ? source.autoOnManualSave : DEFAULT_SNAPSHOT_SETTINGS.autoOnManualSave,
    autoOnInterval:
      typeof source.autoOnInterval === "boolean" ? source.autoOnInterval : DEFAULT_SNAPSHOT_SETTINGS.autoOnInterval,
    intervalMinutes: clampInteger(
      source.intervalMinutes,
      1,
      240,
      DEFAULT_SNAPSHOT_SETTINGS.intervalMinutes,
    ),
    maxSnapshotsPerDocument: clampInteger(
      source.maxSnapshotsPerDocument,
      10,
      500,
      DEFAULT_SNAPSHOT_SETTINGS.maxSnapshotsPerDocument,
    ),
    autoBeforeRestore:
      typeof source.autoBeforeRestore === "boolean" ? source.autoBeforeRestore : DEFAULT_SNAPSHOT_SETTINGS.autoBeforeRestore,
  }
}

const normalizeTargetsSettings = (value: unknown): TargetsSettings => {
  const source = isRecord(value) ? value : {}
  const historySource = isRecord(source.dailyWordHistory) ? source.dailyWordHistory : {}
  const dailyWordHistory = Object.entries(historySource).reduce<Record<string, number>>((acc, [dateKey, rawWords]) => {
    const words = clampInteger(rawWords, 0, 2_000_000, 0)
    if (words > 0) {
      acc[dateKey] = words
    }
    return acc
  }, {})

  return {
    sessionWordTarget: clampInteger(source.sessionWordTarget, 100, 500_000, DEFAULT_TARGETS_SETTINGS.sessionWordTarget),
    projectWordTarget: clampInteger(source.projectWordTarget, 1000, 2_000_000, DEFAULT_TARGETS_SETTINGS.projectWordTarget),
    defaultDocumentWordTarget: clampInteger(
      source.defaultDocumentWordTarget,
      100,
      500_000,
      DEFAULT_TARGETS_SETTINGS.defaultDocumentWordTarget,
    ),
    dailyWordHistory,
  }
}

const normalizeProjectSettings = (value: unknown, fallbackTheme = "system", fallbackFontSize = "16"): ProjectSettings => {
  const source = isRecord(value) ? value : {}
  const theme = typeof source.theme === "string" && source.theme ? source.theme : fallbackTheme
  const fontSize = typeof source.fontSize === "string" && source.fontSize ? source.fontSize : fallbackFontSize

  const metadataFields = normalizeMetadataFields(source.metadataFields)
  const metadataTemplates = normalizeMetadataTemplates(source.metadataTemplates, metadataFields)
  const compilePresets = normalizeCompilePresets(source.compilePresets)
  const defaultCompilePresetId =
    typeof source.defaultCompilePresetId === "string" && compilePresets.some((preset) => preset.id === source.defaultCompilePresetId)
      ? source.defaultCompilePresetId
      : compilePresets[0]?.id ?? "preset-manuscript-docx"

  return {
    theme,
    fontSize,
    snapshotSettings: normalizeSnapshotSettings(source.snapshotSettings),
    targetsSettings: normalizeTargetsSettings(source.targetsSettings),
    metadataFields,
    metadataTemplates,
    compilePresets,
    defaultCompilePresetId,
  }
}

const normalizeTreeNodes = (value: unknown, parentType: TreeNode["type"] = "folder"): TreeNode[] => {
  if (!Array.isArray(value)) return []

  const nodes: TreeNode[] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue
    const type = entry.type === "folder" || entry.type === "document" ? entry.type : parentType === "folder" ? "document" : "folder"
    const label = typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : type === "folder" ? "Untitled Folder" : "Untitled Document"
    const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const sectionType = normalizeSectionType(entry.sectionType, type, label)
    const includeInCompile = typeof entry.includeInCompile === "boolean" ? entry.includeInCompile : true
    const metadataTemplateId = typeof entry.metadataTemplateId === "string" ? entry.metadataTemplateId : null

    const node: TreeNode = {
      id,
      label,
      type,
      sectionType,
      includeInCompile,
      metadataTemplateId,
    }

    if (type === "folder") {
      node.children = normalizeTreeNodes(entry.children, type)
    }

    nodes.push(node)
  }

  return nodes
}

const getTemplateById = (templates: MetadataTemplate[], templateId: string | null | undefined): MetadataTemplate | null => {
  if (!templateId) return null
  return templates.find((template) => template.id === templateId) ?? null
}

export const findTemplateForSectionType = (templates: MetadataTemplate[], sectionType: SectionType): MetadataTemplate | null => {
  const exact = templates.find((template) => template.sectionTypes?.includes(sectionType))
  return exact ?? templates[0] ?? null
}

export const buildMetadataDefaults = (
  fields: MetadataFieldDefinition[],
  template: MetadataTemplate | null,
): Record<string, MetadataValue> => {
  const defaults: Record<string, MetadataValue> = {}

  for (const field of fields) {
    defaults[field.id] = field.defaultValue ?? (field.type === "multi-select" ? [] : "")
  }

  if (template) {
    for (const [fieldId, value] of Object.entries(template.fieldDefaults)) {
      defaults[fieldId] = value
    }
  }

  return defaults
}

const findNodeById = (nodes: TreeNode[], nodeId: string): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === nodeId) return node
    if (node.children?.length) {
      const found = findNodeById(node.children, nodeId)
      if (found) return found
    }
  }
  return null
}

export const getDocumentNodeIds = (nodes: TreeNode[], acc: string[] = []): string[] => {
  for (const node of nodes) {
    if (node.type === "document") acc.push(node.id)
    if (node.children?.length) getDocumentNodeIds(node.children, acc)
  }
  return acc
}

const normalizeDocument = (
  value: unknown,
  fields: MetadataFieldDefinition[],
  templateDefaults: Record<string, MetadataValue>,
  defaultWordTarget: number,
  now: string,
): DocumentData => {
  const source = isRecord(value) ? value : {}
  const content = typeof source.content === "string" ? source.content : ""
  const synopsis = typeof source.synopsis === "string" ? source.synopsis : ""
  const notes = typeof source.notes === "string" ? source.notes : ""
  const research = normalizeResearchItem(source.research, now)
  const rawSnapshots = Array.isArray(source.snapshots) ? source.snapshots : []
  const rawComments = Array.isArray(source.comments) ? source.comments : []
  const snapshots = rawSnapshots
    .map((snapshot, index): DocumentSnapshot | null => {
      if (!isRecord(snapshot)) return null
      const snapshotContent = typeof snapshot.content === "string" ? snapshot.content : ""
      const createdAt =
        typeof snapshot.createdAt === "string" && snapshot.createdAt ? snapshot.createdAt : now
      const triggerCandidate = typeof snapshot.trigger === "string" ? snapshot.trigger : "manual"
      const trigger: SnapshotTrigger =
        triggerCandidate === "manual-save" ||
        triggerCandidate === "interval" ||
        triggerCandidate === "before-restore"
          ? triggerCandidate
          : "manual"
      const contentHash =
        typeof snapshot.contentHash === "string" && snapshot.contentHash
          ? snapshot.contentHash
          : computeContentHash(snapshotContent)

      return {
        id:
          typeof snapshot.id === "string" && snapshot.id
            ? snapshot.id
            : `snapshot-${createdAt}-${index}`,
        createdAt,
        note: typeof snapshot.note === "string" && snapshot.note.trim() ? snapshot.note.trim() : undefined,
        contentHash,
        content: snapshotContent,
        wordCount:
          typeof snapshot.wordCount === "number" ? snapshot.wordCount : computeWordCount(snapshotContent),
        trigger,
      }
    })
    .filter((snapshot): snapshot is DocumentSnapshot => snapshot !== null)
  const comments = rawComments
    .map((comment, index): DocumentComment | null => {
      if (!isRecord(comment)) return null
      const createdAt =
        typeof comment.createdAt === "string" && comment.createdAt ? comment.createdAt : now
      const updatedAt =
        typeof comment.updatedAt === "string" && comment.updatedAt ? comment.updatedAt : createdAt

      return {
        id:
          typeof comment.id === "string" && comment.id
            ? comment.id
            : `comment-${createdAt}-${index}`,
        text: typeof comment.text === "string" ? comment.text : "",
        quote: typeof comment.quote === "string" && comment.quote.trim() ? comment.quote.trim() : undefined,
        resolved: typeof comment.resolved === "boolean" ? comment.resolved : false,
        createdAt,
        updatedAt,
      }
    })
    .filter((comment): comment is DocumentComment => comment !== null)

  const metadata: Record<string, MetadataValue> = { ...templateDefaults }
  const metadataSource = isRecord(source.metadata) ? source.metadata : {}
  const fieldMap = new Map(fields.map((field) => [field.id, field]))

  for (const field of fields) {
    const candidate = metadataSource[field.id]
    if (candidate !== undefined) {
      metadata[field.id] = normalizeMetadataValue(field, candidate)
      continue
    }

    // Legacy fields migration
    if (field.id === "status" && typeof source.status === "string") metadata[field.id] = source.status
    if (field.id === "label" && typeof source.label === "string") metadata[field.id] = source.label
    if (field.id === "keywords" && typeof source.keywords === "string") metadata[field.id] = source.keywords
  }

  const statusField = fieldMap.get("status")
  const labelField = fieldMap.get("label")
  const keywordsField = fieldMap.get("keywords")

  const status =
    typeof metadata.status === "string"
      ? metadata.status
      : typeof source.status === "string"
        ? source.status
        : (statusField?.defaultValue as string | undefined) ?? "to-do"
  const label =
    typeof metadata.label === "string"
      ? metadata.label
      : typeof source.label === "string"
        ? source.label
        : (labelField?.defaultValue as string | undefined) ?? "none"
  const keywords =
    typeof metadata.keywords === "string"
      ? metadata.keywords
      : typeof source.keywords === "string"
        ? source.keywords
        : (keywordsField?.defaultValue as string | undefined) ?? ""

  return {
    content,
    synopsis,
    notes,
    wordTarget: clampInteger(source.wordTarget, 100, 500_000, defaultWordTarget),
    research,
    snapshots,
    comments,
    status,
    label,
    keywords,
    metadata,
    wordCount: typeof source.wordCount === "number" ? source.wordCount : computeWordCount(content),
    createdAt: typeof source.createdAt === "string" && source.createdAt ? source.createdAt : now,
    lastModified: typeof source.lastModified === "string" && source.lastModified ? source.lastModified : now,
  }
}

const createDefaultTreeAndDocs = (projectName: string, settings: ProjectSettings, now: string): {
  tree: TreeNode[]
  documents: Record<string, DocumentData>
} => {
  const manuscriptId = `folder-${Date.now()}`
  const chapterId = `folder-${Date.now() + 1}`
  const sceneId = `doc-${Date.now() + 2}`

  const sceneTemplate = findTemplateForSectionType(settings.metadataTemplates, "scene")
  const sceneMetadata = buildMetadataDefaults(settings.metadataFields, sceneTemplate)

  const tree: TreeNode[] = [
    {
      id: "root",
      label: projectName || "My Project",
      type: "folder",
      sectionType: "chapter",
      includeInCompile: true,
      children: [
        {
          id: manuscriptId,
          label: "Manuscript",
          type: "folder",
          sectionType: "chapter",
          includeInCompile: true,
          children: [
            {
              id: chapterId,
              label: "Chapter 1",
              type: "folder",
              sectionType: "chapter",
              includeInCompile: true,
              children: [
                {
                  id: sceneId,
                  label: "Scene 1",
                  type: "document",
                  sectionType: "scene",
                  includeInCompile: true,
                  metadataTemplateId: sceneTemplate?.id ?? null,
                },
              ],
            },
          ],
        },
      ],
    },
  ]

  const documents: Record<string, DocumentData> = {
    [sceneId]: {
      content: "",
      synopsis: "",
      notes: "",
      wordTarget: settings.targetsSettings.defaultDocumentWordTarget,
      snapshots: [],
      comments: [],
      status: typeof sceneMetadata.status === "string" ? sceneMetadata.status : "to-do",
      label: typeof sceneMetadata.label === "string" ? sceneMetadata.label : "none",
      keywords: typeof sceneMetadata.keywords === "string" ? sceneMetadata.keywords : "",
      metadata: sceneMetadata,
      wordCount: 0,
      createdAt: now,
      lastModified: now,
    },
  }

  return { tree, documents }
}

export const normalizeProject = (value: unknown): QuillProject => {
  const source = isRecord(value) ? value : {}
  const now = new Date().toISOString()
  const sourceMetadata = isRecord(source.metadata) ? source.metadata : {}
  const name = typeof sourceMetadata.name === "string" && sourceMetadata.name.trim() ? sourceMetadata.name.trim() : "Untitled Project"
  const version = typeof sourceMetadata.version === "string" && sourceMetadata.version ? sourceMetadata.version : "1.2.0"
  const createdAt = typeof sourceMetadata.createdAt === "string" && sourceMetadata.createdAt ? sourceMetadata.createdAt : now
  const lastModified = typeof sourceMetadata.lastModified === "string" && sourceMetadata.lastModified ? sourceMetadata.lastModified : now

  const fallbackTheme = isRecord(source.settings) && typeof source.settings.theme === "string" ? source.settings.theme : "system"
  const fallbackFontSize = isRecord(source.settings) && typeof source.settings.fontSize === "string" ? source.settings.fontSize : "16"
  const settings = normalizeProjectSettings(source.settings, fallbackTheme, fallbackFontSize)

  let treeStructure = normalizeTreeNodes(source.treeStructure, "folder")
  if (treeStructure.length === 0) {
    const defaults = createDefaultTreeAndDocs(name, settings, now)
    treeStructure = defaults.tree
  }

  const rawDocuments = isRecord(source.documents) ? source.documents : {}
  const documents: Record<string, DocumentData> = {}
  const documentNodeIds = getDocumentNodeIds(treeStructure)

  for (const docId of documentNodeIds) {
    const node = findNodeById(treeStructure, docId)
    const template =
      getTemplateById(settings.metadataTemplates, node?.metadataTemplateId) ??
      findTemplateForSectionType(settings.metadataTemplates, node?.sectionType ?? "scene")
    const defaults = buildMetadataDefaults(settings.metadataFields, template)
    documents[docId] = normalizeDocument(
      rawDocuments[docId],
      settings.metadataFields,
      defaults,
      settings.targetsSettings.defaultDocumentWordTarget,
      now,
    )

    if (node && (node.metadataTemplateId === undefined || node.metadataTemplateId === null)) {
      node.metadataTemplateId = template?.id ?? null
    }
  }

  if (Object.keys(documents).length === 0) {
    const defaults = createDefaultTreeAndDocs(name, settings, now)
    return {
      metadata: {
        name,
        version,
        createdAt,
        lastModified,
      },
      settings,
      treeStructure: defaults.tree,
      documents: defaults.documents,
    }
  }

  return {
    metadata: {
      name,
      version,
      createdAt,
      lastModified,
    },
    settings,
    treeStructure,
    documents,
  }
}

export const createEmptyProject = (name: string): QuillProject => {
  const now = new Date().toISOString()
  const settings = getDefaultProjectSettings("system", "16")
  const defaults = createDefaultTreeAndDocs(name, settings, now)

  return {
    metadata: {
      name: name || "Untitled Project",
      version: "1.2.0",
      createdAt: now,
      lastModified: now,
    },
    settings,
    treeStructure: defaults.tree,
    documents: defaults.documents,
  }
}

export const extractCurrentProject = (
  currentProject: QuillProject | null,
  projectName: string,
  treeData: TreeNode[],
  documents: Record<string, DocumentData>,
  theme: string,
  fontSize: string,
  nextSettings?: ProjectSettings,
): QuillProject => {
  const now = new Date().toISOString()

  const baseSettings =
    nextSettings ??
    currentProject?.settings ??
    getDefaultProjectSettings(theme || "system", fontSize || "16")

  const normalizedSettings = normalizeProjectSettings(baseSettings, theme, fontSize)
  normalizedSettings.theme = theme
  normalizedSettings.fontSize = fontSize

  return normalizeProject({
    metadata: {
      name: projectName,
      version: currentProject?.metadata.version || "1.2.0",
      createdAt: currentProject?.metadata.createdAt || now,
      lastModified: now,
    },
    settings: normalizedSettings,
    treeStructure: treeData,
    documents,
  })
}
