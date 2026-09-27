import { accessSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLUB_PHOTOS, clubPhotoSrc } from './clubPhotos';

describe('club gallery photos', () => {
  it('points at English-named files in public/club', () => {
    expect(CLUB_PHOTOS).toHaveLength(5);
    for (const photo of CLUB_PHOTOS) {
      expect(photo.file).toMatch(/^[a-z0-9-]+\.jpg$/);
      expect(clubPhotoSrc(photo.file)).toMatch(/\/club\/[a-z0-9-]+\.jpg$/);
      accessSync(resolve('public/club', photo.file));
    }
  });
});
