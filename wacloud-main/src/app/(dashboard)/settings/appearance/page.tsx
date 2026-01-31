import { Metadata } from 'next'
import { AppearanceSettings } from '@/components/settings/appearance-settings'

export const metadata: Metadata = {
  title: 'Appearance | Settings',
}

export default function AppearancePage() {
  return <AppearanceSettings />
}
