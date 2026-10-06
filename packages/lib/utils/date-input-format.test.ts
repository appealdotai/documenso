import { describe, expect, it } from 'vitest';

import {
  autoFormatDateInput,
  formatIsoDateForDisplay,
  getDateFormatPlaceholder,
  getDateFormatStructure,
  parseFormattedDateInput,
} from './date-input-format';

describe('getDateFormatStructure', () => {
  it('should parse day-first formats', () => {
    expect(getDateFormatStructure('dd/MM/yyyy')).toEqual({
      parts: ['day', 'month', 'year'],
      lengths: [2, 2, 4],
      separator: '/',
      pattern: 'dd/MM/yyyy',
    });
  });

  it('should parse year-first and dotted formats', () => {
    expect(getDateFormatStructure('yyyy-MM-dd')).toMatchObject({
      parts: ['year', 'month', 'day'],
      separator: '-',
    });
    expect(getDateFormatStructure('dd.MM.yyyy')).toMatchObject({ separator: '.' });
  });

  it('should ignore the time portion of datetime formats', () => {
    expect(getDateFormatStructure('dd/MM/yyyy HH:mm')).toMatchObject({
      parts: ['day', 'month', 'year'],
      separator: '/',
    });
  });

  it('should return null for month names, missing formats, or odd shapes', () => {
    expect(getDateFormatStructure(null)).toBeNull();
    expect(getDateFormatStructure('MMMM dd, yyyy')).toBeNull();
    expect(getDateFormatStructure('EEEE, MMMM dd, yyyy')).toBeNull();
    expect(getDateFormatStructure('yyyy-MM-dd')).not.toBeNull();
  });
});

describe('autoFormatDateInput', () => {
  it('should insert separators progressively', () => {
    const structure = getDateFormatStructure('dd/MM/yyyy');

    expect(autoFormatDateInput('0', structure)).toBe('0');
    expect(autoFormatDateInput('0112', structure)).toBe('01/12');
    expect(autoFormatDateInput('01122026', structure)).toBe('01/12/2026');
    expect(autoFormatDateInput('01122026111', structure)).toBe('01/12/2026');
  });

  it('should strip non-digits and respect part order', () => {
    expect(autoFormatDateInput('01-12-2026', getDateFormatStructure('MM/dd/yyyy'))).toBe('01/12/2026');
    expect(autoFormatDateInput('2026ab0102', getDateFormatStructure('yyyy-MM-dd'))).toBe('2026-01-02');
  });
});

describe('parseFormattedDateInput', () => {
  it('should parse formatted values per the document format', () => {
    expect(parseFormattedDateInput('01/12/2026', 'dd/MM/yyyy')).toBe('2026-12-01');
    expect(parseFormattedDateInput('12/01/2026', 'MM/dd/yyyy')).toBe('2026-12-01');
    expect(parseFormattedDateInput('2026-01-02', 'yyyy-MM-dd')).toBe('2026-01-02');
  });

  it('should accept plain digits', () => {
    expect(parseFormattedDateInput('01122026', 'dd/MM/yyyy')).toBe('2026-12-01');
  });

  it('should reject impossible dates and incomplete input', () => {
    expect(parseFormattedDateInput('99/99/2026', 'dd/MM/yyyy')).toBeNull();
    expect(parseFormattedDateInput('01/12', 'dd/MM/yyyy')).toBeNull();
    expect(parseFormattedDateInput('not a date', 'dd/MM/yyyy')).toBeNull();
    expect(parseFormattedDateInput('', 'dd/MM/yyyy')).toBeNull();
  });

  it('should still accept ISO as fallback', () => {
    expect(parseFormattedDateInput('2026-12-01', 'dd/MM/yyyy')).toBe('2026-12-01');
  });
});

describe('formatIsoDateForDisplay', () => {
  it('should format per the document format', () => {
    expect(formatIsoDateForDisplay('2026-12-01', 'dd/MM/yyyy')).toBe('01/12/2026');
    expect(formatIsoDateForDisplay('2026-12-01', 'MM/dd/yyyy')).toBe('12/01/2026');
    expect(formatIsoDateForDisplay('', 'dd/MM/yyyy')).toBe('');
    expect(formatIsoDateForDisplay('garbage', 'dd/MM/yyyy')).toBe('garbage');
  });
});

describe('getDateFormatPlaceholder', () => {
  it('should show the expected shape', () => {
    expect(getDateFormatPlaceholder('dd/MM/yyyy')).toBe('DD/MM/YYYY');
    expect(getDateFormatPlaceholder('MM/dd/yyyy')).toBe('MM/DD/YYYY');
    expect(getDateFormatPlaceholder('yyyy-MM-dd')).toBe('YYYY-MM-DD');
    expect(getDateFormatPlaceholder(null)).toBe('YYYY-MM-DD');
  });
});
