import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { DATABASE, type Database } from '../../database/database.module.js';
import { MailService } from '../mail/mail.service.js';
import type { AuthInstance } from './auth.contract.js';
import {
  admin,
  createAuth,
  drizzleStore,
  github,
  google,
  type OAuthProvider,
} from './custom/index.js';

/** Providers are enabled only when their credentials are configured. */
function socialProviders(config: ConfigService<Env, true>): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  const githubId = config.get('GITHUB_CLIENT_ID', { infer: true });
  const githubSecret = config.get('GITHUB_CLIENT_SECRET', { infer: true });
  if (githubId && githubSecret) {
    providers.push(github({ clientId: githubId, clientSecret: githubSecret }));
  }
  const googleId = config.get('GOOGLE_CLIENT_ID', { infer: true });
  const googleSecret = config.get('GOOGLE_CLIENT_SECRET', { infer: true });
  if (googleId && googleSecret) {
    providers.push(google({ clientId: googleId, clientSecret: googleSecret }));
  }
  return providers;
}

/**
 * The only place that knows which auth implementation is used.
 * Replace the body of this factory to plug another library.
 */
export const authFactory = {
  inject: [ConfigService, DATABASE, MailService],
  useFactory(
    config: ConfigService<Env, true>,
    db: Database,
    mail: MailService,
  ): AuthInstance {
    const webUrl = config.get('WEB_URL', { infer: true });

    return createAuth({
      baseURL: `${webUrl}/api/auth`,
      secret: config.get('AUTH_SECRET', { infer: true }),
      trustedOrigins: [webUrl],
      store: drizzleStore(db),
      socialProviders: socialProviders(config),
      errorURL: '/sign-in',
      plugins: [
        admin({ adminEmails: config.get('ADMIN_EMAILS', { infer: true }) }),
      ],
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
      },
      emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        autoSignInAfterVerification: true,
        async sendVerificationEmail({ user, url }) {
          await mail.send({
            to: user.email,
            subject: 'Confirm your Dashboard account',
            text: `Hello ${user.name},\n\nConfirm your email address: ${url}\n\nThis link expires in one hour.`,
          });
        },
      },
      emailResetPassword: {
        async sendResetPassword({ user, url }) {
          await mail.send({
            to: user.email,
            subject: 'Reset Pasword Link',
            text: `Hello ${user.name},\n\nHere is you reset password link : ${url}\n\nThis link expires in one hour.`,
          });
        },
      },
      rateLimit: {
        window: 60,
        max: 100,
        customRules: {
          '/sign-in/email': { window: 60, max: 5 },
          '/sign-up/email': { window: 60, max: 5 },
          '/send-verification-email': { window: 60, max: 3 },
          '/sign-in/social': { window: 60, max: 10 },
          '/update-password': { window: 60, max: 5 },
          '/request-password-reset': { window: 60, max: 3 },
          '/reset-password': { window: 60, max: 5 },
        },
      },
    });
  },
};
