"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Sun, Moon, Palette, InfoIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { selectDirectory } from "@/lib/project-io"
import { loadPreferences, updatePreference } from "@/lib/user-preferences"
import { isTauri } from "@/lib/environment"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState("personalization")
  const [projectDirectory, setProjectDirectory] = useState<string>("")

  // Load saved project directory from preferences on component mount
  useEffect(() => {
    loadPreferences()
      .then((prefs) => {
        setProjectDirectory(prefs.projectDirectory || "")
      })
      .catch((error) => {
        console.error("Failed to load preferences:", error)
      })
  }, [])

  // Save project directory to preferences when it changes
  const handleDirectoryChange = async (value: string) => {
    setProjectDirectory(value)
    await updatePreference("projectDirectory", value)
  }

  // Update to use Tauri's dialog API
  const handleBrowseDirectory = async () => {
    if (isTauri) {
      try {
        // Use Tauri's dialog API to select a directory
        const selected = await window.__TAURI__.dialog.open({
          directory: true,
          multiple: false,
          defaultPath: projectDirectory || undefined,
        })

        if (selected) {
          await handleDirectoryChange(selected as string)
        }
      } catch (error) {
        console.error("Failed to select directory:", error)
      }
    } else {
      // Fallback to the existing implementation
      const directory = await selectDirectory(projectDirectory)
      if (directory) {
        await handleDirectoryChange(directory)
      }
    }
  }

  // Update theme handler to save to preferences
  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme)
    await updatePreference("theme", newTheme)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] dialog-animation">
        <DialogHeader>
          <DialogTitle>Ink & Quill Settings</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personalization">Personalization</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>
          <TabsContent value="personalization" className="mt-6 space-y-6 tab-content transition-all duration-300">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Theme</h3>
              <RadioGroup value={theme} onValueChange={handleThemeChange} className="grid grid-cols-2 gap-4">
                <div>
                  <RadioGroupItem value="light" id="theme-light" className="peer sr-only" />
                  <Label
                    htmlFor="theme-light"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-white p-4 hover:bg-gray-100 hover:text-gray-900 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <Sun className="mb-3 h-6 w-6" />
                    Light
                  </Label>
                </div>

                <div>
                  <RadioGroupItem value="dark" id="theme-dark" className="peer sr-only" />
                  <Label
                    htmlFor="theme-dark"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-gray-950 text-white p-4 hover:bg-gray-900 hover:text-white peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <Moon className="mb-3 h-6 w-6" />
                    Dark
                  </Label>
                </div>

                <div>
                  <RadioGroupItem value="muted-elegance" id="theme-muted-elegance" className="peer sr-only" />
                  <Label
                    htmlFor="theme-muted-elegance"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-[#565656] text-[#F0F0F0] p-4 hover:bg-[#666666] hover:text-[#F0F0F0] peer-data-[state=checked]:border-[#E3B5A4] [&:has([data-state=checked])]:border-[#E3B5A4]"
                  >
                    <Palette className="mb-3 h-6 w-6" />
                    Muted Elegance
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </TabsContent>
          <TabsContent value="storage" className="mt-6 space-y-6 tab-content transition-all duration-300">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Project Directory</h3>
              <p className="text-sm text-muted-foreground">Set your default directory for storing Quill projects.</p>

              <div className="flex items-center space-x-2">
                <Input
                  value={projectDirectory}
                  onChange={(e) => handleDirectoryChange(e.target.value)}
                  placeholder="C:\Users\Username\Documents\Quill Projects"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleBrowseDirectory}>
                  Browse
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="info" className="mt-6 space-y-6 tab-content transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <InfoIcon className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-medium">About Ink & Quill</h3>
              </div>

              <div className="bg-muted p-5 rounded-md">
                <p className="text-sm leading-relaxed italic">This app was made with care by Joshua Viars.</p>
                <p className="text-sm leading-relaxed mt-3">
                  I truly hope it proves useful to you and brings even a fraction of the joy I felt while creating it.
                  Though simple in design, it comes from a long-standing dream—I've always wanted to write, even if I've
                  never considered myself a writer. With any luck, this tool might help someone more gifted with words
                  than I am bring their own stories to life.
                </p>
                <div className="mt-4 text-right">
                  <p className="text-sm font-medium" style={{ fontFamily: "var(--font-dancing-script)" }}>
                    — Joshua Viars
                  </p>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <div className="text-center">
                  <h4 className="text-sm font-medium mb-1">Ink & Quill</h4>
                  <p className="text-xs text-muted-foreground">Version 1.0.0</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
