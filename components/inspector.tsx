"use client"

import { useState, useEffect, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SECTION_TYPE_LABELS,
  SECTION_TYPE_VALUES,
  type DocumentComment,
  type DocumentData,
  type DocumentSnapshot,
  type MetadataFieldDefinition,
  type MetadataTemplate,
  type MetadataValue,
  type SectionType,
  type SnapshotSettings,
  type TreeNode,
} from "@/lib/project-types"
import { buildInlineDiff, formatSnapshotTrigger, htmlToPlainText } from "@/lib/snapshot-utils"
import { extractCommentAnchorsFromHtml, sortCommentsByCreatedAt } from "@/lib/comment-utils"
import { cn } from "@/lib/utils"

interface InspectorProps {
  selectedNode: string | null
  selectedTreeNode: TreeNode | null
  documents: Record<string, DocumentData>
  snapshotSettings: SnapshotSettings
  metadataFields: MetadataFieldDefinition[]
  metadataTemplates: MetadataTemplate[]
  onDocumentUpdate?: (id: string, data: Partial<DocumentData>) => void
  onNodeUpdate?: (id: string, patch: Partial<TreeNode>) => void
  onCreateSnapshot?: (id: string, note?: string) => void
  onRestoreSnapshot?: (id: string, snapshot: DocumentSnapshot) => void
}

const stringifyMetadataValue = (value: MetadataValue): string => {
  if (Array.isArray(value)) return value.join(", ")
  if (value === null || value === undefined) return ""
  return String(value)
}

const parseMetadataValue = (field: MetadataFieldDefinition, value: string): MetadataValue => {
  if (field.type === "number") return Number(value) || 0
  if (field.type === "boolean") return value === "true"
  if (field.type === "multi-select") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return value
}

export function Inspector({
  selectedNode,
  selectedTreeNode,
  documents,
  snapshotSettings,
  metadataFields,
  metadataTemplates,
  onDocumentUpdate,
  onNodeUpdate,
  onCreateSnapshot,
  onRestoreSnapshot,
}: InspectorProps) {
  const [notes, setNotes] = useState("")
  const [synopsis, setSynopsis] = useState("")
  const [metadata, setMetadata] = useState<Record<string, MetadataValue>>({})
  const [snapshotNote, setSnapshotNote] = useState("")
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("")

  useEffect(() => {
    if (selectedNode && documents[selectedNode]) {
      const doc = documents[selectedNode]
      setNotes(doc.notes || "")
      setSynopsis(doc.synopsis || "")
      setMetadata(doc.metadata || {})
      const latestSnapshot = doc.snapshots?.[doc.snapshots.length - 1]
      setSelectedSnapshotId(latestSnapshot?.id || "")
      setSnapshotNote("")
    } else {
      setNotes("")
      setSynopsis("")
      setMetadata({})
      setSelectedSnapshotId("")
      setSnapshotNote("")
    }
  }, [selectedNode, documents])

  const handleDocUpdate = (patch: Partial<DocumentData>) => {
    if (!selectedNode || !onDocumentUpdate || selectedTreeNode?.type !== "document") return
    onDocumentUpdate(selectedNode, patch)
  }

  const handleCoreTextUpdate = (field: "notes" | "synopsis", value: string) => {
    if (field === "notes") setNotes(value)
    if (field === "synopsis") setSynopsis(value)
    handleDocUpdate({ [field]: value })
  }

  const handleMetadataUpdate = (field: MetadataFieldDefinition, rawValue: string) => {
    const parsedValue = parseMetadataValue(field, rawValue)
    const nextMetadata = {
      ...metadata,
      [field.id]: parsedValue,
    }
    setMetadata(nextMetadata)

    const legacyPatch: Partial<DocumentData> = {
      metadata: nextMetadata,
    }

    if (field.id === "status" && typeof parsedValue === "string") {
      legacyPatch.status = parsedValue
    }
    if (field.id === "label" && typeof parsedValue === "string") {
      legacyPatch.label = parsedValue
    }
    if (field.id === "keywords" && typeof parsedValue === "string") {
      legacyPatch.keywords = parsedValue
    }

    handleDocUpdate(legacyPatch)
  }

  const handleNodeSettingUpdate = (patch: Partial<TreeNode>) => {
    if (!selectedNode || !onNodeUpdate) return
    onNodeUpdate(selectedNode, patch)
  }

  const panelClass =
    "rounded-xl border border-white/10 bg-white/10 text-foreground shadow-none transition-all focus-visible:ring-1 focus-visible:ring-primary/35"

  const selectedTemplateValue = selectedTreeNode?.metadataTemplateId || "none"
  const selectedSectionType = (selectedTreeNode?.sectionType || "scene") as SectionType
  const isDocumentSelected = selectedTreeNode?.type === "document"
  const selectedDocument = selectedNode ? documents[selectedNode] : null
  const sortedComments = useMemo(() => {
    const comments = selectedDocument?.comments ?? []
    return sortCommentsByCreatedAt(comments)
  }, [selectedDocument?.comments])
  const commentAnchors = useMemo(() => {
    return extractCommentAnchorsFromHtml(selectedDocument?.content || "")
  }, [selectedDocument?.content])

  const sortedSnapshots = useMemo(() => {
    if (!selectedDocument?.snapshots?.length) return []
    return [...selectedDocument.snapshots].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [selectedDocument?.snapshots])

  const selectedSnapshot = useMemo(() => {
    if (sortedSnapshots.length === 0) return null
    if (!selectedSnapshotId) return sortedSnapshots[0]
    return sortedSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || sortedSnapshots[0]
  }, [sortedSnapshots, selectedSnapshotId])

  const snapshotPlainText = useMemo(() => {
    if (!selectedSnapshot) return ""
    return htmlToPlainText(selectedSnapshot.content)
  }, [selectedSnapshot])

  const currentPlainText = useMemo(() => {
    if (!selectedDocument) return ""
    return htmlToPlainText(selectedDocument.content)
  }, [selectedDocument])

  const inlineDiff = useMemo(() => {
    if (!selectedSnapshot || !selectedDocument) return []
    return buildInlineDiff(snapshotPlainText, currentPlainText)
  }, [selectedSnapshot, selectedDocument, snapshotPlainText, currentPlainText])

  const diffCounts = useMemo(() => {
    return inlineDiff.reduce(
      (acc, segment) => {
        if (segment.type === "insert") acc.inserted += segment.text.length
        if (segment.type === "delete") acc.deleted += segment.text.length
        return acc
      },
      { inserted: 0, deleted: 0 },
    )
  }, [inlineDiff])

  const handleCreateSnapshot = () => {
    if (!selectedNode || !onCreateSnapshot) return
    onCreateSnapshot(selectedNode, snapshotNote.trim() || undefined)
    setSnapshotNote("")
  }

  const handleRestoreSnapshot = () => {
    if (!selectedNode || !selectedSnapshot || !onRestoreSnapshot) return
    const confirmRestore = window.confirm(
      `Restore snapshot from ${new Date(selectedSnapshot.createdAt).toLocaleString()}? A safety snapshot of your current content will be created first.`,
    )
    if (!confirmRestore) return
    onRestoreSnapshot(selectedNode, selectedSnapshot)
  }

  const handleCommentUpdate = (commentId: string, patch: Partial<DocumentComment>) => {
    if (!selectedDocument) return
    const nextComments = (selectedDocument.comments ?? []).map((comment) =>
      comment.id === commentId
        ? {
            ...comment,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        : comment,
    )
    handleDocUpdate({ comments: nextComments })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Inspector</h2>
      </div>

      <ScrollArea className="flex-1 min-h-0 px-4 pb-4">
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Section Type</Label>
            <Select
              value={selectedSectionType}
              onValueChange={(value) => handleNodeSettingUpdate({ sectionType: value as SectionType })}
              disabled={!selectedTreeNode}
            >
              <SelectTrigger className={panelClass}>
                <SelectValue placeholder="Section type" />
              </SelectTrigger>
              <SelectContent>
                {SECTION_TYPE_VALUES.map((sectionType) => (
                  <SelectItem key={sectionType} value={sectionType}>
                    {SECTION_TYPE_LABELS[sectionType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compile</Label>
            <label className={`flex items-center gap-2 rounded-xl px-3 py-2 ${panelClass}`}>
              <input
                type="checkbox"
                checked={selectedTreeNode?.includeInCompile ?? true}
                onChange={(e) => handleNodeSettingUpdate({ includeInCompile: e.target.checked })}
                disabled={!selectedTreeNode}
              />
              <span className="text-sm">Include this item in compile output</span>
            </label>
          </div>

          {selectedTreeNode?.type === "document" && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template</Label>
              <Select
                value={selectedTemplateValue}
                onValueChange={(value) => handleNodeSettingUpdate({ metadataTemplateId: value === "none" ? null : value })}
              >
                <SelectTrigger className={panelClass}>
                  <SelectValue placeholder="Metadata template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {metadataTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Synopsis</Label>
            <Textarea
              placeholder="Brief summary of this document..."
              className={`min-h-[100px] resize-none ${panelClass}`}
              value={synopsis}
              onChange={(e) => handleCoreTextUpdate("synopsis", e.target.value)}
              disabled={!isDocumentSelected}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</Label>
            <Textarea
              placeholder="Enter notes..."
              className={`min-h-[180px] ${panelClass}`}
              value={notes}
              onChange={(e) => handleCoreTextUpdate("notes", e.target.value)}
              disabled={!isDocumentSelected}
            />
          </div>

          {isDocumentSelected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comments</Label>
                <span className="text-xs text-muted-foreground">
                  {(selectedDocument?.comments ?? []).filter((comment) => !comment.resolved).length} open
                </span>
              </div>
              {sortedComments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Select text in the editor and click the comment button to add a thread.</p>
              ) : (
                <div className="space-y-3">
                  {sortedComments.map((comment) => {
                    const anchors = commentAnchors[comment.id] || []
                    return (
                      <div key={comment.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {comment.resolved ? "Resolved" : "Unresolved"}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleCommentUpdate(comment.id, { resolved: !comment.resolved })}
                          >
                            {comment.resolved ? "Reopen" : "Resolve"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleString()}
                        </p>
                        <Textarea
                          value={comment.text}
                          onChange={(event) => handleCommentUpdate(comment.id, { text: event.target.value })}
                          className="min-h-[72px] resize-none rounded-xl border border-white/10 bg-white/10 text-sm"
                        />
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Anchors</p>
                          {anchors.length > 0 ? (
                            <div className="space-y-1">
                              {anchors.map((anchor, index) => (
                                <p key={`${comment.id}-anchor-${index}`} className="rounded-md bg-white/10 px-2 py-1 text-xs text-muted-foreground">
                                  "{anchor}"
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Anchor not found in current content.</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {isDocumentSelected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Snapshots</Label>
                {!snapshotSettings.enabled && (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Disabled</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={snapshotNote}
                  onChange={(event) => setSnapshotNote(event.target.value)}
                  placeholder="Optional note"
                  className={panelClass}
                  disabled={!snapshotSettings.enabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCreateSnapshot}
                  disabled={!snapshotSettings.enabled}
                >
                  Create
                </Button>
              </div>

              {sortedSnapshots.length === 0 ? (
                <p className="text-xs text-muted-foreground">No snapshots yet for this document.</p>
              ) : (
                <div className="space-y-3">
                  <Select value={selectedSnapshot?.id || ""} onValueChange={setSelectedSnapshotId}>
                    <SelectTrigger className={panelClass}>
                      <SelectValue placeholder="Select snapshot" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedSnapshots.map((snapshot) => (
                        <SelectItem key={snapshot.id} value={snapshot.id}>
                          {new Date(snapshot.createdAt).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedSnapshot && (
                    <>
                      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <div>Trigger: {formatSnapshotTrigger(selectedSnapshot.trigger)}</div>
                        <div>Hash: {selectedSnapshot.contentHash.slice(0, 12)}</div>
                        <div>Words: {selectedSnapshot.wordCount}</div>
                        <div>Note: {selectedSnapshot.note || "None"}</div>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleRestoreSnapshot}
                        disabled={!selectedSnapshot}
                      >
                        Restore Snapshot
                      </Button>

                      <div className="grid gap-2 lg:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Snapshot</p>
                          <Textarea
                            readOnly
                            value={snapshotPlainText}
                            className="min-h-[140px] resize-none rounded-xl border border-white/10 bg-white/10 text-xs leading-relaxed"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Current</p>
                          <Textarea
                            readOnly
                            value={currentPlainText}
                            className="min-h-[140px] resize-none rounded-xl border border-white/10 bg-white/10 text-xs leading-relaxed"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Inline Diff
                          <span className="ml-2 normal-case tracking-normal text-muted-foreground">
                            +{diffCounts.inserted} / -{diffCounts.deleted}
                          </span>
                        </p>
                        <div className="max-h-[180px] overflow-auto rounded-xl border border-white/10 bg-white/10 p-3 text-xs leading-relaxed">
                          {inlineDiff.length === 0 ? (
                            <span className="text-muted-foreground">No differences.</span>
                          ) : (
                            inlineDiff.map((segment, index) => (
                              <span
                                key={`${segment.type}-${index}`}
                                className={cn(
                                  segment.type === "insert" && "rounded bg-emerald-500/25 text-emerald-900 dark:text-emerald-200",
                                  segment.type === "delete" && "rounded bg-rose-500/25 text-rose-900 dark:text-rose-200 line-through",
                                )}
                              >
                                {segment.text}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metadata</Label>
            {metadataFields.map((field) => {
              const value = metadata[field.id]
              const displayValue = stringifyMetadataValue(value)
              const selectOptions = field.options || []

              return (
                <div key={field.id} className="space-y-2">
                  <Label className="text-xs">{field.name}</Label>
                  {field.type === "long-text" ? (
                    <Textarea
                      value={displayValue}
                      disabled={!isDocumentSelected}
                      className={panelClass}
                      onChange={(e) => handleMetadataUpdate(field, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === "select" && selectOptions.length > 0 ? (
                    <Select
                      value={displayValue || "__empty__"}
                      disabled={!isDocumentSelected}
                      onValueChange={(nextValue) => handleMetadataUpdate(field, nextValue === "__empty__" ? "" : nextValue)}
                    >
                      <SelectTrigger className={panelClass}>
                        <SelectValue placeholder={field.placeholder || "Select value"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">None</SelectItem>
                        {selectOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "boolean" ? (
                    <label className={`flex items-center gap-2 rounded-xl px-3 py-2 ${panelClass}`}>
                      <input
                        type="checkbox"
                        checked={value === true}
                        disabled={!isDocumentSelected}
                        onChange={(e) => handleMetadataUpdate(field, e.target.checked ? "true" : "false")}
                      />
                      <span className="text-sm">{field.name}</span>
                    </label>
                  ) : (
                    <Input
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      value={displayValue}
                      disabled={!isDocumentSelected}
                      className={panelClass}
                      onChange={(e) => handleMetadataUpdate(field, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
