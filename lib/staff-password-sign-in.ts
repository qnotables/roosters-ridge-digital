'use client'

import { authClient } from '@/lib/auth-client'

export function signInStaffWithPassword(email: string, password: string) {
  return authClient.signIn.email({ email: email.trim().toLowerCase(), password })
}
