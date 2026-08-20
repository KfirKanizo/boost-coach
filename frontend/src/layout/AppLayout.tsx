import type { ReactNode } from 'react';
import { WifiOff } from 'lucide-react';
import { BottomNav } from '../components/nav/BottomNav';
import type { TabId } from '../config/navigation';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineSync } from '../hooks/useOfflineSync';

interface AppLayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isAdmin?: boolean;
  children: ReactNode;
}

export function AppLayout({ activeTab, onTabChange, isAdmin, children }: AppLayoutProps) {
  const isConnected = useNetworkStatus();
  useOfflineSync(isConnected);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      {!isConnected && (
        <div
          role="status"
          className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-ember px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-ink"
        >
          <WifiOff size={14} />
          Offline Mode - Progress saved locally
        </div>
      )}
      <header className="sticky top-0 z-40 flex items-center border-b border-white/5 bg-ink/80 px-4 backdrop-blur-xl">
        <img
          src="/logo.png"
          alt="BoostCoach"
          className="h-8 w-auto py-2 object-contain"
          width={120}
          height={32}
        />
      </header>
      <main className="flex-1">{children}</main>
      <BottomNav activeTab={activeTab} onTabChange={onTabChange} isAdmin={isAdmin} />
    </div>
  );
}
