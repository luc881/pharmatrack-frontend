import { useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { uploadToCloudinary } from 'src/lib/cloudinary';

import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Fotos de una especie o variedad. Son la fuente de verdad: la tienda, la
// venta rápida y los ejemplares sin foto propia usan estas. La primera es la
// principal.
// ----------------------------------------------------------------------

export function TaxonPhotosField({ photos, onChange, onUploading }) {
  const [uploading, setUploading] = useState(false);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState(null);

  // Un link externo lo descarga Cloudinary y queda guardado allá (no se
  // pierde si la página original lo borra); uno de Cloudinary va tal cual
  const addLink = async () => {
    const url = link.trim();
    if (!/^https?:\/\//i.test(url)) {
      setLinkError('Pega un link que empiece con https://');
      return;
    }
    setLinkError(null);
    if (/^https:\/\/res\.cloudinary\.com\//i.test(url)) {
      onChange((prev) => [...prev, url]);
      setLink('');
      return;
    }
    setUploading(true);
    onUploading?.(true);
    try {
      const stored = await uploadToCloudinary(url);
      onChange((prev) => [...prev, stored]);
      setLink('');
    } catch (error) {
      setLinkError(error?.message || 'No se pudo subir ese link');
    } finally {
      setUploading(false);
      onUploading?.(false);
    }
  };

  const upload = async (files) => {
    if (!files.length) return;
    setUploading(true);
    onUploading?.(true);
    try {
      const urls = await Promise.all(files.map((file) => uploadToCloudinary(file)));
      onChange((prev) => [...prev, ...urls]);
    } catch (error) {
      toast.error(error?.message || 'Error al subir las fotos');
    } finally {
      setUploading(false);
      onUploading?.(false);
    }
  };

  const remove = (index) => onChange((prev) => prev.filter((_, i) => i !== index));
  const makeMain = (index) =>
    onChange((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);

  return (
    <Box role="group" aria-label="Fotos">
      <Typography variant="subtitle2">Fotos</Typography>
      <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: 'text.secondary' }}>
        La tienda, la venta rápida y los ejemplares sin foto propia usan estas. La primera es la
        principal.
      </Typography>

      <Box
        sx={{
          gap: 1.5,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
        }}
      >
        {photos.map((url, index) => (
          <Stack key={url} spacing={0.5}>
            <Box
              component="img"
              src={url}
              alt={index === 0 ? 'Foto principal' : `Foto ${index + 1}`}
              sx={{
                width: 1,
                aspectRatio: '1',
                objectFit: 'cover',
                borderRadius: 1,
                outline: index === 0 ? '2px solid' : 'none',
                outlineColor: 'primary.main',
              }}
            />
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              {index === 0 ? (
                <Typography variant="caption" sx={{ color: 'primary.main', alignSelf: 'center' }}>
                  Principal
                </Typography>
              ) : (
                <Button
                  size="small"
                  aria-label={`Hacer principal la foto ${index + 1}`}
                  onClick={() => makeMain(index)}
                >
                  Principal
                </Button>
              )}
              <Button
                size="small"
                color="error"
                aria-label={`Quitar foto ${index + 1}`}
                onClick={() => remove(index)}
              >
                Quitar
              </Button>
            </Stack>
          </Stack>
        ))}

        <Button
          component="label"
          variant="outlined"
          disabled={uploading}
          sx={{ aspectRatio: '1', flexDirection: 'column', gap: 0.5 }}
        >
          {uploading ? 'Subiendo…' : '+ Subir fotos'}
          {/* Input anidado y sin htmlFor (mismo patrón que site-media-view) */}
          <Box
            component="input"
            type="file"
            accept="image/*"
            multiple
            hidden
            aria-label="Subir fotos"
            onChange={(event) => {
              upload([...(event.target.files ?? [])]);
              event.target.value = '';
            }}
          />
        </Button>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'flex-start' }}>
        <TextField
          size="small"
          label="o pega un link"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setLinkError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addLink();
            }
          }}
          error={Boolean(linkError)}
          helperText={linkError ?? 'Se guarda en Cloudinary'}
          sx={{ flex: 1, maxWidth: 420 }}
        />
        <Button variant="outlined" disabled={!link.trim() || uploading} onClick={addLink}>
          Subir link
        </Button>
      </Stack>
    </Box>
  );
}
