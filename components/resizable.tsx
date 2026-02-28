"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"

interface ResizableSidebarProps {
  children: React.ReactNode
  sidebarContent: React.ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  isCollapsed?: boolean
}

export function ResizableSidebar({
  children,
  sidebarContent,
  defaultWidth = 256,
  minWidth = 180,
  maxWidth = 500,
  isCollapsed = false,
}: ResizableSidebarProps) {
  const [sidebarWidth, setSidebarWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Handle resize logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      // Get the sidebar's position
      const sidebarRect = sidebarRef.current?.getBoundingClientRect()
      if (!sidebarRect) return

      // Calculate new width based on mouse position
      const newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX - sidebarRect.left))

      // Apply the new width
      setSidebarWidth(newWidth)

      // Prevent text selection during resize
      e.preventDefault()
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = "default"
      document.body.style.userSelect = "auto"
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "ew-resize"
      document.body.style.userSelect = "none"
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, minWidth, maxWidth])

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="relative flex min-h-0 flex-col overflow-hidden border-r border-white/10 transition-all duration-300 ease-in-out"
        style={{
          width: isCollapsed ? "0px" : `${sidebarWidth}px`,
          opacity: isCollapsed ? 0 : 1,
        }}
      >
        <div className="h-full w-full min-w-0 overflow-hidden">{sidebarContent}</div>

        {/* Resize handle */}
        {!isCollapsed && (
          <div
            className="absolute right-0 top-0 z-10 flex h-full w-2 cursor-ew-resize items-center justify-center"
            onMouseDown={() => setIsResizing(true)}
            style={{
              touchAction: "none",
            }}
          >
            <div
              className={`h-16 w-1 rounded-full bg-foreground/35 transition-opacity duration-300 ${
                isResizing ? "opacity-100" : "opacity-30 hover:opacity-100"
              }`}
            />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
