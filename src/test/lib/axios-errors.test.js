import { http, HttpResponse } from 'msw';
import { it, expect, describe } from 'vitest';

import axiosInstance from 'src/lib/axios';

import { server } from '../mocks/server';

// ----------------------------------------------------------------------
// Un 422 del API trae una lista de errores por campo: el mensaje que llega a
// la pantalla debe decir cuál campo y por qué, no «Request failed…».
// ----------------------------------------------------------------------

const URL = 'https://api.opuntiaden.com/api/v1/species';

describe('mensajes de error del API', () => {
  it('un 422 con errores por campo dice cuál y por qué', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json(
          {
            detail: [
              { field: 'habitat', message: 'String should have at most 2000 characters' },
              { field: 'name', message: 'Field required' },
            ],
          },
          { status: 422 }
        )
      )
    );
    const error = await axiosInstance.post(URL, {}).catch((e) => e);
    expect(error.status).toBe(422);
    expect(error.message).toBe(
      'habitat: String should have at most 2000 characters · name: Field required'
    );
  });

  it('un detalle de texto llega tal cual', async () => {
    server.use(
      http.post(URL, () => HttpResponse.json({ detail: 'Genus not found.' }, { status: 400 }))
    );
    const error = await axiosInstance.post(URL, {}).catch((e) => e);
    expect(error.message).toBe('Genus not found.');
  });
});
