import { it, expect, describe } from 'vitest';

import { mxToday, mxDayRangeUtc } from 'src/utils/mx-day';

// El corte se hace por días de México, también de noche (después de las 6 pm
// en México ya es el día siguiente en UTC).
describe('días de México', () => {
  it('a las 6:30 pm del 16 en México, hoy sigue siendo el 16', () => {
    expect(mxToday(Date.parse('2026-11-17T00:30:00Z'))).toBe('2026-11-16');
    expect(mxToday(Date.parse('2026-11-16T12:00:00Z'))).toBe('2026-11-16');
    // la medianoche de México
    expect(mxToday(Date.parse('2026-11-17T06:00:00Z'))).toBe('2026-11-17');
  });

  it('un día de México va de las 6:00 UTC a las 5:59:59 UTC del día siguiente', () => {
    expect(mxDayRangeUtc('2026-11-16', '2026-11-16')).toEqual({
      from: '2026-11-16T06:00:00',
      to: '2026-11-17T05:59:59',
    });
    expect(mxDayRangeUtc('2026-11-01', '2026-11-30')).toEqual({
      from: '2026-11-01T06:00:00',
      to: '2026-12-01T05:59:59',
    });
  });
});
