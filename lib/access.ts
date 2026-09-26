// Who may spend the owner's API keys. Until payments exist, generation is
// limited to the emails listed in ALLOWED_EMAILS (comma-separated).
// Anyone can still sign up; they just see an "access pending" screen.

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.toLowerCase());
}
