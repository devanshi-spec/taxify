import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Get existing organization and user (from logged in user)
  const existingOrg = await prisma.organization.findFirst()
  const existingUser = await prisma.user.findFirst()

  if (!existingOrg || !existingUser) {
    console.log('No existing organization or user found.')
    console.log('Please log in through the app first to create an organization.')

    // Create a default organization and user if none exists
    const org = await prisma.organization.create({
      data: {
        name: 'Demo Organization',
        slug: 'demo-org',
        plan: 'PROFESSIONAL',
        maxUsers: 10,
        maxChannels: 5,
        maxContacts: 10000,
        maxMessages: 50000,
      },
    })

    console.log(`Created organization: ${org.name}`)

    // Note: User needs to be created through Supabase auth
    console.log('Seed completed with new organization. Please register a user.')
    return
  }

  const organizationId = existingOrg.id
  const userId = existingUser.id

  console.log(`Using organization: ${existingOrg.name}`)
  console.log(`Using user: ${existingUser.email}`)

  // ============================================
  // SEED CHANNELS
  // ============================================
  console.log('\nSeeding channels...')

  const channel1 = await prisma.channel.upsert({
    where: { id: 'seed-channel-1' },
    update: {},
    create: {
      id: 'seed-channel-1',
      name: 'Main Business Line',
      phoneNumber: '+1 555-0100',
      phoneNumberId: 'demo_phone_id_1',
      connectionType: 'CLOUD_API',
      status: 'CONNECTED',
      organizationId,
    },
  })

  const channel2 = await prisma.channel.upsert({
    where: { id: 'seed-channel-2' },
    update: {},
    create: {
      id: 'seed-channel-2',
      name: 'Support Line',
      phoneNumber: '+1 555-0200',
      evolutionInstance: 'support-instance',
      connectionType: 'EVOLUTION_API',
      status: 'CONNECTED',
      organizationId,
    },
  })

  console.log(`Created ${2} channels`)

  // ============================================
  // SEED CONTACTS
  // ============================================
  console.log('\nSeeding contacts...')

  const contacts = [
    { name: 'John Smith', phoneNumber: '+1 555-1001', email: 'john.smith@email.com', stage: 'CUSTOMER' as const, tags: ['vip', 'retail'], segment: 'VIP Customers', leadScore: 85 },
    { name: 'Sarah Johnson', phoneNumber: '+1 555-1002', email: 'sarah.j@company.com', stage: 'QUALIFIED' as const, tags: ['enterprise', 'hot-lead'], segment: 'Enterprise', leadScore: 90 },
    { name: 'Mike Williams', phoneNumber: '+1 555-1003', email: 'mike.w@gmail.com', stage: 'LEAD' as const, tags: ['retail'], segment: 'Retail', leadScore: 45 },
    { name: 'Emily Davis', phoneNumber: '+1 555-1004', email: 'emily.d@email.com', stage: 'NEW' as const, tags: ['inquiry'], leadScore: 20 },
    { name: 'Robert Brown', phoneNumber: '+1 555-1005', email: 'rob.brown@work.com', stage: 'CUSTOMER' as const, tags: ['loyal', 'repeat-buyer'], segment: 'Loyal Customers', leadScore: 95 },
    { name: 'Lisa Garcia', phoneNumber: '+1 555-1006', email: 'lisa.g@email.com', stage: 'QUALIFIED' as const, tags: ['interested'], leadScore: 70 },
    { name: 'David Martinez', phoneNumber: '+1 555-1007', email: 'david.m@company.com', stage: 'LEAD' as const, tags: ['small-business'], segment: 'SMB', leadScore: 55 },
    { name: 'Jennifer Wilson', phoneNumber: '+1 555-1008', email: 'jen.wilson@email.com', stage: 'CHURNED' as const, tags: ['inactive'], leadScore: 10 },
    { name: 'James Anderson', phoneNumber: '+1 555-1009', email: 'j.anderson@work.com', stage: 'CUSTOMER' as const, tags: ['enterprise', 'high-value'], segment: 'Enterprise', leadScore: 88 },
    { name: 'Patricia Taylor', phoneNumber: '+1 555-1010', email: 'pat.taylor@email.com', stage: 'NEW' as const, tags: ['new-inquiry'], leadScore: 15 },
  ]

  const createdContacts = []
  for (const contact of contacts) {
    const c = await prisma.contact.upsert({
      where: { phoneNumber_channelId: { phoneNumber: contact.phoneNumber, channelId: channel1.id } },
      update: {},
      create: {
        ...contact,
        channelId: channel1.id,
        organizationId,
        lastContactedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    })
    createdContacts.push(c)
  }

  console.log(`Created ${createdContacts.length} contacts`)

  // ============================================
  // SEED CONVERSATIONS & MESSAGES
  // ============================================
  console.log('\nSeeding conversations and messages...')

  let conversationCount = 0
  let messageCount = 0

  for (let i = 0; i < 5; i++) {
    const contact = createdContacts[i]
    const conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        channelId: channel1.id,
        organizationId,
        status: i === 0 ? 'OPEN' : i === 1 ? 'PENDING' : 'OPEN',
        priority: i === 0 ? 'HIGH' : 'NORMAL',
        unreadCount: i < 2 ? Math.floor(Math.random() * 5) + 1 : 0,
        lastMessageAt: new Date(Date.now() - i * 60 * 60 * 1000),
        lastMessagePreview: `Sample message from ${contact.name}`,
        tags: i === 0 ? ['urgent', 'sales'] : [],
      },
    })
    conversationCount++

    // Add messages to each conversation
    const messageTemplates = [
      { direction: 'INBOUND' as const, content: `Hi, I'm interested in your products.` },
      { direction: 'OUTBOUND' as const, content: `Hello ${contact.name}! Thank you for reaching out. How can I help you today?` },
      { direction: 'INBOUND' as const, content: `Can you tell me more about your pricing?` },
      { direction: 'OUTBOUND' as const, content: `Of course! Our plans start at $29/month. Would you like me to send you our detailed pricing guide?` },
      { direction: 'INBOUND' as const, content: `Yes, please send it over.` },
    ]

    for (let j = 0; j < messageTemplates.length; j++) {
      const msg = messageTemplates[j]
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          waMessageId: `wamid_seed_${conversation.id}_${j}`,
          direction: msg.direction,
          senderId: msg.direction === 'OUTBOUND' ? userId : contact.id,
          senderName: msg.direction === 'OUTBOUND' ? existingUser.name : contact.name,
          type: 'TEXT',
          content: msg.content,
          status: 'DELIVERED',
          sentAt: new Date(Date.now() - (messageTemplates.length - j) * 10 * 60 * 1000 - i * 60 * 60 * 1000),
          deliveredAt: new Date(Date.now() - (messageTemplates.length - j) * 10 * 60 * 1000 - i * 60 * 60 * 1000 + 5000),
        },
      })
      messageCount++
    }
  }

  console.log(`Created ${conversationCount} conversations with ${messageCount} messages`)

  // ============================================
  // SEED QUICK REPLIES
  // ============================================
  console.log('\nSeeding quick replies...')

  const quickReplies = [
    { shortcut: '/hello', title: 'Greeting', content: 'Hello! Thank you for contacting us. How can I help you today?', category: 'Greetings' },
    { shortcut: '/thanks', title: 'Thank You', content: 'Thank you for your message! We appreciate your time and will get back to you shortly.', category: 'Greetings' },
    { shortcut: '/pricing', title: 'Pricing Info', content: 'Our pricing starts at $29/month for the Starter plan. Premium plans are available at $79/month. Would you like more details?', category: 'Sales' },
    { shortcut: '/hours', title: 'Business Hours', content: 'Our business hours are Monday to Friday, 9 AM to 6 PM EST. For urgent matters outside these hours, please email support@company.com', category: 'Support' },
    { shortcut: '/demo', title: 'Schedule Demo', content: 'I\'d be happy to schedule a demo for you! Please visit our booking page at calendly.com/our-company or let me know your preferred time.', category: 'Sales' },
    { shortcut: '/hold', title: 'Please Hold', content: 'Please hold on while I check that for you. I\'ll be right back with the information you need.', category: 'Support' },
    { shortcut: '/bye', title: 'Goodbye', content: 'Thank you for chatting with us! If you have any more questions, feel free to reach out anytime. Have a great day!', category: 'Greetings' },
    { shortcut: '/refund', title: 'Refund Policy', content: 'Our refund policy allows full refunds within 30 days of purchase. Please provide your order number and I can assist you further.', category: 'Support' },
  ]

  for (const qr of quickReplies) {
    await prisma.quickReply.upsert({
      where: { shortcut_organizationId: { shortcut: qr.shortcut, organizationId } },
      update: {},
      create: {
        ...qr,
        tags: [qr.category.toLowerCase()],
        createdBy: userId,
        organizationId,
      },
    })
  }

  console.log(`Created ${quickReplies.length} quick replies`)

  // ============================================
  // SEED TEMPLATES
  // ============================================
  console.log('\nSeeding message templates...')

  const templates = [
    { name: 'welcome_message', category: 'MARKETING' as const, language: 'en', bodyText: 'Hello {{1}}! Welcome to our service. We\'re excited to have you on board!', status: 'APPROVED' as const },
    { name: 'order_confirmation', category: 'UTILITY' as const, language: 'en', bodyText: 'Hi {{1}}, your order #{{2}} has been confirmed. Expected delivery: {{3}}', status: 'APPROVED' as const },
    { name: 'shipping_update', category: 'UTILITY' as const, language: 'en', bodyText: 'Good news {{1}}! Your order #{{2}} has been shipped and will arrive by {{3}}.', status: 'APPROVED' as const },
    { name: 'appointment_reminder', category: 'UTILITY' as const, language: 'en', bodyText: 'Reminder: {{1}}, you have an appointment scheduled for {{2}} at {{3}}.', status: 'APPROVED' as const },
    { name: 'special_offer', category: 'MARKETING' as const, language: 'en', bodyText: '{{1}}, exclusive offer just for you! Get {{2}}% off on your next purchase. Use code: {{3}}', status: 'APPROVED' as const },
    { name: 'payment_receipt', category: 'UTILITY' as const, language: 'en', bodyText: 'Payment received! Amount: ${{1}}. Transaction ID: {{2}}. Thank you for your payment.', status: 'APPROVED' as const },
    { name: 'feedback_request', category: 'MARKETING' as const, language: 'en', bodyText: 'Hi {{1}}! We hope you enjoyed your recent experience. Would you take a moment to share your feedback?', status: 'PENDING' as const },
  ]

  for (const template of templates) {
    await prisma.messageTemplate.upsert({
      where: { name_language_channelId: { name: template.name, language: template.language, channelId: channel1.id } },
      update: {},
      create: {
        ...template,
        bodyVariables: (template.bodyText.match(/\{\{\d+\}\}/g) || []).map(v => v.replace(/[{}]/g, '')),
        channelId: channel1.id,
      },
    })
  }

  console.log(`Created ${templates.length} message templates`)

  // ============================================
  // SEED CAMPAIGNS
  // ============================================
  console.log('\nSeeding campaigns...')

  const campaigns = [
    {
      name: 'Black Friday Sale',
      description: 'Promotional campaign for Black Friday deals',
      type: 'BROADCAST' as const,
      status: 'COMPLETED' as const,
      messageType: 'TEMPLATE' as const,
      messageContent: 'Get 50% off on all products!',
      targetSegment: 'VIP Customers',
      totalRecipients: 150,
      sentCount: 148,
      deliveredCount: 145,
      readCount: 98,
      replyCount: 23,
      failedCount: 2,
    },
    {
      name: 'New Product Launch',
      description: 'Announcing our new product line',
      type: 'BROADCAST' as const,
      status: 'SCHEDULED' as const,
      messageType: 'TEMPLATE' as const,
      messageContent: 'Introducing our latest innovation!',
      targetSegment: 'Enterprise',
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      totalRecipients: 200,
    },
    {
      name: 'Customer Feedback Survey',
      description: 'Monthly feedback collection',
      type: 'BROADCAST' as const,
      status: 'DRAFT' as const,
      messageType: 'TEXT' as const,
      messageContent: 'We value your feedback! Please take a moment to share your thoughts.',
      targetTags: ['customer'],
    },
    {
      name: 'Onboarding Drip',
      description: 'Welcome series for new customers',
      type: 'DRIP' as const,
      status: 'RUNNING' as const,
      messageType: 'TEMPLATE' as const,
      targetSegment: 'New Customers',
      totalRecipients: 45,
      sentCount: 30,
      deliveredCount: 29,
      readCount: 22,
    },
  ]

  for (const campaign of campaigns) {
    await prisma.campaign.create({
      data: {
        ...campaign,
        channelId: channel1.id,
        organizationId,
        createdBy: userId,
      },
    })
  }

  console.log(`Created ${campaigns.length} campaigns`)

  // ============================================
  // SEED PIPELINES & DEALS
  // ============================================
  console.log('\nSeeding pipelines and deals...')

  const pipeline = await prisma.pipeline.upsert({
    where: { id: 'seed-pipeline-1' },
    update: {},
    create: {
      id: 'seed-pipeline-1',
      name: 'Sales Pipeline',
      isDefault: true,
      stages: [
        { id: 'stage-1', name: 'New Lead', order: 1, color: '#6366f1', probability: 10 },
        { id: 'stage-2', name: 'Contacted', order: 2, color: '#3b82f6', probability: 25 },
        { id: 'stage-3', name: 'Qualified', order: 3, color: '#f59e0b', probability: 50 },
        { id: 'stage-4', name: 'Proposal', order: 4, color: '#8b5cf6', probability: 75 },
        { id: 'stage-5', name: 'Closed Won', order: 5, color: '#22c55e', probability: 100 },
        { id: 'stage-6', name: 'Closed Lost', order: 6, color: '#ef4444', probability: 0 },
      ],
      organizationId,
    },
  })

  const deals = [
    { title: 'Enterprise Software License', value: 25000, stage: 'stage-4', probability: 75, contactIndex: 1 },
    { title: 'Annual Support Contract', value: 12000, stage: 'stage-3', probability: 50, contactIndex: 0 },
    { title: 'Custom Development Project', value: 45000, stage: 'stage-2', probability: 25, contactIndex: 8 },
    { title: 'Starter Plan Subscription', value: 348, stage: 'stage-5', probability: 100, contactIndex: 4 },
    { title: 'Premium Upgrade', value: 1500, stage: 'stage-1', probability: 10, contactIndex: 2 },
    { title: 'Consulting Services', value: 8000, stage: 'stage-3', probability: 50, contactIndex: 5 },
  ]

  for (const deal of deals) {
    await prisma.deal.create({
      data: {
        title: deal.title,
        value: deal.value,
        stage: deal.stage,
        probability: deal.probability,
        contactId: createdContacts[deal.contactIndex].id,
        pipelineId: pipeline.id,
        organizationId,
        createdBy: userId,
        expectedCloseDate: new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000),
      },
    })
  }

  console.log(`Created 1 pipeline with ${deals.length} deals`)

  // ============================================
  // SEED ACTIVITIES
  // ============================================
  console.log('\nSeeding activities...')

  const activities = [
    { type: 'CALL' as const, title: 'Follow-up call with John', contactIndex: 0, dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    { type: 'EMAIL' as const, title: 'Send proposal to Sarah', contactIndex: 1, dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
    { type: 'MEETING' as const, title: 'Product demo with Enterprise team', contactIndex: 8, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    { type: 'TASK' as const, title: 'Prepare pricing document', dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
    { type: 'NOTE' as const, title: 'Customer mentioned competitor pricing', contactIndex: 5, completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    { type: 'WHATSAPP' as const, title: 'Send welcome message to new leads', dueDate: new Date(Date.now() + 0.5 * 24 * 60 * 60 * 1000) },
    { type: 'CALL' as const, title: 'Check-in call with Robert', contactIndex: 4, completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { type: 'MEETING' as const, title: 'Quarterly review meeting', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  ]

  for (const activity of activities) {
    await prisma.activity.create({
      data: {
        type: activity.type,
        title: activity.title,
        description: `${activity.type} activity - ${activity.title}`,
        contactId: activity.contactIndex !== undefined ? createdContacts[activity.contactIndex].id : null,
        dueDate: activity.dueDate,
        completedAt: activity.completedAt,
        createdBy: userId,
        organizationId,
      },
    })
  }

  console.log(`Created ${activities.length} activities`)

  // ============================================
  // SEED CHATBOTS
  // ============================================
  console.log('\nSeeding chatbots...')

  const chatbots = [
    {
      name: 'Sales Assistant',
      description: 'AI-powered sales assistant to help qualify leads',
      isActive: true,
      aiProvider: 'openai',
      aiModel: 'gpt-4o',
      systemPrompt: 'You are a friendly sales assistant for our company. Help customers with product information and pricing queries.',
      triggerKeywords: ['pricing', 'cost', 'buy', 'purchase'],
      handoffKeywords: ['human', 'agent', 'speak to someone'],
      handoffMessage: 'Let me connect you with a human agent who can better assist you.',
    },
    {
      name: 'Support Bot',
      description: 'Customer support chatbot for common inquiries',
      isActive: true,
      aiProvider: 'anthropic',
      aiModel: 'claude-3-sonnet',
      systemPrompt: 'You are a helpful customer support agent. Answer questions about orders, shipping, and returns.',
      triggerKeywords: ['help', 'support', 'issue', 'problem', 'order'],
      triggerOnNewConversation: true,
      handoffKeywords: ['manager', 'supervisor', 'complaint'],
    },
    {
      name: 'FAQ Bot',
      description: 'Answers frequently asked questions',
      isActive: false,
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      flowType: 'FLOW' as const,
      triggerKeywords: ['faq', 'question', 'info'],
    },
  ]

  for (const bot of chatbots) {
    await prisma.chatbot.create({
      data: {
        ...bot,
        organizationId,
      },
    })
  }

  console.log(`Created ${chatbots.length} chatbots`)

  // ============================================
  // SEED AGENT STATUS
  // ============================================
  console.log('\nSeeding agent status...')

  await prisma.agentStatus.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      status: 'ONLINE',
      maxConcurrentChats: 10,
      currentLoad: 3,
      skills: ['sales', 'support', 'technical'],
      languages: ['en', 'es'],
      lastActiveAt: new Date(),
      organizationId,
    },
  })

  console.log('Created agent status')

  console.log('\n========================================')
  console.log('Database seeding completed successfully!')
  console.log('========================================')
  console.log('\nSummary:')
  console.log('- 2 Channels')
  console.log('- 10 Contacts')
  console.log('- 5 Conversations with messages')
  console.log('- 8 Quick Replies')
  console.log('- 7 Message Templates')
  console.log('- 4 Campaigns')
  console.log('- 1 Pipeline with 6 Deals')
  console.log('- 8 Activities')
  console.log('- 3 Chatbots')
  console.log('- 1 Agent Status')
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
