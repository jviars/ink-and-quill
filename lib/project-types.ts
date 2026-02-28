// Existing types
export interface QuillProject {
  metadata: {
    name: string
    version: string
    createdAt: string
    lastModified: string
  }
  settings: {
    theme: string
    fontSize: string
    // Add other settings as needed
  }
  treeStructure: TreeNode[]
  documents: Record<string, DocumentData>
}

export interface TreeNode {
  id: string
  label: string
  type: "folder" | "document"
  children?: TreeNode[]
}

export interface DocumentData {
  content: string
  synopsis: string
  notes: string
  status: string
  label: string
  keywords?: string
  wordCount: number
  createdAt: string
  lastModified: string
}

// New types for the drag-and-drop file sidebar
export type NodeType = "file" | "folder"

export interface FileNode {
  id: string // uuid
  name: string
  type: NodeType
  children?: FileNode[] // only for folders
  parentId: string | null // null = root
}

// Default empty project
export const createEmptyProject = (name: string): QuillProject => {
  const now = new Date().toISOString()
  const manuscriptId = `folder-${Date.now()}`
  const chapterId = `folder-${Date.now() + 1}`
  const sceneId = `doc-${Date.now() + 2}`

  return {
    metadata: {
      name,
      version: "1.0.0",
      createdAt: now,
      lastModified: now,
    },
    settings: {
      theme: "system",
      fontSize: "16",
    },
    treeStructure: [
      {
        id: "root",
        label: "My Project",
        type: "folder",
        children: [
          {
            id: manuscriptId,
            label: "Manuscript",
            type: "folder",
            children: [
              {
                id: chapterId,
                label: "Chapter 1",
                type: "folder",
                children: [
                  {
                    id: sceneId,
                    label: "Scene 1",
                    type: "document",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    documents: {
      [sceneId]: {
        content: "",
        synopsis: "",
        notes: "",
        status: "to-do",
        label: "none",
        wordCount: 0,
        createdAt: now,
        lastModified: now,
      },
    },
  }
}

// Extract current project state from the application
export const extractCurrentProject = (
  currentProject: QuillProject | null,
  projectName: string,
  treeData: TreeNode[],
  documents: Record<string, DocumentData>,
  theme: string,
  fontSize: string,
): QuillProject => {
  const now = new Date().toISOString()

  return {
    metadata: {
      name: projectName,
      version: "1.0.0",
      // Preserve original creation date if available
      createdAt: currentProject?.metadata.createdAt || now,
      lastModified: now,
    },
    settings: {
      theme,
      fontSize,
    },
    treeStructure: treeData,
    documents,
  }
}
