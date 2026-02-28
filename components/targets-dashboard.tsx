"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { DocumentData, TargetsSettings, TreeNode } from "@/lib/project-types"

interface TargetsDashboardProps {
  treeData: TreeNode[]
  documents: Record<string, DocumentData>
  selectedDocumentId: string | null
  targetsSettings: TargetsSettings
  sessionStartedAt: string
  sessionStartWordCount: number
  onTargetsSettingsChange: (patch: Partial<TargetsSettings>) => void
  onDocumentTargetChange: (documentId: string, target: number) => void
  onResetSession: () => void
}

interface OrderedDocument {
  id: string
  title: string
  words: number
  target: number
}

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

const getTodayKey = (): string => {
  return new Date().toISOString().slice(0, 10)
}

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return "<1m"
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = Math.round(minutes % 60)
  return `${hours}h ${remainingMinutes}m`
}

const buildOrderedDocuments = (treeData: TreeNode[], documents: Record<string, DocumentData>): OrderedDocument[] => {
  const ordered: OrderedDocument[] = []
  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.type === "document") {
        const doc = documents[node.id]
        ordered.push({
          id: node.id,
          title: node.label || "Untitled Document",
          words: doc?.wordCount || 0,
          target: doc?.wordTarget || 1500,
        })
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }

  walk(treeData)
  return ordered
}

const calculateStreak = (history: Record<string, number>): number => {
  let streak = 0
  const cursor = new Date()

  while (true) {
    const dateKey = cursor.toISOString().slice(0, 10)
    const words = history[dateKey] ?? 0
    if (words <= 0) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

const progressPercentage = (value: number, target: number): number => {
  if (target <= 0) return 0
  return Math.max(0, Math.min(100, (value / target) * 100))
}

export function TargetsDashboard({
  treeData,
  documents,
  selectedDocumentId,
  targetsSettings,
  sessionStartedAt,
  sessionStartWordCount,
  onTargetsSettingsChange,
  onDocumentTargetChange,
  onResetSession,
}: TargetsDashboardProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  const orderedDocuments = useMemo(() => buildOrderedDocuments(treeData, documents), [treeData, documents])
  const totalProjectWords = useMemo(() => orderedDocuments.reduce((sum, doc) => sum + doc.words, 0), [orderedDocuments])

  const selectedDocument =
    (selectedDocumentId ? orderedDocuments.find((doc) => doc.id === selectedDocumentId) : null) ??
    orderedDocuments[0] ??
    null

  const elapsedMinutes = useMemo(() => {
    const startedAt = new Date(sessionStartedAt).getTime()
    if (!Number.isFinite(startedAt)) return 0
    return Math.max(0, (now - startedAt) / (1000 * 60))
  }, [sessionStartedAt, now])

  const sessionWords = Math.max(0, totalProjectWords - sessionStartWordCount)
  const sessionPace = elapsedMinutes > 0 ? sessionWords / elapsedMinutes : 0
  const sessionRemaining = Math.max(0, targetsSettings.sessionWordTarget - sessionWords)
  const sessionEta = sessionPace > 0 ? sessionRemaining / sessionPace : null

  const projectRemaining = Math.max(0, targetsSettings.projectWordTarget - totalProjectWords)
  const todayKey = getTodayKey()
  const todayWords = targetsSettings.dailyWordHistory[todayKey] ?? 0
  const streak = calculateStreak(targetsSettings.dailyWordHistory)
  const bestDay = Math.max(0, ...Object.values(targetsSettings.dailyWordHistory))

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div className="z-10 flex items-center justify-between border-b border-white/10 bg-transparent px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Targets Dashboard</h2>
        <Button type="button" variant="outline" size="sm" onClick={onResetSession}>
          Reset Session
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Session</p>
            <p className="mt-2 text-2xl font-semibold">{sessionWords.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">words written this session</p>
            <div className="mt-3 h-2 rounded bg-white/10">
              <div
                className="h-full rounded bg-emerald-500/80"
                style={{ width: `${progressPercentage(sessionWords, targetsSettings.sessionWordTarget)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Target {targetsSettings.sessionWordTarget.toLocaleString()} • Remaining {sessionRemaining.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pace {sessionPace.toFixed(1)} wpm • ETA {sessionEta !== null ? formatDuration(sessionEta) : "n/a"}
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Document</p>
            {selectedDocument ? (
              <>
                <p className="mt-2 text-sm font-semibold truncate">{selectedDocument.title}</p>
                <p className="mt-1 text-2xl font-semibold">{selectedDocument.words.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">words in selected document</p>
                <div className="mt-3 h-2 rounded bg-white/10">
                  <div
                    className="h-full rounded bg-sky-500/80"
                    style={{ width: `${progressPercentage(selectedDocument.words, selectedDocument.target)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Target {selectedDocument.target.toLocaleString()}</p>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No document selected.</p>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Project</p>
            <p className="mt-2 text-2xl font-semibold">{totalProjectWords.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">total manuscript words</p>
            <div className="mt-3 h-2 rounded bg-white/10">
              <div
                className="h-full rounded bg-violet-500/80"
                style={{ width: `${progressPercentage(totalProjectWords, targetsSettings.projectWordTarget)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Target {targetsSettings.projectWordTarget.toLocaleString()} • Remaining {projectRemaining.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Today {todayWords.toLocaleString()} • Streak {streak} days • Best day {bestDay.toLocaleString()}
            </p>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Target Settings</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Session Target</label>
              <Input
                type="number"
                min={100}
                max={500000}
                value={targetsSettings.sessionWordTarget}
                onChange={(event) =>
                  onTargetsSettingsChange({
                    sessionWordTarget: clamp(Number(event.target.value), 100, 500000),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Project Target</label>
              <Input
                type="number"
                min={1000}
                max={2000000}
                value={targetsSettings.projectWordTarget}
                onChange={(event) =>
                  onTargetsSettingsChange({
                    projectWordTarget: clamp(Number(event.target.value), 1000, 2000000),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Default Document Target</label>
              <Input
                type="number"
                min={100}
                max={500000}
                value={targetsSettings.defaultDocumentWordTarget}
                onChange={(event) =>
                  onTargetsSettingsChange({
                    defaultDocumentWordTarget: clamp(Number(event.target.value), 100, 500000),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Selected Document Target</label>
              <Input
                type="number"
                min={100}
                max={500000}
                value={selectedDocument?.target ?? targetsSettings.defaultDocumentWordTarget}
                disabled={!selectedDocument}
                onChange={(event) => {
                  if (!selectedDocument) return
                  onDocumentTargetChange(selectedDocument.id, clamp(Number(event.target.value), 100, 500000))
                }}
              />
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Documents</p>
          <div className="mt-3 space-y-2">
            {orderedDocuments.length === 0 && (
              <p className="text-xs text-muted-foreground">No documents available.</p>
            )}
            {orderedDocuments.map((document) => (
              <div key={document.id} className="rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm">{document.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {document.words.toLocaleString()} / {document.target.toLocaleString()}
                  </p>
                </div>
                <div className="mt-1 h-1.5 rounded bg-white/10">
                  <div
                    className="h-full rounded bg-cyan-500/75"
                    style={{ width: `${progressPercentage(document.words, document.target)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
