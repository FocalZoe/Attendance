import { describe, expect, it } from 'vitest';
import { csvEscape, toCsv } from './csv';

describe('csvEscape', () => {
  it('returns empty string for null and undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('keeps plain text and numbers unchanged', () => {
    expect(csvEscape('王小明')).toBe('王小明');
    expect(csvEscape(12)).toBe('12');
    expect(csvEscape(-3)).toBe('-3');
  });

  it('quotes fields containing commas, quotes or newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralizes spreadsheet formula injection in text', () => {
    expect(csvEscape('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(csvEscape('+1')).toBe("'+1");
    expect(csvEscape('-1')).toBe("'-1");
    expect(csvEscape('@cmd')).toBe("'@cmd");
    expect(csvEscape('=1,2')).toBe('"\'=1,2"');
  });
});

describe('toCsv', () => {
  it('joins rows with CRLF', () => {
    expect(toCsv([['a', 'b'], [1, null]])).toBe('a,b\r\n1,');
  });
});
