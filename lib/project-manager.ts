// Project manager for handling .quill file format
import saveAs from "file-saver"
import { v4 as uuidv4 } from "uuid"

// Define the project data structure
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

// Update the createEmptyProject function to remove the default text from Scene 1
export const createEmptyProject = (name: string): QuillProject => {
  const now = new Date().toISOString()

  // Generate unique IDs for each node
  const rootId = uuidv4()
  const manuscriptId = uuidv4()
  const chapter1Id = uuidv4()
  const sceneId = uuidv4()

  return {
    metadata: {
      name,
      version: "1.0.0",
      createdAt: now,
      lastModified: now,
    },
    settings: {
      theme: "muted-elegance",
      fontSize: "16",
    },
    treeStructure: [
      {
        id: rootId,
        label: "My Project",
        type: "folder",
        children: [
          {
            id: manuscriptId,
            label: "Manuscript",
            type: "folder",
            children: [
              {
                id: chapter1Id,
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
        synopsis: "Opening scene of the story.",
        notes: "Consider developing the protagonist's background here.",
        status: "to-do",
        label: "none",
        wordCount: 0,
        createdAt: now,
        lastModified: now,
      },
    },
  }
}

// Update the saveProject function to ensure the tree structure is properly saved
export const saveProject = async (project: QuillProject): Promise<void> => {
  try {
    // Update last modified date
    project.metadata.lastModified = new Date().toISOString()

    // Ensure the tree structure is valid
    if (!project.treeStructure || !Array.isArray(project.treeStructure) || project.treeStructure.length === 0) {
      console.error("Invalid tree structure in project:", project)
      throw new Error("Invalid tree structure in project")
    }

    console.log("Saving project with tree structure:", project.treeStructure)

    // Convert project to JSON string
    const projectJson = JSON.stringify(project, null, 2)

    // Create a Blob with the JSON data
    const blob = new Blob([projectJson], { type: "application/json" })

    // Use FileSaver to save the file
    saveAs(blob, `${project.metadata.name}.quill`)

    return Promise.resolve()
  } catch (error) {
    console.error("Error saving project:", error)
    return Promise.reject(error)
  }
}

// Update the loadProject function to properly handle file loading
export const loadProject = async (file: File): Promise<QuillProject> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        if (!event.target?.result) {
          throw new Error("Failed to read file")
        }

        const projectJson = event.target.result as string
        const project = JSON.parse(projectJson) as QuillProject

        // Validate the project structure
        if (!project.metadata || !project.treeStructure || !project.documents) {
          throw new Error("Invalid project file format")
        }

        resolve(project)
      } catch (error) {
        console.error("Error parsing project file:", error)
        reject(error)
      }
    }

    reader.onerror = () => {
      reject(new Error("Error reading file"))
    }

    reader.readAsText(file)
  })
}

// Extract current project state from the application
export const extractCurrentProject = (
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
      createdAt: now, // This should be preserved if loading an existing project
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
