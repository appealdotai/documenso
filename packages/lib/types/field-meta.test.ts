import { describe, expect, it } from 'vitest';

import { FIELD_DEFAULT_FONT_FAMILY, FIELD_TEXT_META_DEFAULT_VALUES, ZTextFieldMeta } from './field-meta';

describe('ZTextFieldMeta font family', () => {
  it('accepts a supported font family', () => {
    const result = ZTextFieldMeta.parse({
      type: 'text',
      fontFamily: 'caveat',
    });

    expect(result.fontFamily).toBe('caveat');
  });

  it('rejects an unsupported font family', () => {
    expect(
      ZTextFieldMeta.safeParse({
        type: 'text',
        fontFamily: 'comic-sans',
      }).success,
    ).toBe(false);
  });

  it('defaults new text fields to the noto sans font family', () => {
    expect(FIELD_DEFAULT_FONT_FAMILY).toBe('noto-sans');
    expect(FIELD_TEXT_META_DEFAULT_VALUES.fontFamily).toBe(FIELD_DEFAULT_FONT_FAMILY);
  });

  it('accepts Montserrat and font style flags', () => {
    const result = ZTextFieldMeta.parse({
      type: 'text',
      fontFamily: 'montserrat',
      bold: true,
      italic: true,
      underline: true,
    });

    expect(result.fontFamily).toBe('montserrat');
    expect(result.bold).toBe(true);
    expect(result.italic).toBe(true);
    expect(result.underline).toBe(true);
  });

  it('defaults font style flags to disabled', () => {
    expect(FIELD_TEXT_META_DEFAULT_VALUES.bold).toBe(false);
    expect(FIELD_TEXT_META_DEFAULT_VALUES.italic).toBe(false);
    expect(FIELD_TEXT_META_DEFAULT_VALUES.underline).toBe(false);
  });
});
