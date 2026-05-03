import { useState } from 'react';
import Calendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetBatchCalendarEvents } from 'src/actions/calendar';
import { success, warning, error as errorColor } from 'src/theme/core';

import { CalendarRoot } from '../styles';
import { useCalendar } from '../hooks/use-calendar';
import { CalendarToolbar } from '../calendar-toolbar';

// ----------------------------------------------------------------------

const LEGEND = [
  { label: 'Vencido',   color: errorColor.darker },
  { label: '≤ 7 días',  color: errorColor.main },
  { label: '≤ 30 días', color: warning.main },
  { label: 'Vigente',   color: success.main },
];

// "2027-07-27" → "Julio de 2027"
function formatMonthYear(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const s = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Today's YYYY-MM string, computed once
function todayYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ----------------------------------------------------------------------

export function CalendarView() {
  const { events, eventsLoading } = useGetBatchCalendarEvents();
  const [currentYearMonth, setCurrentYearMonth] = useState(todayYearMonth);

  const {
    calendarRef,
    view,
    title,
    onChangeView,
    onDateNavigation,
  } = useCalendar();

  const flexStyles = {
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
  };

  // Events that start in the currently visible month (safe string compare — no TZ issues)
  const monthEvents = events.filter((ev) => ev.start?.startsWith(currentYearMonth));

  return (
    <DashboardContent maxWidth="xl" sx={{ ...flexStyles }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: { xs: 3, md: 5 },
        }}
      >
        <Typography variant="h4">Calendario de vencimientos</Typography>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          {LEGEND.map((l) => (
            <Chip
              key={l.label}
              label={l.label}
              size="small"
              sx={{ bgcolor: l.color, color: '#fff', fontWeight: 600 }}
            />
          ))}
        </Stack>
      </Box>

      <Card sx={{ ...flexStyles, minHeight: '50vh' }}>
        <CalendarRoot sx={{ ...flexStyles }}>
          <CalendarToolbar
            view={view}
            title={title}
            canReset={false}
            loading={eventsLoading}
            onChangeView={onChangeView}
            onDateNavigation={onDateNavigation}
            onOpenFilters={() => {}}
            viewOptions={[
              { value: 'dayGridMonth', label: 'Mes',    icon: 'mingcute:calendar-month-line' },
              { value: 'timeGridWeek', label: 'Semana', icon: 'mingcute:calendar-week-line' },
              { value: 'timeGridDay',  label: 'Día',    icon: 'mingcute:calendar-day-line' },
              { value: 'listWeek',     label: 'Agenda', icon: 'custom:calendar-agenda-outline' },
            ]}
          />

          <Calendar
            weekends
            firstDay={1}
            aspectRatio={3}
            dayMaxEvents={3}
            eventMaxStack={2}
            rerenderDelay={10}
            headerToolbar={false}
            eventDisplay="block"
            ref={calendarRef}
            initialView={view}
            events={events}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            datesSet={(dateInfo) => {
              const d = dateInfo.view.currentStart;
              setCurrentYearMonth(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              );
            }}
            eventContent={(arg) => (
              <Box
                title={`${arg.event.title}\nStk: ${arg.event.extendedProps?.batch?.quantity ?? '—'}`}
                sx={{
                  px: 0.5,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'default',
                }}
              >
                {arg.event.title}
              </Box>
            )}
          />
        </CalendarRoot>
      </Card>

      {/* ── Monthly batch list ────────────────────────────────────────── */}
      <Card sx={{ mt: 3 }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: monthEvents.length > 0 ? 2 : 0 }}>
            Lotes que vencen en {formatMonthYear(currentYearMonth)}
          </Typography>

          {monthEvents.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
              No hay lotes que venzan en este mes.
            </Typography>
          ) : (
            <Stack divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />}>
              {monthEvents.map((ev) => {
                const parts = ev.title.split(' \u2014 '); // em dash separator
                const productName = parts[0] ?? ev.title;
                const lotCode = parts[1] ?? null;
                const statusLabel = LEGEND.find((l) => l.color === ev.color)?.label ?? 'Vigente';

                return (
                  <Box
                    key={ev.id}
                    sx={{
                      py: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {productName}
                      </Typography>
                      {lotCode && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Lote: {lotCode}
                        </Typography>
                      )}
                    </Box>

                    <Stack direction="row" spacing={1.5} alignItems="center" flexShrink={0}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {ev.start}
                      </Typography>
                      <Typography variant="body2">
                        Stock:{' '}
                        <Box component="span" sx={{ fontWeight: 700 }}>
                          {ev.extendedProps?.batch?.quantity ?? '—'}
                        </Box>
                      </Typography>
                      <Chip
                        label={statusLabel}
                        size="small"
                        sx={{ bgcolor: ev.color, color: '#fff', fontWeight: 600 }}
                      />
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      </Card>
    </DashboardContent>
  );
}
