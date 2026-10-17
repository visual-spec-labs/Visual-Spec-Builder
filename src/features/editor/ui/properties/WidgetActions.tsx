import { useEditorStore } from "@/features/editor/store/editorStore";
import { useResponsiveScreen } from "@/features/editor/responsive/useResponsiveScreen";

export function WidgetActions({ id, type }: { id: string; type: 'frame' | 'instance' }) {
  const root = useEditorStore(state => state.spec.pages[state.activePageId].root);
  const extractWidget = useEditorStore(state => state.extractWidget);
  const detachInstance = useEditorStore(state => state.detachInstance);
  const { breakpoint } = useResponsiveScreen();
  if (type === 'frame' && id === root) return null;
  return <div className="border-t border-line p-3">
    <button type="button" disabled={breakpoint !== null} title={breakpoint ? '기본값에서 위젯 추출·분리를 실행합니다.' : undefined} className="rounded-control border border-line px-2 py-1 text-xs text-content hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50" onClick={() => type === 'frame' ? extractWidget(id) : detachInstance(id)}>
      {type === 'frame' ? '위젯으로 추출' : '위젯 연결 해제'}
    </button>
  </div>;
}
