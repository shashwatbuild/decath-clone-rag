"use client";

/**
 * The mobile version as its own page: the same app running inside a phone-sized window.
 * The window is only 390px wide, so the app shows its phone layout whatever the screen is.
 * Real phones (under 640px wide) are sent straight to the app, which is already the mobile version there.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function MobileVersion() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [time, setTime] = useState("");
  const [capture, setCapture] = useState(false);
  const [screen, setScreen] = useState("/");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const capturing = query.get("capture") === "1";
    setCapture(capturing);
    const target = query.get("screen");
    setScreen(target && ["try-on", "lab", "chat"].includes(target) ? `/${target}` : "/");
    if (!capturing && window.innerWidth < 640) { router.replace("/"); return; }
    setShow(true);
    const tick = () => setTime(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?[ap]m/i, ""));
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [router]);

  if (!show) return null;

  return (
    <div className="full-bleed fixed inset-0 z-50 overflow-auto bg-[#eef0f4] [background:radial-gradient(1200px_600px_at_20%_10%,#e6e8f8,transparent_60%),radial-gradient(900px_500px_at_85%_90%,#dfe9f3,transparent_55%),#eef0f4]">
      <div className={`min-h-full grid place-items-center relative ${capture ? "py-4" : "pt-12 pb-5"}`} style={{ minHeight: capture ? 900 : 940 }}>
        {!capture && <Link href="/d" className="absolute top-5 left-6 text-[15px] font-semibold text-brand hover:underline">← Desktop version</Link>}
        {!capture && <p className="absolute top-5 right-6 text-[13px] text-muted">Mobile version</p>}

        <div className="relative w-[414px] p-3 rounded-[62px] bg-[#121214] shadow-[0_0_0_2px_#45454a,0_0_0_5px_#1b1b1d,0_40px_90px_rgba(20,24,60,0.35),0_12px_30px_rgba(0,0,0,0.2)]"
          style={{ height: 868, flexShrink: 0 }}>
          <div className="relative h-full flex flex-col rounded-[50px] overflow-hidden bg-white" style={{ clipPath: "inset(0 round 50px)" }}>
            <div className="relative h-[50px] shrink-0 flex items-center justify-between pl-10 pr-7 pt-1.5 bg-white" aria-hidden>
              <span className="font-semibold text-[16px] min-w-[48px]">{time}</span>
              <span className="absolute top-[11px] left-1/2 -translate-x-1/2 w-[122px] h-[35px] rounded-[20px] bg-black" />
              <span className="flex items-center gap-1.5">
                <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" /><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" opacity="0.35" /></svg>
                <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" opacity="0.4" fill="none" /><rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor" /></svg>
              </span>
            </div>
            <iframe allow="camera" src={screen} title="Decathlon app, mobile version" className="flex-1 w-full border-0 block bg-white" />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[136px] h-[5px] rounded-[3px] bg-[#101010] pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
