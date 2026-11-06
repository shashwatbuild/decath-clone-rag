"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * On laptop/desktop screens the app renders inside an iPhone-style device (bezel, Dynamic Island,
 * status bar, home indicator) with its own scrolling screen. On real phones (< 640px wide) the
 * frame pieces are hidden by CSS and the app is full-screen as usual. See .stage/.phone in globals.css.
 */
export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // The phone screen is its own scroll container, so start each new page at the top.
  useEffect(() => {
    screenRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="stage">
      <div className="phone">
        <span className="phone-btn phone-btn-action" />
        <span className="phone-btn phone-btn-vol-up" />
        <span className="phone-btn phone-btn-vol-down" />
        <span className="phone-btn phone-btn-power" />
        <div className="phone-screen">
          <StatusBar />
          {/* viewport pins position:fixed children (bars, sheets, chat button); the inner layer scrolls */}
          <div className="phone-viewport">
            <div ref={screenRef} className="phone-scroll">
              {children}
            </div>
          </div>
          <div className="home-indicator" />
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?[ap]m/i, ""));
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="status-bar" aria-hidden>
      <span className="status-time">{time}</span>
      <span className="dynamic-island" />
      <span className="status-icons">
        {/* signal */}
        <svg width="18" height="12" viewBox="0 0 18 12">
          <rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" />
          <rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" />
          <rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" opacity="0.35" />
        </svg>
        {/* wifi */}
        <svg width="16" height="12" viewBox="0 0 16 12">
          <path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 008 .6 10.4 10.4 0 00.8 3.5L2 4.8a8.6 8.6 0 016-2.4z" fill="currentColor" />
          <path d="M8 5.9c1.4 0 2.6.5 3.6 1.4l1.2-1.3A7 7 0 008 4.1 7 7 0 003.2 6l1.2 1.3c1-.9 2.2-1.4 3.6-1.4z" fill="currentColor" />
          <path d="M8 9.3c.5 0 1 .2 1.3.5L8 11.2 6.7 9.8c.3-.3.8-.5 1.3-.5z" fill="currentColor" />
        </svg>
        {/* battery */}
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" opacity="0.4" fill="none" />
          <rect x="2" y="2" width="17" height="9" rx="2" fill="currentColor" />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="currentColor" opacity="0.45" />
        </svg>
      </span>
    </div>
  );
}
