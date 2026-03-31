import Calendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetBatchCalendarEvents } from 'src/actions/calendar';
import { success, warning, error as errorColor } from 'src/theme/core';

import { CalendarRoot } from '../styles';
import { useCalendar } from '../hooks/use-calendar';
import { CalendarToolbar } from '../calendar-toolbar';

// ----------------------------------------------------------------------

const LEGEND = [
  { label: 'Vencido', color: errorColor.darker },
  { label: '≤ 7 días', color: errorColor.main },
  { label: '≤ 30 días', color: warning.main },
  { label: 'Vigente', color: success.main },
];

// ----------------------------------------------------------------------

export function CalendarView() {
  const { events, eventsLoading } = useGetBatchCalendarEvents();

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
              { value: 'dayGridMonth', label: 'Mes', icon: 'mingcute:calendar-month-line' },
              { value: 'timeGridWeek', label: 'Semana', icon: 'mingcute:calendar-week-line' },
              { value: 'timeGridDay', label: 'Día', icon: 'mingcute:calendar-day-line' },
              { value: 'listWeek', label: 'Agenda', icon: 'custom:calendar-agenda-outline' },
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
    </DashboardContent>
  );
}

