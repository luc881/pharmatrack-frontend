import { z as zod } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';

import { handleApiError } from 'src/utils/handle-api-error';

import { uploadToCloudinary } from 'src/lib/cloudinary';
import { createArticle, updateArticle } from 'src/actions/articles';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Field } from 'src/components/hook-form';

// ----------------------------------------------------------------------

const schema = zod.object({
  title: zod.string().min(1, 'El título es obligatorio'),
  category: zod.string().optional(),
  excerpt: zod.string().max(500, 'Máximo 500 caracteres').optional(),
  cover_image: zod.string().optional(),
  body: zod.string().optional(),
  author_name: zod.string().optional(),
  author_role: zod.string().optional(),
  tags: zod.string().optional(), // separados por coma; se parsean al enviar
  published: zod.boolean(),
});

const BODY_HELP =
  'Línea en blanco separa párrafos · "## " inicia un subtítulo · "> " inicia una cita destacada · "img: URL | pie de foto" inserta una imagen';

export function ArticleCreateEditForm({ currentArticle }) {
  const navigate = useNavigate();
  const isEdit = !!currentArticle;

  const [coverLoading, setCoverLoading] = useState(false);

  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      category: '',
      excerpt: '',
      cover_image: '',
      body: '',
      author_name: '',
      author_role: '',
      tags: '',
      published: false,
    },
    values: currentArticle
      ? {
          title: currentArticle.title ?? '',
          category: currentArticle.category ?? '',
          excerpt: currentArticle.excerpt ?? '',
          cover_image: currentArticle.cover_image ?? '',
          body: currentArticle.body ?? '',
          author_name: currentArticle.author_name ?? '',
          author_role: currentArticle.author_role ?? '',
          tags: (currentArticle.tags ?? []).join(', '),
          published: !!currentArticle.published,
        }
      : undefined,
  });

  const {
    watch,
    setError,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const coverImage = watch('cover_image');

  const uploadCover = async (file) => {
    setCoverLoading(true);
    try {
      const url = await uploadToCloudinary(file);
      setValue('cover_image', url, { shouldDirty: true });
    } catch {
      toast.error('Error al subir la portada');
    } finally {
      setCoverLoading(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        title: data.title,
        category: data.category || null,
        excerpt: data.excerpt || null,
        cover_image: data.cover_image || null,
        body: data.body || null,
        author_name: data.author_name || null,
        author_role: data.author_role || null,
        tags: (data.tags ?? '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        published: data.published,
      };

      if (isEdit) {
        await updateArticle(currentArticle.id, payload);
      } else {
        await createArticle(payload);
      }

      toast.success(isEdit ? 'Artículo actualizado' : 'Artículo creado');
      navigate(paths.dashboard.article.root);
    } catch (error) {
      if (!handleApiError(error, setError)) {
        toast.error(error.message || 'Error al guardar el artículo');
      }
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <Card sx={{ p: 3 }}>
          <Box sx={{ gap: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Field.Text name="title" label="Título *" sx={{ gridColumn: { sm: 'span 2' } }} />

            <Field.Text
              name="category"
              label="Categoría"
              placeholder="Cuidados, Especies, Bioactivo…"
              helperText="Etiqueta corta que agrupa artículos"
            />

            <Field.Text
              name="tags"
              label="Tags"
              placeholder="tarántulas, principiantes"
              helperText="Separados por coma"
            />

            <Field.Text
              name="excerpt"
              label="Extracto"
              multiline
              rows={2}
              helperText="Resumen corto para las tarjetas y el SEO (máx. 500)"
              sx={{ gridColumn: { sm: 'span 2' } }}
            />

            {/* Portada */}
            <Box sx={{ gridColumn: { sm: 'span 2' } }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Portada
              </Typography>
              {coverImage && (
                <Box sx={{ mb: 1.5, position: 'relative', display: 'inline-block' }}>
                  <Box
                    component="img"
                    src={coverImage}
                    alt="Portada"
                    sx={{ width: 320, maxWidth: 1, borderRadius: 1.5, aspectRatio: '16/9', objectFit: 'cover' }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setValue('cover_image', '', { shouldDirty: true })}
                    sx={{
                      top: 6,
                      right: 6,
                      position: 'absolute',
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                  >
                    <Iconify icon="mingcute:close-line" width={14} />
                  </IconButton>
                </Box>
              )}
              <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  component="label"
                  variant="outlined"
                  loading={coverLoading}
                  startIcon={<Iconify icon="solar:camera-add-bold" />}
                >
                  {coverImage ? 'Cambiar portada' : 'Subir portada'}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) uploadCover(e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                </Button>
                <Field.Text name="cover_image" label="o pega una URL" size="small" sx={{ minWidth: 280 }} />
              </Box>
            </Box>

            <Field.Text name="author_name" label="Autor" placeholder="Selene" />
            <Field.Text name="author_role" label="Rol del autor" placeholder="Criadora" />

            <Field.Text
              name="body"
              label="Contenido"
              multiline
              minRows={14}
              helperText={BODY_HELP}
              sx={{ gridColumn: { sm: 'span 2' }, '& textarea': { fontFamily: 'monospace', fontSize: 14 } }}
            />

            <Field.Switch
              name="published"
              label="Publicado (visible en el sitio público)"
              sx={{ gridColumn: { sm: 'span 2' } }}
            />
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" loading={isSubmitting}>
              {isEdit ? 'Guardar cambios' : 'Crear artículo'}
            </Button>
          </Box>
        </Card>
      </form>
    </FormProvider>
  );
}
