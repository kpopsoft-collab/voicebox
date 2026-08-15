import { Loader2, Mic, Pause, Play, Scissors, Sparkles, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { AudioTrimmerModal } from './AudioTrimmerModal';

interface AudioSampleUploadProps {
  file: File | null | undefined;
  onFileChange: (file: File | undefined) => void;
  onTranscribe: () => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  isValidating?: boolean;
  isTranscribing?: boolean;
  isDisabled?: boolean;
  fieldName: string;
}

export function AudioSampleUpload({
  file,
  onFileChange,
  onTranscribe,
  onPlayPause,
  isPlaying,
  isValidating = false,
  isTranscribing = false,
  isDisabled = false,
  fieldName,
}: AudioSampleUploadProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isTrimmerOpen, setIsTrimmerOpen] = useState(false);
  const [isRemovingBgm, setIsRemovingBgm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRemoveBgm = async () => {
    if (!file) return;
    try {
      setIsRemovingBgm(true);
      toast({
        title: '🪄 AI 배경음악 제거 시작',
        description: 'Demucs AI 모델로 배경음악을 분리하여 순수 목소리를 추출하는 중입니다...',
      });
      const vocalOnly = await apiClient.removeBgm(file);
      onFileChange(vocalOnly);
      toast({
        title: '배경음악 제거 완료',
        description: '목소리만 추출된 오디오로 교체되었습니다.',
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

  return (
    <FormItem>
      <FormControl>
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="audio/*"
            name={fieldName}
            ref={fileInputRef}
            onChange={(e) => {
              const selectedFile = e.target.files?.[0];
              if (selectedFile) {
                onFileChange(selectedFile);
              } else {
                onFileChange(undefined);
              }
            }}
            className="hidden"
          />
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const droppedFile = e.dataTransfer.files?.[0];
              if (droppedFile?.type.startsWith('audio/')) {
                onFileChange(droppedFile);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`flex flex-col items-center justify-center gap-4 p-4 border-2 rounded-lg transition-colors min-h-[180px] ${
              file
                ? 'border-primary bg-primary/5'
                : isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-dashed border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
          >
            {!file ? (
              <>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-5 w-5" />
                  {t('audioSample.chooseFile')}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  {t('audioSample.uploadHint')} (MP3, WAV, M4A 등 지원)
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <span className="font-medium">{t('audioSample.fileUploaded')}</span>
                </div>
                <p className="text-sm text-muted-foreground text-center font-mono">
                  {t('audioSample.fileLabel', { name: file.name })}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={onPlayPause}
                    disabled={isValidating}
                    aria-label={isPlaying ? t('audioSample.pause') : t('audioSample.play')}
                    title="전체 재생/정지"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>

                  {/* Audio Trimmer Button */}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsTrimmerOpen(true)}
                    disabled={isValidating || isRemovingBgm}
                    className="flex items-center gap-1.5 font-medium border border-primary/20 hover:border-primary/50 text-foreground"
                    title="오디오 구간 자르기"
                  >
                    <Scissors className="h-4 w-4 text-primary" />
                    구간 자르기 (Trim)
                  </Button>

                  {/* Remove BGM Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveBgm}
                    disabled={isValidating || isRemovingBgm}
                    className="flex items-center gap-1.5 border-primary/30 hover:bg-primary/10"
                    title="배경음악 및 악기를 제거하고 목소리만 추출"
                  >
                    {isRemovingBgm ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        분리 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-primary" />
                        배경음악 제거
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={onTranscribe}
                    disabled={isTranscribing || isValidating || isDisabled}
                    className="flex items-center gap-1.5"
                    title="음성을 텍스트로 자동 변환"
                  >
                    <Mic className="h-4 w-4" />
                    {isTranscribing ? t('audioSample.transcribing') : t('audioSample.transcribe')}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      onFileChange(undefined);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    {t('audioSample.remove')}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Audio Trimmer Dialog Modal */}
          {file && (
            <AudioTrimmerModal
              open={isTrimmerOpen}
              onOpenChange={setIsTrimmerOpen}
              file={file}
              onApplyTrimmed={(trimmedFile) => {
                onFileChange(trimmedFile);
              }}
            />
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
