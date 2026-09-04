import { useNavigationStore } from "@/features/editor/store/navigationStore";
import { EditorLayout } from "@/features/editor/ui/EditorLayout";
import { HomeScreen } from "@/features/editor/ui/HomeScreen";
import { ThemeProvider } from "@/features/editor/ui/ThemeProvider";

export function App() {
  const screen = useNavigationStore((s) => s.screen);

  return (
    <ThemeProvider>
      {screen === "home" ? <HomeScreen /> : <EditorLayout />}
    </ThemeProvider>
  );
}
