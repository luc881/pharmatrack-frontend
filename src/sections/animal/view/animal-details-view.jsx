import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { SEX_LABELS, speciesLabel, STATUS_COLORS, STATUS_LABELS } from '../utils';

// ----------------------------------------------------------------------

function InfoRow({ label, children }) {
  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Typography variant="body2" sx={{ width: 120, flexShrink: 0, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box sx={{ typography: 'body2', minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export function AnimalDetailsView({ animal }) {
  const { user } = useAuthContext();
  const canUpdate = user?.permissions?.includes('animals.update');

  const gallery = useMemo(() => {
    const urls = [...(animal?.image ? [animal.image] : []), ...(animal?.photos ?? [])];
    return [...new Set(urls)];
  }, [animal]);

  const [selected, setSelected] = useState(0);

  if (!animal) return null;

  const group = animal.species?.genus?.group;

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={animal.code}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Animales', href: paths.dashboard.animal.root },
          { name: animal.code },
        ]}
        action={canUpdate && (
          <Button
            component={RouterLink}
            href={paths.dashboard.animal.edit(animal.id)}
            variant="contained"
            startIcon={<Iconify icon="solar:pen-bold" />}
          >
            Editar
          </Button>
        )}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: 3 }}>
        <Box sx={{ gap: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          {/* Galería */}
          <Box>
            {gallery.length > 0 ? (
              <>
                <Box
                  component="img"
                  src={gallery[selected]}
                  alt={animal.code}
                  sx={{
                    width: 1,
                    height: 360,
                    borderRadius: 1.5,
                    objectFit: 'cover',
                    bgcolor: 'background.neutral',
                  }}
                />
                {gallery.length > 1 && (
                  <Box sx={{ mt: 1.5, gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                    {gallery.map((url, index) => (
                      <Box
                        key={url}
                        component="img"
                        src={url}
                        alt={`Foto ${index + 1}`}
                        onClick={() => setSelected(index)}
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: 1,
                          objectFit: 'cover',
                          cursor: 'pointer',
                          border: (t) =>
                            `2px solid ${index === selected ? t.vars.palette.primary.main : 'transparent'}`,
                        }}
                      />
                    ))}
                  </Box>
                )}
              </>
            ) : (
              <Box
                sx={{
                  height: 360,
                  display: 'flex',
                  borderRadius: 1.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'background.neutral',
                  color: 'text.disabled',
                }}
              >
                <Iconify icon="solar:camera-bold" width={48} />
              </Box>
            )}
          </Box>

          {/* Datos */}
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h5">{animal.code}</Typography>
              <Label variant="soft" color={STATUS_COLORS[animal.status] ?? 'default'}>
                {STATUS_LABELS[animal.status] ?? animal.status}
              </Label>
            </Box>

            <Typography variant="h4" sx={{ color: 'primary.main' }}>
              {fCurrency(animal.price)}
            </Typography>

            <Divider sx={{ borderStyle: 'dashed' }} />

            <InfoRow label="Especie">{speciesLabel(animal.species) || '—'}</InfoRow>
            {group && <InfoRow label="Grupo">{group.name}</InfoRow>}
            <InfoRow label="Morphs">
              {animal.morphs?.length ? (
                <Box sx={{ gap: 0.5, display: 'flex', flexWrap: 'wrap' }}>
                  {animal.morphs.map((m) => (
                    <Chip key={m.id} size="small" variant="soft" label={m.name} />
                  ))}
                </Box>
              ) : (
                '—'
              )}
            </InfoRow>
            <InfoRow label="Sexo">{SEX_LABELS[animal.sex] ?? animal.sex}</InfoRow>
            <InfoRow label="Nacimiento">{animal.birth_date ?? '—'}</InfoRow>
            <InfoRow label="Costo">{fCurrency(animal.price_cost)}</InfoRow>

            <Divider sx={{ borderStyle: 'dashed' }} />

            <InfoRow label="Doc. legal">
              {!animal.requires_legal_doc ? (
                'No requiere'
              ) : !animal.legal_doc ? (
                <Label variant="soft" color="warning">
                  Pendiente
                </Label>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Label variant="soft" color="success">
                    {animal.legal_doc}
                  </Label>
                  {animal.legal_doc_url && (
                    <Link href={animal.legal_doc_url} target="_blank" rel="noopener" variant="body2">
                      Ver documento
                    </Link>
                  )}
                </Box>
              )}
            </InfoRow>

            {animal.description && (
              <>
                <Divider sx={{ borderStyle: 'dashed' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap' }}>
                  {animal.description}
                </Typography>
              </>
            )}
          </Stack>
        </Box>
      </Card>
    </DashboardContent>
  );
}
