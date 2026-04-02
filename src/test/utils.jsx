import { SWRConfig } from 'swr';

// ----------------------------------------------------------------------
// Wrapper que provee una caché SWR limpia por cada test.
// Úsalo en renderHook({ wrapper: createWrapper() }) cuando el mismo
// endpoint se llama en varios tests del mismo archivo.
// ----------------------------------------------------------------------

export function createWrapper() {
  return function Wrapper({ children }) {
    return (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    );
  };
}
