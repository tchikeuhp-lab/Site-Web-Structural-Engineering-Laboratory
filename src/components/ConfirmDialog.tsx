import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style destructif (rouge) pour les suppressions */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

/** Remplace window.confirm : dialogue accessible, cohérent avec l'interface, utilisable hors-ligne. */
export const useConfirm = (): ConfirmFn => useContext(ConfirmContext);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [request, setRequest] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setRequest({ options, resolve })),
    []
  );

  const close = useCallback(
    (result: boolean) => {
      request?.resolve(result);
      setRequest(null);
    },
    [request]
  );

  useEffect(() => {
    if (!request) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, close]);

  const o = request?.options;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {o && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={o.message ? 'confirm-message' : undefined}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl animate-fade-in"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  o.danger ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-sm font-bold text-white">
                  {o.title}
                </h2>
                {o.message && (
                  <p id="confirm-message" className="mt-1 text-xs leading-relaxed text-slate-400">
                    {o.message}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                ref={cancelRef}
                onClick={() => close(false)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                {o.cancelLabel ?? 'Annuler'}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white ${
                  o.danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {o.confirmLabel ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
