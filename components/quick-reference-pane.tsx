"use client"

import { useEffect, useMemo } from "react"
import { ExternalLink, FileText, Image as ImageIcon, Link2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { DocumentData, ResearchItem, TreeNode } from "@/lib/project-types"

interface ResearchEntry {
  id: string
  title: string
  document: DocumentData
}

interface QuickReferencePaneProps {
  treeData: TreeNode[]
  documents: Record<string, DocumentData>
  selectedReferenceId: string | null
  onSelectReference: (documentId: string) => void
  onCreateResearchNote: () => void
  onCreateResearchLink: () => void
  onImportResearchFiles: () => void
  onUpdateResearchItem?: (documentId: string, patch: Partial<ResearchItem>) => void
}

const collectResearchEntries = (nodes: TreeNode[], documents: Record<string, DocumentData>, acc: ResearchEntry[] = []): ResearchEntry[] => {
  for (const node of nodes) {
    if (node.type === "document") {
      const document = documents[node.id]
      if (document && (node.sectionType === "research" || document.research)) {
        acc.push({
          id: node.id,
          title: node.label || "Untitled Research Item",
          document,
        })
      }
    }
    if (node.children?.length) {
      collectResearchEntries(node.children, documents, acc)
    }
  }
  return acc
}

const stripHtml = (html: string): string => {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const resolvePreviewSrc = (path: string | undefined): string | null => {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path

  if (typeof window !== "undefined") {
    const convertFileSrc = (window as any).__TAURI__?.tauri?.convertFileSrc
    if (typeof convertFileSrc === "function") {
      return convertFileSrc(path)
    }
  }

  return `file://${path}`
}

const getTypeLabel = (entry: ResearchEntry): string => {
  return entry.document.research?.type ?? "note"
}

export function QuickReferencePane({
  treeData,
  documents,
  selectedReferenceId,
  onSelectReference,
  onCreateResearchNote,
  onCreateResearchLink,
  onImportResearchFiles,
  onUpdateResearchItem,
}: QuickReferencePaneProps) {
  const researchEntries = useMemo(() => collectResearchEntries(treeData, documents), [treeData, documents])

  useEffect(() => {
    if (researchEntries.length === 0) return
    const isSelectedValid = selectedReferenceId ? researchEntries.some((entry) => entry.id === selectedReferenceId) : false
    if (!isSelectedValid) {
      onSelectReference(researchEntries[0].id)
    }
  }, [researchEntries, selectedReferenceId, onSelectReference])

  const selectedEntry = useMemo(() => {
    if (researchEntries.length === 0) return null
    if (!selectedReferenceId) return researchEntries[0]
    return researchEntries.find((entry) => entry.id === selectedReferenceId) ?? researchEntries[0]
  }, [researchEntries, selectedReferenceId])

  const selectedType = selectedEntry?.document.research?.type ?? "note"
  const previewSrc = selectedEntry ? resolvePreviewSrc(selectedEntry.document.research?.sourcePath) : null
  const notePreview = selectedEntry
    ? selectedEntry.document.research?.indexedText || stripHtml(selectedEntry.document.content || "") || selectedEntry.document.notes || ""
    : ""

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-white/10 bg-transparent">
      <div className="border-b border-white/10 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick Reference</h3>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 glass-icon-button" onClick={onCreateResearchNote} title="New research note">
              <FileText className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 glass-icon-button" onClick={onCreateResearchLink} title="New research link">
              <Link2 className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 glass-icon-button" onClick={onImportResearchFiles} title="Import research file">
              <Upload className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-3 py-3">
        <Select value={selectedEntry?.id || ""} onValueChange={onSelectReference} disabled={researchEntries.length === 0}>
          <SelectTrigger className="rounded-xl border border-white/10 bg-white/10">
            <SelectValue placeholder={researchEntries.length === 0 ? "No research items yet" : "Choose reference"} />
          </SelectTrigger>
          <SelectContent>
            {researchEntries.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                [{getTypeLabel(entry)}] {entry.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-3 pb-3">
        {!selectedEntry ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-3 text-sm text-muted-foreground">
            Add research notes, links, PDFs, or images from the binder to keep references beside your manuscript.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Item</p>
              <p className="mt-1 text-sm font-medium">{selectedEntry.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">Type: {selectedType}</p>
            </div>

            {selectedType === "link" && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Link</p>
                <Input
                  value={selectedEntry.document.research?.sourceUrl || ""}
                  onChange={(event) => onUpdateResearchItem?.(selectedEntry.id, { sourceUrl: event.target.value })}
                  placeholder="https://example.com"
                  className="rounded-xl border-white/10 bg-white/10"
                />
                {selectedEntry.document.research?.sourceUrl && (
                  <a
                    href={selectedEntry.document.research.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open link
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}

            {selectedType === "image" && previewSrc && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- Tauri file previews use local file URLs that next/image cannot optimize. */}
                <img src={previewSrc} alt={selectedEntry.title} className="h-auto w-full rounded-lg object-contain" />
              </div>
            )}

            {selectedType === "pdf" && previewSrc && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <iframe
                  title={`${selectedEntry.title} preview`}
                  src={previewSrc}
                  className="h-[420px] w-full rounded-lg border border-white/10 bg-white"
                />
              </div>
            )}

            {selectedType === "note" && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preview</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
                  {notePreview || "No indexed text yet. Add notes or import a text file."}
                </p>
              </div>
            )}

            {selectedEntry.document.research?.sourcePath && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Source</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{selectedEntry.document.research.sourcePath}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
