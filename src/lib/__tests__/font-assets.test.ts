import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../../public/fonts/manifest.json';

describe('bundled font provenance', () => {
  it('keeps every font and license identical to the reviewed asset manifest', () => {
    expect(manifest.assets).toHaveLength(4);
    for (const asset of manifest.assets) {
      const data = readFileSync(path.join(process.cwd(), 'public/fonts', asset.file));
      expect(data.length).toBe(asset.bytes);
      expect(createHash('sha256').update(data).digest('hex')).toBe(asset.sha256);
      if (asset.kind === 'font') expect(data.subarray(0, 4).toString('hex')).toBe('00010000');
      else expect(data.toString('utf8')).toContain('SIL Open Font License, Version 1.1');
    }
  });
});
