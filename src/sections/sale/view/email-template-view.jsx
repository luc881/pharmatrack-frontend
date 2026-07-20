import useSWR from 'swr';
import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import axiosInstance, { fetcher } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { toast } from 'src/components/snackbar';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------
// Plantilla del correo de ticket: nombre del negocio, mensaje inicial y
// despedida. El backend combina con defaults y arma el HTML.
// ----------------------------------------------------------------------

const URL = '/api/v1/settings/email-ticket';

export function EmailTemplateView() {
  const { data, mutate } = useSWR(URL, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.put(URL, form);
      await mutate(res.data, { revalidate: false });
      toast.success('Plantilla guardada');
    } catch (error) {
      toast.error(error?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Correo de ticket"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Ventas', href: paths.dashboard.sale.root },
          { name: 'Correo de ticket' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: 3, maxWidth: 640 }}>
        {!form ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Cargando…
          </Typography>
        ) : (
          <Stack spacing={3}>
            <TextField
              label="Nombre del negocio"
              value={form.business_name}
              onChange={set('business_name')}
              helperText="Aparece en el asunto y el encabezado del correo"
            />
            <TextField
              label="Mensaje inicial (opcional)"
              value={form.intro_message}
              onChange={set('intro_message')}
              multiline
              minRows={2}
              helperText="Se muestra arriba de la lista de productos, p. ej. instrucciones de cuidado o garantía"
            />
            <TextField
              label="Mensaje de despedida"
              value={form.footer_message}
              onChange={set('footer_message')}
              multiline
              minRows={2}
            />
            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                disabled={saving || !form.business_name?.trim()}
                onClick={handleSave}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </Stack>
          </Stack>
        )}
      </Card>
    </DashboardContent>
  );
}
