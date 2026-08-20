---
name: analyze-target-project
description: 대상 React 프로젝트의 폴더 구조, 라우팅 방식, Tailwind 설정(커스텀 폰트/컬러), 컴포넌트 배치 관례를 분석해 요약한다. "이 프로젝트 구조 파악해줘", "컴포넌트 어디에 두는 프로젝트야?" 같은 요청이나, visual-spec-to-react가 생성 코드를 어디에 둘지 판단해야 할 때 그보다 먼저 실행한다.
---

# 대상 프로젝트 컨벤션 분석

이 스킬이 지금 상황에 맞지 않으면 [../visual-spec/SKILL.md](../visual-spec/SKILL.md)를 대신 연다.

Visual Spec을 React 코드로 바꿀 때(`visual-spec-to-react`) 파일을 어디에 둘지, 어떤 스타일
관례를 따를지 매번 사용자에게 묻지 않아도 되도록, 대상 프로젝트를 먼저 읽고 요약한다.
분석 결과를 별도 파일로 저장하지 않는다 — 이번 대화 세션 안에서만 참고한다 (MVP는 영속화하지 않음).

## 실행 순서

1. **설정 파일을 읽는다.** `package.json`, `tsconfig.json`, `vite.config.*` 또는
   `next.config.*`, `tailwind.config.*` (v4는 CSS 파일의 `@theme`) 순으로 확인한다.
2. **라우팅 방식을 판단한다.** `react-router` 의존성이 있는지, Next.js `app/`/`pages/` 폴더가
   있는지, 아니면 라우팅이 아예 없는 SPA인지 확인한다.
3. **컴포넌트/화면 배치 관례를 찾는다.** `src/pages`, `src/screens`, `src/features/*/ui` 등
   기존 폴더에 이미 컴포넌트가 있으면 그 위치와 명명 규칙(파일당 컴포넌트 하나인지, 폴더
   구조인지)을 기록한다. 기존 예시가 없으면 "관례 없음"으로 표시한다.
4. **Tailwind 커스텀 설정을 확인한다.** 등록된 폰트 패밀리, 컬러 토큰이 있으면 적어둔다 —
   `visual-spec-to-react`의 `fontFamily` 매핑(`[font-family:'값']` arbitrary property 대신
   named 클래스를 쓸 수 있는지)에 쓰인다.
5. **요약해서 보고한다.** 아래 형식을 따른다.

```
- 폴더 구조: <예: src/features/<domain>/ui/ 아래 화면 컴포넌트를 둔다>
- 라우팅: <예: react-router, src/app/routes.tsx에서 등록>
- Tailwind: <예: v4, @theme에 font-pretendard 등록됨 / 커스텀 설정 없음>
- 컴포넌트 명명: <예: PascalCase 파일명, default export>
```

6. 이 요약을 대화 맥락에 남긴다. 이어서 `visual-spec-to-react`를 실행할 때 이 요약을 참고해
   파일 위치를 제안하되, 최종 확인은 여전히 사용자에게 받는다 (자동으로 결정하지 않는다).

## 이 스킬이 하지 않는 것

- 분석 결과의 파일 저장/캐싱 (매번 새로 분석한다)
- 파일 위치의 자동 확정 (제안만 하고, 사용자 확인을 거친다)
- 코드 스타일 자동 교정 (분석만 하지 프로젝트를 고치지 않는다)
