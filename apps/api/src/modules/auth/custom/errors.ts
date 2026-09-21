export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  toResponse(): Response {
    return Response.json(
      { code: this.code, message: this.message },
      { status: this.status },
    );
  }
}

export const Errors = {
  invalidBody: (message: string) =>
    new AuthError(400, 'INVALID_BODY', message),
  invalidCredentials: () =>
    new AuthError(401, 'INVALID_EMAIL_OR_PASSWORD', 'Invalid email or password'),
  emailNotVerified: () =>
    new AuthError(403, 'EMAIL_NOT_VERIFIED', 'Email is not verified'),
  userAlreadyExists: () =>
    new AuthError(422, 'USER_ALREADY_EXISTS', 'User already exists'),
  invalidToken: () =>
    new AuthError(400, 'INVALID_TOKEN', 'Invalid or expired token'),
  untrustedOrigin: () =>
    new AuthError(403, 'INVALID_ORIGIN', 'Invalid origin'),
  invalidCallbackURL: () =>
    new AuthError(403, 'INVALID_CALLBACK_URL', 'Invalid callback URL'),
  tooManyRequests: (retryAfter: number) =>
    new AuthError(
      429,
      'TOO_MANY_REQUESTS',
      `Too many requests, retry in ${retryAfter}s`,
    ),
  notFound: () => new AuthError(404, 'NOT_FOUND', 'Not found'),
  unauthorized: () => new AuthError(401, 'UNAUTHORIZED', 'Unauthorized'),
  forbidden: () => new AuthError(403, 'FORBIDDEN', 'Forbidden'),
  userBanned: () =>
    new AuthError(403, 'USER_BANNED', 'This account has been suspended'),
};
