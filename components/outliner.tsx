"use client"

import { useTheme } from "next-themes"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import type { TreeNode, DocumentData } from "@/lib/project-types"

interface OutlinerProps {
  treeData: TreeNode[]
  documents: Record<string, DocumentData>
  selectedNode: string | null
  onNodeSelect: (id: string) => void
  onDocumentUpdate?: (id: string, data: Partial<DocumentData>) => void
}

export function Outliner({ treeData, documents, selectedNode, onNodeSelect, onDocumentUpdate }: OutlinerProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  // Helper to extract all documents from the tree
  const getAllDocuments = (nodes: TreeNode[]): { node: TreeNode; doc: DocumentData }[] => {
    let result: { node: TreeNode; doc: DocumentData }[] = []
    for (const node of nodes) {
      if (node.type === "document") {
        const docInfo = documents[node.id] || {
          content: "",
          synopsis: "",
          notes: "",
          status: "to-do",
          label: "none",
          wordCount: 0,
          createdAt: "",
          lastModified: ""
        }
        result.push({ node, doc: docInfo })
      }
      if (node.children) {
        result = result.concat(getAllDocuments(node.children))
      }
    }
    return result
  }

  const allCards = getAllDocuments(treeData)

  const getCardBg = () => {
    if (isDark) return "bg-slate-900/65 border-white/10 shadow-md"
    return "bg-white/80 border-slate-200/70 shadow-sm"
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
      case "revised":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
      case "final":
        return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
    }
  }

  if (allCards.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center bg-transparent p-8 text-center text-muted-foreground">
        <div>
          <h3 className="text-lg font-medium mb-2">No documents found</h3>
          <p>Create a document in the sidebar to see it on the corkboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="z-10 flex items-center justify-between border-b border-white/10 bg-transparent p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Corkboard</h2>
        <span className="text-xs text-muted-foreground">{allCards.length} Cards</span>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start auto-rows-max">
            {allCards.map(({ node, doc }) => (
              <div
                key={node.id}
                onClick={() => onNodeSelect(node.id)}
                className={`flex flex-col rounded-xl border p-4 transition-all duration-200 cursor-pointer ${getCardBg()} ${selectedNode === node.id ? "ring-2 ring-primary ring-offset-2 scale-[1.02]" : "hover:shadow-md hover:scale-[1.01]"
                  }`}
              >
                <div className="flex items-center justify-between mb-3 gap-2">
                  <h3 className="font-semibold text-base truncate flex-1">{node.label}</h3>
                  <Badge variant="outline" className={`text-[10px] px-2 py-0 border-none shrink-0 ${getStatusColor(doc.status)}`}>
                    {doc.status || "to-do"}
                  </Badge>
                </div>

                <div className="flex-1 mb-4">
                  <Textarea
                    placeholder="Brief synopsis..."
                    className="w-full min-h-[120px] resize-none border-transparent bg-transparent p-1 shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:italic text-sm"
                    value={doc.synopsis || ""}
                    onChange={(e) => onDocumentUpdate && onDocumentUpdate(node.id, { synopsis: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-black/5 dark:border-white/5 pt-3">
                  <div className="flex items-center gap-2">
                    {doc.label && doc.label !== "none" && (
                      <span className="truncate max-w-[100px] border rounded px-1.5 py-0.5 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">{doc.label}</span>
                    )}
                  </div>
                  <span>{doc.wordCount || 0} words</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
