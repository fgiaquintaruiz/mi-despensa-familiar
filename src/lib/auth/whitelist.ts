export function isEmailAllowed(email: string): boolean {
  const raw = process.env.ALLOWED_EMAILS;
  if (!raw || raw.trim() === '') return true;

  const allowed = raw.split(',').map((e) => e.trim().toLowerCase());
  return allowed.includes(email.trim().toLowerCase());
}
