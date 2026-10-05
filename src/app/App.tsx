import { useEffect } from "react";

import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { EditorLayout } from "@/features/editor/ui/EditorLayout";
import { HomeScreen } from "@/features/editor/ui/HomeScreen";
import { startSpecAutosave } from "@/features/editor/ui/specAutosave";
import { SaveConflictDialog } from "@/features/editor/ui/SaveConflictDialog";
import { useSaveConflictStore } from "@/features/editor/store/saveConflictStore";
import { ThemeProvider } from "@/features/editor/ui/ThemeProvider";

export function App() {
  const screen = useNavigationStore((s) => s.screen);
  const paused = useSaveConflictStore((s) => s.paused);
  useEffect(startSpecAutosave, []);

  return (
    <ThemeProvider>
      <div inert={paused || undefined}>
        {screen === "home" ? <HomeScreen /> : <EditorLayout />}
      </div>
      <SaveConflictDialog />
    </ThemeProvider>
  );
}
