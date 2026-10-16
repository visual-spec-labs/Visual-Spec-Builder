# 프로젝트 v4 GUI 전달과 Export (#265 S1-9)

프로젝트에 modal/widget 또는 버튼 action이 있으면 구현 티켓 열기/다시 생성은 전체
ProjectPlan을 만든다. 화면 관계가 없는 기존 단일 화면 경로와 v3 API는 유지한다.
widget은 제외 개수를 표시하고 문서에는 그대로 보존한다. 재사용 widget 생성(S2)은
이 전달 범위에 포함하지 않는다.

## 전달과 취소

projectTicketRunner는 기존 v4 dispatch와 프로젝트 수락 API를 연결한다. 선택 페이지가
바뀌는 것은 프로젝트 입력 변경이 아니다. 전체 spec 참조, documentId, projectIdentity,
컴파일 generation이 바뀌면 이전 응답을 수락하지 않는다. 현재 자산 bytes는 snapshot과
수락 단계에서 다시 검증한다. 수동 상태 선택으로 프로젝트 티켓을 done으로 만들 수 없다.

정상 수락된 wave만 다음 의존 wave로 이어진다. 하나라도 failed인 응답이나 keep 선택은
wave 전체를 수락하지 않으며 다음 wave를 보내지 않는다. Stop/재컴파일은 취소만 표시하고
수락 보상이 끝나기 전에 원래 lease를 해제하지 않는다. dispatch 응답의 lease는 finally에서
해제한다. commit point 뒤 Stop/재컴파일이면 복구 handle을 보존하고 새 계획 상태는 건드리지 않는다.
복구가 필요하다는 결과를 일반 성공으로 숨기지 않는다. 세부 제한은
[수락·복구 계약](PROJECT_OUTPUT_ACCEPTANCE.md)을 따른다.

## 프로젝트 Export

화면 관계가 있는 프로젝트는 전체 페이지·modal·GUI runtime을 한 ZIP으로 묶는다.
현재 registry 소유권, 전체 provenance, 모든 출력 hash, 현재 소스 자산 fingerprint가
검증된 current 상태만 허용한다. partial/stale/unverified 상태를 페이지 하나의 ZIP으로
조용히 축소하거나 부분 성공으로 내보내지 않는다. 선택한 페이지가 달라도 같은 프로젝트 범위다.

다운로드 때 캐시된 UI 결과를 신뢰하지 않고 다시 읽는다. 프로젝트 소유 output만 포함하고
staging/backup/legacy의 같은 이름 파일은 넣지 않는다. snapshot에서 검증한 이미지 bytes는
content hash별로 중복을 제거한다. 상대 모듈 경계와 파일 참조를 검사하고 package dependency
목록과 README를 함께 넣는다. 파일 검사는 실제 typecheck/build/시각 검증을 대신하지 않는다.

기존 v3의 scanGeneratedCode/downloadGeneratedBundle은 계속 화면 관계를 거부한다.
GUI가 쓰는 프로젝트 API와 구 호출자를 섞어 전체 프로젝트를 한 page로 오인하지 않는다.

## 검증과 남은 범위

단위/통합 검사는 프로젝트 wave 연결, 입력·문서·Save As 신원 변경, 취소·재컴파일 lease 유지,
commit 뒤 복구 handle 보존, 전체 ZIP 내용/이미지 중복 제거, 다운로드 직전 변경 거부를 검사한다.
screen-relations-guard.mjs는 실제 GUI·HTTP·filesystem에서 결정적 fixture 응답을 주고 여러
wave→수락→프로젝트 ZIP과 수동 출력 변경 거부를 확인한다. 원본 IR/identity도 비교한다.

실제 AI agent 실행, 내려받은 임의 코드의 빌드/시각 일치, 미커밋 중간 실패를 새 lease로
자동 복구하는 기능, S2 재사용 widget은 완료로 표시하지 않는다. Epic #265를 닫지 않는다.


미커밋 적용이 남은 채 reload한 경우 프로젝트 티켓 패널의 **미완료 적용 확인**으로
저장된 pending 실행을 읽기 전용으로 찾는다. 이어서 **마지막 프로젝트 적용 되돌리기**가
새 lease 아래 저널·백업·현재 전체 bytes를 재검증한다. 발견만으로 복구 성공을 표시하지 않는다.
