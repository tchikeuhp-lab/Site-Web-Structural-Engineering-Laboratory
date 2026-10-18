import React from 'react';
import { PenTool, Shapes, ListOrdered, Share2 } from 'lucide-react';

export type NavTab = 'canvas' | 'shapes' | 'points' | 'export';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pointsCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  pointsCount,
}) => {
  return (
    <nav
      aria-label="Navigation principale"
      style={{ height: 'var(--nav-h)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md"
    >
      <div className="mx-auto grid h-full max-w-3xl grid-cols-4 items-center">
        {/* Onglet 1 : Tracé / Canevas */}
        <button
          onClick={() => onSelectTab('canvas')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'canvas'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PenTool className="h-5 w-5" />
          <span className="text-[11px] mt-1 tracking-tight">Tracé</span>
        </button>

        {/* Onglet 2 : Formes */}
        <button
          onClick={() => onSelectTab('shapes')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'shapes'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shapes className="h-5 w-5" />
          <span className="text-[11px] mt-1 tracking-tight">Formes</span>
        </button>

        {/* Onglet 3 : Bornes / Carnet */}
        <button
          onClick={() => onSelectTab('points')}
          className={`relative flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'points'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <ListOrdered className="h-5 w-5" />
            {pointsCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-slate-800 border border-slate-600 px-1 text-[9px] font-mono text-emerald-400">
                {pointsCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight">Bornes</span>
        </button>

        {/* Onglet 4 : Exporter / Audit */}
        <button
          onClick={() => onSelectTab('export')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'export'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Share2 className="h-5 w-5" />
          <span className="text-[11px] mt-1 tracking-tight">Export</span>
        </button>
      </div>
    </nav>
  );
};
