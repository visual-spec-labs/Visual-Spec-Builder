import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { THEME_STORAGE_KEY } from "@/features/editor/ui/theme-storage";

export type Theme = "light" | "dark";

/** 현재 DOM 상태에서 초기 테마를 읽는다. (index.html 인라인 스크립트가 선반영) */
function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** data-theme 속성과 localStorage에 테마를 반영한다(부수효과). */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.dataset.theme = "dark";
  } else {
    delete root.dataset.theme;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* localStorage 접근 불가(프라이빗 모드 등) 시 무시 */
  }
}

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * 앱 전역 테마 상태의 단일 소스. App 최상단에서 감싼다.
 * 여러 컴포넌트가 useTheme()로 같은 상태를 공유한다.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const toggle = useCallback(() => {
    // 부수효과(DOM/스토리지)는 이벤트 핸들러에서 실행하고,
    // 상태 갱신 함수는 순수하게 유지한다.
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggle }),
    [theme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 전역 테마 상태와 토글을 가져온다. ThemeProvider 내부에서만 사용 가능. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error("useTheme는 ThemeProvider 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
}
