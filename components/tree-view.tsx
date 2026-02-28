"use client"

import { ContextMenuTrigger } from "@/components/ui/context-menu"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { ChevronRight, ChevronDown, File, Folder, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Update the TreeNodeProps interface to include the new props
interface TreeNodeProps {
  id: string
  label: string
  type: "folder" | "document"
  children?: TreeNodeProps[]
  level: number
  isExpanded: boolean
  isSelected: boolean
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  onCreateFolder: (parentId: string | null) => void
  onCreateFile: (parentId: string | null) => void
  onRename: (id: string, currentName: string) => void
  onDelete: (id: string) => void
  onDragStart?: (e: React.DragEvent, id: string, type: string) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragEnter?: (e: React.DragEvent, id: string, type: string) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent, targetId: string, targetType: string) => void
  onDragOverNode?: (
    e: React.DragEvent,
    targetId: string,
    targetType: string,
    nodeRef: React.RefObject<HTMLDivElement>,
  ) => void
  onDragEnd?: () => void
}

// Update the TreeViewProps interface to include the tree prop
interface TreeViewProps {
  tree: TreeNodeProps[]
  selectedNode: string | null
  onNodeSelect: (nodeId: string) => void
  onTreeChange?: (treeData: TreeNodeProps[]) => void
}

// Add a new state for tracking nodes being dragged over for folder highlighting
const TreeNode = ({
  id,
  label,
  type,
  children,
  level,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onCreateFolder,
  onCreateFile,
  onRename,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragOverNode,
  onDragEnd,
}: TreeNodeProps) => {
  const hasChildren = children && children.length > 0
  const { theme } = useTheme()
  const [isDragOver, setIsDragOver] = useState(false)
  const nodeRef = useRef<HTMLDivElement>(null)

  // Get the expanded state for this specific node
  const nodeIsExpanded = isExpanded

  const getSelectedClass = () => {
    if (isSelected) {
      if (theme === "muted-elegance") {
        return "bg-[#E3B5A4] bg-opacity-30 hover:bg-[#E3B5A4] hover:bg-opacity-30 text-[#F0F0F0]"
      } else if (theme === "dark") {
        return "bg-blue-900 hover:bg-blue-900"
      } else {
        return "bg-blue-100 hover:bg-blue-100"
      }
    }
    return ""
  }

  const getHoverClass = () => {
    if (theme === "muted-elegance") {
      return "hover:bg-[#666666]"
    } else if (theme === "dark") {
      return "dark:hover:bg-gray-800"
    } else {
      return "hover:bg-gray-100"
    }
  }

  // Add a function to get the class for a node being dragged over
  const getDragOverClass = () => {
    if (isDragOver && type === "folder") {
      if (theme === "muted-elegance") {
        return "bg-[#E3B5A4] bg-opacity-20 border-2 border-dashed border-[#E3B5A4] border-opacity-50"
      } else if (theme === "dark") {
        return "bg-blue-900 bg-opacity-20 border-2 border-dashed border-blue-500 border-opacity-50"
      } else {
        return "bg-blue-100 bg-opacity-50 border-2 border-dashed border-blue-300 border-opacity-50"
      }
    }
    return ""
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      onDragStart(e, id, type)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (onDragOver) {
      onDragOver(e)
    }
    if (onDragOverNode) {
      onDragOverNode(e, id, type, nodeRef)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    if (type === "folder") {
      setIsDragOver(true)
    }
    if (onDragEnter) {
      onDragEnter(e, id, type)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (onDragLeave) {
      onDragLeave(e)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (onDrop) {
      onDrop(e, id, type)
    }
  }

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            ref={nodeRef}
            className={cn(
              "flex items-center py-1 px-2 text-sm cursor-pointer transition-colors tree-node-content rounded-sm",
              getHoverClass(),
              getSelectedClass(),
              getDragOverClass(), // Use the drag over class here
            )}
            style={{ paddingLeft: `${level * 12 + 4}px` }}
            onClick={(e) => {
              e.preventDefault()
              console.log(`Selecting node: ${id}`)
              onSelect(id)
            }}
            draggable={true}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={onDragEnd}
          >
            {hasChildren ? (
              <button
                className="mr-1 h-4 w-4 flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(id)
                }}
              >
                {nodeIsExpanded ? (
                  <ChevronDown className="h-3 w-3 transition-transform duration-300" />
                ) : (
                  <ChevronRight className="h-3 w-3 transition-transform duration-300" />
                )}
              </button>
            ) : (
              <span className="mr-1 w-4" />
            )}
            {type === "folder" ? (
              <Folder className="h-4 w-4 mr-2 text-gray-500" />
            ) : (
              <File className="h-4 w-4 mr-2 text-gray-500" />
            )}
            <span className="truncate">{label}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {type === "folder" ? (
            <>
              <ContextMenuItem onClick={() => onCreateFolder(id)}>
                <Folder className="h-4 w-4 mr-2" />
                New Folder
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCreateFile(id)}>
                <FileText className="h-4 w-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onRename(id, label)}>Rename</ContextMenuItem>
              <ContextMenuItem className="text-red-600" onClick={() => onDelete(id)}>
                Delete
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem onClick={() => onRename(id, label)}>Rename</ContextMenuItem>
              <ContextMenuItem className="text-red-600" onClick={() => onDelete(id)}>
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {hasChildren && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            nodeIsExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          {children.map((child) => (
            <TreeNode
              key={child.id}
              {...child}
              level={level + 1}
              isExpanded={child.isExpanded}
              isSelected={child.isSelected}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreateFolder={onCreateFolder}
              onCreateFile={onCreateFile}
              onRename={onRename}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragOverNode={onDragOverNode}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Update the TreeView component to handle drag-and-drop operations
export function TreeView({ tree, selectedNode, onNodeSelect, onTreeChange }: TreeViewProps) {
  const [treeData, setTreeData] = useState<TreeNodeProps[]>(tree)
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)

  // Sync internal state whenever parent passes a new outline
  // Sync internal state whenever parent passes a new outline - with strict equality check
  useEffect(() => {
    if (tree && Array.isArray(tree) && tree.length > 0) {
      // Use a ref to track if we're updating from props to avoid triggering onTreeChange
      const isFromProps = true

      // Only update if the incoming tree is different from current state
      // Use JSON.stringify for deep comparison
      const treeString = JSON.stringify(tree)
      const treeDataString = JSON.stringify(treeData)

      if (treeString !== treeDataString) {
        console.log("TreeView received new tree data from props")
        setTreeData(tree)
      }
    }
  }, [JSON.stringify(tree)]) // Use JSON.stringify in dependency array to detect deep changes

  // Remove the debugging useEffect that was added earlier
  // useEffect(() => {
  //   console.log("TreeView received data:", treeData);
  // }, [treeData]);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    root: true,
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: string } | null>(null)

  // Add these new types and state variables after the existing state declarations in the TreeView component
  const [dropIndicator, setDropIndicator] = useState<{
    visible: boolean
    targetId: string | null
    position: "before" | "after" | "inside"
    top: number
  }>({
    visible: false,
    targetId: null,
    position: "after",
    top: 0,
  })

  // Add state for rename dialog
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [itemToRename, setItemToRename] = useState<{ id: string; currentName: string } | null>(null)
  const [newName, setNewName] = useState("")

  // Add state for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)

  // Notify parent component when tree data changes
  // Notify parent component when tree data changes - with strict equality check
  const lastTreeChangeRef = useRef(null)

  useEffect(() => {
    if (onTreeChange && treeData.length > 0) {
      // Create a deep copy to avoid reference issues
      const treeDataCopy = JSON.parse(JSON.stringify(treeData))
      const treeDataString = JSON.stringify(treeDataCopy)

      // Only notify parent if this is a new change (not from props update)
      // and if the data has actually changed
      if (lastTreeChangeRef.current !== treeDataString) {
        lastTreeChangeRef.current = treeDataString

        // Compare with the original tree to avoid unnecessary updates
        const treeString = JSON.stringify(tree)

        if (treeString !== treeDataString) {
          console.log("Notifying parent of tree changes")
          onTreeChange(treeDataCopy)
        }
      }
    }
  }, [JSON.stringify(treeData)])

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, id: string, type: string) => {
    e.dataTransfer.setData("text/plain", id)
    e.dataTransfer.effectAllowed = "move"
    setDraggedItem({ id, type })
  }

  // Update the handleDragOver function to calculate the drop position
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  // Add this new function after handleDragEnter
  const handleDragOverNode = (
    e: React.DragEvent,
    targetId: string,
    targetType: string,
    nodeRef: React.RefObject<HTMLDivElement>,
  ) => {
    e.preventDefault()

    if (!nodeRef.current || !draggedItem || draggedItem.id === targetId) {
      setDropIndicator({ visible: false, targetId: null, position: "after", top: 0 })
      setDragOverNodeId(null)
      return
    }

    const rect = nodeRef.current.getBoundingClientRect()
    const mouseY = e.clientY

    let position: "before" | "after" | "inside" = "after"

    if (targetType === "folder") {
      // For folders, make it easier to drop inside by expanding the "inside" zone
      // Top 20% = before, Middle 60% = inside, Bottom 20% = after
      const topThreshold = rect.top + rect.height * 0.2
      const bottomThreshold = rect.top + rect.height * 0.8

      if (mouseY < topThreshold) {
        position = "before"
        setDragOverNodeId(null)
      } else if (mouseY > bottomThreshold) {
        position = "after"
        setDragOverNodeId(null)
      } else {
        position = "inside"
        setDragOverNodeId(targetId)
      }
    } else {
      // For files, we have only two drop zones: before and after
      if (mouseY < rect.top + rect.height / 2) {
        position = "before"
      } else {
        position = "after"
      }
      setDragOverNodeId(null)
    }

    // Calculate the top position for the indicator line
    let top = 0
    if (position === "before") {
      top = rect.top
    } else if (position === "after") {
      top = rect.bottom
    } else {
      // For "inside" position, don't show the line but highlight the folder
      setDropIndicator({ visible: false, targetId: targetId, position: "inside", top: 0 })
      return
    }

    // Update the drop indicator
    setDropIndicator({
      visible: true,
      targetId: targetId,
      position: position,
      top: top,
    })
  }

  // Update the handleDragEnter function to track which node is being dragged over
  const handleDragEnter = (e: React.DragEvent, id: string, type: string) => {
    e.preventDefault()

    if (draggedItem && draggedItem.id !== id) {
      if (type === "folder" && dropIndicator.position === "inside") {
        setDragOverNodeId(id)
      }
    }
  }

  // Update the handleDragLeave function to clear the drag over state
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverNodeId(null)
  }

  // Update the handleDrop function to properly handle all drag-and-drop scenarios
  const handleDrop = (e: React.DragEvent, targetId: string, targetType: string) => {
    e.preventDefault()

    // Hide the drop indicator
    setDropIndicator({ visible: false, targetId: null, position: "after", top: 0 })
    setDragOverNodeId(null)

    if (!draggedItem) return

    const sourceId = draggedItem.id
    const sourceType = draggedItem.type

    // Don't do anything if dropping onto itself
    if (sourceId === targetId) return

    // Create a deep copy of the tree data
    const newTreeData = JSON.parse(JSON.stringify(treeData))

    // Helper function to find a node and its parent in the tree
    const findNode = (
      nodes: TreeNodeProps[],
      id: string,
      parent: TreeNodeProps[] | null = null,
      parentId: string | null = null,
    ): { node: TreeNodeProps | null; parent: TreeNodeProps[] | null; parentId: string | null; index: number } => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === id) {
          return { node: nodes[i], parent: nodes, parentId, index: i }
        }

        if (nodes[i].children) {
          const result = findNode(nodes[i].children!, id, nodes[i].children, nodes[i].id)
          if (result.node) {
            return result
          }
        }
      }

      return { node: null, parent: null, parentId: null, index: -1 }
    }

    // Check if target is a descendant of source (to prevent dropping a folder into its own descendant)
    const isDescendant = (sourceId: string, targetId: string): boolean => {
      const { node: sourceNode } = findNode(newTreeData, sourceId)
      if (!sourceNode || sourceNode.type !== "folder" || !sourceNode.children) return false

      const checkChildren = (children: TreeNodeProps[]): boolean => {
        for (const child of children) {
          if (child.id === targetId) return true
          if (child.children && checkChildren(child.children)) return true
        }
        return false
      }

      return checkChildren(sourceNode.children)
    }

    // Find source and target nodes
    const sourceResult = findNode(newTreeData, sourceId)
    const targetResult = findNode(newTreeData, targetId)

    if (!sourceResult.node || !targetResult.node) return

    // Check if target is a descendant of source (prevent dropping a folder into its own descendant)
    if (sourceType === "folder" && isDescendant(sourceId, targetId)) {
      console.log("Cannot drop a folder into its own descendant")
      return
    }

    // Remove the source node from its parent
    const sourceNode = sourceResult.node
    if (sourceResult.parent) {
      sourceResult.parent.splice(sourceResult.index, 1)
    }

    // Determine where to insert the node based on the drop position and target type
    if (targetType === "folder" && dropIndicator.position === "inside") {
      // If dropping inside a folder
      if (!targetResult.node.children) {
        targetResult.node.children = []
      }

      // Add the node to the target folder's children
      targetResult.node.children.push(sourceNode)

      // Expand the target folder
      setExpandedNodes((prev) => ({
        ...prev,
        [targetId]: true,
      }))
    } else if (dropIndicator.position === "before") {
      // If dropping before the target
      if (targetResult.parent) {
        targetResult.parent.splice(targetResult.index, 0, sourceNode)
      }
    } else {
      // If dropping after the target
      if (targetResult.parent) {
        targetResult.parent.splice(targetResult.index + 1, 0, sourceNode)
      }
    }

    // Update the tree data
    setTreeData(newTreeData)
    setDraggedItem(null)
  }

  // Update the handleDragEnd function to clear all drag states
  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverNodeId(null)
    setDropIndicator({ visible: false, targetId: null, position: "after", top: 0 })
  }

  // Create a function to handle creating a new folder
  const handleCreateFolder = (parentId: string | null) => {
    // Generate a unique ID for the new folder
    const newFolderId = `folder-${Date.now()}`

    if (parentId) {
      // Add folder to a parent folder
      setTreeData((prevData) => {
        // Create a deep copy of the tree data
        const updatedData = JSON.parse(JSON.stringify(prevData))

        // Function to recursively find and update the parent folder
        const addFolderToParent = (nodes: TreeNodeProps[]): boolean => {
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === parentId) {
              // Found the parent folder, add the new folder to its children
              if (!nodes[i].children) {
                nodes[i].children = []
              }
              nodes[i].children.push({
                id: newFolderId,
                label: "New Folder",
                type: "folder",
                level: nodes[i].level + 1,
                isExpanded: false,
                isSelected: false,
                children: [],
              })

              // Expand the parent folder
              setExpandedNodes((prev) => ({
                ...prev,
                [parentId]: true,
              }))

              return true
            }

            // Check children recursively
            if (nodes[i].children && addFolderToParent(nodes[i].children)) {
              return true
            }
          }
          return false
        }

        addFolderToParent(updatedData)
        return updatedData
      })
    } else {
      // Add folder at the root level
      setTreeData((prevData) => [
        ...prevData,
        {
          id: newFolderId,
          label: "New Folder",
          type: "folder",
          level: 0,
          isExpanded: false,
          isSelected: false,
          onToggle: () => {},
          onSelect: () => {},
          onCreateFolder: () => {},
          onCreateFile: () => {},
          onRename: () => {},
          onDelete: () => {},
          children: [],
        },
      ])
    }

    // Select the new folder
    onNodeSelect(newFolderId)
  }

  // Create a function to handle creating a new file
  const handleCreateFile = (parentId: string | null) => {
    // Generate a unique ID for the new file
    const newFileId = `file-${Date.now()}`

    if (parentId) {
      // Add file to a parent folder
      setTreeData((prevData) => {
        // Create a deep copy of the tree data
        const updatedData = JSON.parse(JSON.stringify(prevData))

        // Function to recursively find and update the parent folder
        const addFileToParent = (nodes: TreeNodeProps[]): boolean => {
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === parentId) {
              // Found the parent folder, add the new file to its children
              if (!nodes[i].children) {
                nodes[i].children = []
              }
              nodes[i].children.push({
                id: newFileId,
                label: "New File",
                type: "document",
                level: nodes[i].level + 1,
                isExpanded: false,
                isSelected: false,
              })

              // Expand the parent folder
              setExpandedNodes((prev) => ({
                ...prev,
                [parentId]: true,
              }))

              return true
            }

            // Check children recursively
            if (nodes[i].children && addFileToParent(nodes[i].children)) {
              return true
            }
          }
          return false
        }

        addFileToParent(updatedData)
        return updatedData
      })
    } else {
      // Add file at the root level
      setTreeData((prevData) => [
        ...prevData,
        {
          id: newFileId,
          label: "New File",
          type: "document",
          level: 0,
          isExpanded: false,
          isSelected: false,
          onToggle: () => {},
          onSelect: () => {},
          onCreateFolder: () => {},
          onCreateFile: () => {},
          onRename: () => {},
          onDelete: () => {},
        },
      ])
    }

    // Select the new file
    onNodeSelect(newFileId)
  }

  // Create a function to handle renaming an item
  const handleRename = (id: string, currentName: string) => {
    setItemToRename({ id, currentName })
    setNewName(currentName)
    setRenameDialogOpen(true)
  }

  // Function to apply the rename
  const applyRename = () => {
    if (!itemToRename || !newName.trim()) return

    setTreeData((prevData) => {
      // Create a deep copy of the tree data
      const updatedData = JSON.parse(JSON.stringify(prevData))

      // Function to recursively find and update the item
      const renameItem = (nodes: TreeNodeProps[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === itemToRename.id) {
            // Found the item, update its label
            nodes[i].label = newName.trim()
            return true
          }

          // Check children recursively
          if (nodes[i].children && renameItem(nodes[i].children)) {
            return true
          }
        }
        return false
      }

      renameItem(updatedData)
      return updatedData
    })

    // Close the dialog
    setRenameDialogOpen(false)
    setItemToRename(null)
  }

  // Create a function to handle deleting an item
  const handleDelete = (id: string) => {
    setItemToDelete(id)
    setDeleteDialogOpen(true)
  }

  // Function to apply the delete
  const applyDelete = () => {
    if (!itemToDelete) return

    try {
      setTreeData((prevData) => {
        // Create a deep copy of the tree data
        const updatedData = JSON.parse(JSON.stringify(prevData))

        // Function to recursively find and delete the item
        const deleteItem = (nodes: TreeNodeProps[], parentArray?: TreeNodeProps[]): boolean => {
          for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === itemToDelete) {
              // Found the item, remove it from its parent array
              if (parentArray) {
                parentArray.splice(i, 1)
              } else {
                // Item is at the root level
                nodes.splice(i, 1)
              }
              return true
            }

            // Check children recursively
            if (nodes[i].children && deleteItem(nodes[i].children, nodes[i].children)) {
              return true
            }
          }
          return false
        }

        deleteItem(updatedData)
        return updatedData
      })

      // If the deleted item was selected, select a default item
      if (selectedNode === itemToDelete) {
        // Find a valid node to select
        const findFirstAvailableNode = (nodes: TreeNodeProps[]): string | null => {
          if (nodes.length === 0) return null

          // Try to find a document node
          for (const node of nodes) {
            if (node.type === "document" && node.id !== itemToDelete) {
              return node.id
            }
          }

          // If no document found, try to find in children
          for (const node of nodes) {
            if (node.children && node.children.length > 0) {
              const childResult = findFirstAvailableNode(node.children)
              if (childResult) return childResult
            }
          }

          // If still no node found, return the first node of any type
          for (const node of nodes) {
            if (node.id !== itemToDelete) {
              return node.id
            }
          }

          return null
        }

        const newSelectedNode = findFirstAvailableNode(treeData)
        if (newSelectedNode) {
          onNodeSelect(newSelectedNode)
        }
      }
    } catch (error) {
      console.error("Error deleting item:", error)
      // Show error to user
      alert("An error occurred while deleting the item. Please try again.")
    } finally {
      // Always clean up state, even if there was an error
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Create a function to recursively update the tree data with proper expanded states
  const buildTreeData = (nodes: TreeNodeProps[]): TreeNodeProps[] => {
    if (!nodes || !Array.isArray(nodes)) {
      return []
    }

    return nodes.map((node) => {
      const nodeWithUpdatedExpanded = {
        ...node,
        isExpanded: expandedNodes[node.id] || false,
        isSelected: selectedNode === node.id,
        onToggle: toggleNode,
        onSelect: onNodeSelect,
        onCreateFolder: handleCreateFolder,
        onCreateFile: handleCreateFile,
        onRename: handleRename,
        onDelete: handleDelete,
        onDragStart: handleDragStart,
        onDragOver: handleDragOver,
        onDragEnter: handleDragEnter,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
        onDragOverNode: handleDragOverNode,
        onDragEnd: handleDragEnd,
      }

      if (node.children && node.children.length > 0) {
        nodeWithUpdatedExpanded.children = buildTreeData(node.children)
      }

      return nodeWithUpdatedExpanded
    })
  }

  // Sample tree data structure
  const baseTreeData: TreeNodeProps[] = [
    {
      id: "root",
      label: "My Project",
      type: "folder",
      level: 0,
      isExpanded: true,
      isSelected: false,
      onToggle: () => {},
      onSelect: () => {},
      onCreateFolder: () => {},
      onCreateFile: () => {},
      onRename: () => {},
      onDelete: () => {},
      children: [],
    },
  ]

  // Initialize tree data if empty
  useEffect(() => {
    if (treeData.length === 0) {
      console.log("Initializing empty tree with base data")
      setTreeData(baseTreeData)
    } else {
      console.log("Using existing tree data:", treeData)
    }
  }, [])

  // Get the updated tree data with proper expanded states and drag-and-drop handlers
  const processedTreeData = buildTreeData(treeData.length > 0 ? treeData : baseTreeData)

  // Add this right before the return statement in the TreeView component
  // This will render the drop indicator line
  const { theme } = useTheme()
  const getIndicatorStyle = () => {
    if (!dropIndicator.visible) return { display: "none" }

    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return { display: "none" }

    return {
      display: "block",
      position: "absolute" as const,
      top: `${dropIndicator.top - containerRect.top + (containerRef.current?.scrollTop || 0)}px`,
      left: "0",
      width: "100%",
      height: "2px",
      backgroundColor: theme === "muted-elegance" ? "#E3B5A4" : theme === "dark" ? "#3B82F6" : "#3B82F6",
      zIndex: 100,
    }
  }

  // Update the return statement to include the drop indicator line
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className="py-2 tree-scroll-container relative"
            ref={containerRef}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"

              // If dragging near the bottom of the container, show a drop indicator for root level
              const rect = containerRef.current?.getBoundingClientRect()

              if (rect && e.clientY > rect.bottom - 20) {
                setDropIndicator({
                  visible: true,
                  targetId: null,
                  position: "after",
                  top: rect.bottom - (containerRef.current?.scrollTop || 0),
                })
              } else {
                // Hide the indicator if not near the bottom and not over a node
                if (!dropIndicator.targetId) {
                  setDropIndicator({ visible: false, targetId: null, position: "after", top: 0 })
                }
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              // Hide the drop indicator
              setDropIndicator({ visible: false, targetId: null, position: "after", top: 0 })

              // Handle drop at root level
              if (draggedItem) {
                const sourceId = draggedItem.id

                // Create a deep copy of the tree data
                const newTreeData = JSON.parse(JSON.stringify(treeData))

                // Find source node
                const findNode = (
                  nodes: TreeNodeProps[],
                  id: string,
                  parent: TreeNodeProps[] | null = null,
                ): { node: TreeNodeProps | null; parent: TreeNodeProps[] | null; index: number } => {
                  for (let i = 0; i < nodes.length; i++) {
                    if (nodes[i].id === id) {
                      return { node: nodes[i], parent: nodes, index: i }
                    }

                    if (nodes[i].children) {
                      const result = findNode(nodes[i].children!, id, nodes[i].children)
                      if (result.node) {
                        return result
                      }
                    }
                  }

                  return { node: null, parent: null, index: -1 }
                }

                const sourceResult = findNode(newTreeData, sourceId)

                if (sourceResult.node && sourceResult.parent) {
                  // Remove the source node from its parent
                  const sourceNode = sourceResult.node
                  sourceResult.parent.splice(sourceResult.index, 1)

                  // Add to root level at the end
                  newTreeData.push(sourceNode)

                  // Update the tree data
                  setTreeData(newTreeData)
                }

                setDraggedItem(null)
              }
            }}
          >
            {/* Drop indicator line */}
            <div style={getIndicatorStyle()} className="drop-indicator-line" />

            {processedTreeData.map((node) => (
              <TreeNode
                key={node.id}
                {...node}
                isExpanded={expandedNodes[node.id] || false}
                isSelected={selectedNode === node.id}
                onToggle={toggleNode}
                onSelect={onNodeSelect}
                onCreateFolder={handleCreateFolder}
                onCreateFile={handleCreateFile}
                onRename={handleRename}
                onDelete={handleDelete}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragOverNode={handleDragOverNode}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => handleCreateFolder(null)}>
            <Folder className="h-4 w-4 mr-2" />
            New Folder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleCreateFile(null)}>
            <FileText className="h-4 w-4 mr-2" />
            New File
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="col-span-3"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyRename()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={applyRename}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete this item? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={applyDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
