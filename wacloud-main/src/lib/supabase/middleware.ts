import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do NOT run this code in a Server Component.
  // This is middleware code that refreshes auth tokens.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (error) {
    // If Supabase is unreachable, allow access to login page
    console.error('Supabase connection error:', error)
    const publicRoutes = ['/login', '/register', '/forgot-password', '/auth/callback']
    const isPublicRoute = publicRoutes.some(route =>
      request.nextUrl.pathname.startsWith(route)
    )
    if (!isPublicRoute && !request.nextUrl.pathname.startsWith('/api')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Define public routes that don't require authentication
  // 1. Auth Routes: If logged in, redirect to dashboard
  const authRoutes = ['/login', '/register', '/forgot-password', '/auth/callback']

  // 2. Open Routes: Accessible by everyone (logged in or not)
  const openRoutes = ['/accept-invite', '/onboarding']

  const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname.startsWith(route))
  const isOpenRoute = openRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // Redirect to login if not authenticated and trying to access protected route
  if (!user && !isAuthRoute && !isOpenRoute && !request.nextUrl.pathname.startsWith('/api')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect to dashboard if authenticated and trying to access AUTH pages (login/register)
  // But ALLOW access to openRoutes (like accept-invite) even if logged in
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/inbox'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
