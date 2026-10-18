import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  kind: 'info' | 'success' | 'error';
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const styles = {
    info: 'border-cyan-500/40 bg-cyan-950/95 text-cyan-100',
    success: 'border-emerald-500/40 bg-emerald-950/95 text-emerald-100',
    error: 'border-rose-500/50 bg-rose-950/95 text-rose-100',
  }[toast.kind];
  const Icon = toast.kind === 'error' ? AlertCircle : toast.kind === 'success' ? CheckCircle2 : Info;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-32 z-[65] flex justify-center px-3">
      <div
        role={toast.kind === 'error' ? 'alert' : 'status'}
        className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur-md animate-fade-in ${styles}`}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="leading-relaxed">{toast.message}</span>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss();
            }}
            className="shrink-0 rounded-md bg-white/15 px-2 py-0.5 font-bold hover:bg-white/25"
          >
            {toast.action.label}
          </button>
        )}
        <button onClick={onDismiss} aria-label="Fermer le message" className="ml-1 shrink-0 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
