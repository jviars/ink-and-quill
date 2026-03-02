"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Sun, Moon, Monitor, InfoIcon, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { selectDirectory } from "@/lib/project-io"
import { loadPreferences, normalizeTheme, type AppTheme, updatePreference } from "@/lib/user-preferences"
import { isTauri } from "@/lib/environment"
import {
  SECTION_TYPE_LABELS,
  SECTION_TYPE_VALUES,
  getDefaultCompilePresets,
  getDefaultMetadataTemplates,
  type CompileOutputFormat,
  type CompilePreset,
  type MetadataFieldDefinition,
  type MetadataFieldType,
  type MetadataValue,
  type MetadataTemplate,
  type ProjectSettings,
  type SectionType,
} from "@/lib/project-types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectSettings: ProjectSettings
  onProjectSettingsChange: (settings: ProjectSettings) => void
}

const CORE_METADATA_FIELDS = new Set(["status", "label", "keywords"])
const METADATA_FIELD_TYPES: MetadataFieldType[] = ["text", "long-text", "number", "date", "select", "multi-select", "boolean"]
const COMPILE_OUTPUT_FORMATS: CompileOutputFormat[] = ["docx", "markdown", "html", "txt"]

const toSlug = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const parseOptions = (value: string): string[] => {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const stringifyFieldValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(", ")
  if (value === null || value === undefined) return ""
  return String(value)
}

export function SettingsDialog({ open, onOpenChange, projectSettings, onProjectSettingsChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState("personalization")
  const [projectDirectory, setProjectDirectory] = useState<string>("")
  const [localSettings, setLocalSettings] = useState<ProjectSettings>(projectSettings)
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldId, setNewFieldId] = useState("")
  const [newFieldType, setNewFieldType] = useState<MetadataFieldType>("text")
  const [newFieldOptions, setNewFieldOptions] = useState("")

  useEffect(() => {
    loadPreferences()
      .then((prefs) => {
        setProjectDirectory(prefs.projectDirectory || "")
      })
      .catch((error) => {
        console.error("Failed to load preferences:", error)
      })
  }, [])

  useEffect(() => {
    setLocalSettings(projectSettings)
  }, [projectSettings, open])

  const commitProjectSettings = (next: ProjectSettings) => {
    setLocalSettings(next)
    onProjectSettingsChange(next)
  }

  const handleDirectoryChange = async (value: string) => {
    setProjectDirectory(value)
    await updatePreference("projectDirectory", value)
  }

  const handleBrowseDirectory = async () => {
    if (isTauri) {
      try {
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
      const directory = await selectDirectory(projectDirectory)
      if (directory) {
        await handleDirectoryChange(directory)
      }
    }
  }

  const handleThemeChange = async (newTheme: AppTheme) => {
    setTheme(newTheme)
    await updatePreference("theme", newTheme)
  }

  const handleMetadataFieldUpdate = (fieldId: string, patch: Partial<MetadataFieldDefinition>) => {
    const nextFields = localSettings.metadataFields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
    const nextSettings = {
      ...localSettings,
      metadataFields: nextFields,
    }
    commitProjectSettings(nextSettings)
  }

  const handleMetadataFieldDelete = (fieldId: string) => {
    if (CORE_METADATA_FIELDS.has(fieldId)) return

    const nextTemplates = localSettings.metadataTemplates.map((template) => {
      const { [fieldId]: _removed, ...rest } = template.fieldDefaults
      return {
        ...template,
        fieldDefaults: rest,
      }
    })

    const nextSettings = {
      ...localSettings,
      metadataFields: localSettings.metadataFields.filter((field) => field.id !== fieldId),
      metadataTemplates: nextTemplates,
    }
    commitProjectSettings(nextSettings)
  }

  const handleAddMetadataField = () => {
    const normalizedName = newFieldName.trim()
    if (!normalizedName) return
    const candidateId = newFieldId.trim() || toSlug(normalizedName)
    if (!candidateId) return

    if (localSettings.metadataFields.some((field) => field.id === candidateId)) return

    const defaultValue =
      newFieldType === "boolean"
        ? false
        : newFieldType === "number"
          ? 0
          : newFieldType === "multi-select"
            ? []
            : ""

    const nextField: MetadataFieldDefinition = {
      id: candidateId,
      name: normalizedName,
      type: newFieldType,
      options: newFieldType === "select" || newFieldType === "multi-select" ? parseOptions(newFieldOptions) : undefined,
      defaultValue,
    }

    const nextTemplates = localSettings.metadataTemplates.map((template) => ({
      ...template,
      fieldDefaults: {
        ...template.fieldDefaults,
        [candidateId]: defaultValue,
      },
    }))

    commitProjectSettings({
      ...localSettings,
      metadataFields: [...localSettings.metadataFields, nextField],
      metadataTemplates: nextTemplates,
    })

    setNewFieldName("")
    setNewFieldId("")
    setNewFieldType("text")
    setNewFieldOptions("")
  }

  const handleTemplateUpdate = (templateId: string, patch: Partial<MetadataTemplate>) => {
    const nextTemplates = localSettings.metadataTemplates.map((template) =>
      template.id === templateId ? { ...template, ...patch } : template,
    )
    commitProjectSettings({
      ...localSettings,
      metadataTemplates: nextTemplates,
    })
  }

  const handleTemplateDefaultUpdate = (templateId: string, field: MetadataFieldDefinition, value: string) => {
    const parsedValue =
      field.type === "boolean"
        ? value === "true"
        : field.type === "number"
          ? Number(value) || 0
          : field.type === "multi-select"
            ? parseOptions(value)
            : value

    const nextTemplates = localSettings.metadataTemplates.map((template) => {
      if (template.id !== templateId) return template
      return {
        ...template,
        fieldDefaults: {
          ...template.fieldDefaults,
          [field.id]: parsedValue,
        },
      }
    })

    commitProjectSettings({
      ...localSettings,
      metadataTemplates: nextTemplates,
    })
  }

  const handleAddTemplate = () => {
    const timestamp = Date.now()
    const defaultsTemplate = getDefaultMetadataTemplates()[0]
    const nextTemplate: MetadataTemplate = {
      id: `template-${timestamp}`,
      name: `Template ${localSettings.metadataTemplates.length + 1}`,
      sectionTypes: defaultsTemplate?.sectionTypes ?? ["scene"],
      fieldDefaults: localSettings.metadataFields.reduce<Record<string, MetadataValue>>((acc, field) => {
        acc[field.id] = field.defaultValue ?? (field.type === "multi-select" ? [] : "")
        return acc
      }, {}),
    }

    commitProjectSettings({
      ...localSettings,
      metadataTemplates: [...localSettings.metadataTemplates, nextTemplate],
    })
  }

  const handleDeleteTemplate = (templateId: string) => {
    if (localSettings.metadataTemplates.length <= 1) return
    commitProjectSettings({
      ...localSettings,
      metadataTemplates: localSettings.metadataTemplates.filter((template) => template.id !== templateId),
    })
  }

  const handlePresetUpdate = (presetId: string, patch: Partial<CompilePreset>) => {
    const nextPresets = localSettings.compilePresets.map((preset) => (preset.id === presetId ? { ...preset, ...patch } : preset))
    commitProjectSettings({
      ...localSettings,
      compilePresets: nextPresets,
    })
  }

  const handleSnapshotSettingsUpdate = (patch: Partial<ProjectSettings["snapshotSettings"]>) => {
    commitProjectSettings({
      ...localSettings,
      snapshotSettings: {
        ...localSettings.snapshotSettings,
        ...patch,
      },
    })
  }

  const handleAddPreset = () => {
    const base = getDefaultCompilePresets()[0]
    const timestamp = Date.now()
    const nextPreset: CompilePreset = {
      ...base,
      id: `preset-${timestamp}`,
      name: `Preset ${localSettings.compilePresets.length + 1}`,
    }
    commitProjectSettings({
      ...localSettings,
      compilePresets: [...localSettings.compilePresets, nextPreset],
      defaultCompilePresetId: localSettings.defaultCompilePresetId || nextPreset.id,
    })
  }

  const handleDeletePreset = (presetId: string) => {
    if (localSettings.compilePresets.length <= 1) return

    const nextPresets = localSettings.compilePresets.filter((preset) => preset.id !== presetId)
    const nextDefaultId =
      localSettings.defaultCompilePresetId === presetId
        ? nextPresets[0]?.id || ""
        : localSettings.defaultCompilePresetId

    commitProjectSettings({
      ...localSettings,
      compilePresets: nextPresets,
      defaultCompilePresetId: nextDefaultId,
    })
  }

  const selectedTheme = normalizeTheme(theme)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-h-[760px] flex-col overflow-hidden sm:min-h-[560px] sm:max-w-[880px]">
        <DialogHeader>
          <DialogTitle>Ink & Quill Settings</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2 flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full shrink-0 grid-cols-5">
            <TabsTrigger value="personalization">Personalization</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="project">Project</TabsTrigger>
            <TabsTrigger value="compile">Compile</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="personalization" className="mt-6 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Theme</h3>
              <RadioGroup
                value={selectedTheme}
                onValueChange={(value) => handleThemeChange(normalizeTheme(value))}
                className="grid grid-cols-1 gap-4 sm:grid-cols-3"
              >
                <div>
                  <RadioGroupItem value="system" id="theme-system" className="peer sr-only" />
                  <Label
                    htmlFor="theme-system"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-card p-4 hover:bg-muted/60 hover:text-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <Monitor className="mb-3 h-6 w-6" />
                    System
                  </Label>
                </div>

                <div>
                  <RadioGroupItem value="light" id="theme-light" className="peer sr-only" />
                  <Label
                    htmlFor="theme-light"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-white p-4 text-slate-900 hover:bg-slate-100 hover:text-slate-950 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
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
              </RadioGroup>
            </div>
          </TabsContent>

          <TabsContent value="storage" className="mt-6 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Project Directory</h3>
              <p className="text-sm text-muted-foreground">Set your default directory for storing project files.</p>
              <div className="flex items-center space-x-2">
                <Input
                  value={projectDirectory}
                  onChange={(e) => handleDirectoryChange(e.target.value)}
                  placeholder="Project directory path"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleBrowseDirectory}>
                  Browse
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="project" className="mt-6 min-h-0 flex-1 space-y-8 overflow-y-auto pr-1">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Snapshots</h3>
              <p className="text-sm text-muted-foreground">
                Keep restorable revisions per document and configure automatic snapshot events.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={localSettings.snapshotSettings.enabled}
                    onChange={(event) => handleSnapshotSettingsUpdate({ enabled: event.target.checked })}
                  />
                  Enable snapshots
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={localSettings.snapshotSettings.autoOnManualSave}
                    disabled={!localSettings.snapshotSettings.enabled}
                    onChange={(event) => handleSnapshotSettingsUpdate({ autoOnManualSave: event.target.checked })}
                  />
                  Snapshot on manual save
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={localSettings.snapshotSettings.autoOnInterval}
                    disabled={!localSettings.snapshotSettings.enabled}
                    onChange={(event) => handleSnapshotSettingsUpdate({ autoOnInterval: event.target.checked })}
                  />
                  Snapshot on interval
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={localSettings.snapshotSettings.autoBeforeRestore}
                    disabled={!localSettings.snapshotSettings.enabled}
                    onChange={(event) => handleSnapshotSettingsUpdate({ autoBeforeRestore: event.target.checked })}
                  />
                  Create safety snapshot before restore
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Interval (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={240}
                    disabled={!localSettings.snapshotSettings.enabled || !localSettings.snapshotSettings.autoOnInterval}
                    value={localSettings.snapshotSettings.intervalMinutes}
                    onChange={(event) =>
                      handleSnapshotSettingsUpdate({
                        intervalMinutes: Math.min(240, Math.max(1, Number(event.target.value) || 10)),
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Max Snapshots Per Document</Label>
                  <Input
                    type="number"
                    min={10}
                    max={500}
                    disabled={!localSettings.snapshotSettings.enabled}
                    value={localSettings.snapshotSettings.maxSnapshotsPerDocument}
                    onChange={(event) =>
                      handleSnapshotSettingsUpdate({
                        maxSnapshotsPerDocument: Math.min(500, Math.max(10, Number(event.target.value) || 50)),
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Metadata Fields</h3>
              </div>

              <div className="space-y-3">
                {localSettings.metadataFields.map((field) => (
                  <div key={field.id} className="rounded-lg border border-white/10 p-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto] items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input value={field.name} onChange={(e) => handleMetadataFieldUpdate(field.id, { name: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Field ID</Label>
                        <Input
                          value={field.id}
                          disabled
                          className="opacity-70"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) =>
                            handleMetadataFieldUpdate(field.id, {
                              type: value as MetadataFieldType,
                              options: value === "select" || value === "multi-select" ? field.options || [] : undefined,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {METADATA_FIELD_TYPES.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={CORE_METADATA_FIELDS.has(field.id)}
                        onClick={() => handleMetadataFieldDelete(field.id)}
                        title={CORE_METADATA_FIELDS.has(field.id) ? "Core field cannot be removed" : "Delete field"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {(field.type === "select" || field.type === "multi-select") && (
                      <div className="mt-3 space-y-1">
                        <Label className="text-xs">Options (comma-separated)</Label>
                        <Input
                          value={(field.options || []).join(", ")}
                          onChange={(e) => handleMetadataFieldUpdate(field.id, { options: parseOptions(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-white/10 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Add Field</p>
                <div className="grid gap-3 md:grid-cols-4">
                  <Input placeholder="Field name" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} />
                  <Input placeholder="field-id (optional)" value={newFieldId} onChange={(e) => setNewFieldId(toSlug(e.target.value))} />
                  <Select value={newFieldType} onValueChange={(value) => setNewFieldType(value as MetadataFieldType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METADATA_FIELD_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddMetadataField}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
                {(newFieldType === "select" || newFieldType === "multi-select") && (
                  <Input
                    className="mt-3"
                    placeholder="Options (comma-separated)"
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Metadata Templates</h3>
                <Button variant="outline" onClick={handleAddTemplate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Template
                </Button>
              </div>

              <div className="space-y-3">
                {localSettings.metadataTemplates.map((template) => (
                  <div key={template.id} className="rounded-lg border border-white/10 p-3 space-y-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Template Name</Label>
                        <Input
                          value={template.name}
                          onChange={(e) => handleTemplateUpdate(template.id, { name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Default Section Type</Label>
                        <Select
                          value={template.sectionTypes?.[0] || "any"}
                          onValueChange={(value) =>
                            handleTemplateUpdate(template.id, {
                              sectionTypes: value === "any" ? undefined : [value as SectionType],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any Section</SelectItem>
                            {SECTION_TYPE_VALUES.map((sectionType) => (
                              <SelectItem key={sectionType} value={sectionType}>
                                {SECTION_TYPE_LABELS[sectionType]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={localSettings.metadataTemplates.length <= 1}
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      {localSettings.metadataFields.map((field) => (
                        <div key={`${template.id}-${field.id}`} className="space-y-1">
                          <Label className="text-xs">{field.name} default</Label>
                          <Input
                            value={stringifyFieldValue(template.fieldDefaults[field.id])}
                            onChange={(e) => handleTemplateDefaultUpdate(template.id, field, e.target.value)}
                            placeholder={field.placeholder || ""}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="compile" className="mt-6 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Compile Presets</h3>
                <Button variant="outline" onClick={handleAddPreset}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Preset
                </Button>
              </div>

              <div className="space-y-3">
                {localSettings.compilePresets.map((preset) => (
                  <div key={preset.id} className="rounded-lg border border-white/10 p-3 space-y-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_160px_180px_auto] items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Preset Name</Label>
                        <Input value={preset.name} onChange={(e) => handlePresetUpdate(preset.id, { name: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Output</Label>
                        <Select
                          value={preset.outputFormat}
                          onValueChange={(value) => handlePresetUpdate(preset.id, { outputFormat: value as CompileOutputFormat })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COMPILE_OUTPUT_FORMATS.map((format) => (
                              <SelectItem key={format} value={format}>
                                {format.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Default</Label>
                        <Button
                          variant={localSettings.defaultCompilePresetId === preset.id ? "default" : "outline"}
                          onClick={() =>
                            commitProjectSettings({
                              ...localSettings,
                              defaultCompilePresetId: preset.id,
                            })
                          }
                          className="w-full"
                        >
                          {localSettings.defaultCompilePresetId === preset.id ? "Selected" : "Set Default"}
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={localSettings.compilePresets.length <= 1}
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={preset.description || ""}
                        onChange={(e) => handlePresetUpdate(preset.id, { description: e.target.value })}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Heading Mode</Label>
                        <Select
                          value={preset.headingMode}
                          onValueChange={(value) => handlePresetUpdate(preset.id, { headingMode: value as CompilePreset["headingMode"] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="project-hierarchy">Project Hierarchy</SelectItem>
                            <SelectItem value="flat">Flat</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Node Separator</Label>
                        <Select
                          value={preset.nodeSeparator}
                          onValueChange={(value) => handlePresetUpdate(preset.id, { nodeSeparator: value as CompilePreset["nodeSeparator"] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="line">Line</SelectItem>
                            <SelectItem value="page-break">Page Break</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={preset.includeFrontMatter}
                          onChange={(e) => handlePresetUpdate(preset.id, { includeFrontMatter: e.target.checked })}
                        />
                        Include Front Matter
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={preset.includeBackMatter}
                          onChange={(e) => handlePresetUpdate(preset.id, { includeBackMatter: e.target.checked })}
                        />
                        Include Back Matter
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={preset.includeResearch}
                          onChange={(e) => handlePresetUpdate(preset.id, { includeResearch: e.target.checked })}
                        />
                        Include Research
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={preset.includeNotes}
                          onChange={(e) => handlePresetUpdate(preset.id, { includeNotes: e.target.checked })}
                        />
                        Include Notes
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={preset.includeSynopsis}
                          onChange={(e) => handlePresetUpdate(preset.id, { includeSynopsis: e.target.checked })}
                        />
                        Include Synopsis
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="info" className="mt-6 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
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
                  <p className="text-xs text-muted-foreground">Version 0.4 beta</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
