# Voicebox 기여 가이드

Voicebox 프로젝트에 관심을 가져주셔서 감사합니다! 이 문서는 프로젝트 기여를 위한 가이드라인과 안내를 제공합니다.

## 행동 강령 (Code of Conduct)

- 상호 존중하고 포용적인 태도를 유지합니다.
- 새로운 기여자를 환영하고 배움을 돕습니다.
- 건설적인 피드백에 집중합니다.
- 다양한 관점과 경험을 존중합니다.

## 시작하기

### 사전 요구사항

- **[Bun](https://bun.sh)** - 빠른 JavaScript 런타임 및 패키지 관리자
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **[Python 3.11+](https://python.org)** - 백엔드 개발용
  ```bash
  python --version  # 3.11 이상이어야 함
  ```

- **[Rust](https://rustup.rs)** - Tauri 데스크톱 앱용 (Tauri CLI 설치 시 자동 설치 지원)
  ```bash
  rustc --version  # 설치 여부 확인
  ```
- **[Tauri 사전 요구사항](https://v2.tauri.app/start/prerequisites)** - OS별 Tauri 시스템 의존성.

- **Git** - 버전 관리

### 개발 환경 설정

[just](https://github.com/casey/just)를 설치합니다 (`brew install just`, `cargo install just`, 또는 `winget install Casey.Just`):

```bash
git clone https://github.com/kpopsoft-collab/voicebox.git
cd voicebox

just setup   # 가상환경(venv) 생성 및 Python + JS 의존성 자동 설치
just dev     # 백엔드 + 데스크톱 앱 동시 실행
```

`just setup` 명령은 다음 작업을 자동으로 처리합니다:
- Python 가상환경(venv) 생성
- Python 의존성 설치 (Windows NVIDIA GPU 환경 시 CUDA PyTorch 자동 감지 설치)
- Apple Silicon 환경 시 MLX 의존성 설치
- JavaScript/TypeScript 의존성 설치

`just dev`는 백엔드와 데스크톱 앱을 함께 시작합니다. 백엔드가 이미 실행 중인 경우(예: 다른 터미널에서 `just dev-backend` 실행 중), 이를 감지하여 프론트엔드만 시작합니다.

기타 유용한 명령어:

```bash
just dev-web       # 백엔드 + 웹 앱 (Tauri/Rust 빌드 제외)
just dev-backend   # 백엔드만 실행
just dev-frontend  # Tauri 데스크톱 앱만 실행 (백엔드가 실행 중이어야 함)
just kill          # 실행 중인 모든 개발 프로세스 종료
just clean-all     # 모든 빌드 파일 및 캐시를 완전히 초기화
just --list        # 사용 가능한 모든 명령어 목록 보기
```

> **참고:** 개발(dev) 모드에서는 수동으로 실행한 Python 서버에 연결됩니다.
> 번들링된 서버 바이너리는 프로덕션 릴리스 빌드에서만 사용됩니다.

#### Windows 사용자 참고사항

justfile은 PowerShell을 통해 Windows에서 네이티브로 실행됩니다 (WSL 또는 Git Bash 불필요). NVIDIA GPU가 장착된 Windows 환경에서는 `just setup`이 GPU 가속을 위해 CUDA 지원 PyTorch를 자동으로 설치합니다.

### AI 모델 다운로드

모델은 처음 사용할 때 HuggingFace Hub에서 자동으로 다운로드됩니다:
- **Whisper** (음성 전사/STT): 최초 전사 실행 시 자동 다운로드
- **Qwen3-TTS** (음성 복제/TTS): 최초 음성 생성 시 자동 다운로드 (~2-4GB)

첫 실행 시에는 모델 다운로드로 인해 시간이 소요될 수 있으나, 이후 실행부터는 캐시된 로컬 모델을 즉시 로딩합니다.

### 빌드하기

**프로덕션 앱 빌드:**

```bash
just build        # CPU 서버 바이너리 + Tauri 인스톨러 빌드
```

Windows에서 로컬 테스트를 위해 CUDA 지원 빌드를 진행할 경우:

```bash
just build-local  # CPU + CUDA 서버 바이너리 + Tauri 인스톨러 빌드
```

이 명령은 CPU 사이드카(앱 번들 내 포함), CUDA 바이너리(런타임 GPU 전환을 위해 `%APPDATA%/sh.voicebox.app/backends/`에 배치), 설치 가능한 Tauri 앱을 생성합니다.

플랫폼별 인스톨러(`.dmg`, `.msi`, `.AppImage`)는 `tauri/src-tauri/target/release/bundle/`에 생성됩니다.

**개별 빌드 타깃:**

```bash
just build-server       # CPU 서버 바이너리만 빌드
just build-server-cuda  # CUDA 서버 바이너리만 빌드 (Windows)
just build-tauri        # Tauri 데스크톱 앱만 빌드
just build-web          # 웹 앱만 빌드
```

**로컬 Qwen3-TTS 개발 버전으로 빌드:**

Qwen3-TTS 라이브러리를 직접 개발하거나 수정 중인 경우, `QWEN_TTS_PATH` 환경 변수에 로컬 클론 경로를 지정하세요:

```bash
export QWEN_TTS_PATH=~/path/to/your/Qwen3-TTS
just build-server
```

이렇게 하면 PyInstaller가 pip 설치 패키지 대신 사용자의 로컬 qwen-tts 버전을 사용합니다.

### OpenAPI 클라이언트 생성

백엔드 서버를 시작한 후:
```bash
./scripts/generate-api.sh
```
OpenAPI 스키마를 다운로드하고 `app/src/lib/api/` 경로에 TypeScript 클라이언트를 자동 생성합니다.

### 웹 포맷으로 에셋 변환

웹 최적화를 위해 이미지와 비디오를 압축 변환하려면 다음을 실행하세요:
```bash
bun run convert:assets
```

이 스크립트는 다음 작업을 수행합니다:
- PNG → WebP 변환 (화질 유지, 더 높은 압축률)
- MOV → WebM 변환 (VP9 코덱, 적은 파일 크기)
- `landing/public/` 및 `docs/public/` 내 파일 처리
- 변환 성공 후 **원본 파일 자동 삭제**

**필수 요구사항:** `webp` 및 `ffmpeg` 설치:
```bash
brew install webp ffmpeg
```

> **참고:** 저장소 크기를 작게 유지하기 위해 새 이미지나 동영상을 커밋하기 전에 이 스크립트를 실행해 주세요.

## 개발 워크플로우

### 1. 브랜치 생성

```bash
git checkout -b feature/기능이름
# 또는
git checkout -b fix/버그수정이름
```

### 2. 코드 작성

- 깔끔하고 읽기 쉬운 코드 작성
- 기존 코드 스타일 준수
- 복잡한 로직에는 이유(Why) 중심의 주석 작성
- 필요에 따라 관련 문서 업데이트

### 3. 변경사항 테스트

- 앱에서 직접 수동 테스트 수행
- 백엔드 API 엔드포인트 동작 확인
- TypeScript 및 Python 컴파일 에러 확인
- UI 컴포넌트 정상 렌더링 확인

### 4. 커밋 메시지 작성

명확하고 설명력 있는 커밋 메시지를 작성합니다:

```bash
git commit -m "feat: 음성 프로필 내보내기 기능 추가"
git commit -m "fix: 30초 후 오디오 재생이 중단되는 문제 수정"
```

### 5. 푸시 및 풀 리퀘스트(PR) 생성

```bash
git push origin feature/기능이름
```

GitHub에서 다음 내용을 포함하여 PR을 생성합니다:
- 변경사항에 대한 명확한 설명
- UI 변경 시 스크린샷 첨부
- 관련된 이슈 링크 연결

## 코드 스타일 가이드

### TypeScript / React

- TypeScript strict 모드 사용
- React 모범 사례 준수
- Hook 기반의 함수형 컴포넌트 작성
- Named export 선호
- Biome 포맷터 준수

```typescript
// 올바른 예시
export function ProfileCard({ profile }: { profile: Profile }) {
  return <div>{profile.name}</div>;
}

// 지양할 예시
export const ProfileCard = (props) => { ... }
```

### Python

- PEP 8 스타일 가이드 준수
- Type hint 명시
- I/O 작업 시 async/await 사용
- Black 포맷터 스타일 준수

```python
# 올바른 예시
async def create_profile(name: str, language: str) -> Profile:
    """새로운 음성 프로필을 생성합니다."""
    ...

# 지양할 예시
def create_profile(name, language):
    ...
```

### Rust

- Rust 표준 컨벤션 준수
- 의미 있는 변수명 사용
- 에러 명시적 처리
- `rustfmt` 포맷팅 준수

## 프로젝트 구조

```
voicebox/
├── app/              # 공유 React 프론트엔드
│   └── src/
│       ├── components/   # UI 컴포넌트
│       ├── lib/          # 유틸리티 및 API 클라이언트
│       └── hooks/        # React 커스텀 훅
├── backend/          # Python FastAPI 서버
│   ├── main.py       # API 라우트 및 진입점
│   ├── tts.py        # 음성 합성 엔진 관리
│   └── ...
├── tauri/            # 데스크톱 앱 래퍼
│   └── src-tauri/    # Rust 백엔드
└── scripts/          # 빌드 및 릴리스 스크립트
```

## 기여 가능한 분야

### 🐛 버그 수정

- 이슈 목록에서 미해결 버그 확인
- 버그 수정 후 철저한 테스트 진행
- 가능한 경우 재현 방지 테스트 추가

### ✨ 신규 기능 개발

- 제안하기 전 README.md의 로드맵과 [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)의 상태를 먼저 확인하세요.
- 대규모 기능은 먼저 이슈를 통해 논의
- 기능의 범위를 명확히 유지

### 📚 문서화

- README 설명 개선
- 코드 주석 및 API 문서 작성
- 튜토리얼 및 사용자 가이드 작성

### 🎨 UI/UX 개선

- 웹 접근성 향상
- 시각적 디자인 완성도 제고
- 렌더링 성능 최적화
- 애니메이션 및 부드러운 전환 효과 추가

### 🔧 인프라 및 빌드

- 빌드 프로세스 개선
- CI/CD 파이프라인 최적화
- 번들 사이즈 최소화
- 테스트 자동화 인프라 강화

## API 개발 가이드

새로운 API 엔드포인트를 추가할 때:

1. **`backend/routes/`에 라우트 추가**
2. **`backend/models.py`에 Pydantic 모델 정의**
3. **해당 모듈에 비즈니스 로직 구현**
4. **OpenAPI 스키마 업데이트** (FastAPI 자동 지원)
5. **TypeScript 클라이언트 재생성:**
   ```bash
   bun run generate:api
   ```
6. **API 문서 업데이트**

## 테스트

현재는 주로 수동 검증을 진행합니다. 자동 테스트 추가 시:

- **백엔드**: pytest 활용
- **프론트엔드**: Vitest 활용
- **E2E**: Playwright 활용

## 풀 리퀘스트(PR) 체크리스트

- [ ] 코드가 프로젝트 스타일 가이드를 준수하는가?
- [ ] 관련 문서가 업데이트되었는가?
- [ ] 변경사항이 로컬에서 정상 테스트되었는가?
- [ ] Breaking change가 없거나 명시적으로 문서화되었는가?
- [ ] CHANGELOG.md가 업데이트되었는가?

## 릴리스 프로세스

릴리스는 메인테이너에 의해 관리됩니다:

1. **bumpversion을 이용한 버전 업데이트:**
   ```bash
   # 패치 버전 올리기 (0.1.0 -> 0.1.1)
   bumpversion patch
   
   # 마이너 버전 올리기 (0.1.0 -> 0.2.0)
   bumpversion minor
   
   # 메이저 버전 올리기 (0.1.0 -> 1.0.0)
   bumpversion major
   ```
   
   이 작업은 모든 파일(`tauri.conf.json`, `Cargo.toml`, 모든 `package.json`, `backend/main.py`)의 버전 번호를 업데이트하고 git 커밋 및 태그를 자동 생성합니다.

2. **CHANGELOG.md에 릴리스 노트 업데이트**

3. **커밋 및 태그 푸시:**
   ```bash
   git push
   git push --tags
   ```

4. **GitHub Actions가 태그 푸시 시 자동으로 빌드 및 릴리스를 수행합니다.**

## 라이선스

프로젝트에 기여함으로써 귀하의 기여물이 MIT 라이선스 하에 배포되는 것에 동의하게 됩니다.

---

Voicebox 프로젝트에 기여해 주셔서 감사합니다! 🎉
