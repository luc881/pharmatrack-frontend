import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

const PRESET_AVATARS = Array.from(
  { length: 25 },
  (_, i) => `/assets/images/mock/avatar/avatar-${i + 1}.webp`
);

// ----------------------------------------------------------------------

export function AvatarPicker({ value, onChange }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
        Avatares predefinidos
      </Typography>

      <Box
        sx={{
          gap: 1,
          display: 'flex',
          flexWrap: 'wrap',
        }}
      >
        {PRESET_AVATARS.map((src) => {
          const selected = value === src;
          return (
            <Tooltip key={src} title={selected ? 'Seleccionado' : 'Seleccionar'}>
              <Avatar
                src={src}
                onClick={() => onChange(selected ? '' : src)}
                sx={{
                  width: 48,
                  height: 48,
                  cursor: 'pointer',
                  opacity: selected ? 1 : 0.55,
                  outline: selected ? '3px solid' : '2px solid transparent',
                  outlineColor: selected ? 'primary.main' : 'transparent',
                  outlineOffset: '2px',
                  transition: 'all 0.15s',
                  '&:hover': { opacity: 1, outlineColor: 'text.disabled' },
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}
