"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/icon";

type Tone = "default" | "success" | "warning";

type Toast = {
  id: number;
  message: string;
  icon: string;
  tone: Tone;
};

type ToastApi = {
  notify: (message: string, options?: { icon?: string; tone?: Tone }) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const toneStyles: Record<Tone, string> = {
  default: "bg-inverse-surface text-inverse-on-surface",
  success: "bg-primary text-on-primary",
  warning: "bg-tertiary text-tertiary-fixed",
};

const toneIcon: Record<Tone, string> = {
  default: "info",
  success: "check_circle",
  warning: "warning",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback<ToastApi["notify"]>(
    (message, options) => {
      const tone = options?.tone ?? "default";
      const id = nextId.current++;
      setToasts((current) => [
        ...current.slice(-2),
        {
          id,
          message,
          icon: options?.icon ?? toneIcon[tone],
          tone,
        },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 3600),
      );
    },
    [dismiss],
  );

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`panel-shadow pointer-events-auto rounded-xl flex w-full max-w-sm items-center gap-3 px-4 py-3 shadow-lg ${toneStyles[toast.tone]}`}
          >
            <Icon name={toast.icon} className="flex-shrink-0 text-[20px]" />
            <span className="text-body-md text-body-md flex-1">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="flex-shrink-0 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    // Rendered outside a provider (e.g. a component used standalone): stay silent.
    return { notify: () => {} };
  }
  return context;
}
