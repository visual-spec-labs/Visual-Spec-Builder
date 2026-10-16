# #265 S2 위젯 구현 계약

이 문서는 승인된 [24의 D8/D9](24-screen-relations-design.md#4-참조의-수명과-위젯-제안)를
S2-1/2에서 검증할 구체 계약으로 좁힌다. 2026-10-16 후속 작업 지시는 실제 모델 endpoint의
CONNECT 403을 우회하지 않고 미검증으로 유지하면서, 독립적인 복구·S2 구현을 진행하도록 했다.
S1 실제 AI 검증과 S2 구현 완료를 같은 것으로 기록하지 않으며 #265 전체 완료 조건은 유지한다.

## IR 0.4와 호환성

VisualSpec와 ProjectSpec의 정본 version은 모두 `0.4`다. 새 `instance`는 기존 Node 유니온에
추가한다. 0.3 소비자는 버전/노드 검증으로 거부하며, instance를 삭제하거나 frame으로 바꿔
0.3으로 저장하는 암묵 downgrade는 없다. 원본 파일은 Open만으로 다시 쓰지 않는다.

`migrateToV04(unknown)`는 기존 `migrateToV03`로 0.1/0.2의 배경 형식을 먼저 보존 변환한 뒤,
올바른 화면/프로젝트 외곽 형태의 0.3 문서 version만 0.4로 올린다. **승격 전에 구버전
문서에 0.4 전용 instance 노드가 있는지 검사하며, 있으면 원본 버전을 유지해 거부한다.**
이 검사는 0.3뿐 아니라 migrateToV03 이전의 0.1/0.2 입력에도 적용한다. 외곽 형태만 보고
버전을 올려 구버전에서 무효인 새 타입을 유효하게 만들지 않는다. 그 밖의 잘못된 필드는
검증기가 거부하도록 보존한다. 기존 migrateToV03의 배경 변환 계약을 임의로 넓히지 않는다.
이미 0.4인 값은 그대로 반환한다. 입력을 변이하지 않는다.
기존 공개 `migrateToV03`의 0.3 변환 의미는 유지하고, 현재 문서 입구가 새 함수를 호출한다.
Open·자동 저장 복원·작업공간 서버·CLI 계약 번들에서 같은 현재 버전 검증을 사용한다.
기존 생성 출력의 provenance를 새 IR에 맞게 조작하지 않는다. 버전 변경으로 입력 지문이
달라지면 stale로 판정하고 재생성을 요구한다.

## InstanceNode의 닫힌 구조

필수 필드는 `type:"instance"`, 비어 있지 않은 `name`, 기존 `Box`의 `box`, `PageId`의 `ref`다.
선택 `visible`은 생략=true다. `overrides`는 생략 또는 빈 맵이면 원본을 상속한다.
children/layout/action/background/typography 등 다른 노드의 필드를 추가하지 않는다.
instance는 호스트 트리에서 leaf이며, ref는 **같은 프로젝트**의 kind=widget 화면이다.
호스트의 root는 기존처럼 frame이어야 한다. instance를 screen root로 바꾸지 않는다.

`overrides`는 직접 원본 widget의 NodeId를 키로 하고, 값은 선택 `content:string`,
`color:Color`만 가진 닫힌 객체다. 빈 객체는 아무 override도 하지 않는다. 대상은 Text/Button만
허용한다. 원본 타입에 합성한 결과도 기존 노드 제약을 만족해야 한다. 특히 Text의 빈
content는 허용하되 Button의 content는 기존 minLength:1을 유지하므로 빈 문자열 override를
`instance-override-invalid`로 거부한다. 없는 노드·frame/image/input/instance 대상·점 경로로 nested instance 내부 접근은
거부한다. 색·내용 이외의 변경과 임의 부분 객체 병합은 이 계약의 범위 밖이다.

호스트의 responsive 규칙은 instance의 **visible과 PartialBox만** 변경할 수 있다.
이를 위한 InstanceOverride를 기존 NodeOverride의 대상 타입 검사에 추가한다. ref/name/
overrides를 breakpoint별로 바꾸거나 instance에 layout/색/배경 속성을 추가하지 않는다.
이 호스트 표현 규칙과 원본 내부 content/color override는 서로 다른 계층이다.

## 의미 검증과 합성

프로젝트 전체에서 다음 오류 코드를 사용한다.

- `instance-ref-missing`: ref가 pages에 없다.
- `instance-ref-kind`: ref가 widget이 아니다.
- `instance-cycle`: widget 포함 그래프의 직접/간접 순환이다. 기존 로컬 children cycle과 구분한다.
- `instance-override-invalid`: 직접 대상이 없거나 Text/Button이 아니거나, 합성 결과가 해당
  원본 노드의 제약을 위반한다(예: Button의 빈 content).

허용하지 않은 override 속성·값 타입·Color 형식처럼 닫힌 JSON Schema에서 먼저 실패하는
항목은 기존 `schema` 코드다. 이를 의미 검증 코드로 바꾸려고 검증 순서나 기존 오류 매핑을
교체하지 않는다. schema 통과 뒤에만 위 instance 의미 검증을 실행한다.

여러 page가 같은 widget을 참조하는 DAG는 유효하다. navigate/openModal 그래프의 순환과
instance 포함 그래프의 순환을 혼동하지 않는다. 독립 VisualSpec은 외부 ref의 존재·종류를
확인했다고 주장하지 않는다. 프로젝트로 Open/Save/생성할 때 전체 참조 검증을 요구한다.

합성은 원본 기본값 → viewport 기반 원본 responsive 누적 → instance content/color다.
명시 color는 모든 폭에서 우선하고, 지정하지 않은 원본 변경은 모든 instance에 반영된다.
호스트 instance.box는 바깥 크기를 정한다. widget에는 page min-height 셸을 추가하지 않는다.
렌더 재귀는 방문 경로를 방어하고 DOM 접근성 ID는 저장 PageId/NodeId를 그대로 재사용하지 않는다.

사용 중 widget 삭제·참조를 깨는 kind 변경·override 대상 삭제/타입 변경은 전체 후보 검사로
거부한다. 참조나 override를 조용히 지우지 않는다. 다른 프로젝트 clipboard의 동일 문자열
ref를 같은 widget으로 간주하지 않는다. 명시 detach/instance 삭제 뒤에만 원본을 삭제한다.

## PR 경계와 남은 계약

1. S2-1은 정본·생성 타입·migration·현재 버전 입구·예제·계약 번들의 별도 PR이다.
   중간 단계에서 미지원 instance를 받아 조용히 버리지 않도록 필요한 차단만 포함한다.
2. S2-2는 참조/순환/override 검증과 후보 프로젝트 무결성 회귀다.
3. S2-3의 extract/detach Command 필드·버전·반응형 복사와 ID 매핑은 docs/09의 별도 계약으로
   정한다. 이 문서가 임의 명령 이름이나 동작을 이미 승인한 것으로 해석하지 않는다.
4. 렌더·선택 잠금 → 위젯 GUI → 프로젝트 ticket의 공유 의존성 → 생성/ZIP/NL을 순차 연결한다.
   각 단계는 기존 검증기를 재사용하고 Undo 한 단계·실패/취소 무변경을 검증한다.
5. 독립 앱 typecheck/build와 브라우저 fixture는 실제 AI 출력 검증과 구분해 기록한다.
   외부 모델 검증이 차단된 상태에서 epic을 완료 처리하거나 닫지 않는다.

스키마 PR은 별도로 유지한다. 사용자가 본 작업의 리뷰 대기 없이 진행·일반 병합을 승인한
범위에서 최신 HEAD CI와 실제 리뷰 지적을 확인한다. 관리자 우회 병합은 사용하지 않는다.
