import { DateTime } from 'luxon';

/**
 * Helpers for masked date typing driven by the document's date format setting.
 *
 * Storage stays ISO (`YYYY-MM-DD`); these helpers only translate between what
 * the author types/sees and the stored value, so free typing can't silently
 * produce ambiguous dates like 01/02/2026.
 *
 * Auto-formatting applies to numeric patterns (dd/MM/yyyy, MM/dd/yyyy,
 * yyyy-MM-dd, dd-MM-yyyy, dd.MM.yyyy, yy-MM-dd and their datetime variants).
 * Formats with month names (MMMM/EEEE) fall back to strict parsing.
 */

type DatePart = 'day' | 'month' | 'year';

const TOKEN_PART: Record<string, DatePart> = {
  dd: 'day',
  MM: 'month',
  yyyy: 'year',
  yy: 'year',
};

export type DateFormatStructure = {
  /** Ordered date parts, e.g. ['day','month','year'] for dd/MM/yyyy. */
  parts: DatePart[];
  /** Digit counts per part, e.g. [2,2,4]. */
  lengths: number[];
  /** Separator between parts, e.g. '/'. */
  separator: string;
  /** The luxon date pattern the structure was derived from. */
  pattern: string;
};

export const getDateFormatStructure = (format: string | null | undefined): DateFormatStructure | null => {
  if (!format) {
    return null;
  }

  const datePart = format.split(/\s+/)[0];

  // Month names / weekdays can't be typed as digits.
  if (/MMMM|MMM|EEEE|EEE|ccc|cccc/.test(datePart)) {
    return null;
  }

  const separatorMatch = datePart.match(/[^A-Za-z0-9]/);

  if (!separatorMatch) {
    return null;
  }

  const separator = separatorMatch[0];
  const tokens = datePart.split(separator);

  if (tokens.length !== 3) {
    return null;
  }

  const parts: DatePart[] = [];
  const lengths: number[] = [];

  for (const token of tokens) {
    const part = TOKEN_PART[token];

    if (!part || parts.includes(part)) {
      return null;
    }

    parts.push(part);
    lengths.push(token.length);
  }

  // Sanity: day/month are 2 digits, year is 2 or 4.
  const dayLength = lengths[parts.indexOf('day')];
  const monthLength = lengths[parts.indexOf('month')];
  const yearLength = lengths[parts.indexOf('year')];

  if (dayLength !== 2 || monthLength !== 2 || (yearLength !== 2 && yearLength !== 4)) {
    return null;
  }

  return { parts, lengths, separator, pattern: datePart };
};

/**
 * Progressively format digit input per the format structure, inserting the
 * separator automatically: "0112" -> "01/12", "01122026" -> "01/12/2026".
 * Non-digit characters are stripped. Output never exceeds the full length.
 */
export const autoFormatDateInput = (raw: string, structure: DateFormatStructure | null): string => {
  const digits = raw.replace(/\D/g, '');

  if (!structure) {
    return digits;
  }

  const chunks: string[] = [];
  let rest = digits;

  for (const length of structure.lengths) {
    if (rest.length === 0) {
      break;
    }

    chunks.push(rest.slice(0, length));
    rest = rest.slice(length);
  }

  return chunks.join(structure.separator);
};

/**
 * Parse user input into an ISO date (`YYYY-MM-DD`), or null when invalid.
 * Accepts the formatted value, plain digits, and ISO as fallback.
 */
export const parseFormattedDateInput = (input: string, format: string | null | undefined): string | null => {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  // Strict ISO always wins so stored values round-trip regardless of format.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const fromIso = DateTime.fromISO(trimmed);

    return fromIso.isValid ? trimmed : null;
  }

  const structure = getDateFormatStructure(format);

  if (structure) {
    const digits = trimmed.replace(/\D/g, '');
    const expectedDigits = structure.lengths.reduce((sum, length) => sum + length, 0);

    if (digits.length === expectedDigits) {
      const chunks: string[] = [];
      let rest = digits;

      for (const length of structure.lengths) {
        chunks.push(rest.slice(0, length));
        rest = rest.slice(length);
      }

      const parsed = DateTime.fromFormat(chunks.join(structure.separator), structure.pattern);

      if (parsed.isValid) {
        return parsed.toISODate();
      }

      return null;
    }
  }

  // Fallback: strict format-aware parsing for month names etc.
  if (format) {
    const datePart = format.split(/\s+/)[0];
    const fromFormat = DateTime.fromFormat(trimmed, datePart);

    if (fromFormat.isValid) {
      return fromFormat.toISODate();
    }
  }

  return null;
};

/**
 * Format an ISO date for display per the document format. Falls back to the
 * raw value when it cannot be parsed.
 */
export const formatIsoDateForDisplay = (iso: string | null | undefined, format: string | null | undefined): string => {
  if (!iso) {
    return '';
  }

  const parsed = DateTime.fromISO(iso);

  if (!parsed.isValid) {
    return iso;
  }

  if (!format) {
    return iso;
  }

  return parsed.toFormat(format.split(/\s+/)[0]);
};

/**
 * Placeholder showing the expected shape, e.g. DD/MM/YYYY.
 */
export const getDateFormatPlaceholder = (format: string | null | undefined): string => {
  const structure = getDateFormatStructure(format);

  if (!structure) {
    return 'YYYY-MM-DD';
  }

  const labels: Record<DatePart, string> = {
    day: 'DD',
    month: 'MM',
    year: structure.lengths[structure.parts.indexOf('year')] === 2 ? 'YY' : 'YYYY',
  };

  return structure.parts.map((part) => labels[part]).join(structure.separator);
};
