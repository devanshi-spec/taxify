'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import { AgentPerformance } from '@/components/analytics/agent-performance'
import { CTWAAttribution } from '@/components/analytics/ctwa-attribution'
import { BarChart3, Users, MousePointerClick } from 'lucide-react'

export function AnalyticsPageContent() {
    const [activeTab, setActiveTab] = useState('overview')

    return (
        <div className="flex-1 overflow-auto p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold">Analytics</h2>
                <p className="text-muted-foreground">
                    Monitor your messaging performance, team productivity, and ad attribution
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full max-w-lg grid-cols-3">
                    <TabsTrigger value="overview" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="hidden sm:inline">Overview</span>
                    </TabsTrigger>
                    <TabsTrigger value="agents" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="hidden sm:inline">Agents</span>
                    </TabsTrigger>
                    <TabsTrigger value="attribution" className="flex items-center gap-2">
                        <MousePointerClick className="h-4 w-4" />
                        <span className="hidden sm:inline">Attribution</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <AnalyticsDashboard />
                </TabsContent>

                <TabsContent value="agents">
                    <AgentPerformance />
                </TabsContent>

                <TabsContent value="attribution">
                    <CTWAAttribution />
                </TabsContent>
            </Tabs>
        </div>
    )
}
