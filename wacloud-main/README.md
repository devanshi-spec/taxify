# WhatsApp CRM SaaS

A modern, multi-tenant WhatsApp CRM application built with Next.js, featuring AI-powered chatbots, bulk messaging, contact management, and seamless WhatsApp integration via Evolution API and WhatsApp Cloud API.

## Features

- **Multi-tenant Architecture**: Schema-per-tenant isolation for enterprise security
- **Real-time Inbox**: Live chat interface with message status tracking
- **AI Chatbots**: Powered by OpenAI and Anthropic with provider switching
- **Bulk Campaigns**: Send targeted messages to contact segments
- **Contact Management**: Tags, custom fields, lead scoring, and segmentation
- **Multi-channel Support**: Connect multiple WhatsApp numbers
- **Team Collaboration**: Role-based access control and conversation assignment
- **Advanced Media Management**: Image, video, audio, and document support
- **Message Templates**: WhatsApp-approved template management

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **UI**: shadcn/ui, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Supabase), Redis (caching & queues)
- **Authentication**: Supabase Auth
- **WhatsApp**: Evolution API, WhatsApp Cloud API
- **AI**: OpenAI, Anthropic Claude
- **State Management**: Zustand
- **Data Fetching**: TanStack Query

## Project Structure

```
whatsapp-crm/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth pages (login, register)
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Layout components
│   │   ├── inbox/            # Inbox components
│   │   └── ...
│   ├── lib/                   # Utility libraries
│   │   ├── supabase/         # Supabase clients
│   │   ├── evolution-api/    # Evolution API client
│   │   └── ai/               # AI provider abstraction
│   ├── stores/               # Zustand stores
│   ├── types/                # TypeScript types
│   ├── config/               # Configuration
│   └── hooks/                # Custom React hooks
├── prisma/                    # Prisma schema & migrations
├── docker/                    # Docker configuration
└── public/                    # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Supabase account (or self-hosted)
- WhatsApp Business API access (for Cloud API)

### 1. Install Dependencies

```bash
cd whatsapp-crm
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://...

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your-api-key

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start Docker Services

```bash
cd docker
docker-compose up -d
```

This starts:
- Evolution API on port 8080
- PostgreSQL on port 5432
- Redis on port 6379

### 4. Set Up Database

```bash
npx prisma generate
npx prisma db push
```

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## WhatsApp Setup

### Evolution API (Recommended for Development)

1. Access Evolution API at http://localhost:8080
2. Create an instance via API or dashboard
3. Scan QR code to connect WhatsApp
4. Configure webhook URL: `http://your-app/api/webhooks/evolution`

### WhatsApp Cloud API (Production)

1. Create a Meta Developer account
2. Create a WhatsApp Business App
3. Complete business verification
4. Add phone numbers
5. Generate access tokens
6. Configure webhook URL in Meta Developer Console

## API Documentation

### Webhook Events

The application handles the following webhook events:

- `messages.upsert` - New message received
- `messages.update` - Message status update
- `send.message` - Message sent confirmation
- `connection.update` - Connection state change
- `qrcode.updated` - QR code for pairing

### Message Types Supported

- Text
- Image
- Video
- Audio
- Document
- Location
- Contact
- Template
- Interactive (buttons, lists)
- Reactions

## Deployment

### Vercel (Frontend)

```bash
vercel deploy
```

### Railway/Render (Services)

Deploy Evolution API and Redis using the Docker configuration.

### Environment Variables for Production

Ensure all environment variables are set in your hosting platform.

## License

MIT License
