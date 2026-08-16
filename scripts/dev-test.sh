#!/usr/bin/env bash
# ==============================================================================
# dev-test: Automated Code Review, Fix, Test & Merge Verification Pipeline
# Usage:
#   ./scripts/dev-test.sh [base-ref]
# Examples:
#   ./scripts/dev-test.sh           # Checks working tree changes against HEAD
#   ./scripts/dev-test.sh main      # Checks changes compared to main branch
#   ./scripts/dev-test.sh HEAD~3    # Checks changes across last 3 commits
# ==============================================================================

set -euo pipefail

TARGET_REF="${1:-HEAD}"

echo "========================================================"
echo " [dev-test] Starting Verification Pipeline (Target: ${TARGET_REF})"
echo "========================================================"

# 1. Context Collection & Diff Validation
echo -e "\n[1/5] Collecting Git Status & Diff..."
git status --short

if [ "$TARGET_REF" = "HEAD" ]; then
    DIFF_STAT=$(git diff --stat HEAD 2>/dev/null || true)
    DIFF_CONTENT=$(git diff HEAD 2>/dev/null || true)
else
    DIFF_STAT=$(git diff --stat "$TARGET_REF" 2>/dev/null || true)
    DIFF_CONTENT=$(git diff "$TARGET_REF" 2>/dev/null || true)
fi

if [ -z "$DIFF_CONTENT" ]; then
    echo -e "\n>> [결과] 변경 사항이 없습니다. 파이프라인을 종료합니다."
    exit 0
fi

echo -e "\n--- 변경 파일 요약 ---"
echo "$DIFF_STAT"

LINE_COUNT=$(echo "$DIFF_CONTENT" | wc -l | tr -d ' ')
if [ "$LINE_COUNT" -gt 500 ]; then
    echo -e "\n⚠️  [주의] 대규모 변경 감지 (${LINE_COUNT} 라인). 파일 단위 분할 검토를 권장합니다."
fi

# 2. Automated Test Runner Detection & Execution
echo -e "\n[2/5] Detecting and Running Test Runners..."
TEST_CMDS=()

# Frontend typecheck / test
if command -v bun >/dev/null 2>&1 && [ -f "package.json" ]; then
    if grep -q '"typecheck"' package.json; then
        TEST_CMDS+=("bun run typecheck")
    elif grep -q '"test"' package.json; then
        TEST_CMDS+=("bun test")
    fi
elif [ -f "package.json" ] && grep -q '"test"' package.json; then
    TEST_CMDS+=("npm test")
fi

# Backend pytest
if [ -f "backend/venv/bin/pytest" ]; then
    TEST_CMDS+=("backend/venv/bin/pytest backend/tests")
elif command -v pytest >/dev/null 2>&1; then
    TEST_CMDS+=("pytest")
fi

# Rust cargo
if [ -f "Cargo.toml" ]; then
    TEST_CMDS+=("cargo test")
fi

# Go
if [ -f "go.mod" ]; then
    TEST_CMDS+=("go test ./...")
fi

TEST_STATUS="통과"
ALL_PASSED=true

if [ ${#TEST_CMDS[@]} -gt 0 ]; then
    for cmd in "${TEST_CMDS[@]}"; do
        echo -e "\n>> 실행 명령어: $cmd"
        if $cmd; then
            echo ">> ✅ [$cmd] 통과"
        else
            echo ">> ❌ [$cmd] 실패"
            ALL_PASSED=false
            TEST_STATUS="실패 ($cmd)"
        fi
    done
    if [ "$ALL_PASSED" = true ]; then
        TEST_STATUS="모든 테스트 통과 (${#TEST_CMDS[@]}개 스위트)"
    fi
else
    echo ">> ⚠️ 테스트 설정을 찾지 못했습니다. (확인 필요로 판정 강하)"
    TEST_STATUS="미실행 (테스트 러너 미발견)"
fi

# 3. Output Checklist & Summary Guide for AI / Reviewer
echo -e "\n========================================================"
echo " [dev-test] 최종 검증 리포트 요약"
echo "========================================================"
echo "1. 대상 Ref: ${TARGET_REF}"
echo "2. 변경 규모: ${LINE_COUNT} 라인 변경"
echo "3. 테스트 결과: ${TEST_STATUS}"
echo "--------------------------------------------------------"
if [ "$ALL_PASSED" = false ]; then
    echo ">> 최종 판정: [수정 필요] - 테스트 실패 해결 필수"
elif [ "$TEST_STATUS" = "미실행 (테스트 러너 미발견)" ]; then
    echo ">> 최종 판정: [확인 필요] - 테스트 러너 미발견으로 수동 검증 필요"
else
    echo ">> 최종 판정: [MERGE OK] - 주요 테스트 통과 완료 (P0/P1 버그 없을 시)"
fi
echo "========================================================"
