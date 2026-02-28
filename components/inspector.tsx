"use client"

import { useState, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DocumentData } from "@/lib/project-types"

interface InspectorProps {
  selectedNode: string | null
  documents: Record<string, DocumentData>
  onDocumentUpdate?: (id: string, data: Partial<DocumentData>) => void
}

export function Inspector({ selectedNode, documents, onDocumentUpdate }: InspectorProps) {
  const [notes, setNotes] = useState("")
  const [synopsis, setSynopsis] = useState("")
  const [status, setStatus] = useState("to-do")
  const [label, setLabel] = useState("none")
  const [keywords, setKeywords] = useState("")

  // Load data based on selected node
  useEffect(() => {
    if (selectedNode && documents[selectedNode]) {
      const doc = documents[selectedNode]
      setNotes(doc.notes || "")
      setSynopsis(doc.synopsis || "")
      setStatus(doc.status || "to-do")
      setLabel(doc.label || "none")
      setKeywords(doc.keywords || "")
    } else {
      // Reset form if no document is selected
      setNotes("")
      setSynopsis("")
      setStatus("to-do")
      setLabel("none")
      setKeywords("")
    }
  }, [selectedNode, documents])

  // Update document when form values change
  const handleUpdate = (field: keyof DocumentData, value: string) => {
    if (field === "notes") setNotes(value)
    if (field === "synopsis") setSynopsis(value)
    if (field === "status") setStatus(value)
    if (field === "label") setLabel(value)
    if (field === "keywords") setKeywords(value)

    if (selectedNode && onDocumentUpdate) {
      onDocumentUpdate(selectedNode, { [field]: value })
    }
  }

  const panelClass =
    "rounded-xl border border-white/10 bg-white/10 text-foreground shadow-none transition-all focus-visible:ring-1 focus-visible:ring-primary/35"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inspector</h2>
      </div>
      <ScrollArea className="flex-1 min-h-0 px-4 pb-4">
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Synopsis</Label>
            <Textarea
              placeholder="Brief summary of this document..."
              className={`min-h-[100px] resize-none ${panelClass}`}
              value={synopsis}
              onChange={(e) => handleUpdate("synopsis", e.target.value)}
              disabled={!selectedNode}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
              <Select
                disabled={!selectedNode}
                value={status}
                onValueChange={(val) => handleUpdate("status", val)}
              >
                <SelectTrigger className={panelClass}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to-do">To Do</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="revised">Revised</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Label</Label>
              <Input
                disabled={!selectedNode}
                value={label}
                onChange={(e) => handleUpdate("label", e.target.value)}
                className={panelClass}
                placeholder="e.g. Concept, Note..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Keywords</Label>
            <Input
              disabled={!selectedNode}
              value={keywords}
              onChange={(e) => handleUpdate("keywords", e.target.value)}
              placeholder="Comma-separated tags"
              className={panelClass}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</Label>
            <Textarea
              placeholder="Enter notes..."
              className={`min-h-[200px] ${panelClass}`}
              value={notes}
              onChange={(e) => handleUpdate("notes", e.target.value)}
              disabled={!selectedNode}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
