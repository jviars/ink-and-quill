"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useTheme } from "next-themes"

interface ResizableSidebarProps {
  children: React.ReactNode
  sidebarContent: React.ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
}

export function ResizableSidebar({
  children,
  sidebarContent,
  defaultWidth = 256,
  minWidth = 180,
  maxWidth = 500,
}: ResizableSidebarProps) {
  const [sidebarWidth, setSidebarWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

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

  // Get the appropriate border color based on theme
  const getBorderColor = () => {
    if (theme === "muted-elegance") {
      return "#666666"
    } else if (theme === "dark") {
      return "rgb(31 41 55)" // dark:border-gray-800
    } else {
      return "rgb(229 231 235)" // border-gray-200
    }
  }

  // Get the appropriate handle color based on theme
  const getHandleColor = () => {
    if (theme === "muted-elegance") {
      return "#E3B5A4"
    } else if (theme === "dark") {
      return "rgb(75 85 99)" // dark:bg-gray-600
    } else {
      return "rgb(209 213 219)" // bg-gray-300
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="flex flex-col border-r relative"
        style={{
          width: `${sidebarWidth}px`,
          borderColor: getBorderColor(),
        }}
      >
        {sidebarContent}

        {/* Resize handle */}
        <div
          className="absolute top-0 right-0 h-full w-2 cursor-ew-resize flex items-center justify-center hover:bg-opacity-20 z-10"
          onMouseDown={() => setIsResizing(true)}
          style={{
            touchAction: "none",
          }}
        >
          <div
            className={`h-16 w-1 rounded-full transition-opacity duration-300 ${isResizing ? "opacity-100" : "opacity-30 hover:opacity-100"}`}
            style={{
              backgroundColor: getHandleColor(),
            }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">{children}</div>
    </div>
  )
}
