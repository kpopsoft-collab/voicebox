import {
  Download,
  FileAudio,
  History,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { formatAudioDuration } from '@/lib/utils/audio';
import { getAudioWaveformData, trimAudioFile } from '@/lib/utils/audioTrim';
import { useUIStore } from '@/stores/uiStore';

interface TrimmedClip {
  id: string;
  name: string;
  file: File;
  url: string;
  duration: number;
  startTime: number;
  endTime: number;
  createdAt: Date;
}

// Helper to convert File to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function TrimmerTab() {
  const { toast } = useToast();
  const setProfileDialogOpen = useUIStore((state) => state.setProfileDialogOpen);
  const setProfileFormDraft = useUIStore((state) => state.setProfileFormDraft);
  const setEditingProfileId = useUIStore((state) => state.setEditingProfileId);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [isRemovingBgm, setIsRemovingBgm] = useState(false);
  const [duration, setDuration] = useState(0);
  const [rawPeaks, setRawPeaks] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Zoom and scroll state
  const [zoom, setZoom] = useState(1); // 1 = 100%, 2 = 200%, up to 32
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const minimapContainerRef = useRef<HTMLDivElement | null>(null);

  // History of trimmed clips
  const [trimmedClips, setTrimmedClips] = useState<TrimmedClip[]>([]);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const clipAudioRef = useRef<HTMLAudioElement | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const draggingRef = useRef<'start' | 'end' | 'pan' | 'create' | 'minimap' | null>(null);
  const dragStartXRef = useRef(0);
  const initialRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 10 });
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // Refs to avoid stale closures in rAF playback loop
  const endTimeRef = useRef(endTime);
  const startTimeRef = useRef(startTime);
  const isLoopingRef = useRef(isLooping);
  useEffect(() => { endTimeRef.current = endTime; }, [endTime]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const loadAudioFile = useCallback((selectedFile: File) => {
    stopPlayback();
    setFile(selectedFile);
    setLoading(true);
    setIsPlaying(false);
    setPlayProgress(0);
    setZoom(1);

    getAudioWaveformData(selectedFile, 1600)
      .then(({ peaks, duration }) => {
        setRawPeaks(peaks);
        setDuration(duration);
        setStartTime(0);
        setEndTime(Math.min(duration, 12));
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load audio waveform:', err);
        setLoading(false);
      });

    if (audioRef.current) {
      audioRef.current.pause();
    }
    // Revoke previous object URL to prevent memory leak
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    const url = URL.createObjectURL(selectedFile);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
  }, [stopPlayback]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (clipAudioRef.current) {
        clipAudioRef.current.pause();
        clipAudioRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Revoke main audio object URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      // Revoke all trimmed clip URLs
      setTrimmedClips((clips) => {
        clips.forEach((clip) => URL.revokeObjectURL(clip.url));
        return [];
      });
      // Clean up any dangling drag event listeners
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
        dragCleanupRef.current = null;
      }
    };
  }, []);

  const selectedDuration = Math.max(0, endTime - startTime);

  // Playback control
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
          if (isLoopingRef.current) {
            audioRef.current.currentTime = startTimeRef.current;
            animationFrameRef.current = requestAnimationFrame(checkTime);
          } else {
            audioRef.current.pause();
            setIsPlaying(false);
            setPlayProgress(startTimeRef.current / duration);
          }
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

  // Adjust time by delta (supports fine increments like 0.01, 0.05, 0.1, 1, 5)
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

  // Zoom to selection
  const handleZoomToSelection = () => {
    if (duration <= 0 || selectedDuration <= 0) return;
    const targetZoom = Math.min(32, Math.max(1, Number((duration / selectedDuration * 0.75).toFixed(1))));
    setZoom(targetZoom);

    // Scroll to center selection
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

  const handleZoomIn = () => {
    setZoom((z) => Math.min(32, Number((z * 1.5).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(1, Number((z / 1.5).toFixed(2))));
  };

  // Mouse wheel zoom on waveform
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
      setZoom((z) => Math.max(1, Math.min(32, Number((z * zoomFactor).toFixed(2)))));
    }
  };

  const hasDraggedRef = useRef(false);

  // Drag interaction on main zoomed waveform
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

  // Clicking on background simply moves the playhead/cursor, NEVER shrinking the selection
  const handleWaveformClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) return;
    if (!waveformContainerRef.current || duration <= 0) return;
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const clickTime = clickRatio * duration;

    stopPlayback();
    // Move audio playhead to clicked time without modifying selected region
    if (audioRef.current) {
      audioRef.current.currentTime = clickTime;
      setPlayProgress(clickRatio);
    }
  };

  // Minimap click to scroll
  const handleMinimapClick = (e: React.MouseEvent) => {
    if (!minimapContainerRef.current || !scrollContainerRef.current || duration <= 0) return;
    const rect = minimapContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));

    const totalWidth = scrollContainerRef.current.clientWidth * zoom;
    const targetScroll = clickRatio * totalWidth - scrollContainerRef.current.clientWidth / 2;
    scrollContainerRef.current.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: 'smooth',
    });
  };

  // Remove BGM using Demucs
  const handleRemoveBgm = async () => {
    if (!file) return;
    try {
      setIsRemovingBgm(true);
      stopPlayback();
      toast({
        title: '🪄 AI 배경음악 제거 시작',
        description: 'Demucs AI 모델로 배경음악과 악기를 분리하여 순수 목소리를 추출하는 중입니다...',
      });
      const vocalOnlyFile = await apiClient.removeBgm(file);
      loadAudioFile(vocalOnlyFile);
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

  // Trim and download
  const handleDownloadTrimmed = async () => {
    if (!file) return;
    try {
      setTrimming(true);
      const trimmed = await trimAudioFile(file, startTime, endTime);
      const url = URL.createObjectURL(trimmed);
      const a = document.createElement('a');
      a.href = url;
      a.download = trimmed.name;
      a.click();

      // Add to clips history
      const newClip: TrimmedClip = {
        id: crypto.randomUUID(),
        name: trimmed.name,
        file: trimmed,
        url,
        duration: selectedDuration,
        startTime,
        endTime,
        createdAt: new Date(),
      };
      setTrimmedClips((prev) => [newClip, ...prev]);
    } catch (err) {
      console.error('Failed to trim audio:', err);
    } finally {
      setTrimming(false);
    }
  };

  // Create voice profile directly from trimmed clip
  const handleCreateVoiceProfile = async () => {
    if (!file) return;
    try {
      setTrimming(true);
      const trimmed = await trimAudioFile(file, startTime, endTime);
      const base64 = await fileToBase64(trimmed);
      setEditingProfileId(null);
      setProfileFormDraft({
        name: trimmed.name.replace(/\.[^/.]+$/, '').replace(/_trimmed_\d+s$/, ''),
        description: '',
        language: 'ko',
        personality: '',
        referenceText: '',
        sampleMode: 'upload',
        sampleFileName: trimmed.name,
        sampleFileType: trimmed.type,
        sampleFileData: base64,
      });
      setProfileDialogOpen(true);
    } catch (err) {
      console.error('Failed to prepare audio for profile:', err);
    } finally {
      setTrimming(false);
    }
  };

  const handleCreateVoiceProfileFromClip = async (clip: TrimmedClip) => {
    try {
      const base64 = await fileToBase64(clip.file);
      setEditingProfileId(null);
      setProfileFormDraft({
        name: clip.name.replace(/\.[^/.]+$/, '').replace(/_trimmed_\d+s$/, ''),
        description: '',
        language: 'ko',
        personality: '',
        referenceText: '',
        sampleMode: 'upload',
        sampleFileName: clip.name,
        sampleFileType: clip.file.type,
        sampleFileData: base64,
      });
      setProfileDialogOpen(true);
    } catch (err) {
      console.error('Failed to prepare audio for profile:', err);
    }
  };

  // Play clip from history
  const handlePlayClip = (clip: TrimmedClip) => {
    if (playingClipId === clip.id) {
      if (clipAudioRef.current) {
        clipAudioRef.current.pause();
      }
      setPlayingClipId(null);
      return;
    }

    if (clipAudioRef.current) {
      clipAudioRef.current.pause();
    }

    const audio = new Audio(clip.url);
    clipAudioRef.current = audio;
    setPlayingClipId(clip.id);

    audio.onended = () => setPlayingClipId(null);
    audio.onpause = () => setPlayingClipId(null);
    audio.play().catch(() => setPlayingClipId(null));
  };

  // Downsample rawPeaks for rendering in zoomed container
  const visiblePeakBars = useMemo(() => {
    if (rawPeaks.length === 0) return [];
    // Number of bars scales with zoom level: 120 bars at 1x, up to 1500 bars at 32x
    const targetBarCount = Math.min(rawPeaks.length, Math.max(120, Math.floor(120 * zoom)));
    const step = rawPeaks.length / targetBarCount;
    const result: number[] = [];

    for (let i = 0; i < targetBarCount; i++) {
      const idx = Math.floor(i * step);
      result.push(rawPeaks[idx] || 0.1);
    }
    return result;
  }, [rawPeaks, zoom]);

  // Minimap peaks (fixed 140 bars)
  const minimapPeaks = useMemo(() => {
    if (rawPeaks.length === 0) return [];
    const targetCount = 140;
    const step = rawPeaks.length / targetCount;
    const result: number[] = [];
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.floor(i * step);
      result.push(rawPeaks[idx] || 0.1);
    }
    return result;
  }, [rawPeaks]);

  // Generate time ruler ticks based on duration and zoom level
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
      if (interval < 0.1) {
        label = `${time.toFixed(2)}s`;
      } else if (interval >= 1) {
        label = `${time.toFixed(0)}s`;
      }
      
      const isMajor = i % 2 === 0;
      ticks.push({ time, percent, label, isMajor });
    }
    return ticks;
  }, [duration, zoom]);

  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
  const playheadPercent = Math.max(0, Math.min(100, playProgress * 100));

  return (
    <div className="flex-1 flex flex-col h-full py-6 overflow-hidden max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Scissors className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">오디오 구간 자르기 (Audio Trimmer)</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            파형을 최대 32배까지 정밀 확대하여 음성의 시작/끝 지점과 호흡을 밀리초 단위로 세밀하게 조정할 수 있습니다.
          </p>
        </div>

        {file && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5"
          >
            <Upload className="h-4 w-4" />
            다른 파일 열기
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="audio/*"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) loadAudioFile(selected);
        }}
        className="hidden"
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pt-4 pb-8 space-y-4">
        {!file ? (
          /* Empty / Upload Dropzone */
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped && dropped.type.startsWith('audio/')) {
                loadAudioFile(dropped);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-16 transition-all duration-200 cursor-pointer min-h-[380px] text-center ${
              isDraggingOver
                ? 'border-primary bg-primary/5 scale-[0.99]'
                : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            <div className="p-4 rounded-full bg-primary/10 text-primary mb-4">
              <FileAudio className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-semibold mb-1">오디오 파일을 여기로 끌어다 놓으세요</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              MP3, WAV, M4A, FLAC, OGG, WebM 등 모든 오디오 포맷을 지원합니다.
            </p>
            <Button size="lg" className="flex items-center gap-2 font-semibold">
              <Upload className="h-5 w-5" />
              컴퓨터에서 파일 선택
            </Button>
          </div>
        ) : loading ? (
          /* Loading Waveform */
          <div className="flex flex-col items-center justify-center py-28 gap-4 bg-muted/20 rounded-2xl border border-border">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <h4 className="font-semibold">고해상도 오디오 파형을 정밀 분석하는 중...</h4>
              <p className="text-sm text-muted-foreground">{file.name}</p>
            </div>
          </div>
        ) : (
          /* Loaded Audio Trimmer Studio */
          <div className="space-y-4">
            {/* High-Contrast Time HUD Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-card rounded-xl border border-border p-3 shadow-xs">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">시작 지점 (Start)</div>
                <div className="text-xl font-mono font-bold text-primary mt-0.5">{startTime.toFixed(3)}s</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{formatAudioDuration(startTime)}</div>
              </div>
              <div className="bg-card rounded-xl border border-border p-3 shadow-xs">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">끝 지점 (End)</div>
                <div className="text-xl font-mono font-bold text-primary mt-0.5">{endTime.toFixed(3)}s</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{formatAudioDuration(endTime)}</div>
              </div>
              <div className="bg-card rounded-xl border border-border p-3 shadow-xs">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">선택 길이 (Duration)</div>
                <div className="text-xl font-mono font-bold text-foreground mt-0.5">{selectedDuration.toFixed(3)}초</div>
                <div className="text-[10px] font-medium mt-0.5">
                  {selectedDuration >= 5 && selectedDuration <= 15 ? (
                    <span className="text-emerald-500 font-semibold">⭐ 복제 최적 권장 길이</span>
                  ) : selectedDuration > 30 ? (
                    <span className="text-destructive font-semibold">⚠️ 30초 이하 권장</span>
                  ) : (
                    <span className="text-muted-foreground">음성 복제용</span>
                  )}
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-3 shadow-xs">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">재생 위치 (Playhead)</div>
                <div className="text-xl font-mono font-bold text-foreground mt-0.5">
                  {(duration * playProgress).toFixed(2)}s
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">전체 {formatAudioDuration(duration)}</div>
              </div>
            </div>

            {/* File Info Bar & Zoom Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <FileAudio className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-sm truncate max-w-xs sm:max-w-md">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    전체: {formatAudioDuration(duration)} · {duration.toFixed(2)}초 · {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
              </div>

              {/* Zoom & Viewport Toolbar */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-background rounded-lg border border-border p-0.5 shadow-xs">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleZoomOut}
                    disabled={zoom <= 1}
                    title="축소 (Zoom Out)"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs font-mono font-semibold px-2 min-w-[3.5rem] text-center">
                    {zoom === 1 ? '1.0x (전체)' : `${zoom.toFixed(1)}x`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleZoomIn}
                    disabled={zoom >= 32}
                    title="확대 (Zoom In)"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleZoomToSelection}
                  className="h-8 text-xs flex items-center gap-1.5 font-medium border border-primary/20 hover:border-primary/50"
                  title="선택된 구간을 화면에 꽉 차게 확대"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-primary" />
                  선택구간 확대
                </Button>

                {zoom > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetZoom}
                    className="h-8 text-xs flex items-center gap-1 text-muted-foreground"
                    title="1배율 전체보기로 리셋"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                    전체보기
                  </Button>
                )}
              </div>
            </div>

            {/* Overview Minimap (Whole Audio Navigator) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span className="font-semibold">전체 오디오 미니맵 (클릭하여 줌 위치 이동)</span>
                <span className="font-mono">
                  선택: {startTime.toFixed(2)}s ~ {endTime.toFixed(2)}s ({selectedDuration.toFixed(2)}초)
                </span>
              </div>
              <div
                ref={minimapContainerRef}
                onClick={handleMinimapClick}
                className="relative h-10 bg-muted/60 rounded-lg border border-border overflow-hidden select-none cursor-pointer p-1 flex items-center"
              >
                {/* Minimap Bars */}
                <div className="absolute inset-0 flex items-center justify-between px-2 gap-0.5 pointer-events-none">
                  {minimapPeaks.map((peak, idx) => {
                    const barRatio = (idx / (minimapPeaks.length - 1)) * 100;
                    const inRange = barRatio >= startPercent && barRatio <= endPercent;
                    return (
                      <div
                        key={idx}
                        style={{ height: `${Math.max(10, peak * 85)}%` }}
                        className={`w-full max-w-[2px] rounded-full ${
                          inRange ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Minimap Selection Highlight */}
                <div
                  style={{
                    left: `${startPercent}%`,
                    width: `${Math.max(0, endPercent - startPercent)}%`,
                  }}
                  className="absolute top-0 bottom-0 bg-primary/25 border-x border-primary/70 pointer-events-none"
                />

                {/* Minimap Playhead */}
                {isPlaying && (
                  <div
                    style={{ left: `${playheadPercent}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10 pointer-events-none"
                  />
                )}
              </div>
            </div>

            {/* Zoomable Main Waveform Editor with Interactive Time Ruler */}
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3">
              {/* Scroll Container for Zoomed View */}
              <div
                ref={scrollContainerRef}
                onWheel={handleWheel}
                className="relative overflow-x-auto overflow-y-hidden rounded-xl border border-border bg-muted/30 select-none cursor-crosshair flex flex-col"
                style={{ scrollbarWidth: 'thin' }}
              >
                {/* 1. Zoom-Synchronized Interactive Time Ruler */}
                <div
                  style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
                  className="relative h-7 border-b border-border/80 bg-background/60 select-none overflow-hidden"
                >
                  {timeRulerTicks.map((tick, idx) => (
                    <div
                      key={idx}
                      style={{ left: `${tick.percent}%` }}
                      className="absolute top-0 bottom-0 flex flex-col items-start pointer-events-none"
                    >
                      <div
                        className={`w-px ${
                          tick.isMajor ? 'h-3 bg-foreground/60' : 'h-1.5 bg-muted-foreground/40'
                        }`}
                      />
                      {tick.isMajor && (
                        <span className="text-[10px] font-mono font-bold text-foreground/80 pl-1 -mt-0.5 whitespace-nowrap">
                          {tick.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* 2. Waveform Container */}
                <div
                  ref={waveformContainerRef}
                  onClick={handleWaveformClick}
                  style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
                  className="relative h-44 p-3 pt-6 flex items-center transition-all duration-75"
                >
                  {/* Waveform Bars */}
                  <div className="absolute inset-0 flex items-center justify-between px-4 gap-0.5 pointer-events-none pt-4">
                    {visiblePeakBars.map((peak, idx) => {
                      const barRatio = (idx / (visiblePeakBars.length - 1)) * 100;
                      const inRange = barRatio >= startPercent && barRatio <= endPercent;

                      return (
                        <div
                          key={idx}
                          style={{ height: `${Math.max(4, peak * 88)}%` }}
                          className={`w-full max-w-[3.5px] rounded-full transition-colors ${
                            inRange
                              ? 'bg-primary shadow-xs'
                              : 'bg-muted-foreground/25'
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Selected Range Highlight Overlay (Pan draggable) */}
                  <div
                    style={{
                      left: `${startPercent}%`,
                      width: `${Math.max(0, endPercent - startPercent)}%`,
                    }}
                    onMouseDown={(e) => handleMouseDown('pan', e)}
                    className="absolute top-0 bottom-0 bg-primary/15 border-y-2 border-primary/80 cursor-grab active:cursor-grabbing pointer-events-auto"
                  />

                  {/* Left (Start) Handle */}
                  <div
                    style={{ left: `${startPercent}%` }}
                    onMouseDown={(e) => handleMouseDown('start', e)}
                    className="absolute top-0 bottom-0 w-7 -translate-x-1/2 flex items-center justify-center cursor-ew-resize group z-20 pointer-events-auto"
                  >
                    <div className="w-2 h-full bg-primary rounded-full group-hover:scale-125 transition-transform shadow-lg ring-2 ring-background" />
                    <div className="absolute top-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-mono font-extrabold shadow-lg ring-1 ring-background pointer-events-none whitespace-nowrap">
                      {startTime.toFixed(2)}s
                    </div>
                  </div>

                  {/* Right (End) Handle */}
                  <div
                    style={{ left: `${endPercent}%` }}
                    onMouseDown={(e) => handleMouseDown('end', e)}
                    className="absolute top-0 bottom-0 w-7 -translate-x-1/2 flex items-center justify-center cursor-ew-resize group z-20 pointer-events-auto"
                  >
                    <div className="w-2 h-full bg-primary rounded-full group-hover:scale-125 transition-transform shadow-lg ring-2 ring-background" />
                    <div className="absolute top-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-mono font-extrabold shadow-lg ring-1 ring-background pointer-events-none whitespace-nowrap">
                      {endTime.toFixed(2)}s
                    </div>
                  </div>

                  {/* Playhead Line */}
                  {isPlaying && (
                    <div
                      style={{ left: `${playheadPercent}%` }}
                      className="absolute top-0 bottom-0 w-1 bg-destructive shadow-md z-30 pointer-events-none transition-all duration-75"
                    />
                  )}
                </div>
              </div>

              {/* Time Ruler & Selection Status */}
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1 font-mono">
                <span>00:00.00</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      selectedDuration >= 5 && selectedDuration <= 15
                        ? 'default'
                        : selectedDuration > 30
                          ? 'destructive'
                          : 'secondary'
                    }
                    className="text-xs px-2.5 py-0.5 font-sans"
                  >
                    선택 구간: {selectedDuration.toFixed(2)}초
                    {selectedDuration >= 5 && selectedDuration <= 15
                      ? ' (⭐ 음성 복제 최적 권장 길이)'
                      : selectedDuration > 30
                        ? ' (⚠️ 30초 이하 권장)'
                        : ''}
                  </Badge>
                </div>
                <span>{formatAudioDuration(duration)}</span>
              </div>

              {/* Ultra-Fine Time Adjusters (Millisecond Precision) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Start Time Fine Tuning */}
                <div className="space-y-1.5 bg-muted/30 p-3.5 rounded-xl border border-border">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>시작 지점 (Start Time)</span>
                    <span className="font-mono text-primary font-bold">{startTime.toFixed(3)} 초</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => adjustStartTime(-1)}
                      disabled={startTime <= 0}
                      className="text-xs px-1.5 h-7"
                    >
                      -1s
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => adjustStartTime(-0.1)}
                      disabled={startTime <= 0}
                      className="text-xs px-1.5 h-7"
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
                      title="-10ms (0.01초 미세조정)"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <div className="flex-1 text-center font-mono font-bold text-sm bg-background py-1 rounded-lg border border-border">
                      {startTime.toFixed(2)}s
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => adjustStartTime(0.01)}
                      disabled={startTime >= endTime - 0.05}
                      title="+10ms (0.01초 미세조정)"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => adjustStartTime(0.1)}
                      disabled={startTime >= endTime - 0.1}
                      className="text-xs px-1.5 h-7"
                    >
                      +0.1s
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => adjustStartTime(1)}
                      disabled={startTime >= endTime - 1}
                      className="text-xs px-1.5 h-7"
                    >
                      +1s
                    </Button>
                  </div>
                </div>

                {/* End Time Fine Tuning */}
                <div className="space-y-1.5 bg-muted/30 p-3.5 rounded-xl border border-border">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>종료 지점 (End Time)</span>
                    <span className="font-mono text-primary font-bold">{endTime.toFixed(3)} 초</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => adjustEndTime(-1)}
                      disabled={endTime <= startTime + 1}
                      className="text-xs px-1.5 h-7"
                    >
                      -1s
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => adjustEndTime(-0.1)}
                      disabled={endTime <= startTime + 0.1}
                      className="text-xs px-1.5 h-7"
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
                      title="-10ms (0.01초 미세조정)"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <div className="flex-1 text-center font-mono font-bold text-sm bg-background py-1 rounded-lg border border-border">
                      {endTime.toFixed(2)}s
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() => adjustEndTime(0.01)}
                      disabled={endTime >= duration}
                      title="+10ms (0.01초 미세조정)"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => adjustEndTime(0.1)}
                      disabled={endTime >= duration}
                      className="text-xs px-1.5 h-7"
                    >
                      +0.1s
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => adjustEndTime(1)}
                      disabled={endTime >= duration}
                      className="text-xs px-1.5 h-7"
                    >
                      +1s
                    </Button>
                  </div>
                </div>
              </div>

              {/* Playback & Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border">
                {/* Playback Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={isPlaying ? 'destructive' : 'default'}
                    size="lg"
                    onClick={handlePlayRange}
                    className="flex items-center gap-2 font-bold px-6 shadow-sm"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-5 w-5" />
                        일시정지
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-5 w-5" />
                        선택 구간 재생 ({selectedDuration.toFixed(2)}초)
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={handlePlayAll}
                    className="flex items-center gap-1.5"
                    title="처음부터 전체 재생"
                  >
                    <RotateCcw className="h-4 w-4" />
                    전체 재생
                  </Button>

                  <Button
                    type="button"
                    variant={isLooping ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setIsLooping(!isLooping)}
                    className={isLooping ? 'border border-primary text-primary' : 'text-muted-foreground'}
                    title="선택 구간 무한 반복 재생"
                  >
                    <Repeat className="h-4 w-4" />
                  </Button>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={handleRemoveBgm}
                    disabled={isRemovingBgm || trimming || !file}
                    className="flex items-center gap-2 font-semibold border border-primary/20 hover:border-primary/50 text-foreground"
                    title="Meta Demucs AI로 배경음악 및 악기를 지우고 목소리만 추출"
                  >
                    {isRemovingBgm ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        배경음악 분리 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-primary" />
                        배경음악 제거 (AI 목소리 추출)
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={handleDownloadTrimmed}
                    disabled={trimming || selectedDuration <= 0}
                    className="flex items-center gap-2"
                  >
                    {trimming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    잘라낸 파일 다운로드 (WAV)
                  </Button>

                  <Button
                    type="button"
                    size="lg"
                    onClick={handleCreateVoiceProfile}
                    disabled={trimming || selectedDuration <= 0}
                    className="flex items-center gap-2 font-bold bg-primary text-primary-foreground shadow-sm"
                  >
                    {trimming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                    새 음성 프로필로 등록하기
                  </Button>
                </div>
              </div>
            </div>

            {/* Trimmed Clips History */}
            {trimmedClips.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    방금 잘라낸 클립 목록 ({trimmedClips.length})
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTrimmedClips([])}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    목록 비우기
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {trimmedClips.map((clip) => {
                    const isClipPlaying = playingClipId === clip.id;

                    return (
                      <div
                        key={clip.id}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => handlePlayClip(clip)}
                            className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-full transition-colors ${
                              isClipPlaying
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-muted hover:bg-primary/20 text-foreground'
                            }`}
                          >
                            {isClipPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                          </button>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{clip.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {clip.duration.toFixed(2)}초 ({clip.startTime.toFixed(2)}s ~ {clip.endTime.toFixed(2)}s)
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = clip.url;
                              a.download = clip.name;
                              a.click();
                            }}
                            title="다운로드"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleCreateVoiceProfileFromClip(clip)}
                            className="text-xs flex items-center gap-1"
                          >
                            <Mic className="h-3.5 w-3.5" />
                            프로필 등록
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setTrimmedClips((prev) => prev.filter((c) => c.id !== clip.id));
                            }}
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
