import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { widgetIdPipe } from './widgets.controller.js';

describe('widgetIdPipe', () => {
  it('lets a UUID through', async () => {
    const id = randomUUID();

    await expect(widgetIdPipe.transform(id, { type: 'param' })).resolves.toBe(
      id,
    );
  });

  it.each(['abc', '1', `${randomUUID()}x`, 'x'.repeat(10_000)])(
    'rejects %s',
    async (id) => {
      const error = await widgetIdPipe
        .transform(id, { type: 'param' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'INVALID_WIDGET_ID',
      });
    },
  );
});
