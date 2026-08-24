import { EditorLayout } from "@/features/editor/ui/EditorLayout";
import { ThemeProvider } from "@/features/editor/ui/ThemeProvider";

export function App() {
  return (
    <ThemeProvider>
      <EditorLayout />
    </ThemeProvider>
  );
}
