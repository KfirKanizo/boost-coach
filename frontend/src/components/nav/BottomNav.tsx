import { NAV_TABS } from '../../config/navigation';
import type { TabId } from '../../config/navigation';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

/** Fixed, semi-transparent bottom navigation bar (flat 3-tab model). */
export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/5 bg-surface/80 pb-safe backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around">
        {NAV_TABS.map(({ id, label, icon: Icon }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(id)}
              className={`flex min-w-[64px] flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-neon' : 'text-ash'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium tracking-wide">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
