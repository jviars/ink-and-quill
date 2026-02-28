"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useTheme } from "next-themes"
import type { DocumentData, TreeNode } from "@/lib/project-types"

interface OutlinerProps {
  treeData: TreeNode[]
  documents: Record<string, DocumentData>
  selectedNode: string
  onNodeSelect: (nodeId: string) => void
  onDocumentUpdate?: (id: string, data: Partial<DocumentData>) => void
}

export function Outliner({ treeData, documents, selectedNode, onNodeSelect, onDocumentUpdate }: OutlinerProps) {
  const { theme } = useTheme()

  // Function to recursively extract all document nodes from the tree with their parent information
  const extractDocumentNodes = (
    nodes: TreeNode[],
    parentName = "Main Folder",
  ): { id: string; title: string; type: string; parent: string }[] => {
    let result: { id: string; title: string; type: string; parent: string }[] = []

    nodes.forEach((node) => {
      if (node.type === "document") {
        result.push({ id: node.id, title: node.label, type: node.type, parent: parentName })
      }

      if (node.children && node.children.length > 0) {
        // Pass the current node's label as the parent name for its children
        result = [...result, ...extractDocumentNodes(node.children, node.label)]
      }
    })

    return result
  }

  // Get all document nodes with their parent information
  const documentNodes = extractDocumentNodes(treeData)

  // Create outline items from document nodes and documents data
  const outlineItems = documentNodes.map((node) => {
    const doc = documents[node.id] || {
      synopsis: "",
      status: "to-do",
      label: "none",
      wordCount: 0,
    }

    // Ensure we have a valid wordCount
    const wordCount =
      doc.wordCount ||
      // If document has content but no wordCount, calculate it
      (doc.content
        ? doc.content
          .replace(/<[^>]*>/g, " ")
          .split(/\s+/)
          .filter(Boolean).length
        : 0)

    // Calculate page count based on standard manuscript format (275 words per page)
    const pageCount = Math.ceil(wordCount / 275)

    return {
      id: node.id,
      title: node.title,
      type: node.type,
      wordCount: wordCount,
      pageCount: pageCount,
      parent: node.parent,
    }
  })

  const getTableHeaderClass = () => {
    if (theme === "muted-elegance") {
      return "bg-[#4D4D4D] text-[#E3B5A4] border-[#666666]"
    }
    return ""
  }

  const getTableRowClass = (id: string) => {
    const baseClass = theme === "muted-elegance" ? "border-[#666666] hover:bg-[#666666]" : ""

    // Add selected state
    if (id === selectedNode) {
      return `${baseClass} ${theme === "muted-elegance" ? "bg-[#E3B5A4] bg-opacity-30" : theme === "dark" ? "bg-blue-900" : "bg-blue-100"
        }`
    }

    return baseClass
  }

  return (
    <div className="flex flex-col h-full dark:bg-gray-950">
      <div className={`border-b p-2 ${theme === "muted-elegance" ? "border-[#666666]" : "dark:border-gray-800"}`}>
        <h2 className="text-lg font-medium dark:text-white">Outliner</h2>
      </div>
      <ScrollArea className="flex-1">
        {outlineItems.length > 0 ? (
          <Table>
            <TableHeader className={getTableHeaderClass()}>
              <TableRow>
                <TableHead className="w-[300px]">Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Word Count</TableHead>
                <TableHead>Page Count</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outlineItems.map((item) => (
                <TableRow
                  key={item.id}
                  className={getTableRowClass(item.id)}
                  onClick={() => onNodeSelect(item.id)}
                  style={{ cursor: "pointer" }}
                >
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.wordCount}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.pageCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{item.parent}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className={`text-lg font-medium mb-4 ${theme === "muted-elegance" ? "text-[#F0F0F0]" : ""}`}>
              No documents to display
            </div>
            <p className={`text-sm ${theme === "muted-elegance" ? "text-[#E3B5A4]" : "text-gray-500"}`}>
              Create documents in the binder to see them in the outliner
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
