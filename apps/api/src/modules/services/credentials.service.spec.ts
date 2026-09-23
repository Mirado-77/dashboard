import type { ConfigService } from '@nestjs/config';
import { createSecretBox } from '../../common/secret-box.js';
import { CredentialsCipher } from './credentials.service.js';
import type { Env } from '../../config/env.js';

const SECRET = 'test-secret-test-secret-test-secret';

function cipher(secret = SECRET) {
  const config = { get: () => secret } as unknown as ConfigService<Env, true>;
  return new CredentialsCipher(config);
}

describe('CredentialsCipher', () => {
  it('reads back what it encrypted', () => {
    const box = cipher();
    const credentials = { username: 'rick', password: 'wubbalubba' };

    expect(box.decrypt(box.encrypt(credentials))).toEqual(credentials);
  });

  it('never stores the values in clear', () => {
    const payload = cipher().encrypt({ password: 'wubbalubba' });

    expect(payload).not.toContain('wubbalubba');
    expect(payload).not.toContain('password');
  });

  it('produces a different payload every time', () => {
    const box = cipher();
    const credentials = { password: 'wubbalubba' };

    expect(box.encrypt(credentials)).not.toBe(box.encrypt(credentials));
  });

  it('refuses a payload altered after encryption', () => {
    const box = cipher();
    const payload = box.encrypt({ password: 'wubbalubba' });
    const [version, iv, tag, data] = payload.split('.');
    const flipped = `${data[0] === 'A' ? 'B' : 'A'}${data.slice(1)}`;

    expect(() => box.decrypt([version, iv, tag, flipped].join('.'))).toThrow();
  });

  it('refuses a payload encrypted with another secret', () => {
    const payload = cipher().encrypt({ password: 'wubbalubba' });
    const other = cipher('another-secret-another-secret-42');

    expect(() => other.decrypt(payload)).toThrow();
  });

  it('refuses a payload encrypted for another purpose', () => {
    const auth = createSecretBox(SECRET);
    const payload = auth.encrypt(JSON.stringify({ password: 'wubbalubba' }));

    expect(() => cipher().decrypt(payload)).toThrow();
  });

  it('refuses a malformed payload', () => {
    expect(() => cipher().decrypt('not-a-payload')).toThrow();
  });
});
