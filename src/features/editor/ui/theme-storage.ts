/**
 * 테마 관련 상수의 단일 소스.
 * ThemeProvider(런타임)와 vite.config(빌드 시 FOUC 스크립트 주입)가 함께 참조한다.
 * React 등 브라우저 전용 의존성을 두지 않아 Node(빌드 설정)에서도 import 가능하다.
 */

/** 테마 선택을 저장하는 localStorage 키. */
export const THEME_STORAGE_KEY = "theme";
