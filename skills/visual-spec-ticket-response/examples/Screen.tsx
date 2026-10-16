// Contract example only: replace these target IDs and asset tokens with the current
// request's actual IR actions and verified asset mapping before writing staging output.
type Actions = {
  onNavigate: (target: string) => void;
  onOpenModal: (target: string) => void;
  onClose: () => void;
};

export function Photo({ variant }: { variant: 'first' | 'second' }) {
  if (variant === 'first') return <img alt="First" src="vsb-asset:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />;
  return <img alt="Second" src="vsb-asset:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" />;
}

export default function Screen({ onNavigate, onOpenModal, onClose }: Actions) {
  return <main>
    <button onClick={() => onNavigate('dashboard')}>Navigate</button>
    <button onClick={() => onOpenModal('resetPassword')}>Open modal</button>
    <button onClick={onClose}>Close</button>
    <Photo variant="first" />
    <Photo variant="second" />
  </main>;
}
