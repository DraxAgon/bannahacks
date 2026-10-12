import type { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#000000",
};

/** The session is black and quiet. Only the image carries color. */
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-dark flex min-h-dvh flex-1 flex-col bg-bg text-ink">
      {/* Keep overscroll and the page behind the session black while it is open. */}
      <style>{`html,body{background:#000;color-scheme:dark}`}</style>
      {children}
    </div>
  );
}
