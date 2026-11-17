// ----------------------------------------------------------------------
// Días de México para cortes y reportes. El API guarda las fechas en UTC y
// cuenta los días de México igual (UTC−6): sin esto, lo vendido después de
// las 6 pm se iba al día siguiente.
// ponytail: offset fijo (México no tiene horario de verano desde 2022); si
// vuelve, usar Intl con 'America/Mexico_City'.
// ----------------------------------------------------------------------

const MX_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const isoUtc = (ms) => new Date(ms).toISOString().slice(0, 19);

// Hoy en México, 'YYYY-MM-DD'
export const mxToday = (now = Date.now()) => new Date(now - MX_OFFSET_MS).toISOString().slice(0, 10);

// Del inicio del día `from` al final del día `to` (México), en UTC sin zona
export const mxDayRangeUtc = (from, to) => ({
  from: isoUtc(Date.parse(`${from}T00:00:00Z`) + MX_OFFSET_MS),
  to: isoUtc(Date.parse(`${to}T00:00:00Z`) + MX_OFFSET_MS + DAY_MS - 1000),
});
