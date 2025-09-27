import React from "react";

export type MainScreenApiTesterProps = {
  visible: boolean;
};

export default function MainScreenApiTester(props: MainScreenApiTesterProps) {
  if (!props.visible) return null;
  return (
    <div className="main-screen-api-tester">
      Supabase API tester dinonaktifkan. Gunakan data lokal untuk verifikasi.
    </div>
  );
}