<p align="center">
  <img src=".github/assets/icon-dark.webp" alt="Voicebox" width="120" height="120" />
</p>

<h1 align="center">Voicebox</h1>

<p align="center">
  <strong>오픈소스 AI 음성 스튜디오</strong><br/>
  어떤 목소리든 복제하고, 음성을 생성하고, 어떤 앱에서든 음성 입력하고, AI 에이전트에게 당신만의 목소리를 부여하세요.<br/>
  완전한 음성 I/O 스택을 로컬에서 실행합니다.
</p>

<p align="center">
  <a href="https://github.com/jamiepine/voicebox/releases">
    <img src="https://img.shields.io/github/downloads/jamiepine/voicebox/total?style=flat&color=blue" alt="Downloads" />
  </a>
  <a href="https://github.com/jamiepine/voicebox/releases/latest">
    <img src="https://img.shields.io/github/v/release/jamiepine/voicebox?style=flat" alt="Release" />
  </a>
  <a href="https://github.com/jamiepine/voicebox/stargazers">
    <img src="https://img.shields.io/github/stars/jamiepine/voicebox?style=flat" alt="Stars" />
  </a>
  <a href="https://github.com/jamiepine/voicebox/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/jamiepine/voicebox?style=flat" alt="License" />
  </a>
  <a href="https://deepwiki.com/jamiepine/voicebox">
    <img src="https://img.shields.io/static/v1?label=Ask&message=DeepWiki&color=5B6EF7" alt="Ask DeepWiki" />
  </a>
</p>

<p align="center">
    <a href="https://trendshift.io/repositories/21213" target="_blank"><img src="https://trendshift.io/api/badge/repositories/21213" alt="jamiepine%2Fvoicebox | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<p align="center">
  <a href="https://voicebox.sh">voicebox.sh</a> •
  <a href="https://docs.voicebox.sh">문서</a> •
  <a href="#다운로드">다운로드</a> •
  <a href="#주요-기능">기능</a> •
  <a href="#api">API</a> •
  <a href="docs/content/docs/overview/troubleshooting.mdx">문제 해결</a>
</p>

<br/>

<p align="center">
  <a href="https://voicebox.sh">
    <img src="landing/public/assets/app-screenshot-1.webp" alt="Voicebox 앱 스크린샷" width="800" />
  </a>
</p>

<p align="center">
  <em>위 이미지를 클릭하면 <a href="https://voicebox.sh">voicebox.sh</a>에서 데모 영상을 볼 수 있습니다</em>
</p>

<br/>

<p align="center">
  <img src="landing/public/assets/app-screenshot-2.webp" alt="Voicebox 스크린샷 2" width="800" />
</p>

<p align="center">
  <img src="landing/public/assets/app-screenshot-3.webp" alt="Voicebox 스크린샷 3" width="800" />
</p>

<br/>

## Voicebox란?

Voicebox는 **로컬 퍼스트 AI 음성 스튜디오**입니다 — **ElevenLabs**와 **WisprFlow**를 하나의 무료 오픈소스 앱으로 대체합니다. 몇 초의 오디오만으로 목소리를 복제하고, 8개의 TTS 엔진으로 23개 언어의 음성을 생성하고, 글로벌 단축키로 어디서든 음성 입력하고, MCP를 지원하는 어떤 AI 에이전트에게든 원하는 목소리를 부여할 수 있습니다.

두 클라우드 서비스(ElevenLabs: 음성 출력, WisprFlow: 음성 입력)가 각각 담당하는 영역을 Voicebox는 하나로 통합하고, 로컬 LLM을 통한 텍스트 정제와 프로필별 페르소나까지 지원하며, 모든 것이 사용자의 머신에서 실행됩니다.

- **완전한 프라이버시** — 모델, 음성 데이터, 캡처가 절대 외부로 전송되지 않음
- **8개 TTS 엔진** — Qwen3-TTS, Qwen CustomVoice, LuxTTS, Chatterbox Multilingual, Chatterbox Turbo, HumeAI TADA, Kokoro, **MeloTTS**
- **음성 복제 & 프리셋** — 레퍼런스 샘플로 제로샷 복제, 또는 Kokoro·Qwen CustomVoice의 50+ 프리셋 보이스 즉시 사용
- **23개 언어** — 영어, 한국어, 일본어, 중국어, 아랍어, 힌디어, 스와힐리어 등
- **후처리 이펙트** — 피치 시프트, 리버브, 딜레이, 코러스, 컴프레서, 필터
- **감정 표현** — Chatterbox Turbo의 `[laugh]`, `[sigh]`, `[gasp]` 등 비언어적 태그 지원, Qwen CustomVoice의 자연어 발화 제어
- **무제한 길이** — 자동 청킹 + 크로스페이드로 대본, 기사, 장편 모두 대응
- **스토리 에디터** — 대화, 팟캐스트, 내러티브용 멀티트랙 타임라인
- **🆕 오디오 트리머 스튜디오** — 32x 줌 파형 편집, 시간 룰러, HUD, 미니맵 내비게이션으로 정밀한 오디오 구간 편집
- **🆕 AI 배경음악 제거** — Meta Demucs AI로 배경음악·악기를 분리하여 순수 보컬만 추출
- **음성 입력** — 글로벌 단축키로 누르고 말하기(Push-to-Talk) 및 토글 모드, macOS 접근성 자동 붙여넣기, 모든 텍스트 필드의 인앱 마이크, Whisper 기반 STT
- **에이전트 음성 출력** — 하나의 도구 호출(`voicebox.speak`)로 MCP 지원 에이전트(Claude Code, Cursor, Cline)가 복제된 목소리로 대화
- **🆕 확장 MCP 도구** — `generate_audio`(동기 생성), `remove_bgm`(BGM 제거), `trim_audio`(구간 자르기), `create_profile`(프로필 생성) 등 외부 AI 에이전트가 호출 가능한 도구 확장
- **음성 페르소나** — 음성 프로필에 자유 형식 페르소나를 부여하고, 로컬 LLM으로 캐릭터에 맞게 텍스트를 재작성한 뒤 TTS 생성
- **API 우선** — REST API + 내장 MCP 서버로 자체 앱과 에이전트에 음성 I/O 통합
- **네이티브 성능** — Electron이 아닌 Tauri(Rust) 기반
- **어디서든 실행** — macOS(MLX/Metal), Windows(CUDA), Linux, AMD ROCm, Intel Arc, Docker

---

## 다운로드

| 플랫폼                   | 다운로드                                                   |
| ----------------------- | -------------------------------------------------------- |
| macOS (Apple Silicon)   | [DMG 다운로드](https://voicebox.sh/download/mac-arm)       |
| macOS (Intel)           | [DMG 다운로드](https://voicebox.sh/download/mac-intel)     |
| Windows                 | [MSI 다운로드](https://voicebox.sh/download/windows)       |
| Docker                  | `docker compose up`                                      |

> **[모든 바이너리 보기 →](https://github.com/jamiepine/voicebox/releases/latest)**

> **Linux** — 사전 빌드된 바이너리는 아직 제공되지 않습니다. [voicebox.sh/linux-install](https://voicebox.sh/linux-install)에서 소스 빌드 방법을 확인하세요.

> **문제가 있나요?** 설치, 생성, 모델 다운로드, GPU 관련 일반적인 문제는 [문제 해결 가이드](docs/content/docs/overview/troubleshooting.mdx)를 참고하세요.

---

## 주요 기능

### 멀티 엔진 음성 복제

8개의 TTS 엔진을 생성 단위로 전환하여 사용할 수 있습니다:

| 엔진                         | 언어 수 | 특장점                                                                                    |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| **Qwen3-TTS** (0.6B / 1.7B) | 10     | 고품질 다국어 복제, 발화 지시("천천히 말해줘", "속삭여줘") 지원                                     |
| **Qwen CustomVoice**        | 10     | 자연어 발화 제어가 가능한 9개 프리셋 보이스 — 레퍼런스 오디오 불필요                                  |
| **LuxTTS**                  | 영어    | 경량 (~1GB VRAM), 48kHz 출력, CPU에서 150배 실시간 속도                                       |
| **Chatterbox Multilingual** | 23     | 아랍어, 덴마크어, 핀란드어, 그리스어, 히브리어, 힌디어, 말레이어 등 최다 언어 지원                      |
| **Chatterbox Turbo**        | 영어    | 350M 경량 모델, 비언어적 감정/사운드 태그 지원                                                   |
| **TADA** (1B / 3B)          | 10     | HumeAI 음성-언어 모델 — 700초+ 일관된 오디오, 텍스트-음향 듀얼 정렬                                |
| **Kokoro**                  | 8      | 50개 프리셋 보이스, 82M 초경량 모델, 빠른 CPU 추론                                              |
| **🆕 MeloTTS**              | 한국어  | 선명하고 정확한 한국어 발음, 깔끔한 프리셋 TTS                                                   |

### 감정 표현 & 비언어적 태그

**Chatterbox Turbo**만 `[laugh]`, `[sigh]` 등의 비언어적 태그를 해석합니다. 다른 엔진은 이를 텍스트로 그대로 읽습니다.

**Chatterbox Turbo** 선택 시, 텍스트 입력란에서 `/`를 입력하면 태그 삽입기가 열립니다:

`[laugh]` `[chuckle]` `[gasp]` `[cough]` `[sigh]` `[groan]` `[sniff]` `[shush]` `[clear throat]`

### 후처리 이펙트

Spotify의 `pedalboard` 라이브러리 기반 8가지 오디오 이펙트. 생성 후 적용하고, 실시간 미리보기하고, 재사용 가능한 프리셋을 구성합니다.

| 이펙트           | 설명                                    |
| --------------- | -------------------------------------- |
| 피치 시프트       | 최대 12 반음까지 올리거나 내림              |
| 리버브           | 방 크기, 감쇠, 웻/드라이 믹스 조절 가능      |
| 딜레이           | 에코 시간, 피드백, 믹스 조절                |
| 코러스 / 플랜저   | 변조된 딜레이로 금속적이거나 풍성한 질감       |
| 컴프레서         | 다이내믹 레인지 압축                        |
| 게인             | 볼륨 조절 (-40 ~ +40 dB)                |
| 하이패스 필터     | 저주파 제거                               |
| 로우패스 필터     | 고주파 제거                               |

4개의 내장 프리셋(로보틱, 라디오, 에코 챔버, 딥 보이스)과 커스텀 프리셋을 지원합니다. 이펙트를 프로필별 기본값으로 지정할 수 있습니다.

### 🆕 오디오 트리머 스튜디오

전용 `/trimmer` 페이지에서 정밀한 오디오 편집이 가능합니다.

- **32x 줌** — 파형을 최대 32배까지 확대하여 밀리초 단위 정밀 편집
- **시간 룰러** — 줌 레벨에 따라 자동 스케일링되는 시간 눈금 표시
- **미니맵 내비게이션** — 전체 파형을 한눈에 보면서 현재 위치를 빠르게 이동
- **드래그 구간 선택** — 시작/끝 핸들 드래그, 영역 이동, 새 구간 생성
- **구간 재생 & 루프** — 선택 영역만 재생하거나 반복 재생
- **잘라내기 & 다운로드** — 선택한 구간을 WAV 파일로 즉시 내보내기
- **음성 프로필 생성** — 트리밍한 클립으로 직접 음성 복제 프로필 등록
- **클립 히스토리** — 작업한 클립 목록을 재생·다운로드·프로필 생성에 활용

### 🆕 AI 배경음악 제거

Meta의 **Demucs htdemucs** AI 모델을 사용하여 오디오에서 배경음악, 비트, 악기를 분리하고 순수 보컬만 추출합니다.

- **원클릭 분리** — 트리머 스튜디오 또는 프로필 샘플 업로드에서 바로 사용
- **MCP 도구** — `voicebox.remove_bgm`으로 외부 AI 에이전트에서 호출 가능
- **REST API** — `POST /audio/remove-bgm`로 프로그래밍 방식 접근
- **Apple Silicon 최적화** — M3 Ultra 등 고코어 CPU에서 빠른 추론

### 무제한 생성 길이

텍스트를 문장 경계에서 자동 분할하고, 각 청크를 독립적으로 생성한 뒤 크로스페이드로 결합합니다. 모든 엔진에서 동작합니다.

- 설정 가능한 자동 청킹 한도 (100~5,000자)
- 크로스페이드 슬라이더 (0~200ms)
- 최대 텍스트 길이: 50,000자
- 약어, CJK 구두점, `[태그]`를 인식하는 스마트 분할

### 생성 버전 관리

모든 생성물은 출처를 추적하는 다중 버전을 지원합니다:

- **오리지널** — 깨끗한 TTS 출력, 항상 보존
- **이펙트 버전** — 원본 버전에서 다양한 이펙트 체인 적용
- **테이크** — 새로운 시드로 재생성하여 변형 생성
- **소스 추적** — 각 버전이 출처를 기록
- **즐겨찾기** — 생성물에 별표를 달아 빠르게 접근

### 비동기 생성 큐

생성은 논블로킹입니다. 요청을 보내고 즉시 다음 텍스트를 입력할 수 있습니다.

- 직렬 실행 큐로 GPU 경합 방지
- 실시간 SSE 상태 스트리밍
- 실패한 생성은 재시도 가능
- 크래시로 남은 미완료 생성은 시작 시 자동 복구

### 음성 프로필 관리

- 오디오 파일로 프로필 생성 또는 앱 내에서 직접 녹음
- 프로필 가져오기/내보내기로 공유 및 백업
- 고품질 복제를 위한 멀티 샘플 지원
- 프로필별 기본 이펙트 체인
- 설명과 언어 태그로 정리

### 스토리 에디터

대화, 팟캐스트, 내러티브를 위한 멀티 보이스 타임라인 에디터.

- 드래그 앤 드롭 멀티트랙 구성
- 인라인 오디오 트리밍 및 분할
- 동기화된 플레이헤드로 자동 재생
- 트랙 클립별 버전 고정

### 글로벌 음성 입력 & 딕테이션

음성 I/O 루프의 나머지 절반. 시스템 어디서든 단축키를 누르고 말하면 — macOS에서는 포커스된 텍스트 필드에 바로 붙여넣기됩니다. 또는 Voicebox의 모든 텍스트 입력란에서 마이크 버튼을 누르고 직접 음성 입력합니다.

- **설정 가능한 단축키** — 누르고 말하기/탭하여 토글 모드, 인앱 단축키 설정에서 재바인딩 가능. Push-to-Talk 중 `Space`를 탭하면 오디오 끊김 없이 토글 세션으로 전환
- **대상 감지 붙여넣기 (macOS)** — 포커스된 텍스트 필드에 접근성 검증된 주입, 클립보드 원자적 저장/복원으로 기존 클립보드 내용 보존
- **최초 실행 권한 UX** — macOS 접근성 및 입력 모니터링 권한을 시스템 설정 딥링크와 함께 안내
- **인앱 마이크 버튼** — 생성 폼, 프로필 설명, 스토리 제목 등 모든 텍스트 필드에서 사용
- **LLM 정제** — 붙여넣기 전 '음', 말더듬, 잘못된 시작을 선택적으로 정리
- **온스크린 필** — `녹음 중`, `전사 중`, `정제 중`, `말하는 중` 상태를 표시하는 플로팅 오버레이. 에이전트가 말할 때도 동일한 필을 사용

### 음성-텍스트 변환

Voicebox는 전사에 OpenAI Whisper를 사용합니다 — 딕테이션, 캡처 탭, `/transcribe` API에서 동일한 모델을 사용합니다. 플랫폼에 따라 MLX(Apple Silicon) 또는 PyTorch(CUDA/ROCm/DirectML/CPU)에서 실행됩니다.

| 크기                         | 비고                                          |
| --------------------------- | --------------------------------------------- |
| Base / Small / Medium / Large | 표준 Whisper 품질 단계                          |
| Turbo                       | Whisper Large 대비 ~8배 빠르고, 품질 손실 최소화   |

추가 엔진(Parakeet v3, Qwen3-ASR) 계획 중 — [로드맵](#로드맵) 참고.

### 캡처

모든 딕테이션, 인앱 녹음, 업로드된 오디오 파일이 캡처 탭에 저장됩니다 — 원본 오디오와 전사본이 함께 항상 보존됩니다.

- **재생, 재전사, 정제** — 다른 Whisper 크기로 STT를 재실행하거나, 로컬 LLM으로 다른 플래그(필러 정리, 자기 교정 제거, 전문 용어 보존)로 재처리
- **인라인 편집** — 전사본을 바로 수정하고 저장
- **음성 프로필로 재생** — 캡처의 오디오를 복제된 목소리로 변환, 원클릭
- **음성 샘플로 활용** — 캡처의 오디오 + 전사본을 음성 프로필의 레퍼런스 샘플로 사용
- **로컬 캡처 저장** — 원본 오디오와 전사본은 Voicebox 데이터 디렉토리에 저장, 설정에서 폴더 바로가기 제공

### 에이전트 음성 출력

모든 에이전트에게 목소리를 부여합니다. 하나의 도구 호출로 MCP를 지원하는 어떤 에이전트든 복제된 목소리로 말할 수 있습니다 — 작업 완료, 질문, 알림. 딕테이션 중에 표시되는 동일한 필이 에이전트 발화 중에도 표시되어, 무엇이 재생되고 있는지 항상 확인할 수 있습니다.

```ts
// MCP를 지원하는 모든 에이전트에서:
await voicebox.speak({
  text: "배포 완료.",
  profile: "소희",
});
```

MCP를 지원하지 않는 클라이언트를 위해 `POST /speak`으로도 사용 가능 — ACP, A2A, 셸 스크립트, 커스텀 연동.

- **양방향 필** — `녹음 중`, `전사 중`, `정제 중`, `말하는 중`이 모두 동일한 OS 레벨 오버레이의 상태이므로, 딕테이션과 에이전트 발화가 하나의 인터페이스를 공유
- **에이전트별 음성 바인딩** — **설정 → MCP**에서 Claude Code는 Morgan으로, Cursor는 소희로 지정하면 보지 않고도 어떤 에이전트가 말하는지 구분 가능. 각 클라이언트의 `last_seen_at` 타임스탬프로 설치 확인
- **항상 가시적** — 백그라운드 TTS 없음. 모든 에이전트 발화가 음성 프로필 이름과 함께 필에 표시
- **HTTP + stdio 전송** — Claude Code / Cursor / Windsurf / VS Code MCP에 URL로 설치하거나, stdio 전용 클라이언트는 번들된 `voicebox-mcp` 바이너리 사용

### 음성 페르소나

음성 프로필에 자유 형식 페르소나를 부여합니다 — 이 목소리가 누구인지, 어떻게 말하는지, 무엇에 관심이 있는지. 페르소나가 설정되면 생성 폼에 두 가지 액션이 나타나며, 완전히 로컬에서 실행되는 번들 Qwen3 LLM이 이를 구동합니다.

- **작성(Compose)** — 캐릭터에 맞는 새로운 대사를 텍스트 영역에 생성. 편집 후 말하기, 또는 다시 클릭하여 다른 버전 생성
- **캐릭터로 말하기** — 입력 텍스트를 페르소나 LLM을 통해 캐릭터의 말투로 재작성한 후 TTS 생성

에이전트도 MCP를 통해 `personality: true`를 `voicebox.speak`에 전달하여 동일한 재작성 경로를 사용할 수 있습니다. 동일한 LLM이 딕테이션의 정제 단계에서도 사용됩니다 — 앱 내 하나의 LLM, 하나의 모델 캐시, 하나의 GPU 메모리 풋프린트.

**로컬 LLM 옵션:** Qwen3 0.6B / 1.7B / 4B, TTS 런타임과 공유 (Apple Silicon에서 MLX, 그 외 PyTorch).

활용 사례: 에이전트 개발 루프(질문을 음성 입력하고 복제된 목소리로 답변 듣기), 게임·내러티브 도구의 인터랙티브 캐릭터, 본래 목소리로 말할 수 없는 사람을 위한 음성 보조.

### 모델 관리

- 다운로드를 삭제하지 않고 모델별 언로드로 GPU 메모리 해제
- `VOICEBOX_MODELS_DIR`로 커스텀 모델 디렉토리 지정
- 진행률 추적이 되는 모델 폴더 마이그레이션
- 다운로드 취소/정리 UI

### GPU 지원

| 플랫폼                    | 백엔드          | 비고                                            |
| ------------------------ | -------------- | ---------------------------------------------- |
| macOS (Apple Silicon)    | MLX (Metal)    | Neural Engine으로 4~5배 빠름                     |
| Windows (NVIDIA)         | PyTorch (CUDA) | 앱 내에서 CUDA 바이너리 자동 다운로드               |
| Linux (NVIDIA)           | PyTorch (CUDA) | CUDA PyTorch가 설치된 로컬/원격 Python 백엔드 사용  |
| Linux (AMD)              | PyTorch (ROCm) | HSA_OVERRIDE_GFX_VERSION 자동 설정              |
| Windows (모든 GPU)       | DirectML       | 범용 Windows GPU 지원                           |
| Intel Arc                | IPEX/XPU       | Intel 이산 GPU 가속                              |
| 모든 플랫폼               | CPU            | 어디서든 동작, 다만 느림                           |

---

## API

Voicebox는 자체 앱과 에이전트에 음성 I/O를 통합하기 위한 REST API를 제공합니다.

```bash
# 음성 생성
curl -X POST http://127.0.0.1:17493/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "안녕하세요", "profile_id": "abc123", "language": "ko"}'

# 에이전트 음성 출력 — 어떤 앱이나 스크립트에서든 복제된 목소리로 말하기
curl -X POST http://127.0.0.1:17493/speak \
  -H "Content-Type: application/json" \
  -H "X-Voicebox-Client-Id: my-script" \
  -d '{"text": "배포 완료.", "profile": "소희"}'

# 오디오 파일 전사
curl -X POST http://127.0.0.1:17493/transcribe \
  -F "audio=@recording.wav" \
  -F "model=whisper-turbo"

# 음성 프로필 목록 조회
curl http://127.0.0.1:17493/profiles

# 🆕 배경음악 제거
curl -X POST http://127.0.0.1:17493/audio/remove-bgm \
  -F "file=@music_with_vocals.mp3" \
  --output vocals_only.wav
```

`POST /speak`은 `profile`을 이름(대소문자 무시) 또는 ID로 받으며, MCP 도구와 동일한 우선순위로 해석합니다: 명시적 인자 → 클라이언트별 바인딩 → `capture_settings.default_playback_voice_id`.

### MCP 서버

Voicebox는 **Model Context Protocol** 서버를 내장하고 있어 MCP를 지원하는 모든 에이전트(Claude Code, Cursor, Windsurf, Cline, VS Code MCP 확장)가 음성 생성, 전사, 캡처 및 프로필을 사용할 수 있습니다.

**Claude Code 한 줄 설정:**

```
claude mcp add voicebox \
  --transport http \
  --url http://127.0.0.1:17493/mcp \
  --header "X-Voicebox-Client-Id: claude-code"
```

**모든 HTTP MCP 클라이언트** (Cursor, Windsurf, VS Code 등):

```json
{
  "mcpServers": {
    "voicebox": {
      "url": "http://127.0.0.1:17493/mcp",
      "headers": { "X-Voicebox-Client-Id": "cursor" }
    }
  }
}
```

**Stdio 폴백** — HTTP MCP를 지원하지 않는 클라이언트를 위해 앱에 번들된 `voicebox-mcp` 바이너리를 사용합니다:

```json
{
  "mcpServers": {
    "voicebox": {
      "command": "/Applications/Voicebox.app/Contents/MacOS/voicebox-mcp",
      "env": { "VOICEBOX_CLIENT_ID": "claude-desktop" }
    }
  }
}
```

9개의 도구를 제공합니다:

| 도구                        | 설명                                                    |
| -------------------------- | ------------------------------------------------------- |
| `voicebox.speak`           | 비동기 TTS — 즉시 반환하고 재생                              |
| `voicebox.generate_audio`  | 🆕 동기 TTS — 오디오 완성까지 대기 후 파일 경로/base64 반환      |
| `voicebox.create_profile`  | 🆕 레퍼런스 오디오로 음성 복제 프로필 생성                        |
| `voicebox.remove_bgm`      | 🆕 Demucs AI로 배경음악 제거, 보컬만 추출                      |
| `voicebox.trim_audio`      | 🆕 오디오 파일의 시작/끝 시간 지정 구간 자르기                    |
| `voicebox.transcribe`      | Whisper 기반 음성-텍스트 변환                                |
| `voicebox.list_profiles`   | 사용 가능한 음성 프로필 목록                                   |
| `voicebox.list_captures`   | 최근 캡처(딕테이션, 녹음, 업로드) 목록                          |
| `voicebox.get_status`      | 🆕 서버 상태, 엔진, 하드웨어 가속 정보                          |

클라이언트별 음성 바인딩은 **Voicebox → 설정 → MCP**에서 관리합니다. 도구 시그니처, 해석 우선순위, 필 규약, 보안 관련 사항은 [MCP 가이드 전문](docs/content/docs/overview/mcp-server.mdx)을 참고하세요.

```ts
// MCP를 지원하는 모든 에이전트에서:
await voicebox.speak({
  text: "테스트 통과. 머지 준비 완료.",
  profile: "소희",          // 선택 — 미지정 시 클라이언트별 바인딩 사용
  personality: true,        // 선택 — 프로필의 페르소나 LLM으로 텍스트 재작성 후 TTS
});

// 🆕 동기 생성 — AI 에이전트가 오디오를 즉시 사용하고 싶을 때
const result = await voicebox.generate_audio({
  text: "안녕하세요, 새로운 기능을 소개합니다.",
  profile: "소희",
  return_base64: true,
});
// result.audio_path, result.duration, result.audio_base64 사용 가능

// 🆕 배경음악 제거
const vocals = await voicebox.remove_bgm({
  audio_path: "/path/to/song.mp3",
  output_path: "/path/to/vocals.wav",
});
```

**활용 사례:** 에이전트 개발 루프(음성 입력 → 음성 출력), 게임 대화, 팟캐스트 제작, 접근성 도구, 음성 비서, 콘텐츠 자동화.

전체 API 문서: `http://127.0.0.1:17493/docs`

---

## 기술 스택

| 레이어         | 기술                                                                                    |
| ------------- | --------------------------------------------------------------------------------------- |
| 데스크톱 앱    | Tauri (Rust)                                                                             |
| 프론트엔드     | React, TypeScript, Tailwind CSS                                                          |
| 상태 관리      | Zustand, React Query                                                                    |
| 백엔드        | FastAPI (Python)                                                                         |
| TTS 엔진      | Qwen3-TTS, Qwen CustomVoice, LuxTTS, Chatterbox, Chatterbox Turbo, TADA, Kokoro, MeloTTS |
| STT           | Whisper / Whisper Turbo (PyTorch 또는 MLX)                                                |
| 로컬 LLM      | Qwen3 (0.6B / 1.7B / 4B), TTS/STT와 런타임 공유                                           |
| MCP 서버      | FastMCP — `/mcp` 마운트 (Streamable HTTP) + 번들 stdio 심 바이너리                          |
| 네이티브 심    | Rust (Tauri 내부) — 글로벌 단축키, 붙여넣기 주입, 포커스 탐지                                  |
| 이펙트        | Pedalboard (Spotify)                                                                     |
| AI 보컬 분리   | 🆕 Demucs htdemucs (Meta)                                                                |
| 추론          | MLX (Apple Silicon) / PyTorch (CUDA/ROCm/XPU/CPU)                                        |
| 데이터베이스   | SQLite                                                                                   |
| 오디오        | WaveSurfer.js, librosa                                                                   |

---

## 로드맵

| 기능                           | 설명                                                                      |
| ----------------------------- | ------------------------------------------------------------------------- |
| **Windows / Linux 자동 붙여넣기** | 딕테이션 붙여넣기 동등 지원 — Windows `SendInput`, Linux `uinput` / AT-SPI      |
| **STT 엔진 확장**              | Whisper에 Parakeet v3, Qwen3-ASR 추가 — 50+ 언어, 비영어 품질 향상             |
| **파이프라인 라우팅**            | 소스 → 변환 → 싱크 체인 설정 + 웹훅/MCP 싱크 및 프리셋 에디터                     |
| **스트리밍 전사**               | WebSocket `/transcribe/stream`으로 말하면서 실시간 부분 전사                     |
| **엔드투엔드 음성 LLM**         | Moshi, GLM-4-Voice, Qwen2.5 Omni — 중간 텍스트 없는 진정한 음성-음성 대화        |
| **음성 디자인**                 | 텍스트 설명으로 새로운 음성 생성                                                 |
| **장시간 캡처**                 | 듀얼 스트림 레코더 (마이크 + 시스템 오디오) + 요약 LLM 변환                       |
| **플랫폼 싱크**                 | Apple Notes, Obsidian 등 선택적 연동                                         |
| **플러그인 아키텍처**            | 커스텀 모델, 변환, 싱크로 확장                                                 |
| **모바일 컴패니언**              | 스마트폰에서 Voicebox 제어                                                   |

전체 엔지니어링 상태, 이슈 분류, 우선순위 작업 큐는 [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)를 참고하세요 — 출시된 것, 진행 중인 것, 평가 중인 TTS 엔진, 특정 통합을 수용하거나 보류한 이유를 추적하는 실시간 문서입니다.

---

## 개발

자세한 설정 및 기여 가이드는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

### 빠른 시작

```bash
git clone https://github.com/jamiepine/voicebox.git
cd voicebox

just setup   # Python venv 생성, 모든 의존성 설치
just dev     # 백엔드 + 데스크톱 앱 시작
```

[just](https://github.com/casey/just) 설치: `brew install just` 또는 `cargo install just`. `just --list`로 모든 명령어를 확인할 수 있습니다.

**사전 요구사항:** [Bun](https://bun.sh), [Rust](https://rustup.rs), [Python 3.11+](https://python.org), [Tauri 사전 요구사항](https://v2.tauri.app/start/prerequisites/), macOS에서는 [Xcode](https://developer.apple.com/xcode/).

저장소에 `.mcp.json`이 미리 설정되어 있어, 이 체크아웃 내에서 Claude Code를 실행하면 개발 앱 실행 후 Voicebox MCP 도구가 자동으로 인식됩니다.

### 로컬 빌드

```bash
just build          # CPU 서버 바이너리 + Tauri 앱 빌드
just build-local    # (Windows) CPU + CUDA 서버 바이너리 + Tauri 앱 빌드
```

### 새 음성 모델 추가

멀티 엔진 아키텍처 덕분에 새로운 TTS 엔진 추가가 간단합니다. [단계별 가이드](docs/content/docs/developer/tts-engines.mdx)에서 의존성 조사, 백엔드 프로토콜 구현, 프론트엔드 연결, PyInstaller 번들링까지 전체 과정을 다룹니다.

이 가이드는 AI 코딩 에이전트에 최적화되어 있습니다. [에이전트 스킬](.agents/skills/add-tts-engine/SKILL.md)이 모델 이름을 받아 전체 통합을 자율적으로 처리할 수 있습니다 — 사용자는 로컬 빌드만 테스트하면 됩니다.

### 프로젝트 구조

```
voicebox/
├── app/              # 공유 React 프론트엔드
├── tauri/            # 데스크톱 앱 (Tauri + Rust)
├── web/              # 웹 배포
├── backend/          # Python FastAPI 서버
├── landing/          # 마케팅 웹사이트
└── scripts/          # 빌드 & 릴리스 스크립트
```

---

## 기여

기여를 환영합니다! 가이드라인은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

1. 저장소 포크
2. 기능 브랜치 생성
3. 변경사항 작성
4. PR 제출

## 보안

보안 취약점을 발견하셨나요? 책임감 있게 신고해 주세요. 자세한 내용은 [SECURITY.md](SECURITY.md)를 참고하세요.

---

## 라이선스

MIT 라이선스 — 자세한 내용은 [LICENSE](LICENSE)를 참고하세요.

---

<p align="center">
  <a href="https://voicebox.sh">voicebox.sh</a>
</p>
