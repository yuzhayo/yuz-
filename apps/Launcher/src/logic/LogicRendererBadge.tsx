import React from 'react'

export type LogicRendererBadgeProps = {
  visible: boolean
  label: string
}

export default function LogicRendererBadge(props: LogicRendererBadgeProps) {
  if (!props.visible) return null
  return (
    <div
      className="pointer-events-none select-none fixed top-3 right-3 z-[9998] text-[10px] px-2 py-0.5 rounded bg-black/60 border border-white/10 text-white/80"
      aria-live="polite"
    >
      {props.label}
    </div>
  )
}
