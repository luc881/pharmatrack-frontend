import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Servidor MSW que corre en Node (usado por Vitest)
export const server = setupServer(...handlers);
