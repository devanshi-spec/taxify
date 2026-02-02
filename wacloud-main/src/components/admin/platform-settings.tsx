'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Loader2, Settings, Key, Mail, Bot, Globe, Save, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

interface PlatformSetting {
    id: string
    key: string
    value: string
    description?: string
    isSecret: boolean
}

export function PlatformSettings() {
    const [settings, setSettings] = useState<PlatformSetting[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
    const [editedValues, setEditedValues] = useState<Record<string, string>>({})

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/admin/platform-settings')
            if (response.ok) {
                const data = await response.json()
                setSettings(data.settings || [])
            }
        } catch (error) {
            console.error('Failed to fetch platform settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleValueChange = (key: string, value: string) => {
        setEditedValues(prev => ({ ...prev, [key]: value }))
    }

    const toggleShowSecret = (key: string) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            const response = await fetch('/api/admin/platform-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: editedValues }),
            })

            if (response.ok) {
                toast.success('Settings saved successfully')
                setEditedValues({})
                fetchSettings()
            } else {
                toast.error('Failed to save settings')
            }
        } catch (error) {
            console.error('Failed to save settings:', error)
            toast.error('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    const getSettingIcon = (key: string) => {
        if (key.includes('api_key') || key.includes('secret')) return <Key className="h-4 w-4" />
        if (key.includes('email') || key.includes('smtp')) return <Mail className="h-4 w-4" />
        if (key.includes('ai') || key.includes('openai') || key.includes('anthropic')) return <Bot className="h-4 w-4" />
        if (key.includes('url') || key.includes('domain')) return <Globe className="h-4 w-4" />
        return <Settings className="h-4 w-4" />
    }

    const groupSettings = () => {
        const groups: Record<string, PlatformSetting[]> = {
            'AI Configuration': [],
            'API Keys': [],
            'Email Settings': [],
            'Other': [],
        }

        settings.forEach(setting => {
            if (setting.key.includes('openai') || setting.key.includes('anthropic') || setting.key.includes('gemini') || setting.key.includes('ai_')) {
                groups['AI Configuration'].push(setting)
            } else if (setting.key.includes('api_key') || setting.key.includes('secret')) {
                groups['API Keys'].push(setting)
            } else if (setting.key.includes('email') || setting.key.includes('smtp') || setting.key.includes('resend')) {
                groups['Email Settings'].push(setting)
            } else {
                groups['Other'].push(setting)
            }
        })

        return groups
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const groupedSettings = groupSettings()
    const hasChanges = Object.keys(editedValues).length > 0

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                Platform Settings
                            </CardTitle>
                            <CardDescription>
                                Configure global platform settings and API keys
                            </CardDescription>
                        </div>
                        {hasChanges && (
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 h-4 w-4" />
                                )}
                                Save Changes
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {settings.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">No platform settings configured</p>
                            <p className="text-sm">Add settings via the database or API</p>
                        </div>
                    ) : (
                        Object.entries(groupedSettings).map(([groupName, groupSettings]) =>
                            groupSettings.length > 0 && (
                                <div key={groupName}>
                                    <h3 className="text-lg font-semibold mb-4">{groupName}</h3>
                                    <div className="space-y-4">
                                        {groupSettings.map((setting) => (
                                            <div key={setting.id} className="grid gap-2">
                                                <div className="flex items-center gap-2">
                                                    {getSettingIcon(setting.key)}
                                                    <Label htmlFor={setting.key} className="font-medium">
                                                        {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                    </Label>
                                                </div>
                                                {setting.description && (
                                                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                                                )}
                                                <div className="relative">
                                                    <Input
                                                        id={setting.key}
                                                        type={setting.isSecret && !showSecrets[setting.key] ? 'password' : 'text'}
                                                        value={editedValues[setting.key] ?? (setting.isSecret ? '••••••••' : setting.value)}
                                                        onChange={(e) => handleValueChange(setting.key, e.target.value)}
                                                        placeholder={setting.isSecret ? 'Enter new value to update' : 'Enter value'}
                                                    />
                                                    {setting.isSecret && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="absolute right-2 top-1/2 -translate-y-1/2"
                                                            onClick={() => toggleShowSecret(setting.key)}
                                                        >
                                                            {showSecrets[setting.key] ? (
                                                                <EyeOff className="h-4 w-4" />
                                                            ) : (
                                                                <Eye className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Separator className="mt-6" />
                                </div>
                            )
                        )
                    )}

                    {/* Quick Actions */}
                    <div className="pt-4">
                        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Use Platform AI Keys</p>
                                        <p className="text-sm text-muted-foreground">
                                            Enable AI features for orgs without their own keys
                                        </p>
                                    </div>
                                    <Switch />
                                </div>
                            </Card>
                            <Card className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Maintenance Mode</p>
                                        <p className="text-sm text-muted-foreground">
                                            Temporarily disable access for maintenance
                                        </p>
                                    </div>
                                    <Switch />
                                </div>
                            </Card>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
