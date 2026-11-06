"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { IconBack, IconBell, IconCart, IconChevronDown, IconClose, IconHeart, IconPin, IconSearch, DecathlonMark } from "./Icons";

export function TopBar({ title, back = true, logo = false }: { title?: string; back?: boolean; logo?: boolean }) {
  const router = useRouter();
  const { cartCount, wishlist } = useStore();
  return (
    <header className="sticky top-0 z-30 bg-white">
      <div className="flex items-center h-14 px-3 gap-2">
        {back && (
          <button aria-label="Back" onClick={() => router.back()} className="p-1.5 -ml-1">
            <IconBack className="w-7 h-7" />
          </button>
        )}
        {logo && (
          <Link href="/" aria-label="Decathlon home" className="flex items-center pl-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/decathlon-logo.svg" alt="DECATHLON" width={188} height={28} className="h-[27px] w-auto" />
          </Link>
        )}
        {title && <h1 className="text-[19px] font-semibold truncate pl-1">{title}</h1>}
        <div className={`ml-auto flex items-center pr-1 ${logo ? "gap-5" : "gap-4"}`}>
          {logo ? (
            <Link href="/notifications" aria-label="Notifications"><IconBell className="w-[26px] h-[26px]" /></Link>
          ) : (
            <Link href="/search" aria-label="Search"><IconSearch className="w-[26px] h-[26px]" /></Link>
          )}
          <Link href="/wishlist" aria-label="Wishlist" className="relative">
            <IconHeart className="w-[26px] h-[26px]" />
            {wishlist.length > 0 && <Badge n={wishlist.length} outline={logo} />}
          </Link>
          <Link href="/cart" aria-label="Cart" className="relative">
            <IconCart className="w-[26px] h-[26px]" />
            {cartCount > 0 && <Badge n={cartCount} outline={logo} />}
          </Link>
        </div>
      </div>
      <DeliveryBar />
    </header>
  );
}

const Badge = ({ n, outline = false }: { n: number; outline?: boolean }) =>
  outline ? (
    // Home header style: white bubble with a dark outline
    <span className="absolute -top-3 -right-2.5 min-w-[22px] h-[22px] px-1 rounded-full bg-white border-[1.5px] border-ink text-ink text-[13px] grid place-items-center">
      {n}
    </span>
  ) : (
    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px] font-semibold grid place-items-center ring-2 ring-white">
      {n}
    </span>
  );

export function DeliveryBar() {
  const { pincode, setPincode, showToast } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(pincode);
  return (
    <>
      <button onClick={() => { setDraft(pincode); setOpen(true); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 border-b border-line text-left">
        <span className="w-7 h-7 rounded-md border border-line grid place-items-center text-brand"><IconPin className="w-4 h-4" /></span>
        <span className="text-[14px] truncate">Delivery to <b className="font-semibold">{pincode}, Pune, Maharashtra</b></span>
        <IconChevronDown className="w-5 h-5 ml-auto shrink-0" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Enter delivery pincode">
        <input value={draft} onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric"
          className="w-full border border-line rounded-lg px-4 py-3 text-base outline-none focus:border-brand" placeholder="6-digit pincode" />
        <button disabled={draft.length !== 6}
          onClick={() => { setPincode(draft); setOpen(false); showToast("Delivery pincode updated"); }}
          className="mt-4 w-full bg-brand disabled:opacity-40 text-white rounded-full py-3 font-semibold">Apply</button>
      </BottomSheet>
    </>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-[1px]" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} viewBox="0 0 24 24" width={size} height={size}>
            <defs>
              <linearGradient id={`g${i}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="#FF9340" />
                <stop offset={`${fill * 100}%`} stopColor="#C9C9C9" />
              </linearGradient>
            </defs>
            <path fill={`url(#g${i}-${Math.round(fill * 100)})`} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );
      })}
    </span>
  );
}

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-white rounded-t-2xl p-5 pb-8 transition-transform duration-300 max-h-[calc(var(--app-h)*0.85)] overflow-y-auto ${open ? "translate-y-0" : "translate-y-full"}`}>
        <div className="flex items-center mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="ml-auto p-1" aria-label="Close"><IconClose /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast() {
  const { toast } = useStore();
  return (
    <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[60] transition-all ${toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"}`}>
      <div className="bg-ink text-white text-sm px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap">{toast}</div>
    </div>
  );
}

export function ChatFab({ bottom = "bottom-28", context }: { bottom?: string; context?: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className={`fixed ${bottom} z-40 right-3 min-[441px]:max-[639px]:right-[calc(50vw-208px)]`}>
      <button onClick={() => setHidden(true)} aria-label="Hide assistant"
        className="absolute -top-2 -left-3 w-7 h-7 rounded-full bg-gray-300/90 grid place-items-center z-10">
        <IconClose className="w-4 h-4 text-gray-700" />
      </button>
      <Link href={context ? `/chat?product=${context}` : "/chat"} aria-label="Open chat assistant"
        className="block w-[68px] h-[68px] rounded-full bg-brand shadow-xl grid place-items-center">
        <DecathlonMark className="w-[38px] h-[31px] text-white" />
      </Link>
    </div>
  );
}

export function SectionTitle({ children, href }: { children: React.ReactNode; href?: string }) {
  return (
    <div className="flex items-end px-4 pt-6 pb-3">
      <h2 className="text-[21px] font-semibold tracking-tight">{children}</h2>
      {href && <Link href={href} className="ml-auto text-brand text-sm font-semibold">View all</Link>}
    </div>
  );
}
