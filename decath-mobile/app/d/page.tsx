"use client";

/**
 * The desktop version as its own page: the full website, always in its desktop layout.
 * The site switches to its desktop layout at 1100px or wider, so in a smaller window it is drawn at that
 * width and scaled down to fit. Widen the window and it fills the space at full size.
 * Real phones (under 640px wide) are sent to the app, which is already the mobile version there.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CANVAS = 1100;

export default function DesktopVersion() {
  const router = useRouter();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const on = () => {
      if (window.innerWidth < 640) { router.replace("/"); return; }
      setSize({ w: window.innerWidth, h: window.innerHeight });
    };
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [router]);

  if (!size) return null;
  const scale = Math.min(1, size.w / CANVAS);

  return (
    // overflow: clip (unlike hidden) can't be scrolled by code either, so nothing inside can shift the page
    <div className="full-bleed fixed inset-0 z-50 overflow-clip bg-white">
      <iframe allow="camera"
        src="/"
        title="Decathlon website, desktop version"
        className="absolute left-0 top-0 block border-0 bg-white origin-top-left"
        style={{ width: scale < 1 ? CANVAS : "100%", height: size.h / scale, transform: scale < 1 ? `scale(${scale})` : undefined }}
      />
    </div>
  );
}
