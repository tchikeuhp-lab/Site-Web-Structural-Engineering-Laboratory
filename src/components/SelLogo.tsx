import React from 'react';

interface SelLogoProps {
  className?: string;
  /** Variante pour fond clair / impression : le sigle S.E.L. passe en sombre pour rester lisible. */
  isPrint?: boolean;
}

/** Logo Structural & Engineering Labs (SEL). */
export const SelLogo: React.FC<SelLogoProps> = ({ className = '', isPrint = false }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg viewBox="0 0 48 48" className={`absolute inset-0 w-full h-full ${isPrint ? '' : 'drop-shadow-lg'}`} aria-hidden="true">
        <path d="M24 4 L44 14 L44 34 L24 44 L4 34 L4 14 Z" fill="currentColor" className={isPrint ? 'text-blue-500/10' : 'text-blue-500/5'} />
        <path d="M24 4 L44 14 L44 34 L24 44 L4 34 L4 14 Z" fill="none" stroke="#3a9bd5" strokeWidth="2.5" />
        <path d="M4 14 L44 34 M4 34 L44 14 M24 4 L24 44" stroke="#3a9bd5" strokeWidth="0.5" strokeOpacity="0.4" />
        <rect x="16" y="18" width="16" height="12" rx="2" fill="#3a9bd5" />
      </svg>
      <span className={`relative font-sans font-black text-[11px] tracking-tighter mt-0.5 ${isPrint ? 'text-slate-900' : 'text-white'}`}>S.E.L.</span>
    </div>
    <div className="flex flex-col -space-y-1.5 text-left">
      <div className="flex items-baseline gap-1">
        <span className="font-sans font-black text-xl tracking-tighter">STRUCTURAL</span>
        <span className="font-sans font-bold text-blue-500 text-xl">&</span>
      </div>
      <span className="font-sans font-bold text-gray-500 text-[11px] tracking-[0.35em] uppercase">ENGINEERING LABS</span>
    </div>
  </div>
);
