"use client"

import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Folder, FileText, ChevronRight, ChevronDown, Trash, Edit, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import type { FileNode } from "@/lib/project-types"
import {
  findNode,
  insertNode,
  removeNode,
  convertToFileNodes,
  convertFromFileNodes,
  sortTreeNodes,
} from "@/lib/tree-utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTheme } from "next-themes"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

/* ────────────────────────────────────────────────────────────── *
 * 1. Recursive sortable item
 * ────────────────────────────────────────────────────────────── */
function TreeItem({
  node,
  depth,
  isExpanded,
  expandedNodes,
  onToggle,
  onSelect,
  selectedNodeId,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder,
}: {
  node: FileNode
  depth: number
  isExpanded: boolean
  expandedNodes: Record<string, boolean>
  onToggle: (id: string) => void
  onSelect: (id: string) => void
  selectedNodeId: string | null
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onCreateFile: (parentId: string | null) => void
  onCreateFolder: (parentId: string | null) => void
}) {
  const { resolvedTheme } = useTheme()
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } = useSortable({ id: node.id })
  const isDark = resolvedTheme === "dark"

  const getSelectedClass = () => {
    if (selectedNodeId === node.id) {
      if (isDark) {
        return "bg-primary/20 text-primary font-medium"
      } else {
        return "bg-primary/10 text-primary font-medium"
      }
    }
    return "text-muted-foreground"
  }

  const getHoverClass = () => {
    if (selectedNodeId === node.id) return "" // Don't apply hover to selected

    if (isDark) {
      return "dark:hover:bg-white/5 hover:text-foreground"
    } else {
      return "hover:bg-black/5 hover:text-foreground"
    }
  }

  const getDragOverClass = () => {
    if (isOver && node.type === "folder") {
      if (isDark) {
        return "bg-blue-900 bg-opacity-30 border-2 border-dashed border-blue-500 border-opacity-70"
      } else {
        return "bg-blue-100 bg-opacity-70 border-2 border-dashed border-blue-300 border-opacity-70"
      }
    }
    return ""
  }

  const getDragIndicatorClass = () => {
    if (isDragging) {
      return "opacity-50 border-2 border-dashed"
    }
    return ""
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: "transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease",
      }}
      className={isDragging ? "opacity-50" : ""}
    >
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            {...attributes}
            {...listeners}
            className={cn(
              "flex items-center rounded-md mx-2 my-0.5 px-2 py-1.5 cursor-pointer text-sm transition-colors duration-150",
              getHoverClass(),
              getSelectedClass(),
              getDragOverClass(),
              getDragIndicatorClass(),
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => onSelect(node.id)}
          >
            {node.type === "folder" ? (
              <button
                className="mr-1 h-4 w-4 flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(node.id)
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 transition-transform duration-300" />
                ) : (
                  <ChevronRight className="h-3 w-3 transition-transform duration-300" />
                )}
              </button>
            ) : (
              <span className="mr-1 w-4" />
            )}

            {node.type === "folder" ? (
              <Folder className="h-4 w-4 mr-2 text-gray-500" />
            ) : (
              <FileText className="h-4 w-4 mr-2 text-gray-500" />
            )}

            <span className="truncate">{node.name}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {node.type === "folder" ? (
            <>
              <ContextMenuItem onClick={() => onCreateFolder(node.id)}>
                <Folder className="h-4 w-4 mr-2" />
                New Folder
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCreateFile(node.id)}>
                <FileText className="h-4 w-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onRename(node.id, node.name)}>
                <Edit className="h-4 w-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem className="text-red-600" onClick={() => onDelete(node.id)}>
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem onClick={() => onRename(node.id, node.name)}>
                <Edit className="h-4 w-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem className="text-red-600" onClick={() => onDelete(node.id)}>
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {node.type === "folder" && node.children?.length && isExpanded ? (
        <SortableContext id={node.id} items={node.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {sortTreeNodes(node.children).map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              isExpanded={(expandedNodes && expandedNodes[child.id]) || false}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedNodeId={selectedNodeId}
              onRename={onRename}
              onDelete={onDelete}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
            />
          ))}
        </SortableContext>
      ) : null}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── *
 * 2. Sidebar wrapper
 * ────────────────────────────────────────────────────────────── */
// Update the FileSidebar component to automatically expand folders in the default structure
function collectFolderIds(nodes: FileNode[], acc: string[] = []) {
  for (const n of nodes) {
    if (n.type === "folder") {
      acc.push(n.id)
      if (n.children?.length) collectFolderIds(n.children, acc)
    }
  }
  return acc
}

function matchesSearch(node: FileNode, query: string, documents?: Record<string, any>): boolean {
  if (node.name.toLowerCase().includes(query.toLowerCase())) return true
  if (node.type === "file" && documents && documents[node.id]) {
    const doc = documents[node.id]
    if (doc.content?.toLowerCase().includes(query.toLowerCase())) return true
    if (doc.synopsis?.toLowerCase().includes(query.toLowerCase())) return true
    if (doc.notes?.toLowerCase().includes(query.toLowerCase())) return true
    if (doc.keywords?.toLowerCase().includes(query.toLowerCase())) return true
  }
  return false
}

function filterTree(nodes: FileNode[], query: string, documents?: Record<string, any>): FileNode[] {
  if (!query) return nodes
  const result: FileNode[] = []
  for (const node of nodes) {
    const matches = matchesSearch(node, query, documents)
    let filteredChildren: FileNode[] = []
    if (node.children) {
      filteredChildren = filterTree(node.children, query, documents)
    }
    if (matches || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
      })
    }
  }
  return result
}

export default function FileSidebar({
  initialTree,
  onTreeChange,
  selectedNode,
  onNodeSelect,
  documents,
}: {
  initialTree: any[]
  onTreeChange: (t: any[]) => void
  selectedNode: string | null
  onNodeSelect: (nodeId: string) => void
  documents?: Record<string, any>
}) {
  // Convert from our existing tree structure to FileNode structure
  const [tree, setTree] = useState<FileNode[]>(convertToFileNodes(initialTree))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const [moveNotification, setMoveNotification] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Dialogs state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [itemToRename, setItemToRename] = useState<{ id: string; currentName: string } | null>(null)
  const [newName, setNewName] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)

  // Update tree when initialTree changes
  useEffect(() => {
    // Ensure we have a valid array to work with, even if initialTree is undefined or empty
    const fileNodes =
      initialTree && Array.isArray(initialTree) && initialTree.length > 0
        ? convertToFileNodes(initialTree)
        : [
          {
            id: "root",
            name: "My Project",
            type: "folder" as const,
            parentId: null,
            children: [],
          },
        ]
    const sortedNodes = sortTreeNodes(fileNodes)
    setTree(sortedNodes)

    // Expand top-level and any folders that actually exist
    const folderIds = collectFolderIds(sortedNodes)
    const nextExpanded: Record<string, boolean> = {}
    for (const id of folderIds) nextExpanded[id] = true
    setExpandedNodes(nextExpanded)
  }, [initialTree])

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor))

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    setActiveId(null)

    if (!over || active.id === over.id) return

    // 1. Pull active node out of tree
    const [draggedNode] = findNode(tree, active.id as string)
    if (!draggedNode) return

    // 2. Prevent infinite loops: A folder cannot be dropped into itself or any of its children
    const isDescendant = (potentialParentId: string, ancestorId: string): boolean => {
      if (potentialParentId === ancestorId) return true
      const [parentNode] = findNode(tree, potentialParentId)
      if (!parentNode || !parentNode.parentId) return false
      return isDescendant(parentNode.parentId, ancestorId)
    }

    const [overNode] = findNode(tree, over.id as string)
    const targetFolderId = overNode?.type === "folder" ? overNode.id : (overNode?.parentId ?? null)

    if (draggedNode.type === "folder" && targetFolderId && isDescendant(targetFolderId, draggedNode.id)) {
      setMoveNotification("Cannot move a folder into itself")
      setTimeout(() => setMoveNotification(null), 2000)
      return
    }

    let newTree = removeNode(tree, active.id as string)

    // 3. Insert it
    draggedNode.parentId = targetFolderId
    newTree = insertNode(newTree, targetFolderId, draggedNode)

    // 4. Sort the tree to maintain hierarchy and sort folders before files at each level
    newTree = sortTreeNodes(newTree)

    setTree(newTree)

    // Convert back to our existing tree structure and notify parent
    const convertedTree = convertFromFileNodes(newTree)
    onTreeChange(convertedTree)

    // Expand the target folder if it's a folder
    if (overNode?.type === "folder") {
      setExpandedNodes((prev) => ({
        ...prev,
        [overNode.id]: true,
      }))
    }

    // Show a notification that the move was successful
    setMoveNotification(`Moved ${draggedNode.name}`)
    setTimeout(() => {
      setMoveNotification(null)
    }, 2000)
  }

  // Toggle folder expanded state
  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Handle rename dialog
  const handleRename = (id: string, currentName: string) => {
    setItemToRename({ id, currentName })
    setNewName(currentName)
    setRenameDialogOpen(true)
  }

  // Apply rename
  const applyRename = () => {
    if (!itemToRename || !newName.trim()) return

    const newTree = [...tree]
    const [node] = findNode(newTree, itemToRename.id)
    if (node) {
      node.name = newName.trim()
      setTree(newTree)

      // Convert back and notify parent
      const convertedTree = convertFromFileNodes(newTree)
      onTreeChange(convertedTree)
    }

    setRenameDialogOpen(false)
    setItemToRename(null)
  }

  // Handle delete dialog
  const handleDelete = (id: string) => {
    setItemToDelete(id)
    setDeleteDialogOpen(true)
  }

  // Apply delete
  const applyDelete = () => {
    if (!itemToDelete) return

    const newTree = removeNode(tree, itemToDelete)
    setTree(newTree)

    // Convert back and notify parent
    const convertedTree = convertFromFileNodes(newTree)
    onTreeChange(convertedTree)

    // If the deleted item was selected, select a default item
    if (selectedNode === itemToDelete) {
      // Find a valid node to select
      const findFirstAvailableNode = (nodes: FileNode[]): string | null => {
        if (nodes.length === 0) return null

        // Try to find a file node
        for (const node of nodes) {
          if (node.type === "file" && node.id !== itemToDelete) {
            return node.id
          }
        }

        // If no file found, try to find in children
        for (const node of nodes) {
          if (node.type === "folder" && node.children && node.children.length > 0) {
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

      const newSelectedNode = findFirstAvailableNode(newTree)
      if (newSelectedNode) {
        onNodeSelect(newSelectedNode)
      }
    }

    setDeleteDialogOpen(false)
    setItemToDelete(null)
  }

  // Create a new folder
  const handleCreateFolder = (parentId: string | null) => {
    const newFolderId = `folder-${Date.now()}`
    const newFolder: FileNode = {
      id: newFolderId,
      name: "New Folder",
      type: "folder",
      parentId,
      children: [],
    }

    const newTree = insertNode(tree, parentId, newFolder)
    setTree(newTree)

    // Convert back and notify parent
    const convertedTree = convertFromFileNodes(newTree)
    onTreeChange(convertedTree)

    // Expand the parent folder
    if (parentId) {
      setExpandedNodes((prev) => ({
        ...prev,
        [parentId]: true,
      }))
    }

    // Select the new folder
    onNodeSelect(newFolderId)

    // Open rename dialog for the new folder
    handleRename(newFolderId, "New Folder")
  }

  // Create a new file
  const handleCreateFile = (parentId: string | null) => {
    const newFileId = `file-${Date.now()}`
    const newFile: FileNode = {
      id: newFileId,
      name: "New File",
      type: "file",
      parentId,
    }

    const newTree = insertNode(tree, parentId, newFile)
    setTree(newTree)

    // Convert back and notify parent
    const convertedTree = convertFromFileNodes(newTree)
    onTreeChange(convertedTree)

    // Expand the parent folder
    if (parentId) {
      setExpandedNodes((prev) => ({
        ...prev,
        [parentId]: true,
      }))
    }

    // Select the new file
    onNodeSelect(newFileId)

    // Open rename dialog for the new file
    handleRename(newFileId, "New File")
  }

  const filteredTree = filterTree(tree || [], searchQuery, documents)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Binder</h2>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="glass-icon-button h-7 w-7"
            onClick={() => handleCreateFolder(null)}
            title="New Folder"
          >
            <Folder className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="glass-icon-button h-7 w-7"
            onClick={() => handleCreateFile(null)}
            title="New File"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </header>

      <div className="px-3 pb-3 pt-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/70" />
          <Input
            placeholder="Search project..."
            className="h-9 rounded-xl border border-white/10 bg-white/10 pl-9 text-sm transition-all focus-visible:ring-1 focus-visible:ring-primary/40"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-1 pb-2">
        <ContextMenu>
          <ContextMenuTrigger className="flex-1 h-full">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e) => setActiveId(e.active.id as string)}
              onDragEnd={handleDragEnd}
            >
              <SortableContext id="ROOT" items={filteredTree.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                {sortTreeNodes(filteredTree).map((node) => (
                  <TreeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    isExpanded={(expandedNodes && expandedNodes[node.id]) || false}
                    expandedNodes={expandedNodes}
                    onToggle={toggleNode}
                    onSelect={onNodeSelect}
                    selectedNodeId={selectedNode}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                  />
                ))}
              </SortableContext>

              {/* ghost while dragging */}
              <DragOverlay dropAnimation={null}>
                {activeId && (
                  <div className="rounded bg-muted px-2 py-1 border-2 border-dashed border-primary opacity-90 shadow-md">
                    <div className="flex items-center">
                      {findNode(tree, activeId)[0]?.type === "folder" ? (
                        <Folder className="h-4 w-4 mr-2 text-gray-500" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2 text-gray-500" />
                      )}
                      <span>{findNode(tree, activeId)[0]?.name}</span>
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
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
      </div>

      {moveNotification && (
        <div className="glass-panel fixed bottom-4 right-4 rounded-xl px-4 py-2 text-sm text-foreground notification">
          {moveNotification}
        </div>
      )}

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
    </div>
  )
}
