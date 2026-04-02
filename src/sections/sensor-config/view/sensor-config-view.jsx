import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import { alpha, useTheme, keyframes } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetSensorHistory, useGetLatestSensorReading } from 'src/actions/sensor';

import { Iconify } from 'src/components/iconify';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

const MX_TIME = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

const parseUTC = (ts) => new Date(/Z|[+-]\d{2}:?\d{2}$/.test(ts) ? ts : `${ts}Z`);

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;

const pulse = keyframes`
  0%   { transform: scale(1);   opacity: 1; }
  50%  { transform: scale(1.6); opacity: 0.5; }
  100% { transform: scale(1);   opacity: 1; }
`;

// ----------------------------------------------------------------------

const STEPS = [
  {
    number: 1,
    title: 'Instalar la librería WiFiManager',
    icon: 'solar:download-bold-duotone',
    color: 'primary',
    content: (
      <Stack spacing={1.5}>
        <Typography variant="body2">
          Abre el <strong>Arduino IDE</strong>, ve a <em>Sketch → Include Library → Manage Libraries</em> y busca:
        </Typography>
        <Box
          sx={{
            px: 2, py: 1.5, borderRadius: 1,
            bgcolor: 'background.neutral',
            fontFamily: 'monospace', fontSize: 13,
          }}
        >
          WiFiManager by tzapu
        </Box>
        <Typography variant="body2">
          Instala también <strong>ArduinoJson</strong> y <strong>Adafruit AHTX0</strong> si no las tienes.
        </Typography>
      </Stack>
    ),
  },
  {
    number: 2,
    title: 'Cargar el firmware al ESP32',
    icon: 'solar:upload-bold-duotone',
    color: 'info',
    content: (
      <Stack spacing={1.5}>
        <Typography variant="body2">
          Conecta el ESP32-S3 por USB. Selecciona la placa correcta y el puerto COM/ttyUSB.
          Carga el código proporcionado (ver sección más abajo).
        </Typography>
        <Alert severity="info" sx={{ fontSize: 13 }}>
          Si el ESP32 ya tenía credenciales guardadas, mantén presionado el <strong>botón BOOT</strong>{' '}
          durante el encendido para borrarlas y entrar al modo configuración.
        </Alert>
      </Stack>
    ),
  },
  {
    number: 3,
    title: 'Conectarse a la red del sensor',
    icon: 'solar:wifi-router-bold-duotone',
    color: 'warning',
    content: (
      <Stack spacing={1.5}>
        <Typography variant="body2">
          La primera vez que enciendas el ESP32 (sin red guardada), creará su propio punto de acceso WiFi:
        </Typography>
        <Box
          sx={{
            px: 2, py: 1.5, borderRadius: 1,
            bgcolor: 'background.neutral',
            fontFamily: 'monospace', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 1,
          }}
        >
          <Iconify icon="solar:wifi-bold" width={18} />
          PharmaTrack-Sensor
        </Box>
        <Typography variant="body2">
          Desde tu celular o laptop, conéctate a esa red WiFi (no tiene contraseña).
          Se abrirá automáticamente un portal de configuración.
          Si no se abre, navega a <strong>192.168.4.1</strong>.
        </Typography>
      </Stack>
    ),
  },
  {
    number: 4,
    title: 'Configurar la red WiFi',
    icon: 'solar:settings-bold-duotone',
    color: 'success',
    content: (
      <Stack spacing={1.5}>
        <Typography variant="body2">
          En el portal de configuración:
        </Typography>
        <Stack spacing={0.75}>
          {[
            'Haz clic en "Configure WiFi"',
            'Selecciona tu red WiFi de la lista',
            'Escribe la contraseña de tu red',
            'Haz clic en "Save"',
          ].map((step, i) => (
            <Stack key={i} direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  bgcolor: 'success.main', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  typography: 'caption', fontWeight: 700,
                }}
              >
                {i + 1}
              </Box>
              <Typography variant="body2">{step}</Typography>
            </Stack>
          ))}
        </Stack>
        <Alert severity="success" sx={{ fontSize: 13 }}>
          El ESP32 guardará las credenciales en su memoria flash y se reiniciará automáticamente.
          La próxima vez se conectará solo sin necesidad de este proceso.
        </Alert>
      </Stack>
    ),
  },
  {
    number: 5,
    title: 'Verificar la conexión',
    icon: 'solar:check-circle-bold-duotone',
    color: 'success',
    content: (
      <Stack spacing={1.5}>
        <Typography variant="body2">
          Después de reiniciar, el ESP32 enviará lecturas cada <strong>30 segundos</strong>.
          Revisa el indicador de estado en la parte superior de esta página — debería mostrar{' '}
          <Chip label="En línea" size="small" color="success" sx={{ fontSize: 11 }} />.
        </Typography>
        <Typography variant="body2">
          Si permanece en{' '}
          <Chip label="Sin señal" size="small" color="error" sx={{ fontSize: 11 }} />{' '}
          después de 1 minuto, verifica que la contraseña WiFi sea correcta y repite desde el paso 3.
        </Typography>
      </Stack>
    ),
  },
];

// ----------------------------------------------------------------------

const FIRMWARE_CODE = `#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_AHTX0.h>
#include <WiFiManager.h>
#include <WiFiClientSecure.h>

// ── Configuración ───────────────────────────────────────
#define RESET_BUTTON_PIN  0   // Botón BOOT del ESP32-S3
#define SDA_PIN           8
#define SCL_PIN           9
const char* API_URL = "https://api.farmaciaselene.com/api/v1/sensor-readings/";
const unsigned long POST_INTERVAL = 30000; // 30 segundos
// ────────────────────────────────────────────────────────

Adafruit_AHTX0 aht;
WiFiClientSecure client;
unsigned long lastPostTime = 0;

void setup() {
  Serial.begin(115200);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);

  // Mantén presionado BOOT al encender para borrar credenciales WiFi
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    Serial.println("Borrando credenciales WiFi...");
    WiFiManager wm;
    wm.resetSettings();
    Serial.println("Listo. Reiniciando...");
    delay(1000);
    ESP.restart();
  }

  // Auto-conectar o abrir portal de configuración
  WiFiManager wm;
  wm.setConfigPortalTimeout(180); // 3 minutos para configurar
  wm.setAPName("PharmaTrack-Sensor");

  Serial.println("Conectando a WiFi...");
  if (!wm.autoConnect("PharmaTrack-Sensor")) {
    Serial.println("Tiempo agotado. Reiniciando...");
    delay(3000);
    ESP.restart();
  }

  Serial.println("WiFi conectado!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  Wire.begin(SDA_PIN, SCL_PIN);
  if (!aht.begin()) {
    Serial.println("ERROR: Sensor AHT10 no encontrado!");
    while (1) delay(1000);
  }

  Serial.println("Sensor AHT10 listo.");
  client.setInsecure(); // HTTPS sin verificar certificado
}

void loop() {
  unsigned long now = millis();
  if (now - lastPostTime < POST_INTERVAL) return;
  lastPostTime = now;

  sensors_event_t humidity_event, temp_event;
  aht.getEvent(&humidity_event, &temp_event);

  float temperature = temp_event.temperature;
  float humidity    = humidity_event.relative_humidity;

  if (isnan(temperature) || isnan(humidity) ||
      temperature < -40 || temperature > 85 ||
      humidity < 0 || humidity > 100) {
    Serial.println("Lectura inválida, omitiendo.");
    return;
  }

  JsonDocument doc;
  doc["temperature"] = round(temperature * 10.0) / 10.0;
  doc["humidity"]    = round(humidity    * 10.0) / 10.0;

  String payload;
  serializeJson(doc, payload);
  Serial.printf("Enviando: %.1f°C  %.1f%%\\n", temperature, humidity);

  HTTPClient http;
  http.begin(client, API_URL);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(payload);
  if (code > 0) {
    Serial.printf("HTTP %d\\n", code);
  } else {
    Serial.printf("Error: %s\\n", http.errorToString(code).c_str());
  }
  http.end();
}`;

// ----------------------------------------------------------------------

function StatusCard() {
  const theme = useTheme();
  const { reading, readingLoading } = useGetLatestSensorReading();
  const { history } = useGetSensorHistory({ pageSize: 5 });
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const isOnline =
    reading?.recorded_at &&
    now - parseUTC(reading.recorded_at).getTime() < OFFLINE_THRESHOLD_MS;

  const statusColor = isOnline ? 'success' : 'error';
  const statusLabel = isOnline ? 'En línea' : 'Sin señal';

  return (
    <Card>
      <CardHeader
        title="Estado actual del sensor"
        subheader="Lecturas en tiempo real · actualiza cada 30 segundos"
        avatar={
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            {isOnline && (
              <Box
                sx={{
                  position: 'absolute', width: 14, height: 14, borderRadius: '50%',
                  bgcolor: alpha(theme.palette.success.main, 0.4),
                  animation: `${pulse} 2s ease-in-out infinite`,
                }}
              />
            )}
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: `${statusColor}.main` }} />
          </Box>
        }
        action={
          readingLoading ? (
            <Skeleton variant="rounded" width={80} height={28} sx={{ borderRadius: 10, mt: 1 }} />
          ) : (
            <Chip
              label={statusLabel}
              color={statusColor}
              size="small"
              variant="soft"
              sx={{ mt: 1 }}
            />
          )
        }
      />
      <Divider />
      <CardContent>
        {readingLoading ? (
          <Stack direction="row" spacing={3}>
            <Skeleton variant="rounded" width={120} height={60} />
            <Skeleton variant="rounded" width={120} height={60} />
          </Stack>
        ) : reading ? (
          <Stack direction="row" spacing={4} flexWrap="wrap">
            <Stack spacing={0.25}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="solar:temperature-bold-duotone" width={20} sx={{ color: 'error.main' }} />
                <Typography variant="h4" sx={{ color: 'error.main' }}>
                  {reading.temperature?.toFixed(1)}°C
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Temperatura</Typography>
            </Stack>

            <Stack spacing={0.25}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="solar:drop-bold-duotone" width={20} sx={{ color: 'info.main' }} />
                <Typography variant="h4" sx={{ color: 'info.main' }}>
                  {reading.humidity?.toFixed(0)}%
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Humedad</Typography>
            </Stack>

            <Stack spacing={0.25} sx={{ ml: 'auto' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Última lectura
              </Typography>
              <Typography variant="subtitle2">
                {MX_TIME.format(parseUTC(reading.recorded_at))}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {history.length > 0 ? `${history.length} lecturas recientes guardadas` : ''}
              </Typography>
            </Stack>
          </Stack>
        ) : (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1 }}>
            <Iconify icon="solar:wifi-router-bold-duotone" width={36} sx={{ color: 'text.disabled' }} />
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No hay datos del sensor
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                Sigue la guía de configuración para conectar el ESP32
              </Typography>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

function StepCard({ step }) {
  const theme = useTheme();
  return (
    <Card
      sx={{
        border: '1px solid',
        borderColor: alpha(theme.palette[step.color].main, 0.2),
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {/* Number badge */}
          <Box
            sx={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: alpha(theme.palette[step.color].main, 0.12),
              color: `${step.color}.main`,
            }}
          >
            <Iconify icon={step.icon} width={22} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
              <Chip
                label={`Paso ${step.number}`}
                size="small"
                color={step.color}
                variant="soft"
                sx={{ fontWeight: 700 }}
              />
              <Typography variant="subtitle1" fontWeight={600}>
                {step.title}
              </Typography>
            </Stack>

            {step.content}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------

function FirmwareCard() {
  return (
    <Card>
      <CardHeader
        title="Código del firmware"
        subheader="Copia este código en el Arduino IDE"
        avatar={
          <Box
            sx={{
              p: 1, borderRadius: 1.5, display: 'flex',
              bgcolor: (t) => alpha(t.palette.warning.main, 0.12),
            }}
          >
            <Iconify icon="solar:code-bold-duotone" width={24} sx={{ color: 'warning.main' }} />
          </Box>
        }
      />
      <Divider />
      <Box
        sx={{
          m: 2, p: 2, borderRadius: 1,
          bgcolor: 'grey.900',
          overflow: 'auto',
          maxHeight: 420,
          '&::-webkit-scrollbar': { width: 6, height: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.700', borderRadius: 3 },
        }}
      >
        <Typography
          component="pre"
          sx={{
            m: 0,
            color: 'grey.100',
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.7,
            whiteSpace: 'pre',
          }}
        >
          {FIRMWARE_CODE}
        </Typography>
      </Box>
    </Card>
  );
}

// ----------------------------------------------------------------------

export function SensorConfigView() {
  return (
    <DashboardContent maxWidth="lg">
      <CustomBreadcrumbs
        heading="Sensor ambiental"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Sensor ambiental' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Grid container spacing={3}>
        {/* Status */}
        <Grid size={{ xs: 12 }}>
          <StatusCard />
        </Grid>

        {/* Info alert */}
        <Grid size={{ xs: 12 }}>
          <Alert
            severity="info"
            icon={<Iconify icon="solar:cpu-bold-duotone" width={22} />}
          >
            <Typography variant="subtitle2" gutterBottom>
              Hardware requerido
            </Typography>
            <Typography variant="body2">
              <strong>ESP32-S3</strong> con sensor <strong>AHT10</strong> conectado por I²C
              (SDA → GPIO8, SCL → GPIO9). Si usas otro modelo de ESP32, los pines pueden variar.
            </Typography>
          </Alert>
        </Grid>

        {/* Steps */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Guía de configuración
          </Typography>
          <Stack spacing={2}>
            {STEPS.map((step) => (
              <StepCard key={step.number} step={step} />
            ))}
          </Stack>
        </Grid>

        {/* Reset instructions */}
        <Grid size={{ xs: 12 }}>
          <Alert
            severity="warning"
            icon={<Iconify icon="solar:restart-bold-duotone" width={22} />}
          >
            <Typography variant="subtitle2" gutterBottom>
              ¿Cómo cambiar la red WiFi después?
            </Typography>
            <Typography variant="body2">
              Mantén presionado el <strong>botón BOOT</strong> del ESP32 mientras lo enciendes.
              Esto borrará las credenciales guardadas y volverá al modo de configuración
              (aparecerá la red <code>PharmaTrack-Sensor</code> de nuevo).
            </Typography>
          </Alert>
        </Grid>

        {/* Firmware */}
        <Grid size={{ xs: 12 }}>
          <FirmwareCard />
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
