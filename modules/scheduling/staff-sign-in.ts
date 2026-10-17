export const schedulingStaffSignInPath = '/admin/scheduling/staff-sign-in'
export const schedulingStaffReturnPath = '/admin/scheduling'

export function verifiedStaffSession(session: unknown): session is { user: { id: string; email: string; emailVerified: true } } {
  if (!session || typeof session !== 'object' || !('user' in session)) return false
  const user = session.user
  return Boolean(user && typeof user === 'object' && 'id' in user && typeof user.id === 'string' && user.id && 'email' in user && typeof user.email === 'string' && user.email && 'emailVerified' in user && user.emailVerified === true)
}

export async function signInSchedulingStaff(
  email: string,
  password: string,
  signIn: (email: string, password: string) => Promise<{ error?: unknown }>,
  confirmSession: (email: string) => Promise<{ ok: boolean }>,
) {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !password) throw new Error('Enter your staff email and password.')
  try {
    const result = await signIn(normalizedEmail, password)
    if (result.error) throw new Error('authentication_failed')
  } catch {
    throw new Error('Staff sign-in failed. Check your credentials and try again.')
  }
  let confirmed = false
  try { confirmed = (await confirmSession(normalizedEmail)).ok } catch {}
  if (!confirmed) throw new Error('Your verified staff session could not be confirmed. Verify your email or try signing in again. Scheduling permissions are unchanged.')
  return schedulingStaffReturnPath
}
