'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Sun, Moon, Monitor, Palette, Layout, Type, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const accentColors = [
  { name: 'Green', value: 'green', class: 'bg-green-500' },
  { name: 'Blue', value: 'blue', class: 'bg-blue-500' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-500' },
  { name: 'Orange', value: 'orange', class: 'bg-orange-500' },
  { name: 'Pink', value: 'pink', class: 'bg-pink-500' },
  { name: 'Red', value: 'red', class: 'bg-red-500' },
]

const fontSizes = [
  { name: 'Small', value: 'small', description: 'Compact interface' },
  { name: 'Medium', value: 'medium', description: 'Default size' },
  { name: 'Large', value: 'large', description: 'Easier to read' },
]

export function AppearanceSettings() {
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState('system')
  const [accentColor, setAccentColor] = useState('green')
  const [fontSize, setFontSize] = useState('medium')
  const [compactMode, setCompactMode] = useState(false)
  const [showAvatars, setShowAvatars] = useState(true)
  const [animationsEnabled, setAnimationsEnabled] = useState(true)

  useEffect(() => {
    setMounted(true)
    // Load saved preferences from localStorage
    const savedTheme = localStorage.getItem('theme')
    const savedAccent = localStorage.getItem('accent-color')
    const savedFontSize = localStorage.getItem('font-size')
    const savedCompact = localStorage.getItem('compact-mode')
    const savedAvatars = localStorage.getItem('show-avatars')
    const savedAnimations = localStorage.getItem('animations-enabled')

    if (savedTheme) setTheme(savedTheme)
    if (savedAccent) setAccentColor(savedAccent)
    if (savedFontSize) setFontSize(savedFontSize)
    if (savedCompact) setCompactMode(savedCompact === 'true')
    if (savedAvatars !== null) setShowAvatars(savedAvatars !== 'false')
    if (savedAnimations !== null) setAnimationsEnabled(savedAnimations !== 'false')
  }, [])

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)

    // Apply theme
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      // System preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save to localStorage
      localStorage.setItem('theme', theme)
      localStorage.setItem('accent-color', accentColor)
      localStorage.setItem('font-size', fontSize)
      localStorage.setItem('compact-mode', compactMode.toString())
      localStorage.setItem('show-avatars', showAvatars.toString())
      localStorage.setItem('animations-enabled', animationsEnabled.toString())

      // Apply font size
      document.documentElement.setAttribute('data-font-size', fontSize)

      // Apply compact mode
      document.documentElement.setAttribute('data-compact', compactMode.toString())

      await new Promise(resolve => setTimeout(resolve, 500))
      toast.success('Appearance settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Appearance</h2>
        <p className="text-muted-foreground">
          Customize how the application looks and feels
        </p>
      </div>

      <Separator />

      {/* Theme */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Theme</CardTitle>
          </div>
          <CardDescription>
            Select your preferred color scheme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={handleThemeChange}
            className="grid grid-cols-3 gap-4"
          >
            <div>
              <RadioGroupItem
                value="light"
                id="light"
                className="peer sr-only"
              />
              <Label
                htmlFor="light"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Sun className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Light</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="dark"
                id="dark"
                className="peer sr-only"
              />
              <Label
                htmlFor="dark"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Moon className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Dark</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="system"
                id="system"
                className="peer sr-only"
              />
              <Label
                htmlFor="system"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Monitor className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">System</span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Accent Color */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Accent Color</CardTitle>
          </div>
          <CardDescription>
            Choose the primary accent color for buttons and highlights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {accentColors.map((color) => (
              <button
                key={color.value}
                onClick={() => setAccentColor(color.value)}
                className={cn(
                  'h-10 w-10 rounded-full ring-offset-2 ring-offset-background transition-all',
                  color.class,
                  accentColor === color.value && 'ring-2 ring-primary'
                )}
                title={color.name}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Selected: {accentColors.find(c => c.value === accentColor)?.name}
          </p>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Font Size</CardTitle>
          </div>
          <CardDescription>
            Adjust the text size throughout the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={fontSize}
            onValueChange={setFontSize}
            className="space-y-3"
          >
            {fontSizes.map((size) => (
              <div key={size.value} className="flex items-center space-x-3">
                <RadioGroupItem value={size.value} id={size.value} />
                <Label htmlFor={size.value} className="flex-1 cursor-pointer">
                  <span className="font-medium">{size.name}</span>
                  <span className="ml-2 text-muted-foreground text-sm">
                    - {size.description}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Layout Options */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layout className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Layout Options</CardTitle>
          </div>
          <CardDescription>
            Customize the layout and display preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Compact Mode</p>
              <p className="text-sm text-muted-foreground">
                Reduce spacing and padding for a denser interface
              </p>
            </div>
            <Switch
              checked={compactMode}
              onCheckedChange={setCompactMode}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Show Avatars</p>
              <p className="text-sm text-muted-foreground">
                Display contact avatars in conversation lists
              </p>
            </div>
            <Switch
              checked={showAvatars}
              onCheckedChange={setShowAvatars}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Enable Animations</p>
              <p className="text-sm text-muted-foreground">
                Show smooth transitions and animations
              </p>
            </div>
            <Switch
              checked={animationsEnabled}
              onCheckedChange={setAnimationsEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
        </Button>
      </div>
    </div>
  )
}
