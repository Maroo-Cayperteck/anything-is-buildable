export const EMAIL_DOMAIN = "students.example.com";

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${EMAIL_DOMAIN}`;
}
