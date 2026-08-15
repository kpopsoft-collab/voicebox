# 🎙️ Voicebox MCP (Model Context Protocol) 가이드

Voicebox는 외부 AI 에이전트(Claude Desktop, Cursor, Windsurf, Antigravity, AutoGPT 등)가 로컬 음성 AI 기능을 자유롭게 호출할 수 있도록 **FastMCP (Streamable HTTP / SSE)** 기반의 강력한 MCP 서버를 제공합니다.

---

## 1. 🔌 AI 클라이언트 연결 설정 (Configuration)

### 📌 엔드포인트 URL
- **로컬 연결:** `https://127.0.0.1:17493/mcp`
- **로컬 네트워크 (외부 기기):** `https://192.168.0.200:17493/mcp`

---

### A. Claude Desktop 설정 (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "voicebox": {
      "url": "https://192.168.0.200:17493/mcp",
      "headers": {
        "x-client-id": "claude-desktop"
      }
    }
  }
}
```

### B. Cursor / Windsurf / Antigravity (`mcp.json`)
```json
{
  "mcpServers": {
    "voicebox": {
      "url": "https://192.168.0.200:17493/mcp",
      "headers": {
        "x-client-id": "cursor-agent"
      }
    }
  }
}
```

---

## 2. 🛠️ 제공되는 MCP 도구 목록 (Tools)

| 도구명 (Tool) | 설명 | 주요 파라미터 |
| :--- | :--- | :--- |
| **`voicebox.generate_audio`** ⭐ | **동기식 음성 합성**<br>(완료될 때까지 대기 후 오디오 경로/Base64 즉시 반환) | `text` (필수), `profile`, `language`, `return_base64` |
| **`voicebox.speak`** | **비동기 음성 합성**<br>(호출 즉시 Generation ID 반환 및 재생) | `text` (필수), `profile`, `engine`, `personality` |
| **`voicebox.create_profile`** | **새 음성 프로필/클론 생성**<br>(오디오 파일이나 Base64로 즉시 캐릭터 등록) | `name` (필수), `audio_path` 또는 `audio_base64`, `personality` |
| **`voicebox.remove_bgm`** | **AI 배경음악 제거 / 보컬 분리**<br>(Demucs AI로 깨끗한 목소리만 추출) | `audio_path` 또는 `audio_base64`, `output_path`, `return_base64` |
| **`voicebox.trim_audio`** | **오디오 구간 자르기**<br>(시작/끝 초를 지정하여 WAV 슬라이스) | `start_seconds`, `end_seconds`, `audio_path` |
| **`voicebox.transcribe`** | **음성 인식 (STT)**<br>(로컬 Whisper 모델로 오디오 텍스트 변환) | `audio_path` 또는 `audio_base64`, `language` |
| **`voicebox.list_profiles`** | **등록된 음성 프로필 목록 조회**<br>(이름, 언어, 페르소나 캐릭터 프롬프트 등) | 없음 |
| **`voicebox.get_status`** | **시스템 상태 & 엔진 정보 조회**<br>(사용 가능한 엔진, 하드웨어 사양 등) | 없음 |
| **`voicebox.list_captures`** | **최근 음성 캡처 / 녹음 기록 조회** | `limit`, `offset` |

---

## 3. 💡 AI 에이전트 활용 예시 (Use Cases)

### 예시 1: 텍스트를 음성으로 생성하여 파일 경로 얻기
```json
{
  "name": "voicebox.generate_audio",
  "arguments": {
    "text": "옛날 옛적 어느 깊은 산골에 착한 호랑이가 살고 있었어요.",
    "profile": "이야기 할머니",
    "language": "ko",
    "return_base64": false
  }
}
```

### 예시 2: 유튜브/음악 음원에서 배경음악 제거 후 보컬만 추출
```json
{
  "name": "voicebox.remove_bgm",
  "arguments": {
    "audio_path": "/Users/kykwoun/Downloads/sample_with_bgm.mp3"
  }
}
```

### 예시 3: 오디오를 5초~15초 구간으로 자른 후 새 캐릭터 프로필 생성
```json
{
  "name": "voicebox.create_profile",
  "arguments": {
    "name": "구연동화 소희",
    "audio_path": "/tmp/vocal_sample.wav",
    "language": "ko",
    "personality": "당신은 7세 아동에게 옛날이야기를 친근하게 들려주는 나레이터입니다."
  }
}
```
