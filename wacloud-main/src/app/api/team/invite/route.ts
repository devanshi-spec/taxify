import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseUserId: user.id },
      select: {
        id: true,
        organizationId: true,
        role: true,
        organization: {
          select: { maxUsers: true }
        }
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only OWNER and ADMIN can invite
    if (!['OWNER', 'ADMIN'].includes(dbUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = inviteSchema.parse(body)

    // Check user limit
    const currentUserCount = await prisma.user.count({
      where: { organizationId: dbUser.organizationId },
    })

    if (currentUserCount >= dbUser.organization.maxUsers) {
      return NextResponse.json(
        { error: 'User limit reached. Please upgrade your plan.' },
        { status: 403 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      if (existingUser.organizationId === dbUser.organizationId) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'User already belongs to another organization' },
        { status: 409 }
      )
    }

    // Create invitation token
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    const invitation = await prisma.invitation.create({
      data: {
        email: validatedData.email,
        role: validatedData.role,
        token,
        organizationId: dbUser.organizationId,
        invitedBy: dbUser.id,
        expiresAt,
      },
    })

    // Send invitation email
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)

      const organization = await prisma.organization.findUnique({
        where: { id: dbUser.organizationId },
        select: { name: true },
      })

      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/accept-invite?token=${token}`

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: validatedData.email,
        subject: `You've been invited to join ${organization?.name || 'our team'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited!</h2>
            <p>You've been invited to join <strong>${organization?.name || 'the team'}</strong> as a <strong>${validatedData.role}</strong>.</p>
            <p>Click the button below to accept the invitation and create your account:</p>
            <a href="${inviteUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
              Accept Invitation
            </a>
            <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>
            <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 12px; word-break: break-all;">${inviteUrl}</p>
          </div>
        `,
      })

      console.log(`[Team] Invitation email sent to ${validatedData.email}`)
    } catch (emailError) {
      console.error('[Team] Failed to send invitation email:', emailError)
      // Don't fail the request if email fails - invitation is still created
    }

    return NextResponse.json({
      message: 'Invitation sent successfully',
      data: {
        id: invitation.id,
        email: validatedData.email,
        role: validatedData.role,
        expiresAt: invitation.expiresAt,
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Error sending invitation:', error)
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
}
