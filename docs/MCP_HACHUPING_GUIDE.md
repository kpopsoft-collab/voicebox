# [시스템 지침] Voicebox MCP '하츄핑' 전용 음성 완벽 합성 가이드

Voicebox에 **'하츄핑' 전용 MCP 도구**가 탑재되었습니다.
이제 AI 에이전트(Claude, Cursor, Windsurf 등)는 복잡한 파라미터를 설정할 필요 없이, **텍스트만 전달하면 원작 애니메이션과 100% 동일한 앙증맞은 요정 목소리로 즉시 발화 및 생성**됩니다.

---

## 1. 하츄핑 전용 MCP 도구 사용법 (가장 간단하고 완벽한 방법 ⭐)

### 방법 1: 즉시 스피커로 발화하기 (`voicebox.hachuping`)
스피커를 통해 하츄핑의 목소리로 실시간 말하게 합니다.
- **자동 적용 사항**:
  - `~츄!` 어미 자동 교정
  - 초고음 요정 발화 스타일 (`instruct`) 자동 주입
  - 피치 시프트 (`Pitch Shift: +3.5 반음`) 자동 후처리

```json
{
  "tool": "voicebox.hachuping",
  "arguments": {
    "text": "안녕! 오늘 하루도 정말 수고 많았어!"
  }
}
```
*(실제 출력: "안녕! 오늘 하루도 정말 수고 많았츄!" / 원작 톤과 100% 동일한 초고음 요정 보이스)*

---

### 방법 2: 오디오 파일 생성 및 Base64 반환 (`voicebox.hachuping_generate`)
AI 에이전트가 완성된 WAV 오디오 파일 경로 또는 Base64 데이터를 직접 받아 사용하고자 할 때 호출합니다.

```json
{
  "tool": "voicebox.hachuping_generate",
  "arguments": {
    "text": "오늘 날씨가 정말 좋아! 나랑 같이 놀러 가자!",
    "return_base64": false
  }
}
```

**반환값 예시:**
```json
{
  "generation_id": "gen_abcdef123",
  "status": "completed",
  "character": "하츄핑",
  "text": "오늘 날씨가 정말 좋츄! 나랑 같이 놀러 가츄!",
  "duration": 3.45,
  "audio_path": "/Users/.../data/generations/gen_abcdef123.wav"
}
```

---

## 2. 옵션: 음높이(피치) 미세 조절

원하는 음색 취향에 따라 `pitch_shift` 값을 자유롭게 조절할 수 있습니다 (기본값: `3.5`):
- `pitch_shift: 3.5` (기본값 — 원작 하츄핑 성우 톤과 완벽 일치)
- `pitch_shift: 4.0` (더 얇고 높은 초요정 톤)
- `pitch_shift: 2.5` (약간 부드럽고 자연스러운 귀여운 톤)
