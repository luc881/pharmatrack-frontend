import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const CREATE_ID = '__create__';

// Normaliza nombres (marcas, categorías, proveedores) igual que el backend
function normName(s) {
  if (!s) return s;
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean
    .split(' ')
    .map((w) => {
      if (!w || !/^[a-záéíóúñA-ZÁÉÍÓÚÑ]/.test(w)) return w; // respeta números
      if (/^([A-Za-záéíóúñÁÉÍÓÚÑ]\.)+$/.test(w)) return w.toUpperCase(); // abreviatura: s.a. → S.A.
      if (w === w.toUpperCase() && w.length > 1) return w; // acrónimo: ABC, BBVA
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_r, row) =>
    Array.from({ length: n + 1 }, (_c, col) => (row === 0 ? col : col === 0 ? row : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalize(s) {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findSimilar(input, options) {
  const norm = normalize(input);
  if (norm.length < 2) return [];

  return options.filter((opt) => {
    const optNorm = normalize(opt.name);
    if (optNorm === norm) return false; // exact — handled separately
    const maxLen = Math.max(norm.length, optNorm.length);
    const threshold = maxLen <= 4 ? 1 : maxLen <= 7 ? 2 : 3;
    return (
      optNorm.includes(norm) || norm.includes(optNorm) || levenshtein(norm, optNorm) <= threshold
    );
  });
}

// ----------------------------------------------------------------------

// Elegir de la lista o, con el botón «+ {newLabel}» a la vista, escribir uno
// nuevo en un recuadro aparte. Escribir en la lista y elegir «Crear …» sigue
// funcionando como atajo.
export function InlineCreatableSelect({
  name,
  label,
  newLabel = 'Nuevo',
  options = [],
  onCreate,
  loading,
}) {
  const { control, setValue } = useFormContext();

  const [inputValue, setInputValue] = useState('');
  const [newMode, setNewMode] = useState(false);
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const [similarNames, setSimilarNames] = useState([]);
  const [pendingName, setPendingName] = useState('');

  const resetWarnings = () => {
    setDuplicateError('');
    setSimilarNames([]);
    setPendingName('');
  };

  const doCreate = async (newName) => {
    setCreating(true);
    resetWarnings();
    try {
      const created = await onCreate(newName);
      setValue(name, created.id, { shouldValidate: true });
      setInputValue(created.name);
      setNewMode(false);
      setDraft('');
    } finally {
      setCreating(false);
    }
  };

  const attemptCreate = async (raw) => {
    const trimmed = normName(raw);
    const norm = normalize(trimmed);

    const exactMatch = options.find((opt) => normalize(opt.name) === norm);
    if (exactMatch) {
      setDuplicateError(`Ya existe: "${exactMatch.name}"`);
      return;
    }

    const similar = findSimilar(trimmed, options);
    if (similar.length > 0) {
      setPendingName(trimmed);
      setSimilarNames(similar);
      return;
    }

    await doCreate(trimmed);
  };

  const handleChange = async (_, newValue) => {
    resetWarnings();

    if (!newValue) {
      setValue(name, '', { shouldValidate: true });
      return;
    }

    if (newValue.id === CREATE_ID) {
      await attemptCreate(newValue.inputValue);
    } else {
      setValue(name, newValue.id, { shouldValidate: true });
      setInputValue(newValue.name);
    }
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value }, fieldState: { error } }) => {
        const selectedOption = options.find((opt) => opt.id === Number(value)) ?? null;

        if (newMode) {
          return (
            <Box
              sx={{
                p: 2,
                gap: 1.5,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1.5,
                border: (t) => `1px dashed ${t.vars.palette.primary.main}`,
                bgcolor: (t) => `rgba(${t.vars.palette.primary.mainChannel} / 0.04)`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="eva:plus-fill" width={18} sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                  {newLabel}
                </Typography>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    setNewMode(false);
                    setDraft('');
                    resetWarnings();
                  }}
                >
                  Elegir existente
                </Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  label="Nombre *"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    resetWarnings();
                  }}
                  onKeyDown={(e) => {
                    // Enter crea aquí en vez de mandar el formulario de afuera
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (draft.trim()) attemptCreate(draft);
                    }
                  }}
                  error={!!duplicateError}
                  helperText={duplicateError || 'Se guarda al tocar «Crear».'}
                />
                <Button
                  variant="contained"
                  loading={creating}
                  disabled={!draft.trim()}
                  onClick={() => attemptCreate(draft)}
                  sx={{ height: 40, flexShrink: 0 }}
                >
                  Crear
                </Button>
              </Box>
              {similarNames.length > 0 && (
                <Alert
                  severity="warning"
                  icon={<Iconify icon="solar:danger-triangle-bold" width={20} />}
                >
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Hay registros con nombre similar:{' '}
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {similarNames.map((s) => s.name).join(', ')}
                    </Box>
                    . ¿Es un nuevo registro?
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      loading={creating}
                      onClick={() => doCreate(pendingName)}
                    >
                      Sí, crear &ldquo;{pendingName}&rdquo;
                    </Button>
                    <Button size="small" variant="outlined" color="inherit" onClick={resetWarnings}>
                      Cancelar
                    </Button>
                  </Box>
                </Alert>
              )}
            </Box>
          );
        }

        return (
          <Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'flex-start',
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
              }}
            >
              <Autocomplete
                sx={{ flex: '1 1 200px' }}
                value={selectedOption}
                inputValue={inputValue}
                onInputChange={(_, v, reason) => {
                  setInputValue(v);
                  if (reason === 'input') resetWarnings();
                }}
                onChange={handleChange}
                loading={loading || creating}
                options={options}
                getOptionLabel={(opt) => opt.name ?? ''}
                isOptionEqualToValue={(opt, val) => opt.id === val?.id}
                noOptionsText="Sin resultados"
                filterOptions={(opts, state) => {
                  const q = normalize(state.inputValue);
                  const filtered = q ? opts.filter((opt) => normalize(opt.name).includes(q)) : opts;

                  const trimmed = state.inputValue.trim();
                  const exactExists = opts.some(
                    (opt) => normalize(opt.name) === normalize(trimmed)
                  );
                  if (trimmed && !exactExists) {
                    filtered.push({ id: CREATE_ID, name: trimmed, inputValue: trimmed });
                  }
                  return filtered;
                }}
                renderOption={(props, opt) => {
                  const { key, ...restProps } = props;
                  if (opt.id === CREATE_ID) {
                    return (
                      <li key={key} {...restProps}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            color: 'primary.main',
                          }}
                        >
                          <Iconify icon="eva:plus-fill" width={16} />
                          <Typography variant="body2">
                            Crear{' '}
                            <Box component="span" sx={{ fontWeight: 600 }}>
                              &ldquo;{opt.name}&rdquo;
                            </Box>
                          </Typography>
                        </Box>
                      </li>
                    );
                  }
                  return (
                    <li key={key} {...restProps}>
                      {opt.name}
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={label}
                    error={!!error || !!duplicateError}
                    helperText={error?.message || duplicateError}
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {(loading || creating) && <CircularProgress size={16} sx={{ mr: 1 }} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
              />
              <Button
                variant="outlined"
                startIcon={<Iconify icon="eva:plus-fill" />}
                onClick={() => {
                  resetWarnings();
                  setNewMode(true);
                }}
                sx={{ height: 56, flexShrink: 0, width: { xs: 1, sm: 'auto' } }}
              >
                {newLabel}
              </Button>
            </Box>

            {similarNames.length > 0 && (
              <Alert
                severity="warning"
                sx={{ mt: 1 }}
                icon={<Iconify icon="solar:danger-triangle-bold" width={20} />}
              >
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Hay registros con nombre similar:{' '}
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {similarNames.map((s) => s.name).join(', ')}
                  </Box>
                  . ¿Es un nuevo registro?
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="warning"
                    loading={creating}
                    onClick={() => doCreate(pendingName)}
                  >
                    Sí, crear &ldquo;{pendingName}&rdquo;
                  </Button>
                  <Button size="small" variant="outlined" color="inherit" onClick={resetWarnings}>
                    Cancelar
                  </Button>
                </Box>
              </Alert>
            )}
          </Box>
        );
      }}
    />
  );
}
