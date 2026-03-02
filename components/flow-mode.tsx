"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { TiptapEditor } from "@/components/tiptap-editor"
import type { EditorCommentDraft } from "@/lib/comment-utils"

export interface FlowModeDocument {
  id: string
  title: string
  content: string
}

interface FlowModeProps {
  documents: FlowModeDocument[]
  fontSize?: string
  onDocumentChange: (documentId: string, content: string) => void
  onCommentCreate?: (documentId: string, comment: EditorCommentDraft) => void
}

export function FlowMode({ documents, fontSize, onDocumentChange, onCommentCreate }: FlowModeProps) {
  if (documents.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-transparent p-8 text-center text-muted-foreground">
        <div>
          <p className="text-sm font-medium">No documents to show in Flow Mode.</p>
          <p className="mt-1 text-xs">Create at least one document in the binder.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="z-10 flex items-center justify-between border-b border-white/10 bg-transparent px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Flow Mode</h2>
        <span className="text-xs text-muted-foreground">{documents.length} docs</span>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-6 p-4">
          {documents.map((document, index) => (
            <section key={document.id} className="rounded-2xl border border-white/10 bg-transparent overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs">
                <span className="font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                  {index + 1}. {document.title}
                </span>
              </div>
              <TiptapEditor
                selectedNode={document.id}
                initialContent={document.content}
                fontSize={fontSize}
                compactMode
                onContentChange={(content) => onDocumentChange(document.id, content)}
                onCommentCreate={(comment) => onCommentCreate?.(document.id, comment)}
              />
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
