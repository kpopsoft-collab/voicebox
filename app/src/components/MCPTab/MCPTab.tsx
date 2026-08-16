import {
  Bot,
  Check,
  Code2,
  Copy,
  Download,
  Network,
  Play,
  Plug,
  RefreshCw,
  Sparkles,
  Terminal,
  Trash2,
  Volume2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api/client';
import { useMCPBindings } from '@/lib/hooks/useMCPBindings';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { useCaptureSettings } from '@/lib/hooks/useSettings';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';
import { usePlayerStore } from '@/stores/playerStore';
import { useServerStore } from '@/stores/serverStore';

interface ToolDoc {
  name: string;
  category: 'hachuping' | 'synthesis' | 'audio' | 'profile_stt';
  description: string;
  badge?: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    default?: string;
  }>;
  returns: string;
  exampleCall: Record<string, unknown>;
  exampleResponse: Record<string, unknown> | Array<Record<string, unknown>>;
}

const MCP_TOOLS: ToolDoc[] = [
  // ── 하츄핑 특화 도구 ──
  {
    name: 'voicebox.hachuping',
    category: 'hachuping',
    badge: '하츄핑 실시간 발화',
    description:
      '하츄핑 음성 프로필로 텍스트를 즉시 스피커로 발화합니다. language="en" 전달 시 "하츄핑-영어" 프로필이 자동 적용됩니다.',
    parameters: [
      { name: 'text', type: 'string', required: true, description: '말할 대사 내용 (한국어/영어)' },
      { name: 'language', type: 'string', required: false, description: '"ko" (한국어) 또는 "en" (영어)', default: '"ko"' },
      { name: 'personality', type: 'boolean', required: false, description: '캐릭터 성격 반영 여부', default: 'true' },
    ],
    returns: '{"generation_id": string, "status": "completed", "character": "하츄핑", "duration": float, "audio_url": string}',
    exampleCall: {
      tool: 'voicebox.hachuping',
      arguments: {
        text: '안녕 도아야! 오늘 하루도 정말 수고 많았어, 츄~!',
        language: 'ko',
        personality: true,
      },
    },
    exampleResponse: {
      generation_id: '74b76a97-add9-4abd-a8fb-320b117e7160',
      status: 'completed',
      character: '하츄핑',
      text: '안녕 도아야! 오늘 하루도 정말 수고 많았어, 츄~!',
      duration: 2.15,
      audio_url: '/audio/74b76a97-add9-4abd-a8fb-320b117e7160',
    },
  },
  {
    name: 'voicebox.hachuping_generate',
    category: 'hachuping',
    badge: '하츄핑 오디오 파일 생성',
    description:
      '하츄핑 음성을 합성하고 완료될 때까지 대기한 후, 로컬 WAV 파일 경로 및 오디오 정보를 반환합니다.',
    parameters: [
      { name: 'text', type: 'string', required: true, description: '합성할 텍스트' },
      { name: 'language', type: 'string', required: false, description: '"ko" 또는 "en"', default: '"ko"' },
      { name: 'return_base64', type: 'boolean', required: false, description: 'Base64 오디오 데이터 포함 여부', default: 'false' },
      { name: 'timeout_seconds', type: 'number', required: false, description: '합성 타임아웃 (초)', default: '60.0' },
    ],
    returns: '{"generation_id": string, "audio_path": string, "audio_url": string, "duration": float, "status": "completed"}',
    exampleCall: {
      tool: 'voicebox.hachuping_generate',
      arguments: {
        text: '오늘도 즐거운 하루 보내자, 츄!',
        language: 'ko',
        return_base64: false,
        timeout_seconds: 60.0,
      },
    },
    exampleResponse: {
      generation_id: '8f921ab3-4411-42cb-b1b4-49c049e7b231',
      status: 'completed',
      character: '하츄핑',
      duration: 1.84,
      audio_path: '/Users/kykwoun/__DEV/voicebox/data/generations/8f921ab3-4411-42cb-b1b4-49c049e7b231.wav',
      audio_url: '/audio/8f921ab3-4411-42cb-b1b4-49c049e7b231',
    },
  },
  {
    name: 'voicebox.hachuping_en',
    category: 'hachuping',
    badge: '하츄핑 영어 전용 발화',
    description:
      '"하츄핑-영어" 전용 보이스 프로필을 사용하여 원어민 영어 발음으로 즉시 발화합니다.',
    parameters: [
      { name: 'text', type: 'string', required: true, description: 'English text to speak' },
    ],
    returns: '{"generation_id": string, "status": "completed", "character": "하츄핑-영어", "duration": float}',
    exampleCall: {
      tool: 'voicebox.hachuping_en',
      arguments: {
        text: 'Hello Doa! Welcome to Voicebox, let\'s study English together!',
      },
    },
    exampleResponse: {
      generation_id: 'c19e54a3-7629-411a-8ab2-19e34b99aa72',
      status: 'completed',
      character: '하츄핑-영어',
      duration: 2.76,
      audio_url: '/audio/c19e54a3-7629-411a-8ab2-19e34b99aa72',
    },
  },
  {
    name: 'voicebox.hachuping_en_generate',
    category: 'hachuping',
    badge: '하츄핑 영어 파일 생성',
    description:
      '"하츄핑-영어" 전용 프로필로 영어 음성을 합성하고 완료 시 로컬 WAV 경로를 반환합니다.',
    parameters: [
      { name: 'text', type: 'string', required: true, description: 'English text to synthesize' },
      { name: 'return_base64', type: 'boolean', required: false, description: 'Include Base64 binary', default: 'false' },
      { name: 'timeout_seconds', type: 'number', required: false, description: 'Timeout in seconds', default: '60.0' },
    ],
    returns: '{"generation_id": string, "audio_path": string, "duration": float, "status": "completed"}',
    exampleCall: {
      tool: 'voicebox.hachuping_en_generate',
      arguments: {
        text: 'You did an amazing job today! Keep it up!',
        return_base64: false,
      },
    },
    exampleResponse: {
      generation_id: 'e49911da-2780-496a-912e-a59ffc129e01',
      status: 'completed',
      character: '하츄핑-영어',
      duration: 2.21,
      audio_path: '/Users/kykwoun/__DEV/voicebox/data/generations/e49911da-2780-496a-912e-a59ffc129e01.wav',
    },
  },

  // ── 범용 음성 합성 & 오디오 제어 ──
  {
    name: 'voicebox.generate_audio',
    category: 'synthesis',
    badge: '동기식 고속 음성 합성',
    description:
      '지정한 보이스 프로필 또는 기본 음성으로 텍스트를 합성하고 파일 생성이 완료될 때까지 대기 후 경로를 반환합니다.',
    parameters: [
      { name: 'text', type: 'string', required: true, description: '합성할 텍스트' },
      { name: 'profile', type: 'string', required: false, description: '프로필 이름 또는 ID (생략 시 기본 음성)', default: '기본값' },
      { name: 'language', type: 'string', required: false, description: '언어 코드 ("ko", "en", "ja", "zh" 등)', default: '"ko"' },
      { name: 'engine', type: 'string', required: false, description: 'TTS 엔진 ("qwen", "chatterbox", "f5tts")', default: 'auto' },
      { name: 'personality', type: 'boolean', required: false, description: '캐릭터 성격 반영 여부', default: 'false' },
      { name: 'timeout_seconds', type: 'number', required: false, description: '최대 대기 시간', default: '60.0' },
    ],
    returns: '{"generation_id": string, "audio_path": string, "duration": float, "status": "completed"}',
    exampleCall: {
      tool: 'voicebox.generate_audio',
      arguments: {
        text: 'Voicebox는 로컬 M3 Ultra 가속을 통해 0.3초 내에 고음질 음성을 생성합니다.',
        profile: '하츄핑',
        language: 'ko',
      },
    },
    exampleResponse: {
      generation_id: '3a4b5c6d-7e8f-9012-3456-789abcdef012',
      status: 'completed',
      duration: 3.42,
      audio_path: '/Users/kykwoun/__DEV/voicebox/data/generations/3a4b5c6d-7e8f-9012-3456-789abcdef012.wav',
    },
  },
  {
    name: 'voicebox.speak',
    category: 'synthesis',
    badge: '비동기 음성 발화',
    description:
      '텍스트를 비동기로 음성 생성 큐에 등록하고 생성 ID를 즉시 반환합니다. 웹 플레이어 및 스피커로 자동 출력됩니다.',
    parameters: [
      { name: 'text', type: 'string', required: true, description: '발화할 텍스트' },
      { name: 'profile', type: 'string', required: false, description: '프로필 이름/ID' },
      { name: 'language', type: 'string', required: false, description: '언어 코드', default: '"ko"' },
      { name: 'personality', type: 'boolean', required: false, description: '성격 반영 여부', default: 'false' },
    ],
    returns: '{"generation_id": string, "status": "generating", "profile": string}',
    exampleCall: {
      tool: 'voicebox.speak',
      arguments: {
        text: '시스템 빌드가 성공적으로 완료되었습니다.',
        profile: '하츄핑',
      },
    },
    exampleResponse: {
      generation_id: '5f6e7d8c-9b0a-1234-5678-9abcdef01234',
      status: 'generating',
      profile: '하츄핑',
    },
  },
  {
    name: 'voicebox.remove_bgm',
    category: 'audio',
    badge: 'Demucs 보컬/음성 분리',
    description:
      'Demucs AI 모델을 활용해 오디오 파일에서 배경음악(BGM)을 깨끗이 제거하고 목소리만 분리합니다.',
    parameters: [
      { name: 'audio_path', type: 'string', required: true, description: '배경음을 제거할 로컬 오디오 파일 절대 경로' },
    ],
    returns: '{"status": "completed", "clean_vocal_path": string, "original_path": string}',
    exampleCall: {
      tool: 'voicebox.remove_bgm',
      arguments: {
        audio_path: '/Users/kykwoun/__DEV/voicebox/temp_samples/sample_with_bgm.mp3',
      },
    },
    exampleResponse: {
      status: 'completed',
      clean_vocal_path: '/Users/kykwoun/__DEV/voicebox/temp_samples/sample_with_bgm_vocals.wav',
    },
  },
  {
    name: 'voicebox.trim_audio',
    category: 'audio',
    badge: '오디오 구간 자르기',
    description:
      '오디오 파일에서 시작 시간(start_sec)부터 종료 시간(end_sec)까지의 구간을 잘라 새로운 클립으로 저장합니다.',
    parameters: [
      { name: 'audio_path', type: 'string', required: true, description: '원본 오디오 파일 경로' },
      { name: 'start_sec', type: 'number', required: true, description: '시작 시간 (초)' },
      { name: 'end_sec', type: 'number', required: true, description: '종료 시간 (초)' },
      { name: 'output_filename', type: 'string', required: false, description: '저장할 파일명' },
    ],
    returns: '{"status": "completed", "trimmed_path": string, "duration": float}',
    exampleCall: {
      tool: 'voicebox.trim_audio',
      arguments: {
        audio_path: '/Users/kykwoun/Downloads/interview.mp3',
        start_sec: 12.5,
        end_sec: 25.0,
      },
    },
    exampleResponse: {
      status: 'completed',
      trimmed_path: '/Users/kykwoun/__DEV/voicebox/data/trimmed/interview_clip.wav',
      duration: 12.5,
    },
  },

  // ── STT & 프로필 관리 ──
  {
    name: 'voicebox.transcribe',
    category: 'profile_stt',
    badge: 'Whisper 음성 전사 (STT)',
    description:
      '로컬 Whisper 신경망을 사용하여 오디오 파일 또는 Base64 데이터를 한국어/영어로 신속하게 텍스트 변환합니다.',
    parameters: [
      { name: 'audio_path', type: 'string', required: false, description: '로컬 오디오 파일 경로' },
      { name: 'audio_base64', type: 'string', required: false, description: 'Base64 인코딩 오디오 데이터' },
      { name: 'language', type: 'string', required: false, description: '언어 힌트 ("ko", "en" 등)' },
    ],
    returns: '{"text": string, "language": string, "duration": float}',
    exampleCall: {
      tool: 'voicebox.transcribe',
      arguments: {
        audio_path: '/Users/kykwoun/__DEV/voicebox/data/generations/sample.wav',
        language: 'ko',
      },
    },
    exampleResponse: {
      text: '안녕하세요, 목소리 복제와 음성 합성을 지원하는 Voicebox입니다.',
      language: 'ko',
      duration: 3.12,
    },
  },
  {
    name: 'voicebox.create_profile',
    category: 'profile_stt',
    badge: 'AI 보이스 프로필 생성',
    description:
      '참조 오디오 샘플과 화자 이름을 입력받아 즉시 목소리를 복제하고 새로운 Voice Profile로 등록합니다.',
    parameters: [
      { name: 'name', type: 'string', required: true, description: '프로필 이름 (예: "도아", "내 목소리")' },
      { name: 'audio_path', type: 'string', required: true, description: '10~30초 분량의 참조 음성 파일 경로' },
      { name: 'language', type: 'string', required: false, description: '주 언어 ("ko", "en")', default: '"ko"' },
      { name: 'personality', type: 'string', required: false, description: '성격/말투 묘사' },
    ],
    returns: '{"id": string, "name": string, "language": string, "status": "active"}',
    exampleCall: {
      tool: 'voicebox.create_profile',
      arguments: {
        name: '도아',
        audio_path: '/Users/kykwoun/voice_sample.wav',
        language: 'ko',
        personality: '밝고 쾌활한 7세 어린이 목소리',
      },
    },
    exampleResponse: {
      id: '99e821bc-1234-4567-89ab-cdef01234567',
      name: '도아',
      language: 'ko',
      voice_type: 'cloned',
      status: 'active',
    },
  },
  {
    name: 'voicebox.list_profiles',
    category: 'profile_stt',
    badge: '등록 프로필 목록 조회',
    description:
      '현재 Voicebox에 등록된 모든 클론 음성 및 프리셋 프로필 목록을 조회합니다.',
    parameters: [],
    returns: 'Array<{"id": string, "name": string, "language": string, "voice_type": string, "personality": string}>',
    exampleCall: {
      tool: 'voicebox.list_profiles',
      arguments: {},
    },
    exampleResponse: [
      { id: 'hachuping-id', name: '하츄핑', language: 'ko', voice_type: 'cloned' },
      { id: 'hachuping-en-id', name: '하츄핑-영어', language: 'en', voice_type: 'cloned' },
      { id: 'preset-1', name: 'Morgan', language: 'en', voice_type: 'preset' },
    ],
  },
  {
    name: 'voicebox.get_status',
    category: 'profile_stt',
    badge: '하드웨어 & 엔진 상태',
    description:
      '로컬 서버의 하드웨어 가속(Apple Silicon M3 Ultra Metal), 활성 모델, 큐 상태를 반환합니다.',
    parameters: [],
    returns: '{"status": "online", "hardware": "Apple Silicon (Metal)", "active_models": Array<string>}',
    exampleCall: {
      tool: 'voicebox.get_status',
      arguments: {},
    },
    exampleResponse: {
      status: 'online',
      hardware: 'Apple Silicon M3 Ultra (Metal 32-core)',
      version: '1.2.0',
      active_models: ['qwen-tts-1.7B', 'demucs-v4', 'whisper-large-v3-turbo'],
    },
  },
];

export function MCPTab() {
  const { toast } = useToast();
  const serverUrl = useServerStore((s) => s.serverUrl);
  const setAudioWithAutoPlay = usePlayerStore((s) => s.setAudioWithAutoPlay);

  const { bindings, upsertAsync, remove } = useMCPBindings();
  const { data: profiles } = useProfiles();
  const { settings: captureSettings, update: updateCapture } = useCaptureSettings();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Playground States
  const [selectedTool, setSelectedTool] = useState<string>('voicebox.hachuping');
  const [playgroundText, setPlaygroundText] = useState<string>(
    '안녕 도아야! Voicebox MCP를 통해 실시간으로 목소리를 들려주고 있어, 츄~!',
  );
  const [playgroundProfile, setPlaygroundProfile] = useState<string>('하츄핑');
  const [playgroundLang, setPlaygroundLang] = useState<string>('ko');
  const [playgroundRunning, setPlaygroundRunning] = useState<boolean>(false);
  const [playgroundResult, setPlaygroundResult] = useState<Record<string, unknown> | null>(null);
  const [playgroundAudioUrl, setPlaygroundAudioUrl] = useState<string | null>(null);

  // Binding Form States
  const [newClientId, setNewClientId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newProfileId, setNewProfileId] = useState('');
  const [addingBinding, setAddingBinding] = useState(false);

  const mcpUrl = `${serverUrl}/mcp`;
  const defaultProfileId = captureSettings?.default_playback_voice_id ?? '';

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast({
        title: '복사 완료',
        description: '클립보드에 설정 코드가 복사되었습니다.',
      });
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleAddBinding = async () => {
    if (!newClientId.trim()) return;
    setAddingBinding(true);
    try {
      await upsertAsync({
        client_id: newClientId.trim(),
        label: newLabel.trim() || null,
        profile_id: newProfileId || null,
      });
      setNewClientId('');
      setNewLabel('');
      setNewProfileId('');
      toast({
        title: '클라이언트 바인딩 등록 완료',
        description: `'${newClientId.trim()}' 클라이언트가 등록되었습니다.`,
      });
    } finally {
      setAddingBinding(false);
    }
  };

  const runPlayground = async () => {
    if (!playgroundText.trim()) {
      toast({
        title: '텍스트 입력 필요',
        description: '발화할 텍스트를 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setPlaygroundRunning(true);
    setPlaygroundResult(null);
    setPlaygroundAudioUrl(null);

    try {
      let resultData: Record<string, unknown> = {};
      let audioLink: string | null = null;
      let generationId: string = '';
      let targetCharacter: string = '';

      if (selectedTool === 'voicebox.hachuping' || selectedTool === 'voicebox.hachuping_en') {
        const lang = selectedTool === 'voicebox.hachuping_en' ? 'en' : playgroundLang;
        const targetProfile = selectedTool === 'voicebox.hachuping_en' ? '하츄핑-영어' : '하츄핑';
        targetCharacter = targetProfile;

        const res = await apiClient.speak({
          text: playgroundText,
          profile: targetProfile,
          language: lang,
          personality: true,
        });

        generationId = res.id;
        audioLink = `${serverUrl}/audio/${res.id}`;
        resultData = {
          tool: selectedTool,
          generation_id: res.id,
          character: targetProfile,
          status: 'completed',
          text: playgroundText,
          language: lang,
          audio_url: audioLink,
        };
      } else if (selectedTool === 'voicebox.speak' || selectedTool === 'voicebox.generate_audio') {
        targetCharacter = playgroundProfile;
        const res = await apiClient.speak({
          text: playgroundText,
          profile: playgroundProfile || undefined,
          language: playgroundLang,
          personality: true,
        });

        generationId = res.id;
        audioLink = `${serverUrl}/audio/${res.id}`;
        resultData = {
          tool: selectedTool,
          generation_id: res.id,
          profile: playgroundProfile,
          status: 'completed',
          text: playgroundText,
          language: playgroundLang,
          audio_url: audioLink,
        };
      } else {
        // Fallback generic speak
        targetCharacter = playgroundProfile;
        const res = await apiClient.speak({
          text: playgroundText,
          profile: playgroundProfile,
          language: playgroundLang,
        });
        generationId = res.id;
        audioLink = `${serverUrl}/audio/${res.id}`;
        resultData = {
          tool: selectedTool,
          generation_id: res.id,
          status: 'completed',
        };
      }

      setPlaygroundResult(resultData);
      if (audioLink) {
        setPlaygroundAudioUrl(audioLink);
        setAudioWithAutoPlay(audioLink, generationId, null, `${targetCharacter}: ${playgroundText.slice(0, 20)}...`);
      }

      toast({
        title: 'MCP 도구 실행 성공',
        description: '음성이 합성되어 즉시 재생되었습니다.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '실행 중 오류가 발생했습니다.';
      setPlaygroundResult({ error: msg, status: 'failed' });
      toast({
        title: 'MCP 실행 실패',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setPlaygroundRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto pb-16 space-y-6 pt-2">
      {/* ── Top Header & Status ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-accent/20 to-primary/20 border border-accent/30 text-accent">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                Model Context Protocol (MCP)
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-medium py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  Live & Active
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Claude Code, Antigravity, Cursor, Windsurf 등 모든 AI 에이전트와 로컬 Voicebox를 즉시 연결하는 초고속 음성 인터페이스
              </p>
            </div>
          </div>
        </div>

        {/* Server Endpoint Badge & Quick Copy */}
        <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-lg border border-border/60">
          <code className="text-xs font-mono text-accent px-2 py-1 rounded bg-background/80 border border-border/50">
            {mcpUrl}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => copyToClipboard(mcpUrl, 'top-mcp-url')}
          >
            {copiedKey === 'top-mcp-url' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            URL 복사
          </Button>
        </div>
      </div>

      {/* ── Main Tabbed Navigation ── */}
      <Tabs defaultValue="connect" className="w-full space-y-6">
        <TabsList className="grid grid-cols-4 max-w-2xl bg-muted/60 p-1 border border-border/50">
          <TabsTrigger value="connect" className="gap-2 text-xs">
            <Zap className="h-3.5 w-3.5" />
            연동 설정
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2 text-xs">
            <Code2 className="h-3.5 w-3.5" />
            도구 레퍼런스 ({MCP_TOOLS.length})
          </TabsTrigger>
          <TabsTrigger value="playground" className="gap-2 text-xs">
            <Play className="h-3.5 w-3.5" />
            실시간 테스트
          </TabsTrigger>
          <TabsTrigger value="bindings" className="gap-2 text-xs">
            <Plug className="h-3.5 w-3.5" />
            클라이언트 바인딩
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 1. Quick Connect Guide Tab                                     */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="connect" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Claude Code CLI Card */}
            <Card className="border-border/70 bg-card/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-base font-semibold">Claude Code (CLI)</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[11px]">터미널 1초 등록</Badge>
                </div>
                <CardDescription className="text-xs">
                  터미널에서 아래 명령어를 1회 실행하면 Claude Code에 Voicebox 도구가 자동 등록됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <pre className="text-xs font-mono p-3 rounded-lg bg-black/40 border border-white/5 overflow-x-auto text-emerald-400">
                    {`claude mcp add voicebox \\\n  --transport http \\\n  --url ${mcpUrl} \\\n  --header "X-Voicebox-Client-Id: claude-code"`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 px-2 text-xs"
                    onClick={() =>
                      copyToClipboard(
                        `claude mcp add voicebox --transport http --url ${mcpUrl} --header "X-Voicebox-Client-Id: claude-code"`,
                        'claude-code-cli',
                      )
                    }
                  >
                    {copiedKey === 'claude-code-cli' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Antigravity / Gemini CLI Card */}
            <Card className="border-border/70 bg-card/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-400" />
                    <CardTitle className="text-base font-semibold">Antigravity / Gemini IDE</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[11px]">mcp.json 연동</Badge>
                </div>
                <CardDescription className="text-xs">
                  프로젝트 루트의 <code>mcp.json</code> 또는 전역 설정 파일에 추가합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <pre className="text-xs font-mono p-3 rounded-lg bg-black/40 border border-white/5 overflow-x-auto text-sky-300">
                    {JSON.stringify(
                      {
                        mcpServers: {
                          voicebox: {
                            url: mcpUrl,
                            headers: { 'X-Voicebox-Client-Id': 'antigravity' },
                          },
                        },
                      },
                      null,
                      2,
                    )}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 px-2 text-xs"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            mcpServers: {
                              voicebox: {
                                url: mcpUrl,
                                headers: { 'X-Voicebox-Client-Id': 'antigravity' },
                              },
                            },
                          },
                          null,
                          2,
                        ),
                        'antigravity-json',
                      )
                    }
                  >
                    {copiedKey === 'antigravity-json' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Claude Desktop Card */}
            <Card className="border-border/70 bg-card/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-orange-400" />
                    <CardTitle className="text-base font-semibold">Claude Desktop App</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[11px]">데스크톱 설정</Badge>
                </div>
                <CardDescription className="text-xs">
                  <code>claude_desktop_config.json</code> 파일의 <code>mcpServers</code> 섹션에 등록합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <pre className="text-xs font-mono p-3 rounded-lg bg-black/40 border border-white/5 overflow-x-auto text-orange-300">
                    {JSON.stringify(
                      {
                        mcpServers: {
                          voicebox: {
                            url: mcpUrl,
                            headers: { 'X-Voicebox-Client-Id': 'claude-desktop' },
                          },
                        },
                      },
                      null,
                      2,
                    )}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 px-2 text-xs"
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            mcpServers: {
                              voicebox: {
                                url: mcpUrl,
                                headers: { 'X-Voicebox-Client-Id': 'claude-desktop' },
                              },
                            },
                          },
                          null,
                          2,
                        ),
                        'claude-desktop-json',
                      )
                    }
                  >
                    {copiedKey === 'claude-desktop-json' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Direct REST / cURL Card */}
            <Card className="border-border/70 bg-card/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-violet-400" />
                    <CardTitle className="text-base font-semibold">Direct REST API (cURL / Python)</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-[11px]">비MCP 클라이언트</Badge>
                </div>
                <CardDescription className="text-xs">
                  MCP를 지원하지 않는 쉘 스크립트나 커스텀 앱에서 직접 HTTP POST로 호출합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <pre className="text-xs font-mono p-3 rounded-lg bg-black/40 border border-white/5 overflow-x-auto text-violet-300">
                    {`curl -k -X POST ${serverUrl}/speak \\\n  -H "Content-Type: application/json" \\\n  -d '{"text": "안녕하세요!", "profile": "하츄핑", "language": "ko"}'`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 px-2 text-xs"
                    onClick={() =>
                      copyToClipboard(
                        `curl -k -X POST ${serverUrl}/speak -H "Content-Type: application/json" -d '{"text": "안녕하세요!", "profile": "하츄핑", "language": "ko"}'`,
                        'curl-speak',
                      )
                    }
                  >
                    {copiedKey === 'curl-speak' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 2. Tools Reference Tab                                         */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="tools" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {MCP_TOOLS.map((tool) => (
              <Card key={tool.name} className="border-border/70 bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <code className="text-sm font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                        {tool.name}
                      </code>
                      {tool.badge && (
                        <Badge variant="secondary" className="text-[11px] font-normal">
                          {tool.badge}
                        </Badge>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] uppercase tracking-wider',
                        tool.category === 'hachuping' && 'text-pink-400 border-pink-500/30 bg-pink-500/10',
                        tool.category === 'synthesis' && 'text-blue-400 border-blue-500/30 bg-blue-500/10',
                        tool.category === 'audio' && 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                        tool.category === 'profile_stt' && 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                      )}
                    >
                      {tool.category}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-foreground/90 mt-1">
                    {tool.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-1">
                  {/* Parameter List */}
                  {tool.parameters.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        매개변수 (Parameters)
                      </div>
                      <div className="rounded-lg border border-border/60 overflow-hidden text-xs">
                        <table className="w-full divide-y divide-border/60">
                          <thead className="bg-muted/40 text-muted-foreground text-[11px]">
                            <tr>
                              <th className="py-1.5 px-3 text-left font-medium">이름</th>
                              <th className="py-1.5 px-3 text-left font-medium">타입</th>
                              <th className="py-1.5 px-3 text-left font-medium">필수</th>
                              <th className="py-1.5 px-3 text-left font-medium">설명</th>
                              <th className="py-1.5 px-3 text-left font-medium">기본값</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                            {tool.parameters.map((p) => (
                              <tr key={p.name} className="hover:bg-muted/20">
                                <td className="py-1.5 px-3 text-accent font-semibold">{p.name}</td>
                                <td className="py-1.5 px-3 text-muted-foreground">{p.type}</td>
                                <td className="py-1.5 px-3">
                                  {p.required ? (
                                    <span className="text-rose-400 font-semibold">필수</span>
                                  ) : (
                                    <span className="text-muted-foreground/70">선택</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-3 font-sans text-foreground/90">{p.description}</td>
                                <td className="py-1.5 px-3 text-muted-foreground/80">{p.default ?? '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* JSON Call Example */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-muted-foreground">호출 예시 (MCP Request)</div>
                      <div className="relative">
                        <pre className="text-[11px] font-mono p-2.5 rounded bg-black/30 border border-white/5 overflow-x-auto text-sky-300">
                          {JSON.stringify(tool.exampleCall, null, 2)}
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-1 right-1 h-6 px-1.5 text-[10px]"
                          onClick={() => copyToClipboard(JSON.stringify(tool.exampleCall, null, 2), `req-${tool.name}`)}
                        >
                          {copiedKey === `req-${tool.name}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold text-muted-foreground">응답 예시 (Response)</div>
                      <pre className="text-[11px] font-mono p-2.5 rounded bg-black/30 border border-white/5 overflow-x-auto text-emerald-300">
                        {JSON.stringify(tool.exampleResponse, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 3. Live Playground Tab                                         */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="playground" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Interactive Input Panel */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-border/70 bg-card/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Play className="h-4 w-4 text-accent" />
                      MCP 도구 실시간 테스트 콘솔
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      Live Test Console
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    웹 브라우저에서 직접 파라미터를 입력하고 MCP 도구를 즉시 실행하여 결과를 확인합니다.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Select Tool */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">호출할 MCP 도구 선택</label>
                    <Select value={selectedTool} onValueChange={setSelectedTool}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="voicebox.hachuping">voicebox.hachuping (하츄핑 한국어/영어 즉시 발화)</SelectItem>
                        <SelectItem value="voicebox.hachuping_en">voicebox.hachuping_en (하츄핑-영어 전용 발화)</SelectItem>
                        <SelectItem value="voicebox.generate_audio">voicebox.generate_audio (동기식 오디오 파일 합성)</SelectItem>
                        <SelectItem value="voicebox.speak">voicebox.speak (비동기 실시간 음성 발화)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Profile Selection (if applicable) */}
                  {(selectedTool === 'voicebox.speak' || selectedTool === 'voicebox.generate_audio') && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">음성 프로필</label>
                        <Select value={playgroundProfile} onValueChange={setPlaygroundProfile}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(profiles ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.name}>
                                {p.name} ({p.language})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">언어</label>
                        <Select value={playgroundLang} onValueChange={setPlaygroundLang}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ko">한국어 (ko)</SelectItem>
                            <SelectItem value="en">영어 (en)</SelectItem>
                            <SelectItem value="ja">일본어 (ja)</SelectItem>
                            <SelectItem value="zh">중국어 (zh)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Text Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground">입력 대사 (Text to Speak)</label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className="text-[11px] text-accent hover:underline"
                          onClick={() => setPlaygroundText('안녕 도아야! 오늘도 기분 좋은 하루 보내자, 츄~!')}
                        >
                          [샘플 1]
                        </button>
                        <button
                          type="button"
                          className="text-[11px] text-accent hover:underline"
                          onClick={() => setPlaygroundText('Voicebox MCP 서버가 정상 가동 중입니다. 모든 요청을 처리할 준비가 되었습니다.')}
                        >
                          [샘플 2]
                        </button>
                        <button
                          type="button"
                          className="text-[11px] text-accent hover:underline"
                          onClick={() => setPlaygroundText('Hello Doa! You did such an amazing job today! Keep it up!')}
                        >
                          [영어 샘플]
                        </button>
                      </div>
                    </div>
                    <Textarea
                      rows={3}
                      value={playgroundText}
                      onChange={(e) => setPlaygroundText(e.target.value)}
                      placeholder="발화할 내용을 입력하세요..."
                      className="text-xs resize-none"
                    />
                  </div>

                  {/* Run Button */}
                  <Button
                    onClick={runPlayground}
                    disabled={playgroundRunning}
                    className="w-full gap-2 h-10 font-semibold"
                  >
                    {playgroundRunning ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        음성 합성 및 발화 중...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        MCP 도구 실행 (Run Tool)
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right: Live Result Panel */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-border/70 bg-card/60 h-full flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center justify-between">
                    <span>실행 결과 (Execution Output)</span>
                    {playgroundAudioUrl && (
                      <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">
                        오디오 재생 가능
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                  {/* Audio Player if generated */}
                  {playgroundAudioUrl ? (
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium text-accent">
                        <span className="flex items-center gap-1.5">
                          <Volume2 className="h-4 w-4" />
                          합성된 오디오 바로 듣기
                        </span>
                        <a
                          href={playgroundAudioUrl}
                          download="mcp_test_output.wav"
                          className="flex items-center gap-1 text-[11px] hover:underline"
                        >
                          <Download className="h-3 w-3" />
                          다운로드
                        </a>
                      </div>
                      <audio controls src={playgroundAudioUrl} className="w-full h-8" autoPlay />
                    </div>
                  ) : (
                    <div className="py-6 border border-dashed border-border/70 rounded-lg flex flex-col items-center justify-center text-muted-foreground text-xs">
                      <Volume2 className="h-6 w-6 mb-1 text-muted-foreground/50" />
                      도구를 실행하면 여기에 오디오 플레이어가 나타납니다.
                    </div>
                  )}

                  {/* Result JSON Viewer */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">JSON 응답 데이터</div>
                    <pre className="text-[11px] font-mono p-3 rounded-lg bg-black/40 border border-white/5 overflow-x-auto min-h-[160px] text-emerald-400">
                      {playgroundResult
                        ? JSON.stringify(playgroundResult, null, 2)
                        : '// 도구를 실행하면 응답 JSON이 출력됩니다.'}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 4. Client Bindings Tab                                         */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="bindings" className="space-y-6">
          <Card className="border-border/70 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">클라이언트별 기본 음성 바인딩</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    <code>X-Voicebox-Client-Id</code> 헤더 값(예: <code>claude-code</code>, <code>antigravity</code>)에 따라 사용할 목소리를 고정 매핑합니다.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">전역 기본 음성:</span>
                  <Select
                    value={defaultProfileId || '__default__'}
                    onValueChange={(v) =>
                      updateCapture({
                        default_playback_voice_id: v === '__default__' ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">기본값 없음</SelectItem>
                      {(profiles ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Existing Bindings Table */}
              {bindings.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                  등록된 클라이언트 바인딩이 없습니다. 아래 입력폼에서 추가할 수 있습니다.
                </div>
              ) : (
                <div className="divide-y divide-border/60 border rounded-lg overflow-hidden">
                  {bindings.map((b) => (
                    <div key={b.client_id} className="p-3 grid grid-cols-[1fr_auto_auto] gap-4 items-center bg-card/30">
                      <div className="min-w-0">
                        <div className="font-medium text-xs truncate text-foreground">{b.label || b.client_id}</div>
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                          <code className="text-accent bg-accent/10 px-1 rounded">{b.client_id}</code>
                          <span>·</span>
                          {b.last_seen_at ? (
                            <span className="text-emerald-400">
                              <Plug className="inline h-3 w-3 mr-0.5" />
                              최근 연결: {formatDate(b.last_seen_at)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">연결 이력 없음</span>
                          )}
                        </div>
                      </div>

                      <Select
                        value={b.profile_id ?? '__default__'}
                        onValueChange={(v) =>
                          upsertAsync({
                            client_id: b.client_id,
                            label: b.label,
                            profile_id: v === '__default__' ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">기본 음성 따름</SelectItem>
                          {(profiles ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-rose-400"
                        onClick={() => remove(b.client_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Binding Form */}
              <div className="pt-2 space-y-2">
                <div className="text-xs font-semibold text-foreground">새 클라이언트 바인딩 추가</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="Client ID (예: cursor, claude-code)"
                    value={newClientId}
                    onChange={(e) => setNewClientId(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="라벨 (예: 커서 개발자 에이전트)"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-2">
                    <Select
                      value={newProfileId || '__default__'}
                      onValueChange={(v) => setNewProfileId(v === '__default__' ? '' : v)}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">기본 음성</SelectItem>
                        {(profiles ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleAddBinding}
                      disabled={!newClientId.trim() || addingBinding}
                      className="h-8 text-xs px-3"
                    >
                      추가
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
