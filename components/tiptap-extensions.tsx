"use client"

import { Extension, Node, mergeAttributes } from "@tiptap/core"
import BulletList from "@tiptap/extension-bullet-list"
import OrderedList from "@tiptap/extension-ordered-list"
import ListItem from "@tiptap/extension-list-item"
import { Plugin, PluginKey } from "@tiptap/pm/state"

// Custom Tiptap extension for word count
export const WordCount = Extension.create({
  name: "wordCount",

  addStorage() {
    return {
      wordCount: 0,
    }
  },

  onUpdate({ editor }) {
    const text = editor.getText()
    const words = text.trim().split(/\s+/).filter(Boolean)
    this.storage.wordCount = words.length
  },

  getWordCount() {
    return this.storage.wordCount
  },
})

// Add animation to the TabIndent extension
export const TabIndent = Extension.create({
  name: "tabIndent",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("tabIndent"),
        props: {
          handleKeyDown: (view, event) => {
            // Check if the tab key was pressed
            if (event.key === "Tab") {
              // Prevent default tab behavior
              event.preventDefault()

              // Get the current selection
              const { selection } = view.state
              const { from, to } = selection

              // Check if we're at the start of a paragraph
              const isAtStart = from === selection.$from.start()

              if (isAtStart) {
                // If at the start of a paragraph, add an indent with animation class
                const tr = view.state.tr.insertText("\t")
                view.dispatch(tr)

                // Add animation class to the paragraph (handled by CSS)
                const paragraph = view.dom.querySelector("p:has(.ProseMirror-trm)")
                if (paragraph) {
                  paragraph.classList.add("animate-indent")
                  setTimeout(() => {
                    paragraph.classList.remove("animate-indent")
                  }, 300)
                }

                return true
              } else {
                // If not at the start, insert a tab character
                const tr = view.state.tr.insertText("\t")
                view.dispatch(tr)
                return true
              }
            }
            return false
          },
        },
      }),
    ]
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
        ({ commands }) => {
          return commands.insertContent({ type: this.name })
        },
    }
  },
})

// Make sure to export the PageBreak extension at the end of the file
// Modify the existing exports or add this line if needed
