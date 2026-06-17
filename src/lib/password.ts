export const ADMIN_ACTION_PASSWORD = '020114'

/** Matches iOS AuthManager.requirePasswordForAction — non-admins must enter the action password. */
export function requirePasswordForAction(isAdmin: boolean): boolean {
  return !isAdmin
}
