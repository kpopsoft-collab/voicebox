import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AudioLines,
  Download,
  FileArchive,
  Loader2,
  MoreHorizontal,
  Play,
  RotateCcw,
  Square,
  Star,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AudioBars } from '@/components/AudioBars';
import { EffectsChainEditor } from '@/components/Effects/EffectsChainEditor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import type { EffectConfig, GenerationVersionResponse, HistoryResponse } from '@/lib/api/types';
import { BOTTOM_SAFE_AREA_PADDING } from '@/lib/constants/ui';
import {
  useClearFailedGenerations,
  useDeleteGeneration,
  useExportGeneration,
  useExportGenerationAudio,
  useHistory,
  useImportGeneration,
} from '@/lib/hooks/useHistory';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatDuration, formatEngineName } from '@/lib/utils/format';
import { useGenerationStore } from '@/stores/generationStore';
import { usePlayerStore } from '@/stores/playerStore';

function parseUtcDate(dateStr: string): number {
  if (!dateStr) return Date.now();
  // If date string doesn't end with Z or have timezone offset (+09:00 / -05:00), append Z
  const hasOffset = dateStr.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(dateStr);
  const normalized = hasOffset ? dateStr : `${dateStr}Z`;
  const time = new Date(normalized).getTime();
  return isNaN(time) ? Date.now() : time;
}

function formatDurationTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const remS = s % 60;
  return `${m.toString().padStart(2, '0')}:${remS.toString().padStart(2, '0')}`;
}

function getEstimatedGenerationDuration(text: string, engine?: string, modelSize?: string): number {
  const len = text ? text.length : 10;
  if (engine === 'kokoro') {
    return Math.max(1, Math.round(len * 0.005 + 0.8));
  }
  if (engine === 'luxtts') {
    return Math.max(2, Math.round(len * 0.02 + 1.5));
  }
  if (engine === 'chatterbox' || engine === 'chatterbox_turbo' || engine === 'tada') {
    return Math.max(3, Math.round(len * 0.035 + 2.5));
  }
  // Default to Qwen TTS / Qwen CustomVoice
  const factor = modelSize === '0.6B' ? 0.035 : 0.055;
  return Math.max(3, Math.round(len * factor + 3.5));
}

function GeneratingProgressInfo({
  createdAt,
  text,
  engine,
  modelSize,
  status,
}: {
  createdAt: string;
  text: string;
  engine?: string;
  modelSize?: string;
  status: string;
}) {
  const { i18n } = useTranslation();
  const isKo = i18n.language?.startsWith('ko');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const totalSec = getEstimatedGenerationDuration(text, engine, modelSize);
  const startTime = parseUtcDate(createdAt);
  const elapsedSec = Math.max(0, (now - startTime) / 1000);
  const remainingSec = Math.max(0, Math.ceil(totalSec - elapsedSec));
  const progressPercent = Math.min(95, Math.max(5, Math.round((elapsedSec / totalSec) * 100)));

  if (status === 'loading_model') {
    return (
      <div className="flex flex-col gap-1 w-full">
        <span className="text-accent font-medium text-[11px]">
          {isKo ? '모델 로딩 중…' : 'Loading model...'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full pr-2">
      <div className="flex items-center justify-between text-accent font-medium text-[11px] leading-none">
        <span className="flex items-center gap-1">
          {isKo ? '생성 중…' : 'Generating…'}
          <span className="text-[10px] text-muted-foreground font-mono font-normal">
            ({formatDurationTimer(elapsedSec)})
          </span>
        </span>
        <span className="text-muted-foreground text-[10px] font-mono">
          {remainingSec > 0
            ? (isKo ? `약 ${remainingSec}초 남음` : `~${remainingSec}s left`)
            : (isKo ? '마무리 중…' : 'Finishing up…')}
        </span>
      </div>
      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

export function HistoryTable() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [allHistory, setAllHistory] = useState<HistoryResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [generationToDelete, setGenerationToDelete] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const { i18n } = useTranslation();
  const isKo = i18n.language?.startsWith('ko');
  const [effectsDialogOpen, setEffectsDialogOpen] = useState(false);
  const [effectsTargetId, setEffectsTargetId] = useState<string | null>(null);
  const [effectsTargetVersions, setEffectsTargetVersions] = useState<GenerationVersionResponse[]>(
    [],
  );
  const [effectsSourceVersionId, setEffectsSourceVersionId] = useState<string | null>(null);
  const [effectsChain, setEffectsChain] = useState<EffectConfig[]>([]);
  const [applyingEffects, setApplyingEffects] = useState(false);
  const [expandedVersionsId, setExpandedVersionsId] = useState<string | null>(null);
  const limit = 20;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected = allHistory.length > 0 && allHistory.every((g) => selectedIds.has(g.id));
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allHistory.map((g) => g.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      await Promise.all(idsToDelete.map((id) => apiClient.deleteGeneration(id)));
      await queryClient.invalidateQueries({ queryKey: ['history'] });
      setSelectedIds(new Set());
      setBulkDeleteDialogOpen(false);
      setPage(0);
      setAllHistory([]);
      toast({
        title: isKo ? '선택 삭제 완료' : 'Deleted selected generations',
        description: isKo
          ? `${idsToDelete.length}개의 생성 내역이 삭제되었습니다.`
          : `${idsToDelete.length} generations removed.`,
      });
    } catch (error) {
      toast({
        title: isKo ? '삭제 실패' : 'Failed to delete',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const {
    data: historyData,
    isLoading,
    isFetching,
  } = useHistory({
    limit,
    offset: page * limit,
  });

  const deleteGeneration = useDeleteGeneration();
  const clearFailed = useClearFailedGenerations();
  const [clearFailedDialogOpen, setClearFailedDialogOpen] = useState(false);
  const exportGeneration = useExportGeneration();
  const exportGenerationAudio = useExportGenerationAudio();
  const importGeneration = useImportGeneration();
  const cancelGeneration = useMutation({
    mutationFn: (generationId: string) => apiClient.cancelGeneration(generationId),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['history'] });
      toast({
        title: 'Cancelling generation',
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: 'Cancel failed',
        description: error instanceof Error ? error.message : 'Could not cancel generation',
        variant: 'destructive',
      });
    },
  });
  const addPendingGeneration = useGenerationStore((state) => state.addPendingGeneration);
  const setAudioWithAutoPlay = usePlayerStore((state) => state.setAudioWithAutoPlay);
  const restartCurrentAudio = usePlayerStore((state) => state.restartCurrentAudio);
  const currentAudioId = usePlayerStore((state) => state.audioId);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const audioUrl = usePlayerStore((state) => state.audioUrl);
  const isPlayerVisible = !!audioUrl;

  // Update accumulated history when new data arrives
  useEffect(() => {
    if (historyData?.items) {
      setTotal(historyData.total);
      if (page === 0) {
        // Reset to first page
        setAllHistory(historyData.items);
      } else {
        // Append new items, avoiding duplicates
        setAllHistory((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const newItems = historyData.items.filter((item) => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [historyData, page]);

  // Reset to page 0 when deletions, imports, or generation completions occur
  const pendingCount = useGenerationStore((state) => state.pendingGenerationIds.size);
  const prevPendingCountRef = useRef(pendingCount);
  useEffect(() => {
    if (deleteGeneration.isSuccess || importGeneration.isSuccess || clearFailed.isSuccess) {
      setPage(0);
      setAllHistory([]);
    }
  }, [deleteGeneration.isSuccess, importGeneration.isSuccess, clearFailed.isSuccess]);

  useEffect(() => {
    // A generation finished (pending count decreased) — scroll back to show it
    if (
      prevPendingCountRef.current > 0 &&
      pendingCount < prevPendingCountRef.current &&
      page !== 0
    ) {
      setPage(0);
      setAllHistory([]);
    }
    prevPendingCountRef.current = pendingCount;
  }, [pendingCount, page]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const loadMoreEl = loadMoreRef.current;
    if (!loadMoreEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && !isFetching && allHistory.length < total) {
          setPage((prev) => prev + 1);
        }
      },
      {
        root: scrollRef.current,
        rootMargin: '100px',
        threshold: 0.1,
      },
    );

    observer.observe(loadMoreEl);
    return () => observer.disconnect();
  }, [isFetching, allHistory.length, total]);

  // Track scroll position for gradient effect
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      setIsScrolled(scrollEl.scrollTop > 0);
    };

    scrollEl.addEventListener('scroll', handleScroll);
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePlay = (audioId: string, text: string, profileId: string) => {
    // If clicking the same audio, restart it from the beginning
    if (currentAudioId === audioId) {
      restartCurrentAudio();
    } else {
      // Otherwise, load the new audio and auto-play it
      const audioUrl = apiClient.getAudioUrl(audioId);
      setAudioWithAutoPlay(audioUrl, audioId, profileId, text.substring(0, 50));
    }
  };

  const handleDownloadAudio = (generationId: string, text: string) => {
    exportGenerationAudio.mutate(
      { generationId, text },
      {
        onError: (error) => {
          toast({
            title: 'Failed to download audio',
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleExportPackage = (generationId: string, text: string) => {
    exportGeneration.mutate(
      { generationId, text },
      {
        onError: (error) => {
          toast({
            title: 'Failed to export generation',
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleDeleteClick = (generationId: string, profileName: string) => {
    setGenerationToDelete({ id: generationId, name: profileName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (generationToDelete) {
      deleteGeneration.mutate(generationToDelete.id);
      setDeleteDialogOpen(false);
      setGenerationToDelete(null);
    }
  };

  const handleRetry = async (generationId: string) => {
    try {
      const result = await apiClient.retryGeneration(generationId);
      addPendingGeneration(result.id);
      queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch (error) {
      toast({
        title: 'Retry failed',
        description: error instanceof Error ? error.message : 'Could not retry generation',
        variant: 'destructive',
      });
    }
  };

  const handleRegenerate = async (generationId: string) => {
    try {
      await apiClient.regenerateGeneration(generationId);
      addPendingGeneration(generationId);
      queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch (error) {
      toast({
        title: 'Regenerate failed',
        description: error instanceof Error ? error.message : 'Could not regenerate',
        variant: 'destructive',
      });
    }
  };

  const handleToggleFavorite = async (generationId: string) => {
    try {
      await apiClient.toggleFavorite(generationId);
      queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch (error) {
      toast({
        title: 'Failed to update favorite',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleApplyEffects = (generationId: string) => {
    const gen = allHistory.find((g) => g.id === generationId);
    const versions = gen?.versions ?? [];
    setEffectsTargetId(generationId);
    setEffectsTargetVersions(versions);
    // Default to clean/original version (no effects chain)
    const cleanVersion = versions.find((v) => !v.effects_chain || v.effects_chain.length === 0);
    setEffectsSourceVersionId(cleanVersion?.id ?? null);
    setEffectsChain([]);
    setEffectsDialogOpen(true);
  };

  const handleApplyEffectsConfirm = async () => {
    if (!effectsTargetId || effectsChain.length === 0) return;
    setApplyingEffects(true);
    try {
      const newVersion = await apiClient.applyEffectsToGeneration(effectsTargetId, {
        effects_chain: effectsChain,
        source_version_id: effectsSourceVersionId ?? undefined,
        set_as_default: true,
      });
      queryClient.invalidateQueries({ queryKey: ['history'] });

      // If the player is currently on this generation, reload with the new version audio
      if (currentAudioId === effectsTargetId) {
        const gen = allHistory.find((g) => g.id === effectsTargetId);
        if (gen) {
          const versionUrl = apiClient.getVersionAudioUrl(newVersion.id);
          setAudioWithAutoPlay(
            versionUrl,
            effectsTargetId,
            gen.profile_id,
            gen.text.substring(0, 50),
          );
        }
      }

      setEffectsDialogOpen(false);
      toast({ title: 'Effects applied', description: 'A new version has been created.' });
    } catch (error) {
      toast({
        title: 'Failed to apply effects',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setApplyingEffects(false);
    }
  };

  const handleSwitchVersion = async (generationId: string, versionId: string) => {
    try {
      await apiClient.setDefaultVersion(generationId, versionId);
      queryClient.invalidateQueries({ queryKey: ['history'] });
    } catch (error) {
      toast({
        title: 'Failed to switch version',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handlePlayVersion = (
    generationId: string,
    versionId: string,
    text: string,
    profileId: string,
  ) => {
    const audioUrl = apiClient.getVersionAudioUrl(versionId);
    setAudioWithAutoPlay(audioUrl, generationId, profileId, text.substring(0, 50));
  };

  const handleImportConfirm = () => {
    if (selectedFile) {
      importGeneration.mutate(selectedFile, {
        onSuccess: (data) => {
          setImportDialogOpen(false);
          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          toast({
            title: 'Generation imported',
            description: data.message || 'Generation imported successfully',
          });
        },
        onError: (error) => {
          toast({
            title: 'Failed to import generation',
            description: error.message,
            variant: 'destructive',
          });
        },
      });
    }
  };

  if (isLoading && page === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const history = allHistory;
  const hasMore = allHistory.length < total;
  const failedCount = history.filter((g) => g.status === 'failed').length;

  const handleClearFailedConfirm = () => {
    clearFailed.mutate(undefined, {
      onSuccess: (data) => {
        setClearFailedDialogOpen(false);
        toast({
          title: 'Cleared failed generations',
          description: `${data.deleted} failed ${data.deleted === 1 ? 'generation' : 'generations'} removed.`,
        });
      },
      onError: (error) => {
        setClearFailedDialogOpen(false);
        toast({
          title: 'Failed to clear',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {history.length === 0 ? (
        <div className="text-center py-12 px-5 border-2 border-dashed mb-5 border-muted rounded-md text-muted-foreground flex-1 flex items-center justify-center">
          {t('history.empty')}
        </div>
      ) : (
        <>
          {/* Bulk Selection and Action Toolbar */}
          {history.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 mb-2 bg-muted/40 hover:bg-muted/60 transition-colors rounded-lg border border-border/60 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-history"
                  checked={isAllSelected}
                  onCheckedChange={handleToggleSelectAll}
                  className="h-4 w-4"
                />
                <label
                  htmlFor="select-all-history"
                  className="cursor-pointer font-medium select-none text-foreground flex items-center gap-1 text-xs"
                >
                  <span>{isKo ? '전체 선택' : 'Select All'}</span>
                  <span className="text-muted-foreground text-[11px]">({history.length})</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-xs font-semibold text-accent">
                      {isKo ? `${selectedIds.size}개 선택됨` : `${selectedIds.size} selected`}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 px-2.5 text-xs flex items-center gap-1.5 shadow-xs font-medium cursor-pointer"
                      onClick={() => setBulkDeleteDialogOpen(true)}
                      disabled={isBulkDeleting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{isKo ? `선택 삭제 (${selectedIds.size})` : `Delete (${selectedIds.size})`}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      {isKo ? '선택 해제' : 'Clear'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {failedCount > 0 && (
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-xs text-muted-foreground">
                {failedCount} failed {failedCount === 1 ? 'generation' : 'generations'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setClearFailedDialogOpen(true)}
                disabled={clearFailed.isPending}
              >
                <Trash2 className="h-3 w-3 mr-1.5" />
                {clearFailed.isPending ? 'Clearing...' : 'Clear failed'}
              </Button>
            </div>
          )}
          {isScrolled && (
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
          )}
          <div
            ref={scrollRef}
            className={cn(
              'flex-1 min-h-0 overflow-y-auto space-y-2 pb-4',
              isPlayerVisible && BOTTOM_SAFE_AREA_PADDING,
            )}
          >
            {history.map((gen) => {
              const isCurrentlyPlaying = currentAudioId === gen.id && isPlaying;
              const isInProgress = gen.status === 'loading_model' || gen.status === 'generating';
              const isGenerating = isInProgress;
              const isFailed = gen.status === 'failed';
              const isPlayable = !isGenerating && !isFailed;
              const hasVersions = gen.versions && gen.versions.length > 1;
              const isVersionsExpanded = expandedVersionsId === gen.id;
              const isCancelling =
                cancelGeneration.isPending && cancelGeneration.variables === gen.id;
              return (
                <div
                  key={gen.id}
                  className={cn(
                    'border rounded-md bg-card transition-colors text-left w-full',
                    isCurrentlyPlaying && 'bg-muted/70',
                  )}
                >
                  {/* Main row */}
                  <div
                    role={isPlayable ? 'button' : undefined}
                    tabIndex={isPlayable ? 0 : undefined}
                    className={cn(
                      'flex items-stretch gap-4 h-26 p-3 outline-none',
                      isPlayable && 'hover:bg-muted/70 cursor-pointer rounded-md',
                      isVersionsExpanded && 'rounded-b-none',
                    )}
                    aria-label={
                      isGenerating
                        ? `Generating speech for ${gen.profile_name}...`
                        : isFailed
                          ? `Generation failed for ${gen.profile_name}`
                          : isCurrentlyPlaying
                            ? `Sample from ${gen.profile_name}, ${formatDuration(gen.duration ?? 0)}, ${formatDate(gen.created_at)}. Playing. Press Enter to restart.`
                            : `Sample from ${gen.profile_name}, ${formatDuration(gen.duration ?? 0)}, ${formatDate(gen.created_at)}. Press Enter to play.`
                    }
                    onMouseDown={(e) => {
                      if (!isPlayable) return;
                      const target = e.target as HTMLElement;
                      if (target.closest('textarea') || window.getSelection()?.toString()) {
                        return;
                      }
                      handlePlay(gen.id, gen.text, gen.profile_id);
                    }}
                    onKeyDown={(e) => {
                      if (!isPlayable) return;
                      const target = e.target as HTMLElement;
                      if (target.closest('textarea') || target.closest('button')) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handlePlay(gen.id, gen.text, gen.profile_id);
                      }
                    }}
                  >
                    {/* Status icon */}
                    <div className="flex items-center shrink-0 w-10 justify-center overflow-hidden">
                      <AudioBars
                        mode={isGenerating ? 'generating' : isCurrentlyPlaying ? 'playing' : 'idle'}
                      />
                    </div>

                    {/* Left side - Meta information */}
                    <div className="flex flex-col gap-1.5 w-48 shrink-0 justify-center">
                      <div className="font-medium text-sm truncate" title={gen.profile_name}>
                        {gen.profile_name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{gen.language}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatEngineName(gen.engine, gen.model_size)}
                        </span>
                        {isFailed ? (
                          <span className="text-xs text-destructive">Failed</span>
                        ) : !isGenerating ? (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(gen.duration ?? 0)}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isInProgress ? (
                          <GeneratingProgressInfo
                            createdAt={gen.created_at}
                            text={gen.text}
                            engine={gen.engine}
                            modelSize={gen.model_size}
                            status={gen.status}
                          />
                        ) : (
                          formatDate(gen.created_at)
                        )}
                      </div>
                    </div>

                    {/* Right side - Transcript textarea */}
                    <div className="flex-1 min-w-0 flex">
                      <Textarea
                        value={gen.text}
                        className="flex-1 resize-none text-sm text-muted-foreground select-text"
                        readOnly
                        aria-label={`Transcript for sample from ${gen.profile_name}, ${formatDuration(gen.duration ?? 0)}`}
                      />
                    </div>

                    {/* Far right - Actions & Selection */}
                    <div
                      className="shrink-0 flex flex-col justify-center items-center gap-1"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(gen.id)}
                        onCheckedChange={() => handleToggleSelect(gen.id)}
                        className="h-4 w-4 mb-0.5"
                        aria-label={`Select generation from ${gen.profile_name}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-6 w-6 text-muted-foreground/50 hover:bg-muted-foreground/20 hover:text-muted-foreground',
                          gen.is_favorited && 'text-accent hover:text-accent',
                        )}
                        aria-label={gen.is_favorited ? 'Unfavorite' : 'Favorite'}
                        onClick={() => handleToggleFavorite(gen.id)}
                      >
                        <Star
                          className="h-2 w-2"
                          fill={gen.is_favorited ? 'currentColor' : 'none'}
                        />
                      </Button>
                      {hasVersions && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-6 w-6 text-muted-foreground/50 hover:bg-muted-foreground/20 hover:text-muted-foreground',
                            isVersionsExpanded && 'text-accent hover:text-accent',
                          )}
                          aria-label="Toggle versions"
                          onClick={() => setExpandedVersionsId(isVersionsExpanded ? null : gen.id)}
                        >
                          <AudioLines className="h-2 w-2" />
                        </Button>
                      )}

                      {isFailed ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground/50 hover:bg-muted-foreground/20 hover:text-muted-foreground"
                            aria-label="Retry generation"
                            onClick={() => handleRetry(gen.id)}
                          >
                            <RotateCcw className="h-2 w-2" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground/50 hover:bg-muted-foreground/20 hover:text-muted-foreground"
                            aria-label="Delete generation"
                            disabled={deleteGeneration.isPending}
                            onClick={() => handleDeleteClick(gen.id, gen.profile_name)}
                          >
                            <Trash2 className="h-2 w-2" />
                          </Button>
                        </>
                      ) : isGenerating ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground/50 hover:bg-muted-foreground/20 hover:text-muted-foreground"
                          aria-label="Cancel generation"
                          disabled={isCancelling}
                          onClick={() => cancelGeneration.mutate(gen.id)}
                        >
                          {isCancelling ? (
                            <Loader2 className="h-2 w-2 animate-spin" />
                          ) : (
                            <Square className="h-2 w-2" />
                          )}
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground/50 hover:bg-muted-foreground/20 hover:text-muted-foreground"
                              aria-label={t('history.actions.menu')}
                              disabled={isGenerating}
                            >
                              <MoreHorizontal className="h-2 w-2" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handlePlay(gen.id, gen.text, gen.profile_id)}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              {t('history.actions.play')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDownloadAudio(gen.id, gen.text)}
                              disabled={exportGenerationAudio.isPending}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              {t('history.actions.exportAudio')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExportPackage(gen.id, gen.text)}
                              disabled={exportGeneration.isPending}
                            >
                              <FileArchive className="mr-2 h-4 w-4" />
                              {t('history.actions.exportPackage')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleApplyEffects(gen.id)}>
                              <Wand2 className="mr-2 h-4 w-4" />
                              {t('history.actions.applyEffects')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRegenerate(gen.id)}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              {t('history.actions.regenerate')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(gen.id, gen.profile_name)}
                              disabled={deleteGeneration.isPending}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {/* Expandable versions panel */}
                  <AnimatePresence>
                    {isVersionsExpanded && gen.versions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border/50">
                          <div className="divide-y divide-border/40">
                            {gen.versions.map((v) => {
                              // Show source provenance when effects were applied to a non-clean version
                              const sourceVersion = v.source_version_id
                                ? gen.versions?.find((sv) => sv.id === v.source_version_id)
                                : null;
                              const showSource =
                                sourceVersion &&
                                sourceVersion.effects_chain &&
                                sourceVersion.effects_chain.length > 0;

                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  className="flex items-center gap-2 w-full h-9 px-3 text-left hover:bg-muted/50 transition-colors"
                                  onClick={() => {
                                    handlePlayVersion(gen.id, v.id, gen.text, gen.profile_id);
                                    if (!v.is_default) {
                                      handleSwitchVersion(gen.id, v.id);
                                    }
                                  }}
                                >
                                  <AudioLines className="h-3 w-3 shrink-0 text-muted-foreground" />
                                  <span className="truncate text-xs font-medium">{v.label}</span>
                                  {v.effects_chain && v.effects_chain.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground truncate">
                                      {v.effects_chain.map((e) => e.type).join(' → ')}
                                    </span>
                                  )}
                                  {showSource && (
                                    <span className="text-[10px] text-muted-foreground/60 truncate">
                                      from {sourceVersion.label}
                                    </span>
                                  )}
                                  <span className="flex-1" />
                                  {v.is_default && (
                                    <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">
                                      active
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Load more trigger element */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                {isFetching && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && history.length > 0 && (
              <div className="text-center py-4 text-xs text-muted-foreground">
                You've reached the end
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('history.deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('history.deleteDialog.body', { name: generationToDelete?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setGenerationToDelete(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteGeneration.isPending}
            >
              {deleteGeneration.isPending ? t('history.deleteDialog.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearFailedDialogOpen} onOpenChange={setClearFailedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('history.clearFailedDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('history.clearFailedDialog.body', { count: failedCount })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearFailedDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearFailedConfirm}
              disabled={clearFailed.isPending}
            >
              {clearFailed.isPending
                ? t('history.clearFailedDialog.clearing')
                : t('history.clearFailedDialog.clearAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('history.importDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('history.importDialog.body', { name: selectedFile?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setSelectedFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleImportConfirm}
              disabled={importGeneration.isPending || !selectedFile}
            >
              {importGeneration.isPending
                ? t('history.importDialog.importing')
                : t('history.importDialog.action')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={effectsDialogOpen} onOpenChange={setEffectsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('history.effectsDialog.title')}</DialogTitle>
            <DialogDescription>{t('history.effectsDialog.body')}</DialogDescription>
          </DialogHeader>
          {effectsTargetVersions.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('history.effectsDialog.sourceLabel')}
              </label>
              <Select
                value={effectsSourceVersionId ?? ''}
                onValueChange={(val) => setEffectsSourceVersionId(val || null)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t('history.effectsDialog.sourcePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {effectsTargetVersions.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      {v.label}
                      {v.effects_chain && v.effects_chain.length > 0 && (
                        <span className="text-muted-foreground ml-1.5">
                          ({v.effects_chain.map((e) => e.type).join(' + ')})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="py-2 max-h-80 overflow-y-auto">
            <EffectsChainEditor value={effectsChain} onChange={setEffectsChain} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEffectsDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleApplyEffectsConfirm}
              disabled={applyingEffects || effectsChain.length === 0}
            >
              {applyingEffects
                ? t('history.effectsDialog.applying')
                : t('history.effectsDialog.apply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isKo ? '선택한 음성 내역 삭제' : 'Delete Selected Generations'}
            </DialogTitle>
            <DialogDescription>
              {isKo
                ? `선택한 ${selectedIds.size}개의 음성 생성 내역을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
                : `Are you sure you want to delete ${selectedIds.size} selected generation(s)? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              disabled={isBulkDeleting}
            >
              {isKo ? '취소' : t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting
                ? (isKo ? '삭제 중…' : 'Deleting...')
                : (isKo ? `삭제 (${selectedIds.size})` : `Delete (${selectedIds.size})`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
