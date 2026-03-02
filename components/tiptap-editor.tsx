"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Type,
  FileQuestionIcon as FileBreak,
  Save,
  MessageSquarePlus,
  Search,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "next-themes"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Tiptap imports
import { useEditor, EditorContent } from "@tiptap/react"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import Bold from "@tiptap/extension-bold"
import Italic from "@tiptap/extension-italic"
import Underline from "@tiptap/extension-underline"
import History from "@tiptap/extension-history"
import Heading from "@tiptap/extension-heading"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import Placeholder from "@tiptap/extension-placeholder"
import { CommentMark, WordCount, ListExtensions, TabIndent, PageBreak, FontSize } from "./tiptap-extensions"
import { createCommentId, type EditorCommentDraft } from "@/lib/comment-utils"

interface TiptapEditorProps {
  selectedNode: string
  initialContent?: string
  fontSize?: string
  onContentChange?: (content: string) => void
  onFontSizeChange?: (fontSize: string) => void
  onCommentCreate?: (comment: EditorCommentDraft) => void
  compactMode?: boolean
}

// US Letter paper dimensions (in pixels at 96 DPI)
const PAPER_HEIGHT = 1056 // 11 inches * 96 DPI
const PAPER_MARGIN = 72 // 0.75 inches * 96 DPI

// Default font size
const DEFAULT_FONT_SIZE = "16"

const normalizeFontSizeValue = (value: unknown): string => {
  if (typeof value !== "string") return DEFAULT_FONT_SIZE
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_FONT_SIZE
  return String(Math.min(36, Math.max(10, parsed)))
}

const countWordsFromHtml = (html?: string): number => {
  if (!html) return 0
  return html
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length
}

const normalizeHtmlForSync = (html?: string): string => {
  return (html || "").replace(/\s+/g, " ").trim()
}

type SlashCommandId = "text" | "heading1" | "heading2" | "bulletList" | "orderedList" | "pageBreak"

interface SlashCommand {
  id: SlashCommandId
  label: string
  description: string
  aliases: string[]
  icon: typeof Type
}

interface SlashMenuState {
  query: string
  position: {
    top: number
    left: number
  }
  range: {
    from: number
    to: number
  }
}

interface FindMatch {
  from: number
  to: number
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "text",
    label: "Text",
    description: "Start a normal paragraph.",
    aliases: ["paragraph", "normal", "body", "p"],
    icon: Type,
  },
  {
    id: "heading1",
    label: "Heading 1",
    description: "Large chapter or section heading.",
    aliases: ["h1", "title", "chapter"],
    icon: Heading1,
  },
  {
    id: "heading2",
    label: "Heading 2",
    description: "Medium section heading.",
    aliases: ["h2", "subtitle", "section"],
    icon: Heading2,
  },
  {
    id: "bulletList",
    label: "Bullet List",
    description: "Create a bulleted list.",
    aliases: ["bullets", "unordered", "ul", "list"],
    icon: List,
  },
  {
    id: "orderedList",
    label: "Numbered List",
    description: "Create a numbered list.",
    aliases: ["numbered", "ordered", "ol", "list"],
    icon: ListOrdered,
  },
  {
    id: "pageBreak",
    label: "Page Break",
    description: "Insert a hard page break marker.",
    aliases: ["break", "page", "separator", "hr"],
    icon: FileBreak,
  },
]

export function TiptapEditor({
  selectedNode,
  initialContent,
  fontSize: controlledFontSize,
  onContentChange,
  onFontSizeChange,
  onCommentCreate,
  compactMode = false,
}: TiptapEditorProps) {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [papers, setPapers] = useState<number[]>([0]) // Start with one paper
  const [toolbarFontSize, setToolbarFontSize] = useState<string>(normalizeFontSizeValue(controlledFontSize))
  const [wordCountDisplay, setWordCountDisplay] = useState(0)
  const editorRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showSaveNotification, setShowSaveNotification] = useState(false)
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null)
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const [findBarOpen, setFindBarOpen] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findMatches, setFindMatches] = useState<FindMatch[]>([])
  const [activeFindMatchIndex, setActiveFindMatchIndex] = useState(0)
  const findInputRef = useRef<HTMLInputElement>(null)
  const shouldRefocusAfterFontChangeRef = useRef(false)
  const preferredTypingFontSizeRef = useRef<string>(normalizeFontSizeValue(controlledFontSize))
  const lastEditorSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const lastSyncedNodeRef = useRef<string>("")
  const lastEmittedContentRef = useRef("")

  useEffect(() => {
    setMounted(true)
  }, [])

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Underline,
      History,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      FontSize,
      WordCount,
      TabIndent,
      PageBreak,
      CommentMark,
      ...ListExtensions,
      // Add placeholder extension
      Placeholder.configure({
        placeholder: "Write something amazing here",
        emptyEditorClass: "is-editor-empty",
        emptyNodeClass: "is-node-empty",
        showOnlyCurrent: false,
      }),
    ],
    content: initialContent || "",
    onUpdate: ({ editor }) => {
      try {
        // Update content height and recalculate pages
        setTimeout(updatePagesBasedOnContent, 0)
        const content = editor.getHTML()
        lastEmittedContentRef.current = content
        setWordCountDisplay(countWordsFromHtml(content))

        // Notify parent component of content change
        if (onContentChange && selectedNode) {
          onContentChange(content)
        }
      } catch (error) {
        console.error("Editor update failed:", error)
      }
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none font-serif editor-content",
        style: "width: 100%; height: 100%;",
      },
    },
  })

  // Update pages based on content height
  const updatePagesBasedOnContent = useCallback(() => {
    if (!editorRef.current || !editor) return

    const contentHeight = editorRef.current.scrollHeight

    // Calculate how many pages we need
    const contentAreaHeight = PAPER_HEIGHT - PAPER_MARGIN * 2 // Account for top and bottom margins
    const pagesNeeded = Math.max(1, Math.ceil(contentHeight / contentAreaHeight))

    // Update pages if needed
    if (pagesNeeded !== papers.length) {
      setPapers(Array.from({ length: pagesNeeded }, (_, i) => i))
    }
  }, [editor, papers.length])

  useEffect(() => {
    if (!editor) return

    const incomingContent = typeof initialContent === "string" ? initialContent : ""
    const normalizedIncoming = normalizeHtmlForSync(incomingContent)
    const normalizedCurrent = normalizeHtmlForSync(editor.getHTML())
    const normalizedLastEmitted = normalizeHtmlForSync(lastEmittedContentRef.current)
    const isNodeSwitch = lastSyncedNodeRef.current !== selectedNode
    const isEchoFromLocalEdit = normalizedIncoming === normalizedLastEmitted
    const shouldApplyExternalContent =
      isNodeSwitch || (!isEchoFromLocalEdit && normalizedCurrent !== normalizedIncoming)

    if (shouldApplyExternalContent) {
      setTimeout(() => {
        try {
          ; (editor.commands as any).setContent(incomingContent, false)
        } catch (error) {
          console.error("Failed to sync editor content from state:", error)
        }
        setTimeout(updatePagesBasedOnContent, 100)
      }, 0)
    } else {
      setTimeout(updatePagesBasedOnContent, 100)
    }

    const nextWordCount = countWordsFromHtml(incomingContent)
    setWordCountDisplay(nextWordCount)
    editor.storage.wordCount.wordCount = nextWordCount
    lastSyncedNodeRef.current = selectedNode
  }, [selectedNode, initialContent, editor, updatePagesBasedOnContent])

  // Update pages when editor is mounted
  useEffect(() => {
    if (editor && mounted) {
      setTimeout(updatePagesBasedOnContent, 100)
    }
  }, [editor, mounted, updatePagesBasedOnContent])

  useEffect(() => {
    const normalized = normalizeFontSizeValue(controlledFontSize)
    preferredTypingFontSizeRef.current = normalized
    setToolbarFontSize((previous) => (previous === normalized ? previous : normalized))
  }, [controlledFontSize])

  useEffect(() => {
    if (!editor) return

    const syncFontSizeFromSelection = () => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        lastEditorSelectionRef.current = { from, to }
      }

      const textStyleAttributes = editor.getAttributes("textStyle") as { fontSize?: string }
      if (typeof textStyleAttributes.fontSize === "string" && textStyleAttributes.fontSize.trim()) {
        const normalized = normalizeFontSizeValue(textStyleAttributes.fontSize.replace("px", ""))
        preferredTypingFontSizeRef.current = normalized
        setToolbarFontSize((previous) => (previous === normalized ? previous : normalized))
        return
      }

      if (editor.isActive("heading", { level: 1 })) {
        setToolbarFontSize("24")
      } else if (editor.isActive("heading", { level: 2 })) {
        setToolbarFontSize("20")
      } else if (editor.isActive("heading", { level: 3 })) {
        setToolbarFontSize("18")
      } else {
        const fallback = normalizeFontSizeValue(controlledFontSize)
        setToolbarFontSize((previous) => (previous === fallback ? previous : fallback))
      }
    }

    editor.on("selectionUpdate", syncFontSizeFromSelection)
    editor.on("transaction", syncFontSizeFromSelection)
    syncFontSizeFromSelection()

    return () => {
      editor.off("selectionUpdate", syncFontSizeFromSelection)
      editor.off("transaction", syncFontSizeFromSelection)
    }
  }, [editor, controlledFontSize])

  const applyStoredTypingFontSize = useCallback(
    (fontSizePx: string) => {
      if (!editor) return
      const textStyleMark = editor.state.schema.marks.textStyle
      if (!textStyleMark) return

      const existingMarks = editor.state.storedMarks ?? editor.state.selection.$from.marks()
      const nextMarks = [
        ...existingMarks.filter((mark) => mark.type !== textStyleMark),
        textStyleMark.create({ fontSize: fontSizePx }),
      ]
      editor.view.dispatch(editor.state.tr.setStoredMarks(nextMarks))
    },
    [editor],
  )

  const captureCurrentSelection = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    lastEditorSelectionRef.current = { from, to }
  }, [editor])

  const refocusEditorForTyping = useCallback((preserveTypingStyle = false) => {
    if (!editor) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          editor.chain().focus().run()
          if (preserveTypingStyle) {
            applyStoredTypingFontSize(`${preferredTypingFontSizeRef.current}px`)
          }
        } catch (error) {
          console.error("Failed to restore editor focus:", error)
        }
      })
    })
  }, [editor, applyStoredTypingFontSize])

  const closeSlashMenu = useCallback(() => {
    setSlashMenu(null)
    setSlashSelectedIndex(0)
  }, [])

  const updateSlashMenu = useCallback(() => {
    if (!editor) return

    const { selection } = editor.state

    if (!selection.empty) {
      setSlashMenu((prev) => (prev ? null : prev))
      return
    }

    const { $from } = selection
    const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc")
    const slashIndex = textBeforeCursor.lastIndexOf("/")

    if (slashIndex === -1) {
      setSlashMenu((prev) => (prev ? null : prev))
      return
    }

    const beforeSlash = textBeforeCursor.slice(0, slashIndex)
    if (beforeSlash.length > 0 && !/\s$/.test(beforeSlash)) {
      setSlashMenu((prev) => (prev ? null : prev))
      return
    }

    const query = textBeforeCursor.slice(slashIndex + 1)
    if (query.length > 0) {
      setSlashMenu((prev) => (prev ? null : prev))
      return
    }
    if (!/^[a-zA-Z0-9-]*$/.test(query)) {
      setSlashMenu((prev) => (prev ? null : prev))
      return
    }

    const rangeFrom = selection.from - (textBeforeCursor.length - slashIndex)
    const anchorPos = Math.min(rangeFrom + 1, selection.from)
    const coords = editor.view.coordsAtPos(anchorPos)
    const containerRect = scrollContainerRef.current?.getBoundingClientRect()
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0
    const scrollLeft = scrollContainerRef.current?.scrollLeft ?? 0

    const nextMenuState: SlashMenuState = {
      query: query.toLowerCase(),
      position: {
        top: containerRect ? coords.bottom - containerRect.top + scrollTop + 8 : coords.bottom + scrollTop + 8,
        left: containerRect ? coords.left - containerRect.left + scrollLeft : coords.left + scrollLeft,
      },
      range: {
        from: rangeFrom,
        to: selection.from,
      },
    }

    setSlashMenu((prev) => {
      if (
        prev &&
        prev.query === nextMenuState.query &&
        prev.range.from === nextMenuState.range.from &&
        prev.range.to === nextMenuState.range.to &&
        prev.position.top === nextMenuState.position.top &&
        prev.position.left === nextMenuState.position.left
      ) {
        return prev
      }
      return nextMenuState
    })
  }, [editor])

  const filteredSlashCommands = useMemo(() => {
    return SLASH_COMMANDS
  }, [])

  const executeSlashCommand = useCallback(
    (commandId: SlashCommandId) => {
      if (!editor || !slashMenu) return

      editor.chain().focus().deleteRange(slashMenu.range).run()
      let shouldRestoreTypingSize = false

      switch (commandId) {
        case "text":
          editor.chain().focus().setParagraph().run()
          shouldRestoreTypingSize = true
          break
        case "heading1":
          editor.chain().focus().setHeading({ level: 1 }).run()
          break
        case "heading2":
          editor.chain().focus().setHeading({ level: 2 }).run()
          break
        case "bulletList":
          editor.chain().focus().toggleBulletList().run()
          shouldRestoreTypingSize = true
          break
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run()
          shouldRestoreTypingSize = true
          break
        case "pageBreak":
          ; (editor.chain().focus() as any).setPageBreak().run()
          shouldRestoreTypingSize = true
          break
      }

      if (shouldRestoreTypingSize) {
        applyStoredTypingFontSize(`${preferredTypingFontSizeRef.current}px`)
      }

      closeSlashMenu()
      setTimeout(updatePagesBasedOnContent, 0)
    },
    [editor, slashMenu, closeSlashMenu, updatePagesBasedOnContent, applyStoredTypingFontSize],
  )

  useEffect(() => {
    if (!editor) return

    const syncSlashMenu = () => updateSlashMenu()
    const handleBlur = () => setTimeout(closeSlashMenu, 80)

    editor.on("selectionUpdate", syncSlashMenu)
    editor.on("transaction", syncSlashMenu)
    editor.on("blur", handleBlur)

    const syncOnViewportChange = () => {
      if (slashMenu) updateSlashMenu()
    }

    window.addEventListener("resize", syncOnViewportChange)
    window.addEventListener("scroll", syncOnViewportChange, true)

    return () => {
      editor.off("selectionUpdate", syncSlashMenu)
      editor.off("transaction", syncSlashMenu)
      editor.off("blur", handleBlur)
      window.removeEventListener("resize", syncOnViewportChange)
      window.removeEventListener("scroll", syncOnViewportChange, true)
    }
  }, [editor, slashMenu, updateSlashMenu, closeSlashMenu])

  useEffect(() => {
    if (!slashMenu || !editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setSlashSelectedIndex((current) => (current + 1) % Math.max(filteredSlashCommands.length, 1))
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        setSlashSelectedIndex((current) => (current - 1 + Math.max(filteredSlashCommands.length, 1)) % Math.max(filteredSlashCommands.length, 1))
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        closeSlashMenu()
        return
      }

      if (event.key === "Enter" || event.key === "Tab") {
        const selected = filteredSlashCommands[slashSelectedIndex]
        if (!selected) return
        event.preventDefault()
        executeSlashCommand(selected.id)
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [slashMenu, slashSelectedIndex, filteredSlashCommands, editor, executeSlashCommand, closeSlashMenu])

  useEffect(() => {
    if (slashSelectedIndex >= filteredSlashCommands.length) {
      setSlashSelectedIndex(0)
    }
  }, [slashSelectedIndex, filteredSlashCommands.length])

  const collectFindMatches = useCallback(
    (query: string): FindMatch[] => {
      if (!editor) return []

      const normalizedQuery = query.trim().toLowerCase()
      if (!normalizedQuery) return []

      const matches: FindMatch[] = []

      editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return true

        const lowerText = node.text.toLowerCase()
        let searchIndex = 0

        while (searchIndex <= lowerText.length - normalizedQuery.length) {
          const foundAt = lowerText.indexOf(normalizedQuery, searchIndex)
          if (foundAt === -1) break

          const from = pos + foundAt
          matches.push({
            from,
            to: from + normalizedQuery.length,
          })

          searchIndex = foundAt + Math.max(normalizedQuery.length, 1)
        }

        return true
      })

      return matches
    },
    [editor],
  )

  const scrollMatchIntoView = useCallback(
    (from: number) => {
      if (!editor || !scrollContainerRef.current) return

      try {
        const coords = editor.view.coordsAtPos(from)
        const container = scrollContainerRef.current
        const containerRect = container.getBoundingClientRect()
        const offsetTop = coords.top - containerRect.top + container.scrollTop
        const targetTop = Math.max(0, offsetTop - container.clientHeight / 2)
        container.scrollTo({ top: targetTop, behavior: "smooth" })
      } catch {
        // Ignore invalid positions that can happen during rapid document updates.
      }
    },
    [editor],
  )

  const goToFindMatch = useCallback(
    (targetIndex: number) => {
      if (!editor || findMatches.length === 0) return

      const nextIndex = ((targetIndex % findMatches.length) + findMatches.length) % findMatches.length
      const match = findMatches[nextIndex]
      editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run()
      scrollMatchIntoView(match.from)
      setActiveFindMatchIndex(nextIndex)
    },
    [editor, findMatches, scrollMatchIntoView],
  )

  useEffect(() => {
    if (!editor) return

    const normalizedQuery = findQuery.trim()
    if (!normalizedQuery) {
      setFindMatches([])
      setActiveFindMatchIndex(0)
      return
    }

    const nextMatches = collectFindMatches(normalizedQuery)
    setFindMatches(nextMatches)

    if (nextMatches.length === 0) {
      setActiveFindMatchIndex(0)
      return
    }

    const selectionFrom = editor.state.selection.from
    const selectedMatchIndex = nextMatches.findIndex((match) => selectionFrom >= match.from && selectionFrom <= match.to)
    const initialIndex = selectedMatchIndex >= 0 ? selectedMatchIndex : 0

    editor
      .chain()
      .focus()
      .setTextSelection({
        from: nextMatches[initialIndex].from,
        to: nextMatches[initialIndex].to,
      })
      .scrollIntoView()
      .run()
    scrollMatchIntoView(nextMatches[initialIndex].from)
    setActiveFindMatchIndex(initialIndex)
  }, [editor, findQuery, collectFindMatches, scrollMatchIntoView])

  useEffect(() => {
    if (!editor || !findBarOpen || !findQuery.trim()) return

    const refreshMatchesOnEdit = () => {
      const nextMatches = collectFindMatches(findQuery)
      setFindMatches(nextMatches)
      setActiveFindMatchIndex((currentIndex) => {
        if (nextMatches.length === 0) return 0
        return Math.min(currentIndex, nextMatches.length - 1)
      })
    }

    editor.on("transaction", refreshMatchesOnEdit)
    return () => {
      editor.off("transaction", refreshMatchesOnEdit)
    }
  }, [editor, findBarOpen, findQuery, collectFindMatches])

  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const isFindShortcut = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "f"
      if (isFindShortcut) {
        event.preventDefault()
        event.stopPropagation()
        closeSlashMenu()
        setFindBarOpen(true)

        const selectedText = editor.state.doc
          .textBetween(editor.state.selection.from, editor.state.selection.to, " ", " ")
          .trim()
        if (selectedText) {
          setFindQuery(selectedText)
        }

        requestAnimationFrame(() => {
          findInputRef.current?.focus()
          findInputRef.current?.select()
        })
        return
      }

      if (!findBarOpen) return

      if (event.key === "Escape") {
        event.preventDefault()
        setFindBarOpen(false)
        editor.chain().focus().run()
        return
      }

      if (event.key === "Enter") {
        event.preventDefault()
        if (event.shiftKey) {
          goToFindMatch(activeFindMatchIndex - 1)
        } else {
          goToFindMatch(activeFindMatchIndex + 1)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [editor, closeSlashMenu, findBarOpen, activeFindMatchIndex, goToFindMatch])

  if (!mounted) {
    return null
  }

  const getEditorBackgroundClass = () => {
    if (isDark) {
      return "bg-slate-950/35"
    } else {
      return "bg-slate-100/30"
    }
  }

  const getToolbarButtonClass = () => {
    if (isDark) {
      return "soft-hover-box text-slate-100"
    }
    return "soft-hover-box text-foreground"
  }

  // Updated to provide theme-specific paper, text colors, and floating aesthetics
  const getPaperStyle = () => {
    if (isDark) {
      return {
        // Further dimmed manuscript paper in dark mode for night reading comfort.
        backgroundColor: "#D9D3C5",
        color: "#1F2124",
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2)",
        borderRadius: "16px",
      }
    } else {
      return {
        backgroundColor: "#FFFFFF",
        color: "#333333",
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03)",
        borderRadius: "16px",
      }
    }
  }

  const handleFontSizeChange = (size: string) => {
    const normalized = normalizeFontSizeValue(size)
    preferredTypingFontSizeRef.current = normalized
    setToolbarFontSize(normalized)
    shouldRefocusAfterFontChangeRef.current = true

    onFontSizeChange?.(normalized)
    if (!editor) return

    try {
      const savedSelection = lastEditorSelectionRef.current
      if (savedSelection) {
        ; (editor.chain().focus().setTextSelection(savedSelection) as any).setFontSize(`${normalized}px`).run()
      } else {
        ; (editor.chain().focus() as any).setFontSize(`${normalized}px`).run()
      }

      // Keep the selected size as the active typing style for subsequent input.
      applyStoredTypingFontSize(`${normalized}px`)

      setTimeout(updatePagesBasedOnContent, 0)
    } catch (error) {
      console.error("Failed to apply font size command:", error)
    }
  }

  const handleSave = () => {
    // Show save notification
    setShowSaveNotification(true)
    setTimeout(() => setShowSaveNotification(false), 2000)
  }

  const handleAddComment = () => {
    if (!editor || !selectedNode || !onCommentCreate) return

    const currentSelection = editor.state.selection
    const savedSelection = lastEditorSelectionRef.current
    const commentSelection =
      !currentSelection.empty
        ? { from: currentSelection.from, to: currentSelection.to }
        : savedSelection && savedSelection.from !== savedSelection.to
          ? savedSelection
          : null
    if (!commentSelection) return

    const selectionText = editor.state.doc.textBetween(
      commentSelection.from,
      commentSelection.to,
      " ",
      " ",
    )
    const note = window.prompt("Add a comment")
    if (note === null) return

    const trimmedNote = note.trim()
    if (!trimmedNote) return

    const commentId = createCommentId()
    ;(editor.chain().focus().setTextSelection(commentSelection) as any).setComment({ commentId }).run()
    lastEditorSelectionRef.current = commentSelection
    onCommentCreate({
      id: commentId,
      text: trimmedNote,
      quote: selectionText.trim() || undefined,
    })
  }

  return (
    <>
      <div className={`${compactMode ? "flex min-h-[380px] flex-col pane-surface" : "flex h-full min-h-0 flex-col pane-surface"}`}>
        {!compactMode && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-transparent p-2">
          <TooltipProvider>
            <div className="flex items-center space-x-1 glass-toolbar-group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8`}
                    onClick={() => editor?.chain().focus().undo().run()}
                    disabled={!editor?.can().undo()}
                  >
                    <Undo className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8`}
                    onClick={() => editor?.chain().focus().redo().run()}
                    disabled={!editor?.can().redo()}
                  >
                    <Redo className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          <TooltipProvider>
            <div className="flex items-center space-x-1 glass-toolbar-group">
              {onCommentCreate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`${getToolbarButtonClass()} h-8 w-8`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={handleAddComment}
                      disabled={!editor || !selectedNode || !onCommentCreate}
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add Comment</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8 transition-colors duration-200 ${editor?.isActive("bold") ? "bg-secondary" : ""}`}
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                  >
                    <BoldIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bold</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8 ${editor?.isActive("italic") ? "bg-secondary" : ""}`}
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                  >
                    <ItalicIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Italic</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8 ${editor?.isActive("underline") ? "bg-secondary" : ""}`}
                    onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  >
                    <UnderlineIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Underline</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          <TooltipProvider>
            <div className="flex items-center space-x-1 glass-toolbar-group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8 ${editor?.isActive({ textAlign: "left" }) ? "bg-secondary" : ""}`}
                    onClick={() => editor?.chain().focus().setTextAlign("left").run()}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Align Left</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8 ${editor?.isActive({ textAlign: "center" }) ? "bg-secondary" : ""}`}
                    onClick={() => editor?.chain().focus().setTextAlign("center").run()}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Align Center</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8 ${editor?.isActive({ textAlign: "right" }) ? "bg-secondary" : ""}`}
                    onClick={() => editor?.chain().focus().setTextAlign("right").run()}
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Align Right</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          <TooltipProvider>
            <div className="flex items-center space-x-1 glass-toolbar-group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8 ${editor?.isActive("bulletList") ? "bg-secondary" : ""}`}
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bullet List</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8 ${editor?.isActive("orderedList") ? "bg-secondary" : ""}`}
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Numbered List</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          <TooltipProvider>
            <div className="flex items-center space-x-1 glass-toolbar-group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8 ${editor?.isActive("heading", { level: 1 }) ? "bg-secondary" : ""}`}
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                  >
                    <Heading1 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Heading 1</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8 ${editor?.isActive("heading", { level: 2 }) ? "bg-secondary" : ""}`}
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  >
                    <Heading2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Heading 2</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          <TooltipProvider>
            <div className="flex items-center space-x-1 glass-toolbar-group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8`}
                    onClick={() => (editor?.chain().focus() as any).setPageBreak().run()}
                  >
                    <FileBreak className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert Page Break</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          <TooltipProvider>
            <div className="flex items-center space-x-1 glass-toolbar-group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8`}
                    onClick={handleSave}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="soft-hover-box flex items-center rounded-md px-1">
                    <Type className="h-4 w-4 mr-1" />
                    <Select
                      value={toolbarFontSize}
                      onValueChange={handleFontSizeChange}
                      onOpenChange={(open) => {
                        if (open) {
                          captureCurrentSelection()
                          return
                        }
                        if (!shouldRefocusAfterFontChangeRef.current) return
                        shouldRefocusAfterFontChangeRef.current = false
                        refocusEditorForTyping(true)
                      }}
                    >
                      <SelectTrigger className="soft-hover-box h-8 w-16 border-none bg-transparent px-2 shadow-none focus:ring-0 focus:ring-offset-0">
                        <SelectValue placeholder="Size" />
                      </SelectTrigger>
                      <SelectContent
                        onCloseAutoFocus={(event) => {
                          if (!shouldRefocusAfterFontChangeRef.current) return
                          event.preventDefault()
                        }}
                      >
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="14">14</SelectItem>
                        <SelectItem value="16">16</SelectItem>
                        <SelectItem value="18">18</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="24">24</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="36">36</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Font Size</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          </div>
        )}
        {compactMode && onCommentCreate && (
          <div className="flex items-center justify-end border-b border-white/10 bg-transparent p-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleAddComment}
                    disabled={!editor || !selectedNode || !onCommentCreate}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Comment</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        <div
          ref={scrollContainerRef}
          className={`editor-scroll-container relative ${compactMode ? "min-h-[320px] overflow-auto" : "flex-1 min-h-0 overflow-auto"} overflow-x-hidden ${getEditorBackgroundClass()}`}
        >
          {findBarOpen && (
            <div
              className={`absolute right-4 top-4 z-[80] flex w-[min(420px,calc(100%-2rem))] items-center gap-2 rounded-lg border px-2 py-2 shadow-lg backdrop-blur ${isDark ? "border-white/20 bg-slate-900/90" : "border-slate-200 bg-white/95"
                }`}
            >
              <Search className={`h-4 w-4 shrink-0 ${isDark ? "text-slate-300" : "text-slate-500"}`} />
              <Input
                ref={findInputRef}
                value={findQuery}
                onChange={(event) => setFindQuery(event.target.value)}
                placeholder="Find in document"
                aria-label="Find in document"
                className={`h-8 border-none bg-transparent px-1 py-0 text-sm focus-visible:ring-0 ${isDark ? "text-slate-100 placeholder:text-slate-400" : "text-slate-900 placeholder:text-slate-500"
                  }`}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    if (event.shiftKey) {
                      goToFindMatch(activeFindMatchIndex - 1)
                    } else {
                      goToFindMatch(activeFindMatchIndex + 1)
                    }
                  }
                }}
              />
              <span className={`min-w-[52px] text-right text-xs ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                {findMatches.length === 0 ? "0/0" : `${activeFindMatchIndex + 1}/${findMatches.length}`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => goToFindMatch(activeFindMatchIndex - 1)}
                disabled={findMatches.length === 0}
                aria-label="Previous match"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => goToFindMatch(activeFindMatchIndex + 1)}
                disabled={findMatches.length === 0}
                aria-label="Next match"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  setFindBarOpen(false)
                  editor?.chain().focus().run()
                }}
                aria-label="Close find bar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div
            className="editor-wrapper mx-auto my-4 paper-animation"
            style={{
              backgroundColor: getPaperStyle().backgroundColor,
              color: getPaperStyle().color,
              boxShadow: getPaperStyle().boxShadow,
            }}
          >
            <EditorContent editor={editor} className="editor" />
          </div>
          {slashMenu && (
            <div
              className={`absolute z-[70] w-[320px] overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl ${isDark
                ? "border-white/20 bg-slate-900/90 text-slate-100"
                : "border-slate-300/90 bg-white/95 text-slate-900"
                }`}
              style={{
                top: slashMenu.position.top,
                left: slashMenu.position.left,
              }}
            >
              <div
                className={`border-b px-3 py-2 text-xs uppercase tracking-[0.2em] ${isDark ? "border-white/10 text-slate-300" : "border-slate-200 text-slate-500"}`}
              >
                Commands
              </div>
              {filteredSlashCommands.length > 0 ? (
                <div className="max-h-72 overflow-auto p-1.5">
                  {filteredSlashCommands.map((command, index) => {
                    const Icon = command.icon
                    const isSelected = index === slashSelectedIndex
                    return (
                      <button
                        key={command.id}
                        type="button"
                        className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${isSelected
                          ? isDark
                            ? "bg-white/10"
                            : "bg-slate-100"
                          : isDark
                            ? "hover:bg-white/5"
                            : "hover:bg-slate-50"
                          }`}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          executeSlashCommand(command.id)
                        }}
                      >
                        <span
                          className={`mt-0.5 rounded-md p-1 ${isDark ? "bg-white/10 text-slate-100" : "bg-slate-100 text-slate-700"}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-tight">{command.label}</span>
                          <span className={`mt-0.5 block text-xs ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                            {command.description}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className={`p-3 text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>No matching commands.</div>
              )}
            </div>
          )}
        </div>
        {!compactMode && (
          <div className="flex items-center justify-between border-t border-white/10 p-2 text-sm text-muted-foreground">
            <div className="flex items-center space-x-3">
              <span>{wordCountDisplay} words</span>
              <span className="text-muted-foreground">•</span>
              <span title="Based on standard manuscript format (275 words per page)">
                ~{Math.ceil(wordCountDisplay / 275)} pages
              </span>
            </div>
            {/* Removed keyboard shortcut indicators */}
          </div>
        )}
        {showSaveNotification && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg notification">
            Document saved successfully
          </div>
        )}
      </div>
    </>
  )
}
