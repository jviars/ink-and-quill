"use client"

import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core"
import BulletList from "@tiptap/extension-bullet-list"
import OrderedList from "@tiptap/extension-ordered-list"
import ListItem from "@tiptap/extension-list-item"

// Custom Tiptap extension for word count
export const WordCount = Extension.create({
  name: "wordCount",

  addStorage() {
    return {
      wordCount: 0,
    }
  },

  onUpdate() {
    const text = this.editor.getText()
    const words = text.trim().split(/\s+/).filter(Boolean)
    this.storage.wordCount = words.length
  },

  getWordCount() {
    return this.storage.wordCount
  },
})

export const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: { chain: any }) => {
          return chain().setMark("textStyle", { fontSize }).run()
        },
      unsetFontSize:
        () =>
        ({ chain }: { chain: any }) => {
          return chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run()
        },
    } as any
  },
})

export const TabIndent = Extension.create({
  name: "tabIndent",

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("listItem")) {
          const canSink = (this.editor.can() as any).sinkListItem?.("listItem") ?? false
          if (canSink) {
            return (this.editor.commands as any).sinkListItem("listItem")
          }
          return true
        }

        return this.editor.commands.insertContent("    ")
      },
      "Shift-Tab": () => {
        if (!this.editor.isActive("listItem")) {
          return false
        }

        const canLift = (this.editor.can() as any).liftListItem?.("listItem") ?? false
        if (canLift) {
          return (this.editor.commands as any).liftListItem("listItem")
        }
        return true
      },
      Backspace: () => {
        if (!this.editor.isActive("listItem")) return false

        const { state } = this.editor
        const { selection } = state
        if (!selection.empty) return false

        const atStartOfItem = selection.$from.parentOffset === 0
        if (!atStartOfItem) return false

        const currentText = selection.$from.parent.textContent.trim()
        if (currentText.length > 0) return false

        try {
          let listItemDepth = -1
          for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
            if (selection.$from.node(depth).type.name === "listItem") {
              listItemDepth = depth
              break
            }
          }

          if (listItemDepth > 0) {
            const listDepth = listItemDepth - 1
            const hasPreviousSiblingItem = selection.$from.index(listDepth) > 0
            if (hasPreviousSiblingItem) {
              // Defer to ProseMirror's native backspace join behavior for non-first list items.
              return false
            }
          }

          const canLift = (this.editor.can() as any).liftListItem?.("listItem") ?? false
          if (canLift) {
            return (this.editor.commands as any).liftListItem("listItem")
          }
          return this.editor.chain().focus().clearNodes().run()
        } catch (error) {
          console.error("List backspace recovery failed:", error)
          return false
        }
      },
    }
  },
})

// Export list extensions
export const ListExtensions = [BulletList, OrderedList, ListItem]

// Add the PageBreak extension definition after the existing extensions
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  parseHTML() {
    return [{ tag: "hr.page-break" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["hr", mergeAttributes(HTMLAttributes, { class: "page-break" })]
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({ type: this.name })
        },
    } as any
  },
})

export const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => {
          if (!attributes.commentId) return {}
          return { "data-comment-id": attributes.commentId }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "inline-comment-mark",
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setComment:
        (attributes: { commentId: string }) =>
        ({ commands }: { commands: any }) => {
          return commands.setMark(this.name, attributes)
        },
      unsetComment:
        () =>
        ({ commands }: { commands: any }) => {
          return commands.unsetMark(this.name)
        },
    } as any
  },
})

// Make sure to export the PageBreak extension at the end of the file
// Modify the existing exports or add this line if needed
