import {
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  Volume2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { formatAudioDuration } from '@/lib/utils/audio';
import { getAudioWaveformData, trimAudioFile } from '@/lib/utils/audioTrim';

interface AudioTrimmerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null | undefined;
  onApplyTrimmed: (trimmedFile: File) => void;
}

export function AudioTrimmerModal({
  open,
  onOpenChange,
  file,
  onApplyTrimmed,
}: AudioTrimmerModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [isRemovingBgm, setIsRemovingBgm] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null | undefined>(file);
  const [duration, setDuration] = useState(0);
  const [rawPeaks, setRawPeaks] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0); // 0 to 1

  // Zoom
  const [zoom, setZoom] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<'start' | 'end' | 'pan' | 'create' | null>(null);
  const dragStartXRef = useRef(0);
  const initialRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 10 });
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const bgmUrlRef = useRef<string | null>(null);

  // Refs to avoid stale closures in rAF playback loop
  const endTimeRef = useRef(endTime);
  const startTimeRef = useRef(startTime);
  useEffect(() => { endTimeRef.current = endTime; }, [endTime]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);

  // Load waveform and duration when file changes
  useEffect(() => {
    if (!open || !file) return;

    let isMounted = true;
    setCurrentFile(file);
    setLoading(true);
    setIsPlaying(false);
    setPlayProgress(0);
    setZoom(1);

    getAudioWaveformData(file, 1200)
      .then(({ peaks, duration }) => {
        if (!isMounted) return;
        setRawPeaks(peaks);
        setDuration(duration);
        setStartTime(0);
        // Default selection: up to 12 seconds or total duration
        setEndTime(Math.min(duration, 12));
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load audio waveform:', err);
        if (isMounted) setLoading(false);
      });

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audioRef.current = audio;

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      URL.revokeObjectURL(url);
      // Revoke BGM-generated URL if any
      if (bgmUrlRef.current) {
        URL.revokeObjectURL(bgmUrlRef.current);
        bgmUrlRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clean up any dangling drag event listeners
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
        dragCleanupRef.current = null;
      }
    };
  }, [open, file]);

  const selectedDuration = Math.max(0, endTime - startTime);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const handlePlayRange = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      stopPlayback();
      return;
    }

    audio.currentTime = startTime;
    audio.play().then(() => {
      setIsPlaying(true);

      const checkTime = () => {
        if (!audioRef.current || audioRef.current.paused) {
          setIsPlaying(false);
          return;
        }

        const current = audioRef.current.currentTime;
        if (duration > 0) {
          setPlayProgress(current / duration);
        }

        // Use refs to get latest values, avoiding stale closures
        if (current >= endTimeRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
          setPlayProgress(startTimeRef.current / duration);
        } else {
          animationFrameRef.current = requestAnimationFrame(checkTime);
        }
      };

      animationFrameRef.current = requestAnimationFrame(checkTime);
    }).catch(console.error);
  };

  const handlePlayAll = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      stopPlayback();
      return;
    }

    audio.currentTime = 0;
    audio.play().then(() => {
      setIsPlaying(true);

      const checkTime = () => {
        if (!audioRef.current || audioRef.current.paused) {
          setIsPlaying(false);
          return;
        }

        const current = audioRef.current.currentTime;
        if (duration > 0) {
          setPlayProgress(current / duration);
        }

        if (current >= duration) {
          audioRef.current.pause();
          setIsPlaying(false);
          setPlayProgress(0);
        } else {
          animationFrameRef.current = requestAnimationFrame(checkTime);
        }
      };

      animationFrameRef.current = requestAnimationFrame(checkTime);
    }).catch(console.error);
  };

  // Adjust time by delta
  const adjustStartTime = (delta: number) => {
    stopPlayback();
    setStartTime((prev) => {
      const next = Math.max(0, Math.min(endTime - 0.05, Number((prev + delta).toFixed(3))));
      return next;
    });
  };

  const adjustEndTime = (delta: number) => {
    stopPlayback();
    setEndTime((prev) => {
      const next = Math.min(duration, Math.max(startTime + 0.05, Number((prev + delta).toFixed(3))));
      return next;
    });
  };

  // Zoom controls
  const handleZoomToSelection = () => {
    if (duration <= 0 || selectedDuration <= 0) return;
    const targetZoom = Math.min(24, Math.max(1, Number((duration / selectedDuration * 0.75).toFixed(1))));
    setZoom(targetZoom);

    setTimeout(() => {
      if (!scrollContainerRef.current) return;
      const containerWidth = scrollContainerRef.current.clientWidth;
      const totalContentWidth = containerWidth * targetZoom;
      const selCenterRatio = (startTime + selectedDuration / 2) / duration;
      const targetScrollLeft = selCenterRatio * totalContentWidth - containerWidth / 2;
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth',
      });
    }, 50);
  };

  const handleResetZoom = () => {
    setZoom(1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const hasDraggedRef = useRef(false);

  // Drag interaction on waveform
  const handleMouseDown = (type: 'start' | 'end' | 'pan' | 'create', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stopPlayback();
    draggingRef.current = type;
    dragStartXRef.current = e.clientX;
    hasDraggedRef.current = false;
    initialRangeRef.current = { start: startTime, end: endTime };

    if (!waveformContainerRef.current || duration <= 0) return;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickTime = clickRatio * duration;
    let createAnchor = clickTime;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!waveformContainerRef.current || duration <= 0) return;
      const moveDelta = Math.abs(moveEvent.clientX - dragStartXRef.current);
      if (moveDelta > 3) {
        hasDraggedRef.current = true;
      }

      const rect = waveformContainerRef.current.getBoundingClientRect();
      const deltaX = moveEvent.clientX - dragStartXRef.current;
      const deltaTime = (deltaX / rect.width) * duration;

      if (draggingRef.current === 'start') {
        const newStart = Math.max(
          0,
          Math.min(initialRangeRef.current.end - 0.05, initialRangeRef.current.start + deltaTime),
        );
        setStartTime(Number(newStart.toFixed(3)));
      } else if (draggingRef.current === 'end') {
        const newEnd = Math.min(
          duration,
          Math.max(initialRangeRef.current.start + 0.05, initialRangeRef.current.end + deltaTime),
        );
        setEndTime(Number(newEnd.toFixed(3)));
      } else if (draggingRef.current === 'pan') {
        const len = initialRangeRef.current.end - initialRangeRef.current.start;
        let newStart = initialRangeRef.current.start + deltaTime;
        if (newStart < 0) {
          newStart = 0;
        } else if (newStart + len > duration) {
          newStart = duration - len;
        }
        const newEnd = Math.min(duration, newStart + len);
        setStartTime(Number(newStart.toFixed(3)));
        setEndTime(Number(newEnd.toFixed(3)));
      } else if (draggingRef.current === 'create') {
        const currentRatio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
        const currentTime = currentRatio * duration;
        const newStart = Math.max(0, Math.min(createAnchor, currentTime));
        const newEnd = Math.min(duration, Math.max(createAnchor, currentTime));
        if (newEnd - newStart >= 0.05) {
          setStartTime(Number(newStart.toFixed(3)));
          setEndTime(Number(newEnd.toFixed(3)));
        }
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dragCleanupRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    // Store cleanup in ref so unmount can remove listeners if needed
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  };

  const handleWaveformClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) return;
    if (!waveformContainerRef.current || duration <= 0) return;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const clickTime = clickRatio * duration;

    stopPlayback();
    if (audioRef.current) {
      audioRef.current.currentTime = clickTime;
      setPlayProgress(clickRatio);
    }
  };

  const handleRemoveBgm = async () => {
    const activeFile = currentFile || file;
    if (!activeFile) return;
    try {
      setIsRemovingBgm(true);
      stopPlayback();
      toast({
        title: '🪄 AI 배경음악 제거 시작',
        description: 'Demucs AI 모델로 배경음악을 분리하여 순수 목소리를 추출하는 중입니다...',
      });
      const vocalOnlyFile = await apiClient.removeBgm(activeFile);
      setCurrentFile(vocalOnlyFile);
      
      const { peaks, duration } = await getAudioWaveformData(vocalOnlyFile, 1200);
      setRawPeaks(peaks);
      setDuration(duration);
      setStartTime(0);
      setEndTime(Math.min(duration, 12));
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Revoke previous BGM URL before creating a new one
      if (bgmUrlRef.current) {
        URL.revokeObjectURL(bgmUrlRef.current);
      }
      const url = URL.createObjectURL(vocalOnlyFile);
      bgmUrlRef.current = url;
      audioRef.current = new Audio(url);

      toast({
        title: '배경음악 제거 완료',
        description: '목소리만 추출된 오디오로 파형이 교체되었습니다.',
      });
    } catch (err) {
      console.error('Failed to remove BGM:', err);
      toast({
        title: '배경음악 제거 실패',
        description: err instanceof Error ? err.message : '오디오 분리 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsRemovingBgm(false);
    }
  };

  const handleApply = async () => {
    const activeFile = currentFile || file;
    if (!activeFile) return;
    try {
      setTrimming(true);
      stopPlayback();
      const trimmed = await trimAudioFile(activeFile, startTime, endTime);
      onApplyTrimmed(trimmed);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to trim audio file:', err);
    } finally {
      setTrimming(false);
    }
  };

  const handleDownload = async () => {
    const activeFile = currentFile || file;
    if (!activeFile) return;
    try {
      setTrimming(true);
      const trimmed = await trimAudioFile(activeFile, startTime, endTime);
      const url = URL.createObjectURL(trimmed);
      const a = document.createElement('a');
      a.href = url;
      a.download = trimmed.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download trimmed audio:', err);
    } finally {
      setTrimming(false);
    }
  };

  const visiblePeakBars = useMemo(() => {
    if (rawPeaks.length === 0) return [];
    const targetBarCount = Math.min(rawPeaks.length, Math.max(100, Math.floor(100 * zoom)));
    const step = rawPeaks.length / targetBarCount;
    const result: number[] = [];
    for (let i = 0; i < targetBarCount; i++) {
      const idx = Math.floor(i * step);
      result.push(rawPeaks[idx] || 0.1);
    }
    return result;
  }, [rawPeaks, zoom]);

  // Generate time ruler ticks for modal
  const timeRulerTicks = useMemo(() => {
    if (duration <= 0) return [];
    let interval = 1;
    if (zoom >= 20) interval = 0.05;
    else if (zoom >= 10) interval = 0.1;
    else if (zoom >= 5) interval = 0.25;
    else if (zoom >= 2.5) interval = 0.5;
    else if (zoom >= 1.5) interval = 1;
    else if (duration > 60) interval = 5;
    else if (duration > 30) interval = 2;
    else interval = 1;

    const ticks: { time: number; percent: number; label: string; isMajor: boolean }[] = [];
    const count = Math.floor(duration / interval);
    for (let i = 0; i <= count; i++) {
      const time = Number((i * interval).toFixed(3));
      if (time > duration) break;
      const percent = (time / duration) * 100;
      let label = `${time.toFixed(1)}s`;
      if (interval < 0.1) label = `${time.toFixed(2)}s`;
      else if (interval >= 1) label = `${time.toFixed(0)}s`;
      ticks.push({ time, percent, label, isMajor: i % 2 === 0 });
    }
    return ticks;
  }, [duration, zoom]);

  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
  const playheadPercent = Math.max(0, Math.min(100, playProgress * 100));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Scissors className="h-5 w-5 text-primary" />
              오디오 구간 자르기 (Audio Trimmer)
            </DialogTitle>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom((z) => Math.max(1, Number((z / 1.5).toFixed(1))))}
                disabled={zoom <= 1}
                title="축소"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-mono font-semibold px-1 min-w-[2.5rem] text-center">
                {zoom === 1 ? '1x' : `${zoom.toFixed(1)}x`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom((z) => Math.min(24, Number((z * 1.5).toFixed(1))))}
                disabled={zoom >= 24}
                title="확대"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs px-2 flex items-center gap-1"
                onClick={handleZoomToSelection}
                title="선택 구간 맞춤 확대"
              >
                <Maximize2 className="h-3 w-3 text-primary" />
                선택구간 확대
              </Button>

              {zoom > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-1.5"
                  onClick={handleResetZoom}
                >
                  <Minimize2 className="h-3 w-3" />
                  전체
                </Button>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs">
            {file?.name} — 파형을 확대하여 호흡과 음성 구간을 밀리초 단위로 정밀하게 자릅니다.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">오디오 파형을 정밀 분석하는 중...</p>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            {/* High-contrast Time HUD */}
            <div className="grid grid-cols-3 gap-2 bg-muted/40 p-2.5 rounded-xl border border-border">
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase">시작 (Start)</div>
                <div className="text-base font-mono font-bold text-primary">{startTime.toFixed(3)}s</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase">끝 (End)</div>
                <div className="text-base font-mono font-bold text-primary">{endTime.toFixed(3)}s</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase">선택 길이 (Duration)</div>
                <div className="text-base font-mono font-bold text-foreground">{selectedDuration.toFixed(3)}초</div>
              </div>
            </div>

            {/* Visual Waveform Editor with Time Ruler */}
            <div className="space-y-1.5">
              <div
                ref={scrollContainerRef}
                className="relative overflow-x-auto overflow-y-hidden rounded-xl border border-border bg-muted/40 select-none flex flex-col cursor-crosshair"
                style={{ scrollbarWidth: 'thin' }}
              >
                {/* Time Ruler */}
                <div
                  style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
                  className="relative h-6 border-b border-border/80 bg-background/60 select-none overflow-hidden"
                >
                  {timeRulerTicks.map((tick, idx) => (
                    <div
                      key={idx}
                      style={{ left: `${tick.percent}%` }}
                      className="absolute top-0 bottom-0 flex flex-col items-start pointer-events-none"
                    >
                      <div
                        className={`w-px ${
                          tick.isMajor ? 'h-2.5 bg-foreground/60' : 'h-1 bg-muted-foreground/40'
                        }`}
                      />
                      {tick.isMajor && (
                        <span className="text-[9px] font-mono font-bold text-foreground/80 pl-0.5 -mt-0.5 whitespace-nowrap">
                          {tick.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Waveform Canvas */}
                <div
                  ref={waveformContainerRef}
                  onClick={handleWaveformClick}
                  style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
                  className="relative h-32 p-2 pt-5 flex items-center transition-all duration-75"
                >
                  {/* Waveform Bars */}
                  <div className="absolute inset-0 flex items-center justify-between px-3 gap-0.5 pointer-events-none pt-3">
                    {visiblePeakBars.map((peak, idx) => {
                      const barRatio = (idx / (visiblePeakBars.length - 1)) * 100;
                      const inRange = barRatio >= startPercent && barRatio <= endPercent;

                      return (
                        <div
                          key={idx}
                          style={{ height: `${Math.max(6, peak * 88)}%` }}
                          className={`w-full max-w-[3.5px] rounded-full transition-colors ${
                            inRange
                              ? 'bg-primary shadow-xs'
                              : 'bg-muted-foreground/30'
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Selected Range Highlight Overlay */}
                  <div
                    style={{
                      left: `${startPercent}%`,
                      width: `${Math.max(0, endPercent - startPercent)}%`,
                    }}
                    onMouseDown={(e) => handleMouseDown('pan', e)}
                    className="absolute top-0 bottom-0 bg-primary/15 border-y-2 border-primary/70 cursor-grab active:cursor-grabbing pointer-events-auto"
                  />

                  {/* Left (Start) Handle */}
                  <div
                    style={{ left: `${startPercent}%` }}
                    onMouseDown={(e) => handleMouseDown('start', e)}
                    className="absolute top-0 bottom-0 w-6 -translate-x-1/2 flex items-center justify-center cursor-ew-resize group z-10 pointer-events-auto"
                  >
                    <div className="w-2 h-full bg-primary rounded-full group-hover:scale-125 transition-transform shadow-md ring-1 ring-background" />
                    <div className="absolute top-0.5 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-extrabold shadow-md ring-1 ring-background pointer-events-none whitespace-nowrap">
                      {startTime.toFixed(2)}s
                    </div>
                  </div>

                  {/* Right (End) Handle */}
                  <div
                    style={{ left: `${endPercent}%` }}
                    onMouseDown={(e) => handleMouseDown('end', e)}
                    className="absolute top-0 bottom-0 w-6 -translate-x-1/2 flex items-center justify-center cursor-ew-resize group z-10 pointer-events-auto"
                  >
                    <div className="w-2 h-full bg-primary rounded-full group-hover:scale-125 transition-transform shadow-md ring-1 ring-background" />
                    <div className="absolute top-0.5 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-extrabold shadow-md ring-1 ring-background pointer-events-none whitespace-nowrap">
                      {endTime.toFixed(2)}s
                    </div>
                  </div>

                  {/* Playhead Line */}
                  {isPlaying && (
                    <div
                      style={{ left: `${playheadPercent}%` }}
                      className="absolute top-0 bottom-0 w-1 bg-destructive shadow-md z-20 pointer-events-none transition-all duration-75"
                    />
                  )}
                </div>
              </div>

              {/* Time Ruler & Duration Badge */}
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1 font-mono">
                <span>00:00.00</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      selectedDuration >= 3 && selectedDuration <= 20
                        ? 'default'
                        : 'secondary'
                    }
                    className="text-xs px-2 py-0.5 font-sans"
                  >
                    선택 구간: {selectedDuration.toFixed(2)}초
                    {selectedDuration >= 5 && selectedDuration <= 15
                      ? ' (⭐ 복제 최적 권장 길이)'
                      : selectedDuration > 30
                        ? ' (⚠️ 30초 이하 권장)'
                        : ''}
                  </Badge>
                </div>
                <span>{formatAudioDuration(duration)}</span>
              </div>
            </div>

            {/* Precision Time Adjustments Controls */}
            <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl border border-border">
              {/* Start Time Adjuster */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>시작 지점 (Start)</span>
                  <span className="font-mono text-primary font-bold">{startTime.toFixed(3)}s</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-1.5 text-xs"
                    onClick={() => adjustStartTime(-1)}
                    disabled={startTime <= 0}
                  >
                    -1s
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-1.5 text-xs"
                    onClick={() => adjustStartTime(-0.1)}
                    disabled={startTime <= 0}
                  >
                    -0.1s
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => adjustStartTime(-0.01)}
                    disabled={startTime <= 0}
                    title="-0.01초 (10ms)"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="flex-1 text-center font-mono font-bold text-xs bg-background py-1 rounded border border-border">
                    {startTime.toFixed(2)}s
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => adjustStartTime(0.01)}
                    disabled={startTime >= endTime - 0.05}
                    title="+0.01초 (10ms)"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-1.5 text-xs"
                    onClick={() => adjustStartTime(0.1)}
                    disabled={startTime >= endTime - 0.1}
                  >
                    +0.1s
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-1.5 text-xs"
                    onClick={() => adjustStartTime(1)}
                    disabled={startTime >= endTime - 1}
                  >
                    +1s
                  </Button>
                </div>
              </div>

              {/* End Time Adjuster */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>끝 지점 (End)</span>
                  <span className="font-mono text-primary font-bold">{endTime.toFixed(3)}s</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-1.5 text-xs"
                    onClick={() => adjustEndTime(-1)}
                    disabled={endTime <= startTime + 1}
                  >
                    -1s
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-1.5 text-xs"
                    onClick={() => adjustEndTime(-0.1)}
                    disabled={endTime <= startTime + 0.1}
                  >
                    -0.1s
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => adjustEndTime(-0.01)}
                    disabled={endTime <= startTime + 0.05}
                    title="-0.01초 (10ms)"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <div className="flex-1 text-center font-mono font-bold text-xs bg-background py-1 rounded border border-border">
                    {endTime.toFixed(2)}s
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => adjustEndTime(0.01)}
                    disabled={endTime >= duration}
                    title="+0.01초 (10ms)"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-1.5 text-xs"
                    onClick={() => adjustEndTime(0.1)}
                    disabled={endTime >= duration}
                  >
                    +0.1s
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-1.5 text-xs"
                    onClick={() => adjustEndTime(1)}
                    disabled={endTime >= duration}
                  >
                    +1s
                  </Button>
                </div>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePlayAll}
                className="flex items-center gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                전체 재생
              </Button>
              <Button
                type="button"
                variant={isPlaying ? 'destructive' : 'secondary'}
                size="default"
                onClick={handlePlayRange}
                className="flex items-center gap-2 font-semibold px-6"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4" />
                    정지 (Stop)
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 text-primary" />
                    선택 구간 미리듣기 ({selectedDuration.toFixed(2)}초)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={trimming || isRemovingBgm}
          >
            취소 (Cancel)
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleRemoveBgm}
              disabled={loading || trimming || isRemovingBgm || !file}
              className="flex items-center gap-1.5 text-xs font-semibold border border-primary/20 hover:border-primary/50"
              title="배경음악 및 악기를 제거하고 목소리만 추출"
            >
              {isRemovingBgm ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  배경음악 분리 중...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  배경음악 제거
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              disabled={loading || trimming || isRemovingBgm || selectedDuration <= 0}
              className="flex items-center gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              WAV 다운로드
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={loading || trimming || isRemovingBgm || selectedDuration <= 0}
              className="flex items-center gap-1.5 font-semibold text-xs"
            >
              {trimming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Scissors className="h-3.5 w-3.5" />
              )}
              이 구간으로 적용
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
