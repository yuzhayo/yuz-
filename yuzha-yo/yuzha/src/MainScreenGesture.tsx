import React from "react";

export type MainScreenGestureOptions = {
  holdMs?: number;
  moveTolerancePx?: number;
};

export type MainScreenGesture = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  bindTargetProps: () => React.HTMLAttributes<HTMLElement>;
};

type PressState = {
  active: boolean;
  id: number | null;
  startX: number;
  startY: number;
  startedAt: number;
  timer: number | null;
  consumed: boolean;
};

export function useMainScreenGesture(opts?: MainScreenGestureOptions): MainScreenGesture {
  const holdMs = Math.max(120, Math.floor(opts?.holdMs ?? 450));
  const tol = Math.max(2, Math.floor(opts?.moveTolerancePx ?? 8));

  const [open, setOpen] = React.useState(false);
  const toggle = React.useCallback(() => setOpen((v) => !v), []);

  const pressRef = React.useRef<PressState>({
    active: false,
    id: null,
    startX: 0,
    startY: 0,
    startedAt: 0,
    timer: null,
    consumed: false,
  });

  const clearTimer = React.useCallback(() => {
    const p = pressRef.current;
    if (p.timer !== null) {
      window.clearTimeout(p.timer);
      p.timer = null;
    }
  }, []);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!e.isPrimary) return;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

      const p = pressRef.current;
      p.active = true;
      p.id = e.pointerId;
      p.startX = e.clientX;
      p.startY = e.clientY;
      p.startedAt = performance.now();
      p.consumed = false;

      clearTimer();
      p.timer = window.setTimeout(() => {
        if (p.active && !p.consumed) {
          p.consumed = true;
          toggle();
        }
      }, holdMs);
    },
    [clearTimer, holdMs, toggle],
  );

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const p = pressRef.current;
      if (!p.active || p.id !== e.pointerId) return;
      const dx = e.clientX - p.startX;
      const dy = e.clientY - p.startY;
      if (dx * dx + dy * dy > tol * tol) {
        p.active = false;
        p.id = null;
        p.consumed = false;
        clearTimer();
      }
    },
    [clearTimer, tol],
  );

  const endPress = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const p = pressRef.current;
      if (!p.active || (p.id !== null && p.id !== e.pointerId)) return;
      p.active = false;
      p.id = null;
      clearTimer();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
    },
    [clearTimer],
  );

  const bindTargetProps = React.useCallback((): React.HTMLAttributes<HTMLElement> => {
    return {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPress,
      onPointerCancel: endPress,
    };
  }, [onPointerDown, onPointerMove, endPress]);

  React.useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return { open, setOpen, toggle, bindTargetProps };
}

export type MainScreenGestureAreaProps = {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode | ((ctx: { open: boolean; toggle: () => void }) => React.ReactNode);
  options?: MainScreenGestureOptions;
  onOpenChange?: (open: boolean) => void;
};

export function MainScreenGestureArea(props: MainScreenGestureAreaProps) {
  const g = useMainScreenGesture(props.options);
  React.useEffect(() => {
    props.onOpenChange?.(g.open);
  }, [g.open, props]);

  const content =
    typeof props.children === "function"
      ? props.children({ open: g.open, toggle: g.toggle })
      : props.children;

  return (
    <div
      {...g.bindTargetProps()}
      className={props.className ?? "main-screen-overlay"}
      style={props.style}
    >
      {content}
    </div>
  );
}