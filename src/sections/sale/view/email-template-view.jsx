import useSWR from 'swr';
import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import axiosInstance, { fetcher } from 'src/lib/axios';
import { DashboardContent } from 'src/layouts/dashboard';

import { toast } from 'src/components/snackbar';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';


// ----------------------------------------------------------------------
// Datos del negocio: lo que se imprime en el ticket, los PDF, el WhatsApp y
// los correos. Cada instalación guarda los suyos (mientras no se guarden, el
// API devuelve los de Opuntia Den y aquí se avisa).
// ----------------------------------------------------------------------

// [campo, etiqueta, ayuda]
const TICKET_FIELDS = [
  ['tagline', 'Línea bajo el nombre', 'Ej. «Criadero · CDMX · Entregas a convenir»'],
  ['website', 'Sitio web', 'Como se lee en el ticket, sin https://'],
  ['instagram', 'Instagram', '@usuario'],
  ['phone', 'Teléfono', ''],
  ['contact_email', 'Correo de contacto', 'Recibo de venta en PDF'],
  ['folio_prefix', 'Prefijo del folio', 'OD → OD-000123. Letras y números, hasta 6. Vacío = solo el número'],
  ['ticket_qr_url', 'URL del QR del ticket', 'Vacío = el ticket sale sin QR'],
  ['ticket_logo_url', 'Logo del ticket (blanco y negro)', 'SVG o PNG. Vacío = sin logo'],
];

const URL = '/api/v1/settings/email-ticket';

export function EmailTemplateView() {
  const { data, mutate } = useSWR(URL, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [testResult, setTestResult] = useState(null);

  // Diagnóstico: los envíos de la operación nunca tumban un pedido, así que
  // sus errores sólo quedan en el log. Estos botones los sacan a la luz.
  // Sin `to`, el servidor manda a ORDER_NOTIFY_EMAIL — el buzón del negocio.
  const handleTest = async (kind) => {
    setTesting(kind);
    setTestResult(null);
    try {
      const res = await axiosInstance.post('/api/v1/settings/test-email', { kind });
      setTestResult(res.data);
    } catch (error) {
      setTestResult({ ok: false, error: error?.message || 'Error al enviar' });
    } finally {
      setTesting('');
    }
  };

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { saved: _saved, ...body } = form;
      const res = await axiosInstance.put(URL, body);
      await mutate(res.data, { revalidate: false });
      toast.success('Datos guardados');
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
        heading="Datos del negocio"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Datos del negocio' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: 3, maxWidth: 640 }}>
        {!form ? (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            Cargando…
          </Typography>
        ) : (
          <Stack spacing={3}>
            {data?.saved === false && (
              <Alert severity="warning">
                Todavía no se han guardado los datos de este negocio: el ticket y los correos
                salen con los de ejemplo. Revísalos y guarda.
              </Alert>
            )}
            <TextField
              label="Nombre del negocio"
              value={form.business_name}
              onChange={set('business_name')}
              helperText="Ticket, PDF, WhatsApp, correos y el cobro de Mercado Pago"
            />

            {TICKET_FIELDS.map(([key, label, help]) => (
              <TextField
                key={key}
                label={label}
                value={form[key] ?? ''}
                onChange={set(key)}
                helperText={help || ' '}
              />
            ))}

            <Divider sx={{ borderStyle: 'dashed' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Correos
              </Typography>
            </Divider>

            <TextField
              label="Mensaje inicial (opcional)"
              value={form.intro_message}
              onChange={set('intro_message')}
              multiline
              minRows={2}
              helperText="Solo en el correo, arriba de la lista de productos (cuidados, garantía…)"
            />
            <TextField
              label="Mensaje de despedida"
              value={form.footer_message}
              onChange={set('footer_message')}
              multiline
              minRows={2}
              helperText="Pie de todos los correos"
            />

            <Divider sx={{ borderStyle: 'dashed' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Imagen de marca
              </Typography>
            </Divider>

            <Stack direction="row" spacing={2} alignItems="flex-start">
              <TextField
                fullWidth
                label="URL del logo"
                value={form.logo_url ?? ''}
                onChange={set('logo_url')}
                helperText="Correos y PDF. PNG o JPG público (los correos no leen archivos del servidor). Vacío = solo el nombre."
              />
              <TextField
                label="Color"
                type="color"
                value={form.accent_color || '#A8455C'}
                onChange={set('accent_color')}
                sx={{ width: 96, flexShrink: 0 }}
                helperText="Separadores"
              />
            </Stack>

            {form.logo_url && (
              <Box
                component="img"
                alt="Vista previa del logo"
                src={form.logo_url}
                sx={{
                  height: 90,
                  objectFit: 'contain',
                  alignSelf: 'center',
                  borderRadius: 1,
                  bgcolor: 'background.neutral',
                  p: 1,
                }}
              />
            )}

            <Divider sx={{ borderStyle: 'dashed' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Textos de los correos de pedido
              </Typography>
            </Divider>

            <TextField
              label="Pedido recibido — entrega en CDMX"
              value={form.order_intro_pickup ?? ''}
              onChange={set('order_intro_pickup')}
              multiline
              minRows={2}
              helperText="El cliente está pagando en línea en ese momento"
            />
            <TextField
              label="Pedido recibido — con envío"
              value={form.order_intro_shipping ?? ''}
              onChange={set('order_intro_shipping')}
              multiline
              minRows={2}
              helperText="Todavía falta cotizar el envío: aquí no se ha cobrado nada"
            />
            <TextField
              label="Pago recibido"
              value={form.paid_intro ?? ''}
              onChange={set('paid_intro')}
              multiline
              minRows={2}
            />

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Pruebas: se mandan al correo del negocio (ORDER_NOTIFY_EMAIL) usando las
              mismas plantillas que reciben los clientes, con datos de ejemplo.
            </Typography>

            <Stack direction="row" spacing={1.5} flexWrap="wrap" justifyContent="flex-end">
              <Button color="inherit" disabled={!!testing} onClick={() => handleTest('simple')}>
                {testing === 'simple' ? 'Enviando…' : 'Prueba simple'}
              </Button>
              <Button color="inherit" disabled={!!testing} onClick={() => handleTest('order')}>
                {testing === 'order' ? 'Enviando…' : 'Correo de pedido'}
              </Button>
              <Button color="inherit" disabled={!!testing} onClick={() => handleTest('paid')}>
                {testing === 'paid' ? 'Enviando…' : 'Correo de pago'}
              </Button>
              <Button
                variant="contained"
                disabled={saving || !form.business_name?.trim()}
                onClick={handleSave}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </Stack>

            {testResult && (
              <Alert severity={testResult.ok ? 'success' : 'error'}>
                {testResult.ok ? (
                  <>
                    Enviado desde <strong>{testResult.from_address}</strong>. Si no llega,
                    revisa spam y el panel de Resend.
                  </>
                ) : (
                  <>
                    <strong>Falló el envío.</strong> {testResult.error}
                  </>
                )}
              </Alert>
            )}
          </Stack>
        )}
      </Card>
    </DashboardContent>
  );
}
