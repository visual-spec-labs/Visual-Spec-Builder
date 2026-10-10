#!/usr/bin/env bash
# Linux CI/로컬용. 실제 작업공간 대신 여정마다 전용 임시 경로만 사용한다.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
command -v timeout >/dev/null
# 진단에서는 짧게 줄일 수 있지만 CI 상한을 늘리거나 무제한으로 만들 수 없다.
limit="${VSB_JOURNEY_TIMEOUT_SECONDS:-120}"
if ! [[ "$limit" =~ ^[1-9][0-9]{0,2}$ ]] || (( limit > 120 )); then
  echo 'VSB_JOURNEY_TIMEOUT_SECONDS must be an integer from 1 to 120' >&2
  exit 2
fi
scratch=$(mktemp -d "${TMPDIR:-/tmp}/vsb-journeys.XXXXXX")
trap 'rm -rf -- "$scratch"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# 기존 5개 + #292의 3개 + #281의 생성 소유권 여정을 모두 유지한다.
journeys=(export-journey project-dialogs document-transitions unnamed-drafts save-status
  stale-ticket-journey request-generation manual-change-guard generation-ownership)
for journey in "${journeys[@]}"; do
  case_dir="$scratch/$journey"
  mkdir -p "$case_dir"
  echo "RUN $journey (limit ${limit}s)"
  # GNU timeout은 실패/timeout을 nonzero로 반환한다. set -e로 다음 성공에 가려지지 않는다.
  # SIGTERM에서는 harness가 브라우저·Vite를 정리하고, 10초 후에도 멈추면 강제 종료한다.
  TMPDIR="$case_dir" TMP="$case_dir" TEMP="$case_dir" VSB_QA_ARTIFACTS="$case_dir/artifacts" \
    timeout --signal=TERM --kill-after=10s "${limit}s" node "scripts/browser/$journey.mjs"
  echo "PASS journey $journey"
done
echo "PASS all ${#journeys[@]} fixture journeys (no skips)"
