import type { FileNode, TreeNode } from "./project-types"

/** Depth-first search to find a node and its parent */
export function findNode(
  nodes: FileNode[],
  id: string,
  parent: FileNode | null = null,
): [FileNode | null, FileNode | null] {
  for (const node of nodes) {
    if (node.id === id) return [node, parent]
    if (node.type === "folder" && node.children?.length) {
      const res = findNode(node.children, id, node)
      if (res[0]) return res
    }
  }
  return [null, null]
}

export function removeNode(nodes: FileNode[], id: string): FileNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => (n.type === "folder" && n.children ? { ...n, children: removeNode(n.children, id) } : n))
}

export function insertNode(nodes: FileNode[], targetFolderId: string | null, node: FileNode): FileNode[] {
  // Set the parentId on the node being inserted
  node.parentId = targetFolderId

  if (targetFolderId === null) {
    return [...nodes, node]
  }

  return nodes.map((n) => {
    if (n.id === targetFolderId && n.type === "folder") {
      // Ensure children array exists
      const children = n.children || []
      return {
        ...n,
        children: [...children, node],
      }
    }
    if (n.type === "folder" && n.children?.length) {
      return { ...n, children: insertNode(n.children, targetFolderId, node) }
    }
    return n
  })
}

// Convert from our existing TreeNodeProps structure to FileNode structure
export function convertToFileNodes(treeData: TreeNode[]): FileNode[] {
  return treeData.map((node) => {
    const fileNode: FileNode = {
      id: node.id,
      name: node.label,
      type: node.type === "folder" ? "folder" : "file",
      sectionType: node.sectionType,
      includeInCompile: node.includeInCompile,
      metadataTemplateId: node.metadataTemplateId ?? null,
      parentId: null,
    }

    if (node.type === "folder" && node.children && node.children.length > 0) {
      const children = convertToFileNodes(node.children)
      // Set parentId for all children
      children.forEach((child) => {
        child.parentId = node.id
      })
      fileNode.children = children
    }

    return fileNode
  })
}

// Convert from FileNode structure back to our existing TreeNodeProps structure
export function convertFromFileNodes(fileNodes: FileNode[]): TreeNode[] {
  return fileNodes.map((node) => {
    const treeNode: TreeNode = {
      id: node.id,
      label: node.name,
      type: node.type === "folder" ? "folder" : "document",
      sectionType: node.sectionType,
      includeInCompile: typeof node.includeInCompile === "boolean" ? node.includeInCompile : true,
      metadataTemplateId: node.metadataTemplateId ?? null,
    }

    if (node.type === "folder" && node.children && node.children.length > 0) {
      treeNode.children = convertFromFileNodes(node.children)
    }

    return treeNode
  })
}

// Update the sortTreeNodes function to handle undefined or empty arrays:

export function sortTreeNodes(nodes: FileNode[]): FileNode[] {
  // Guard against undefined or non-array inputs
  if (!nodes || !Array.isArray(nodes)) {
    return []
  }

  // Sort the current level - folders first, then alphabetically
  const sortedNodes = [...nodes].sort((a, b) => {
    // Folders come before files ONLY at the same level
    if (a.type === "folder" && b.type !== "folder") return -1
    if (a.type !== "folder" && b.type === "folder") return 1
    // Then sort alphabetically by name
    return a.name.localeCompare(b.name)
  })

  // Recursively sort children
  return sortedNodes.map((node) => {
    if (node.type === "folder" && node.children && node.children.length > 0) {
      return {
        ...node,
        children: sortTreeNodes(node.children),
      }
    }
    return node
  })
}
