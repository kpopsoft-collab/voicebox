import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { HistoryQuery } from '@/lib/api/types';
import { usePlatform } from '@/platform/PlatformContext';

export function useHistory(query?: HistoryQuery) {
  return useQuery({
    queryKey: ['history', query],
    queryFn: () => apiClient.listHistory(query),
  });
}

export function useGenerationDetail(generationId: string) {
  return useQuery({
    queryKey: ['history', generationId],
    queryFn: () => apiClient.getGeneration(generationId),
    enabled: !!generationId,
  });
}

export function useDeleteGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (generationId: string) => apiClient.deleteGeneration(generationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

export function useClearFailedGenerations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.clearFailedGenerations(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

export function formatExportFilename(
  profileName?: string,
  createdAt?: string,
  extension: string = 'wav',
): string {
  const safeProfile = (profileName || 'voice')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'voice';

  let timeStr = '';
  if (createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const yyyy = d.getFullYear();
      const MM = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mm = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      timeStr = `${yyyy}${MM}${dd}_${hh}${mm}${ss}`;
    }
  }

  if (!timeStr) {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  const ext = extension.replace(/^\./, '').toLowerCase();
  return `${safeProfile}_${timeStr}.${ext}`;
}

export function useExportGeneration() {
  const platform = usePlatform();

  return useMutation({
    mutationFn: async ({
      generationId,
      profileName,
      createdAt,
    }: {
      generationId: string;
      profileName?: string;
      createdAt?: string;
      text?: string;
    }) => {
      const blob = await apiClient.exportGeneration(generationId);
      const filename = formatExportFilename(profileName, createdAt, 'voicebox.zip');

      await platform.filesystem.saveFile(filename, blob, [
        {
          name: 'Voicebox Generation',
          extensions: ['zip'],
        },
      ]);

      return blob;
    },
  });
}

export function useExportGenerationAudio() {
  const platform = usePlatform();

  return useMutation({
    mutationFn: async ({
      generationId,
      profileName,
      createdAt,
      format = 'wav',
    }: {
      generationId: string;
      profileName?: string;
      createdAt?: string;
      text?: string;
      format?: 'wav' | 'mp3';
    }) => {
      const blob = await apiClient.exportGenerationAudio(generationId, format);
      const ext = format.toLowerCase();
      const filename = formatExportFilename(profileName, createdAt, ext);

      await platform.filesystem.saveFile(filename, blob, [
        {
          name: ext === 'mp3' ? 'MP3 Audio' : 'WAV Audio',
          extensions: [ext],
        },
      ]);

      return blob;
    },
  });
}

export function useImportGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => apiClient.importGeneration(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}
