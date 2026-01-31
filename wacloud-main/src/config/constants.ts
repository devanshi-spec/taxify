// Application configuration constants

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'WhatsApp CRM'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Plan limits
export const PLAN_LIMITS = {
  FREE: {
    maxUsers: 1,
    maxChannels: 1,
    maxContacts: 500,
    maxMessagesPerMonth: 1000,
    aiEnabled: false,
    campaignsEnabled: false,
  },
  STARTER: {
    maxUsers: 3,
    maxChannels: 2,
    maxContacts: 2500,
    maxMessagesPerMonth: 5000,
    aiEnabled: true,
    campaignsEnabled: true,
  },
  PROFESSIONAL: {
    maxUsers: 10,
    maxChannels: 5,
    maxContacts: 10000,
    maxMessagesPerMonth: 25000,
    aiEnabled: true,
    campaignsEnabled: true,
  },
  ENTERPRISE: {
    maxUsers: -1, // Unlimited
    maxChannels: -1,
    maxContacts: -1,
    maxMessagesPerMonth: -1,
    aiEnabled: true,
    campaignsEnabled: true,
  },
} as const

// Message types that support media
export const MEDIA_MESSAGE_TYPES = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'] as const

// Supported media MIME types
export const SUPPORTED_MEDIA_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  VIDEO: ['video/mp4', 'video/3gpp'],
  AUDIO: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ],
  STICKER: ['image/webp'],
} as const

// Max file sizes (in bytes)
export const MAX_FILE_SIZES = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  VIDEO: 16 * 1024 * 1024, // 16MB
  AUDIO: 16 * 1024 * 1024, // 16MB
  DOCUMENT: 100 * 1024 * 1024, // 100MB
  STICKER: 500 * 1024, // 500KB
} as const

// WhatsApp template categories
export const TEMPLATE_CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing', description: 'Promotional messages' },
  { value: 'UTILITY', label: 'Utility', description: 'Transactional messages' },
  { value: 'AUTHENTICATION', label: 'Authentication', description: 'OTP and verification' },
] as const

// Contact stages
export const CONTACT_STAGES = [
  { value: 'NEW', label: 'New', color: '#6B7280' },
  { value: 'LEAD', label: 'Lead', color: '#3B82F6' },
  { value: 'QUALIFIED', label: 'Qualified', color: '#F59E0B' },
  { value: 'CUSTOMER', label: 'Customer', color: '#10B981' },
  { value: 'CHURNED', label: 'Churned', color: '#EF4444' },
] as const

// Conversation statuses
export const CONVERSATION_STATUSES = [
  { value: 'OPEN', label: 'Open', color: '#10B981' },
  { value: 'PENDING', label: 'Pending', color: '#F59E0B' },
  { value: 'RESOLVED', label: 'Resolved', color: '#6B7280' },
  { value: 'CLOSED', label: 'Closed', color: '#374151' },
] as const

// AI Providers
export const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'] },
] as const

// Default AI settings
export const DEFAULT_AI_SETTINGS = {
  provider: 'openai' as const,
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 500,
} as const

// Pagination
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// Rate limiting
export const RATE_LIMITS = {
  messagesPerSecond: 80, // WhatsApp Cloud API limit
  templatesPerDay: 1000,
} as const

// Webhook events
export const WEBHOOK_EVENTS = [
  'messages.upsert',
  'messages.update',
  'messages.delete',
  'send.message',
  'contacts.upsert',
  'contacts.update',
  'presence.update',
  'chats.upsert',
  'chats.update',
  'connection.update',
  'qrcode.updated',
] as const
