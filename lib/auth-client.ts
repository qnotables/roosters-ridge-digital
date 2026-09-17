'use client'

import { createAuthClient } from '@neondatabase/auth'

const authBaseUrl = typeof window === 'undefined' ? 'http://localhost:3000/api/auth' : `${window.location.origin}/api/auth`
export const authClient = createAuthClient(authBaseUrl)
