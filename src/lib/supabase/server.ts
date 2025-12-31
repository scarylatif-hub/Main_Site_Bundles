import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = (cookieStore: ReturnType<typeof cookies>) => {
  return createServerClient(
    "https://rqqvttdajsczwhjvrzve.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcXZ0dGRhanNjenFoanZyenZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE0ODE5NTAsImV4cCI6MjAzNzA1Nzk1MH0.3BHtW2E0y1j59-t5-dMtxKqgvyDAtinZlF9oH52c8Fw",
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
