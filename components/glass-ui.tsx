"use client"

import type React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function GlassPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-panel", className)} {...props} />
}

export function GlassToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-toolbar", className)} {...props} />
}

export function GlassToolbarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-toolbar-group", className)} {...props} />
}

interface GlassIconButtonProps extends ButtonProps {
  active?: boolean
}

export function GlassIconButton({ className, active = false, ...props }: GlassIconButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("glass-icon-button soft-hover-box", active && "glass-icon-button-active", className)}
      {...props}
    />
  )
}

export function GlassSegmented({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-segmented", className)} {...props} />
}
