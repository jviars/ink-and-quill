"use client"

import { useState, useEffect, useRef } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "next-themes"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Head from "next/head"

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
import FontSize from "tiptap-fontsize-extension" // Updated import
import Placeholder from "@tiptap/extension-placeholder"
import { WordCount, ListExtensions, TabIndent, PageBreak } from "./tiptap-extensions"

interface TiptapEditorProps {
  selectedNode: string
  initialContent?: string
  onContentChange?: (content: string) => void
}

// US Letter paper dimensions (in pixels at 96 DPI)
const PAPER_WIDTH = 816 // 8.5 inches * 96 DPI
const PAPER_HEIGHT = 1056 // 11 inches * 96 DPI
const PAPER_MARGIN = 72 // 0.75 inches * 96 DPI

// Default font size
const DEFAULT_FONT_SIZE = "16"

export function TiptapEditor({ selectedNode, initialContent, onContentChange }: TiptapEditorProps) {
  const [mounted, setMounted] = useState(false)
  const { theme } = useTheme()
  const [papers, setPapers] = useState<number[]>([0]) // Start with one paper
  const [contentHeight, setContentHeight] = useState(0)
  const [fontSize, setFontSize] = useState<string>(DEFAULT_FONT_SIZE)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const [showSaveNotification, setShowSaveNotification] = useState(false)

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
      FontSize, // The community extension has a different API
      WordCount,
      TabIndent,
      PageBreak,
      ...ListExtensions,
      // Add placeholder extension
      Placeholder.configure({
        placeholder: "Write something amazing here",
        emptyEditorClass: "is-editor-empty",
        emptyNodeClass: "is-node-empty",
      }),
    ],
    content: initialContent || "",
    onUpdate: ({ editor }) => {
      // Update content height and recalculate pages
      setTimeout(updatePagesBasedOnContent, 0)

      // Notify parent component of content change
      if (onContentChange && selectedNode) {
        const content = editor.getHTML()
        console.log(`Saving content for document: ${selectedNode}`)
        onContentChange(content)
      }
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none font-serif editor-content",
        style: `width: 100%; height: 100%; font-size: ${DEFAULT_FONT_SIZE}px;`, // Apply default font size here
      },
    },
  })

  // Update pages based on content height
  const updatePagesBasedOnContent = () => {
    if (!editorRef.current || !editor) return

    const contentHeight = editorRef.current.scrollHeight
    setContentHeight(contentHeight)

    // Calculate how many pages we need
    const contentAreaHeight = PAPER_HEIGHT - PAPER_MARGIN * 2 // Account for top and bottom margins
    const pagesNeeded = Math.max(1, Math.ceil(contentHeight / contentAreaHeight))

    // Update pages if needed
    if (pagesNeeded !== papers.length) {
      setPapers(Array.from({ length: pagesNeeded }, (_, i) => i))
    }
  }

  useEffect(() => {
    if (!editor) return

    // When selectedNode changes or initialContent changes
    if (initialContent) {
      console.log(`Loading content for document: ${selectedNode}`)

      // Only set content if it's different from current content
      const currentContent = editor.getHTML()

      // Use a more robust comparison to avoid unnecessary updates
      const normalizedCurrentContent = currentContent.replace(/\s+/g, " ").trim()
      const normalizedInitialContent = initialContent.replace(/\s+/g, " ").trim()

      if (normalizedCurrentContent !== normalizedInitialContent) {
        console.log("Content differs, updating editor")

        // Use setTimeout to avoid React update cycles
        setTimeout(() => {
          editor.commands.setContent(initialContent)

          // Update word count storage when content is loaded
          const wordCount = initialContent
            .replace(/<[^>]*>/g, " ")
            .split(/\s+/)
            .filter(Boolean).length
          editor.storage.wordCount.wordCount = wordCount

          // Check content height and update pages after content is loaded
          setTimeout(updatePagesBasedOnContent, 100)
        }, 0)
      }
    } else {
      // If no content is provided, set empty content to show placeholder
      console.log("No content provided, setting empty content to show placeholder")
      editor.commands.setContent("")

      // Apply default font size to empty content
      editor.chain().focus().setFontSize(DEFAULT_FONT_SIZE).run()
    }
  }, [selectedNode, initialContent, editor])

  // Add this new useEffect to ensure word count is updated even if content hasn't changed
  // Add this right after the previous useEffect:
  useEffect(() => {
    if (!editor || !initialContent) return

    // Force update the word count when a document is loaded, even if content hasn't changed
    const wordCount = initialContent
      .replace(/<[^>]*>/g, " ")
      .split(/\s+/)
      .filter(Boolean).length

    // Update the editor storage with the correct word count
    editor.storage.wordCount.wordCount = wordCount

    // Force a re-render to update the UI
    editor.view.dispatch(editor.state.tr)

    // Also update pages based on content
    setTimeout(updatePagesBasedOnContent, 100)
  }, [selectedNode, initialContent, editor])

  // Update pages when editor is mounted
  useEffect(() => {
    if (editor && mounted) {
      setTimeout(updatePagesBasedOnContent, 100)
    }
  }, [editor, mounted])

  // Update font size when selection changes
  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      // Get the font size of the current selection
      const attrs = editor.getAttributes("textStyle")
      if (attrs.fontSize) {
        // Remove 'px' from the fontSize value if it exists
        const size = attrs.fontSize.toString().replace("px", "")
        setFontSize(size)
      } else {
        // If no fontSize attribute is found, check if we're in a heading
        // and set an appropriate size based on heading level
        if (editor.isActive("heading", { level: 1 })) {
          setFontSize("24")
        } else if (editor.isActive("heading", { level: 2 })) {
          setFontSize("20")
        } else if (editor.isActive("heading", { level: 3 })) {
          setFontSize("18")
        } else {
          // Default size if nothing is selected or no size is applied
          setFontSize(DEFAULT_FONT_SIZE)
        }
      }
    }

    // Add event listener for selection changes
    editor.on("selectionUpdate", handleSelectionUpdate)
    // Also trigger when transaction is created (for when formatting is applied)
    editor.on("transaction", handleSelectionUpdate)

    // Initial check
    handleSelectionUpdate()

    return () => {
      // Remove event listeners when component unmounts
      editor.off("selectionUpdate", handleSelectionUpdate)
      editor.off("transaction", handleSelectionUpdate)
    }
  }, [editor])

  if (!mounted) {
    return null
  }

  const getEditorBackgroundClass = () => {
    if (theme === "muted-elegance") {
      return "bg-[#5D5D5D]" // Slightly darker than the UI background
    } else if (theme === "dark") {
      return "bg-gray-900" // Dark background for dark theme
    } else {
      return "bg-gray-100" // Light gray for light theme
    }
  }

  const getToolbarButtonClass = () => {
    if (theme === "muted-elegance") {
      return "text-[#F0F0F0] hover:bg-[#666666]"
    }
    return ""
  }

  // Updated to provide theme-specific paper and text colors
  const getPaperStyle = () => {
    if (theme === "muted-elegance") {
      return {
        backgroundColor: "#E8DCC9", // Darker parchment-like color
        color: "#2D2A24", // Slightly darker text for better contrast on parchment
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
      }
    } else if (theme === "dark") {
      return {
        backgroundColor: "#2A2A2A", // Dark gray paper that's not too harsh
        color: "#E0E0E0", // Light gray text for good contrast
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      }
    } else {
      // Light theme - keep white paper
      return {
        backgroundColor: "#FFFFFF",
        color: "#000000",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
      }
    }
  }

  const handleFontSizeChange = (size: string) => {
    setFontSize(size)
    editor?.chain().focus().setFontSize(size).run()
  }

  const handleSave = () => {
    // Show save notification
    setShowSaveNotification(true)
    setTimeout(() => setShowSaveNotification(false), 2000)
  }

  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className="flex flex-col h-full dark:bg-gray-950">
        <div className="border-b p-2 flex items-center dark:border-gray-800">
          <TooltipProvider>
            <div className="flex items-center space-x-1">
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
          <Separator orientation="vertical" className="mx-2 h-6" />
          <TooltipProvider>
            <div className="flex items-center space-x-1">
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
          <Separator orientation="vertical" className="mx-2 h-6" />
          <TooltipProvider>
            <div className="flex items-center space-x-1">
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
          <Separator orientation="vertical" className="mx-2 h-6" />
          <TooltipProvider>
            <div className="flex items-center space-x-1">
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
          <Separator orientation="vertical" className="mx-2 h-6" />
          <TooltipProvider>
            <div className="flex items-center space-x-1">
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
          <Separator orientation="vertical" className="mx-2 h-6" />
          <TooltipProvider>
            <div className="flex items-center space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${getToolbarButtonClass()} h-8 w-8`}
                    onClick={() => editor?.chain().focus().setPageBreak().run()}
                  >
                    <FileBreak className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert Page Break</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          <Separator orientation="vertical" className="mx-2 h-6" />
          <TooltipProvider>
            <div className="flex items-center space-x-1">
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
                  <div className="flex items-center">
                    <Type className="h-4 w-4 mr-1" />
                    <Select value={fontSize} onValueChange={handleFontSizeChange}>
                      <SelectTrigger className="w-16 h-8 border-none">
                        <SelectValue placeholder="Size" />
                      </SelectTrigger>
                      <SelectContent>
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
        <div className={`flex-1 overflow-auto overflow-x-hidden editor-scroll-container ${getEditorBackgroundClass()}`}>
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
        </div>
        <div className="border-t p-2 flex justify-between items-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          <div className="flex items-center space-x-3">
            <span>{editor?.storage.wordCount.wordCount || 0} words</span>
            <span className="text-muted-foreground">•</span>
            <span title="Based on standard manuscript format (275 words per page)">
              ~{Math.ceil((editor?.storage.wordCount.wordCount || 0) / 275)} pages
            </span>
          </div>
          {/* Removed keyboard shortcut indicators */}
        </div>
        {showSaveNotification && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg notification">
            Document saved successfully
          </div>
        )}
      </div>
    </>
  )
}
