import React from 'react'

export type LogicApiTesterProps = {
  visible: boolean
}

export default function LogicApiTester(props: LogicApiTesterProps) {
  if (!props.visible) return null

  return (
    <div className="fixed top-9 right-16 z-[9998] rounded border border-white/10 bg-black/70 px-3 py-2 text-[11px] text-white/80 shadow-sm">
      Supabase API tester dinonaktifkan. Gunakan data lokal untuk verifikasi.
    </div>
  )
}