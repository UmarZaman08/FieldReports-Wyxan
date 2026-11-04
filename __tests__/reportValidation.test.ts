import { MAX_REPORT_IMAGES, MIN_REPORT_IMAGES, validateReport } from '../src/screens/Draft/validation';

describe('validateReport', () => {
  it('rejects descriptions containing only whitespace', () => {
    expect(validateReport('  \n ', MIN_REPORT_IMAGES)).toMatch(/description/i);
  });

  it('requires at least one image', () => {
    expect(validateReport('Loose railing', 0)).toMatch(/at least one photo/i);
  });

  it('allows a nonblank report with one through five images', () => {
    for (let count = MIN_REPORT_IMAGES; count <= MAX_REPORT_IMAGES; count += 1) {
      expect(validateReport('Loose railing', count)).toBeNull();
    }
  });

  it('rejects more than five images', () => {
    expect(validateReport('Loose railing', MAX_REPORT_IMAGES + 1)).toMatch(/up to five/i);
  });
});
