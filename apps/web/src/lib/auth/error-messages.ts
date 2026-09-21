const messages: Record<string, string> = {
  ACCESS_DENIED: "Authorization was cancelled.",
  ACCOUNT_NOT_LINKED:
    "An account already uses this email. Sign in with your password, then link the provider from your settings.",
  ACCOUNT_ALREADY_LINKED: "This account is already linked to another user.",
  EMAIL_NOT_FOUND: "The provider did not share an email address.",
  EMAIL_NOT_VERIFIED: "Confirm your email first. We sent you a link.",
  USER_BANNED: "This account has been suspended.",
  STATE_MISMATCH: "The sign in link expired, please try again.",
  STATE_EXPIRED: "The sign in link expired, please try again.",
  OAUTH_FAILED: "Could not complete the sign in with the provider.",
  INVALID_TOKEN: "This link is invalid or has expired.",
};

export function authErrorMessage(code: string | string[] | undefined): string | null {
  if (typeof code !== "string") return null;
  return messages[code] ?? "Something went wrong, please try again.";
}
