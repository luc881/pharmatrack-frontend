import '@testing-library/jest-dom';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './mocks/server';

// Levanta el servidor de MSW antes de todos los tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Limpia los handlers customizados que se agreguen en tests individuales
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Cierra el servidor al terminar
afterAll(() => server.close());
