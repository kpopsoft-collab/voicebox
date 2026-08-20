import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { queryClient } from '@/lib/queryClient';

interface ServerStore {
  serverUrl: string;
  setServerUrl: (url: string) => void;

  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;

  mode: 'local' | 'remote';
  setMode: (mode: 'local' | 'remote') => void;

  keepServerRunningOnClose: boolean;
  setKeepServerRunningOnClose: (keepRunning: boolean) => void;

  customModelsDir: string | null;
  setCustomModelsDir: (dir: string | null) => void;
}

/**
 * Invalidate all React Query caches so stale data from the previous
 * server is not shown. Called when the server URL changes.
 */
function invalidateAllServerData() {
  queryClient.invalidateQueries();
}

/**
 * True only when running under the Vite dev server, not in a built bundle.
 * `import.meta.env.DEV` is replaced at build time and stays accurate even
 * when Vite falls back to a non-default port (e.g. 5174 on port collision).
 */
function isViteDevServer(): boolean {
  return import.meta.env.DEV;
}

export function getDefaultServerUrl(): string {
  const fallback = 'https://localhost:17493';

  if (typeof window === 'undefined') {
    return fallback;
  }

  const { protocol, origin, hostname, port } = window.location;

  // Vite dev mode: always proxy to the backend on 17493 regardless of which
  // port Vite actually grabbed. Done via env flag, not `port === '5173'`,
  // because Vite auto-falls-back to 5174 when 5173 is taken.
  if (isViteDevServer() && port) {
    return 'https://localhost:17493';
  }

  // Production-like web build: trust the current origin (served from backend
  // via static mount) — except Tauri webviews which use tauri.localhost.
  if (
    (protocol === 'http:' || protocol === 'https:') &&
    hostname &&
    hostname !== 'tauri.localhost'
  ) {
    return origin || fallback;
  }

  return fallback;
}

export function isLoopbackVoiceboxServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.port === '17493' &&
      (parsed.hostname === '127.0.0.1' ||
        parsed.hostname === 'localhost' ||
        parsed.hostname === '[::1]' ||
        parsed.hostname === '::1')
    );
  } catch {
    return false;
  }
}

export const useServerStore = create<ServerStore>()(
  persist(
    (set, get) => ({
      serverUrl: getDefaultServerUrl(),
      setServerUrl: (url) => {
        const prev = get().serverUrl;
        set({ serverUrl: url });
        if (url !== prev) {
          invalidateAllServerData();
        }
      },

      isConnected: false,
      setIsConnected: (connected) => set({ isConnected: connected }),

      mode: 'local',
      setMode: (mode) => set({ mode }),

      keepServerRunningOnClose: false,
      setKeepServerRunningOnClose: (keepRunning) => set({ keepServerRunningOnClose: keepRunning }),

      customModelsDir: null,
      setCustomModelsDir: (dir) => set({ customModelsDir: dir }),
    }),
    {
      name: 'voicebox-server',
      onRehydrateStorage: () => (state) => {
        if (typeof window !== 'undefined' && state) {
          const { hostname, port, origin } = window.location;
          if (isViteDevServer() && port) {
            state.setServerUrl('https://localhost:17493');
          } else if (
            hostname &&
            hostname !== 'tauri.localhost' &&
            origin
          ) {
            state.setServerUrl(origin);
          }
        }
      },
    },
  ),
);
