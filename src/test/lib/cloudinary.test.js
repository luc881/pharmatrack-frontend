import { it, vi, expect, describe, afterEach } from 'vitest';

import { keepInCloudinary } from 'src/lib/cloudinary';

describe('keepInCloudinary', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('copia a Cloudinary un link de otra página', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ secure_url: 'https://res.cloudinary.com/demo/image/upload/copia.jpg' }),
    }));
    vi.stubGlobal('fetch', fetch);

    expect(await keepInCloudinary('https://picsum.photos/seed/x/1200/675')).toBe(
      'https://res.cloudinary.com/demo/image/upload/copia.jpg'
    );
    expect(fetch.mock.calls[0][1].body.get('file')).toBe('https://picsum.photos/seed/x/1200/675');
  });

  it('deja igual un link que ya está en Cloudinary, o uno vacío', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const mine = 'https://res.cloudinary.com/demo/image/upload/mia.jpg';
    expect(await keepInCloudinary(mine)).toBe(mine);
    expect(await keepInCloudinary('')).toBe('');
    expect(fetch).not.toHaveBeenCalled();
  });
});
