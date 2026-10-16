# 프로젝트 출력 수락과 복구 구현 경계 (#265)

이 문서는 docs/26의 v4 프로젝트 생성 계약 중 `projectOutputAcceptance.ts`의 호출 계약을
설명한다. GUI producer, 에이전트 v4 skill, Export 연결이나 S1 전체 완료를 뜻하지 않는다.
기존 v3 수락과 자연어 transactionGate는 교체하지 않는다.

## 수락 단위와 호출자 책임

`planProjectOutputs`는 저장된 immutable 요청 입력, 현재 소스 자산, 완료 wave의 staging
출력, 기존 manifest와 sidecar를 다시 검증한다. 기존 plan/protocol/provenance 검증기를
그대로 사용한다. 요청 전체가 done이어야 하며 failed/skipped를 부분 수락하지 않는다.
done dependency에는 현재 fingerprint와 일치하는 과거 수락 근거가 있어야 한다.

계획은 읽기만 한다. 호출자는 현재 문서/요청이 바뀌면 false가 되는 `isCurrent`와
dispatch가 반환한 기존 ticket lease를 수락까지 유지한다. 이 모듈은 에디터 문서를
수정하지 않는다. GUI는 committed 결과 뒤에만 티켓 상태를 갱신하고 finally에서 lease를
해제해야 한다. 내부 계획 객체를 외부 파일/사용자 입력에서 직접 역직렬화해 넘기지 않는다.

AST 자산 변환 후 출력 hash를 계산한다. 모든 page ticket의 현재 출력이 모였을 때만
GUI 소유 routes/host/entry를 만든다. artifact에 가짜 page manifest 항목을 만들지 않는다.
자산 검사와 별도로 AST import/export/import()/require()/TS import type의 경계를 검사한다.
상대 import는 같은 프로젝트 계획의 TSX 티켓으로 해석되어야 한다. 다른 프로젝트·계획 밖
파일·절대/alias/URL·동적 경로는 거부한다. bare package dependency는 후속 build/Export 검사
대상이며 이 단계가 패키지 설치나 typecheck 성공을 보장하지는 않는다.
수동/다른 소유 출력은 명시적 overwrite가 필요하다. 하나라도 keep/미결정이면 wave 전체를
변경하지 않는다. 원본과 sidecar는 디코딩 문자열이 아닌 정확한 bytes로 백업한다(BOM 포함).

## 쓰기 순서와 commit point

1. 현재 문서/lease/소스 자산을 확인하고 모든 원본을 create-only 백업한다.
2. plan.json과 project-recovery.json을 create-only 저장하고 readback을 확인한다.
3. 검토 당시 출력·manifest·sidecar revision과 이전 wave에서 유지할 모든 출력 hash를 첫 출력 쓰기 전에 다시 비교한다.
4. 현재 owner와 CAS로 각 출력을 쓰고 실제 bytes를 readback한다.
5. 소스 자산/문서/lease를 다시 확인하고 manifest를 쓴다. sidecar에 포함할 전체 출력(이전 wave와 이번 wave)의 hash를 다시 확인한 뒤 sidecar를 쓴다.
6. sidecar readback 뒤 전체 출력 hash와 마지막 현재성/lease 확인이 성공하면 commit point다.
7. 실제 적용 범위를 run.json에 기록한다. 이 후 Stop은 이미 커밋한 wave를 취소하지 않는다.

manifest는 기존 전체 파일 쓰기 API를 사용한다. GUI writer는 ticket lease로 직렬화되고
sidecar는 #405의 디스크 mutex+CAS를 사용한다. OS 파일시스템 전체 트랜잭션이나 외부
프로그램 직접 파일 쓰기 차단을 보장하지 않는다. run.json 기록 실패는 committed와
recoveryRequired를 함께 반환하며, 복구 가능하다고 거짓으로 보고하지 않는다.

## 실패와 명시적 되돌리기

commit point 전 실패/취소는 원래 lease가 살아 있을 때만 자기 bytes를 CAS로 보상한다.
원본 출력, manifest, sidecar 순서로 되돌리며 직전 부재인 sidecar는 조건부 DELETE한다.
새 수동 bytes나 새 lease를 덮어쓰지 않는다. 유지할 이전 wave 출력이 변경·삭제됐거나
최종 출력 hash 검사가 실패하면 committed=false, recoveryRequired=true다. 이번 쓰기의
보상이 완료돼도 외부 변경으로 과거 수락 상태가 유효하지 않을 수 있으므로 이를 성공 복구로
표시하지 않는다. 외부 변경 bytes/부재는 보존하며 다음 수락에는 새 계획과 검증이 필요하다. 원래 lease를 잃으면 새 lease를 자동 획득해
과거 쓰기 권한으로 사용하지 않는다. 실제 범위와 백업을 남기고 recoveryRequired를 알린다.

`restoreProjectOutputs`는 명시적 요청에서 새 lease를 얻고 run.json, project-recovery.json,
현재 sidecar의 committedRunId/hash, 전체 출력 bytes와 backup hash를 모두 검증한다.
현재 sidecar에서 해당 requestId의 전체 출력 목록과 run 범위가 정확히 일치해야 한다.
plan.json만 있거나 범위가 잘렸거나 파일/백업이 달라졌으면 변경하지 않는다.
이전 manifest 항목만 현재 manifest에 합쳐 다른 프로젝트 registry/항목을 유지한다.
복구 자체가 중단되면 같은 복구 lease 아래에서 accepted bytes로 보상한다.

**남은 복구 범위:** sidecar까지 커밋되지 않은 중간 실패를 새 lease로 자동 복구하는
기능은 없다. 현재 sidecar가 해당 실행을 증명하지 않으면 기존 bytes와 백업을 보존하고
수동 확인을 요구한다. 이미 복구한 실행을 다시 복구하는 idempotent 성공도 제공하지 않는다.
GUI는 이 제한을 숨기거나 일반적인 성공 toast로 바꾸면 안 된다.

## 검증

- 단위 검사는 wave 완료, overwrite keep, 각 단계 취소, lease 손실, 쓰기 실패, 현재 입력/
  출력 변경, 전체 복구 범위, 변조된 보조 기록/백업, BOM bytes 보존, 복구 중 CAS 충돌을 검사한다.
- 실제 HTTP 검사는 browser-relative URL만 Node 서버 주소로 연결한다. 실제 workspaceClient,
  lease, middleware, revision, 파일시스템을 사용해 수락 후 새 lease 복구와 sidecar 저장 직후
  취소 보상을 검사한다. 실제 AI 생성/GUI 버튼/Export 검증으로 세지 않는다.
