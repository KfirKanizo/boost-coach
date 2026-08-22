import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="More info"
        onClick={() => setOpen((o) => !o)}
        className="flex h-5 w-5 items-center justify-center rounded-full text-ash/50 transition-colors hover:bg-white/10 hover:text-ash"
      >
        <Info size={14} />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-56 rounded-xl border border-white/10 bg-surface p-3 text-xs leading-relaxed text-ash shadow-xl">
          {text}
          <div className="absolute -bottom-1 right-2 h-2 w-2 rotate-45 border-b border-r border-white/10 bg-surface" />
        </div>
      )}
    </div>
  );
}
