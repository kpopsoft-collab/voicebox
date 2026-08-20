import { Check, Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { VoiceProfileResponse } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

const PROFILE_LINE = (p: VoiceProfileResponse): string => {
  const engine = p.preset_engine || p.default_engine || 'qwen';
  const desc = p.description || '';
  const type =
    p.voice_type === 'preset'
      ? '프리셋'
      : p.voice_type === 'designed'
        ? '디자인'
        : '클론';
  return `  - "${p.name}" (언어: ${p.language}, 타입: ${type}, 엔진: ${engine})${
    desc ? ` — ${desc}` : ''
  }`;
};

function buildPromptText(profiles: VoiceProfileResponse[], mcpUrl: string): string {
  const profileLines = profiles.map(PROFILE_LINE).join('\n');

  return `나의 로컬 네트워크에 Voicebox라는 AI 음성 엔진이 MCP 서버로 동작 중이야.
아래 정보로 연결해서 사용해줘.

【MCP 서버 설정】
- URL: ${mcpUrl}/
- Transport: StreamableHTTP
- 자체 서명 인증서(self-signed) 사용 중이므로 SSL 검증 비활성화 필요

【MCP 설정 JSON】
${JSON.stringify(
  {
    mcpServers: {
      voicebox: { type: 'streamableHttp', url: `${mcpUrl}/` },
    },
  },
  null,
  2,
)}

【등록된 음성 프로필 목록】
${profileLines}

【사용 가능한 MCP 도구와 사용법】

1. voicebox.speak — 텍스트를 음성으로 즉시 재생 (비동기, 스피커 출력)
   매개변수: text(필수), profile(프로필 이름), language("ko","en","zh","ja" 등)
   예시: { "text": "안녕하세요", "profile": "성우 이지선", "language": "ko" }

2. voicebox.generate_audio — 텍스트를 음성 파일로 생성하고 완료까지 대기
   매개변수: text(필수), profile(프로필 이름), language, engine, timeout_seconds(기본 60)
   예시: { "text": "오늘 날씨가 좋네요", "profile": "하츄핑", "language": "ko" }
   반환: { generation_id, audio_path, duration, status }

3. voicebox.create_profile — 레퍼런스 오디오로 새 음성 복제 프로필 생성
   매개변수: name(필수), audio_path(필수, 10~30초 음성 파일), language, personality(성격 묘사)
   예시: { "name": "내 목소리", "audio_path": "/path/to/sample.wav", "language": "ko" }

4. voicebox.remove_bgm — Demucs AI로 배경음악 제거, 깨끗한 보컬만 추출
   매개변수: audio_path(필수)
   예시: { "audio_path": "/path/to/song.mp3" }

5. voicebox.trim_audio — 오디오 파일을 시작/끝 시간(초)으로 잘라내기
   매개변수: audio_path(필수), start_sec(필수), end_sec(필수)
   예시: { "audio_path": "/path/to/audio.wav", "start_sec": 5.0, "end_sec": 15.0 }

6. voicebox.transcribe — Whisper를 이용한 음성→텍스트 변환 (STT)
   매개변수: audio_path 또는 audio_base64, language(힌트)
   예시: { "audio_path": "/path/to/audio.wav", "language": "ko" }

7. voicebox.list_profiles — 등록된 모든 음성 프로필 목록 조회
   매개변수: 없음

8. voicebox.get_status — 시스템/하드웨어/모델 상태 확인
   매개변수: 없음

【주의사항】
- profile 파라미터에는 위 프로필 목록의 "이름"을 정확히 입력해야 합니다.
- language는 프로필의 언어와 일치시켜야 자연스러운 발화가 됩니다.
- 음성 생성(generate_audio)은 모델 로딩 시 첫 요청이 30초~1분 걸릴 수 있고, 이후는 1~5초 내 완료됩니다.`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to legacy path */
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface AIPromptCardProps {
  profiles: VoiceProfileResponse[];
  mcpUrl: string;
  className?: string;
}

/**
 * Card that renders a copy-paste prompt for AI agents (ChatGPT, Claude, etc.)
 * instructing them to connect to the local voicebox MCP server. Profile list
 * is regenerated on every render so newly added profiles appear immediately.
 */
export function AIPromptCard({ profiles, mcpUrl, className }: AIPromptCardProps) {
  const [copied, setCopied] = useState(false);

  const promptText = buildPromptText(profiles, mcpUrl);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(promptText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <Card className={cn('border-border/70 bg-card/60 shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-base font-semibold">
              AI 에이전트용 복사 프롬프트
            </CardTitle>
          </div>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            복사 → 붙여넣기
          </span>
        </div>
        <CardDescription className="text-xs">
          아래 프롬프트를 복사하여 AI 채팅(ChatGPT, Claude, Gemini 등)에 붙여넣으면 MCP 서버에
          바로 연결하고 모든 프로필을 사용할 수 있습니다. 프로필이 추가/삭제되면 자동
          반영됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <pre className="text-xs font-mono p-4 rounded-lg bg-[#0f172a] border border-white/5 text-purple-300 whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto overflow-x-auto">
            {promptText}
          </pre>
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-2 right-2 h-7 px-2 text-xs"
            onClick={handleCopy}
            aria-label="프롬프트 복사"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/40">
          <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
          <span>
            프로필 목록은 현재 서버에 등록된 <strong>{profiles.length}개</strong> 프로필을 실시간
            반영합니다. URL은 서버 주소(<code className="text-accent">{mcpUrl}</code>)를 기반으로
            자동 생성됩니다.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
