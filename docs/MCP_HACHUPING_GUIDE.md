# [시스템 지침] Voicebox '하츄핑' 음성 MCP 연동 가이드

이 문서는 AI 에이전트(Claude, Cursor, Windsurf, Antigravity 등)가 **Voicebox 웹 UI에서 생성하는 '하츄핑' 목소리와 100% 동일한 품질과 음색**으로 음성을 합성하고 제어하기 위한 전용 MCP 가이드입니다.

---

## 1. 개요 및 특징

- **웹 UI 100% 동일 파이프라인**: Voicebox 프로필 화면에 등록된 '하츄핑' 샘플 오디오와 Qwen3-TTS 1.7B 엔진을 그대로 사용하여 인위적 왜곡 없이 자연스럽고 앙증맞은 하츄핑 음성을 생성합니다.
- **초간단 호출**: 복잡한 파라미터(엔진, 언어, 프로필 ID 등) 없이 **`text`만 전달**하면 즉시 동작합니다.

---

## 2. 사용 가능한 하츄핑 전용 MCP 도구

| 도구명 | 설명 | 주요 사용 목적 |
| :--- | :--- | :--- |
| **`voicebox.hachuping`** | 스피커로 하츄핑 음성 즉시 실시간 재생 (`language="en"` 전달 시 **'하츄핑-영어'** 자동 선택) | 실시간 한국어/영어 대화, 알림 |
| **`voicebox.hachuping_generate`** | 하츄핑 오디오 파일 합성 완료 후 WAV 파일 경로/Base64 반환 | 한국어/영어 오디오 파일 취득 및 저장 |
| **`voicebox.hachuping_en`** | **'하츄핑-영어'** 전용 프로필로 즉시 영어 발화 | 영어 실시간 대화 및 리스닝 학습 |
| **`voicebox.hachuping_en_generate`** | **'하츄핑-영어'** 전용 프로필로 영어 오디오 파일 생성 및 대기 | 영어 오디오 파일 취득 및 저장 |

---

## 3. MCP 도구 호출 예시

### 방법 1: 한국어 즉시 발화 (`voicebox.hachuping`)
```json
{
  "tool": "voicebox.hachuping",
  "arguments": {
    "text": "안녕 도아야! 오늘 하루도 정말 수고 많았어!"
  }
}
```

### 방법 2: 영어 전용 즉시 발화 (`voicebox.hachuping_en`)
'하츄핑-영어' 프로필을 사용하여 영어 음성을 생성합니다.
```json
{
  "tool": "voicebox.hachuping_en",
  "arguments": {
    "text": "Hello Doa! You did such a great job today!"
  }
}
```

### 방법 3: 오디오 파일 생성 및 경로 받기 (`voicebox.hachuping_generate` / `voicebox.hachuping_en_generate`)
합성된 오디오 파일을 직접 전달받아 활용하고자 할 때 호출합니다.

```json
{
  "tool": "voicebox.hachuping_en_generate",
  "arguments": {
    "text": "Welcome to Voicebox! Let's study English together!",
    "return_base64": false,
    "timeout_seconds": 60.0
  }
}
```

#### 반환값 (JSON):
```json
{
  "generation_id": "74b76a97-add9-4abd-a8fb-320b117e7160",
  "status": "completed",
  "character": "하츄핑-영어",
  "text": "Welcome to Voicebox! Let's study English together!",
  "duration": 2.35,
  "audio_path": "/Users/kykwoun/__DEV/voicebox/data/generations/74b76a97-add9-4abd-a8fb-320b117e7160.wav",
  "audio_url": "/audio/74b76a97-add9-4abd-a8fb-320b117e7160"
}
```

---

## 4. AI 에이전트용 시스템 프롬프트 (주입용 템플릿)

다른 AI 에이전트(Cursor, Claude Code 등)에게 하츄핑 캐릭터 역할을 맡길 경우, 아래 내용을 시스템 프롬프트(Custom Instruction)로 설정하세요:

```markdown
너는 애니메이션 《캐치! 티니핑》의 대표 사랑의 요정 '하츄핑'이야.
사용자와 대화할 때 밝고 사랑스러운 요정 톤으로 대화하며, 말끝에 자연스럽게 '~츄!', '~츄~' 등의 어미를 붙여서 말해.
음성으로 대답할 때는 Voicebox MCP 도구인 `voicebox.hachuping`을 호출하여 text에 대사를 전달해.

[도구 호출 예시]
voicebox.hachuping({ "text": "사용자님 안녕! 오늘 하루도 정말 수고 많았츄~!" })
```
