import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { uploadToCloudinary } from 'src/lib/cloudinary';
import { DashboardContent } from 'src/layouts/dashboard';
import { updateSiteMedia, useGetSiteSettings } from 'src/actions/site';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------
// Media del sitio publico. Son slots con nombre fijo, no una biblioteca: cada
// hueco dice donde aparece, porque el sitio tiene diseno editorial y cambiar
// una foto por otra de proporcion distinta se nota.
// ----------------------------------------------------------------------

const SLOTS = [
  { key: 'hero_video_mp4', label: 'Video del hero (MP4)', where: 'Portada · fondo de la primera pantalla', type: 'video' },
  { key: 'hero_video_webm', label: 'Video del hero (WebM)', where: 'Portada · mismo video, formato alterno', type: 'video' },
  { key: 'hero_poster', label: 'Poster del hero', where: 'Portada · cuadro fijo mientras carga el video', type: 'image' },
  { key: 'moss_tall', label: 'Musgo vertical', where: 'Preguntas frecuentes, El criadero y el divisor 3D', type: 'image' },
  { key: 'moss_wide', label: 'Musgo horizontal', where: 'Portada · cierre y rejilla de categorías', type: 'image' },
  { key: 'leaf_litter', label: 'Hojarasca', where: 'Portada · bloque de sustrato y categorías', type: 'image' },
  { key: 'terrarium', label: 'Terrario', where: 'Divisor 3D de las vistas interiores', type: 'image' },
  { key: 'isopod_zebra', label: 'Isópodo cebra', where: 'Portada · bloque de proteína y categorías', type: 'image' },
  { key: 'isopod_cubaris', label: 'Isópodo Cubaris', where: 'Portada · bloque de calcio y categorías', type: 'image' },
];

export function SiteMediaView() {
  const { site, siteLoading, siteMutate } = useGetSiteSettings();
  const [busy, setBusy] = useState(null); // key del slot que se está subiendo

  const handlePick = async (slot, file) => {
    if (!file) return;
    setBusy(slot.key);
    try {
      const url = await uploadToCloudinary(file, slot.type);
      await updateSiteMedia({ [slot.key]: url });
      await siteMutate();
      toast.success('Actualizado. El sitio lo muestra en ~1 minuto.');
    } catch (error) {
      toast.error(error.message || 'Error al subir el archivo');
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Media del sitio"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sitio web' },
          { name: 'Media' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Los cambios aparecen en el sitio en aproximadamente un minuto.
      </Typography>

      {siteLoading ? (
        <Typography>Cargando…</Typography>
      ) : (
        <Grid container spacing={3}>
          {SLOTS.map((slot) => (
            <Grid key={slot.key} size={{ xs: 12, sm: 6, md: 4 }}>
              <SlotCard
                slot={slot}
                src={site?.media?.[slot.key] ?? ''}
                busy={busy === slot.key}
                disabled={!!busy}
                onPick={(file) => handlePick(slot, file)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

function SlotCard({ slot, src, busy, disabled, onPick }) {
  return (
    <Card sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        sx={{
          aspectRatio: '16 / 10',
          borderRadius: 1.5,
          overflow: 'hidden',
          bgcolor: 'background.neutral',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {!src ? (
          <Iconify icon="solar:gallery-bold" width={32} sx={{ color: 'text.disabled' }} />
        ) : slot.type === 'video' ? (
          // muted+loop: la vista previa no debe hacer ruido al abrir la pagina
          <Box component="video" src={src} muted loop playsInline controls sx={{ width: 1, height: 1, objectFit: 'cover' }} />
        ) : (
          <Box component="img" src={src} alt={slot.label} sx={{ width: 1, height: 1, objectFit: 'cover' }} />
        )}
      </Box>

      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle2">{slot.label}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {slot.where}
        </Typography>
      </Box>

      <Button
        component="label"
        variant="outlined"
        size="small"
        disabled={disabled}
        startIcon={<Iconify icon={busy ? 'eos-icons:loading' : 'solar:upload-bold'} width={16} />}
      >
        {busy ? 'Subiendo…' : 'Reemplazar'}
        {/* El input va anidado y SIN htmlFor: un label que ademas contiene al
            input dispara el click dos veces si encima lo apunta por id. */}
        <Box
          component="input"
          type="file"
          accept={slot.type === 'video' ? 'video/*' : 'image/*'}
          hidden
          // value se limpia para poder volver a elegir el MISMO archivo
          onChange={(event) => {
            onPick(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </Button>
    </Card>
  );
}
