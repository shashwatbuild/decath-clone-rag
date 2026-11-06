type P = { className?: string; filled?: boolean };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const IconBack = ({ className = "w-6 h-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M15 4l-8 8 8 8" /></svg>
);
export const IconSearch = ({ className = "w-6 h-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><circle cx="10.5" cy="10.5" r="7" /><path d="M16 16l5 5" /></svg>
);
export const IconHeart = ({ className = "w-6 h-6", filled }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.5 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
  </svg>
);
export const IconCart = ({ className = "w-6 h-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M2 3.5h2.6l2.3 11.2a1.5 1.5 0 001.5 1.2h9.3a1.5 1.5 0 001.5-1.1L21.5 7H6" /><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" />
  </svg>
);
export const IconBasketPlus = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M3 10h18l-2 10H5L3 10z" /><path d="M8 10l4-6 4 6" /><path d="M17 3v4M15 5h4" />
  </svg>
);
export const IconPin = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" /></svg>
);
export const IconChevronDown = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2.2}><path d="M5 9l7 7 7-7" /></svg>
);
export const IconChevronRight = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M9 5l7 7-7 7" /></svg>
);
export const IconPlus = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2}><path d="M12 4v16M4 12h16" /></svg>
);
export const IconClose = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconShare = ({ className = "w-6 h-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
  </svg>
);
export const IconUsers = ({ className = "w-7 h-7" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <circle cx="8" cy="7" r="3" /><circle cx="16.5" cy="7.5" r="2.5" /><path d="M2.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6M14 14.3c.8-.4 1.6-.6 2.5-.6 2.8 0 5 2.2 5 5.8" />
  </svg>
);
export const IconSort = ({ className = "w-7 h-7" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4" /></svg>
);
export const IconFilter = ({ className = "w-7 h-7" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M3 6h18M3 12h18M3 18h18" /><rect x="6" y="4" width="4" height="4" fill="white" /><rect x="14" y="10" width="4" height="4" fill="white" /><rect x="8" y="16" width="4" height="4" fill="white" />
  </svg>
);
export const IconTruck = ({ className = "w-7 h-7" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M2 6h12v10H2zM14 9h4l3 3.5V16h-7" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>
);
export const IconStore = ({ className = "w-7 h-7" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M3 9h18v11H3zM6 9V5h12v4M3 13h18M9 20v-4h6v4" /></svg>
);
export const IconHome = ({ className = "w-7 h-7" }: P) => (
  <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M12 3L2 11h3v9h5v-6h4v6h5v-9h3z" /></svg>
);
export const IconClip = ({ className = "w-7 h-7" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}><path d="M20 11.5l-8.2 8.2a5 5 0 01-7.1-7.1l8.5-8.5a3.4 3.4 0 014.8 4.8l-8.4 8.4a1.7 1.7 0 01-2.4-2.4l7.7-7.7" /></svg>
);
export const IconSend = ({ className = "w-6 h-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className}><path fill="currentColor" d="M3 20.5l18-8.5L3 3.5l.1 6.6L15 12 3.1 13.9z" /></svg>
);
export const IconTag = ({ className = "w-6 h-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 7l1.3 1.4 1.9-.2.2 1.9L17 12l-1.6 1.1-.2 1.9-1.9-.2L12 17l-1.3-1.4-1.9.2-.2-1.9L7 12l1.6-1.1.2-1.9 1.9.2zM10 14l4-4" />
  </svg>
);
export const IconShield = ({ className = "w-10 h-10" }: P) => (
  <svg viewBox="0 0 40 40" className={className}>
    <path d="M20 3l4 3 5-.5 1.5 4.7 4.5 2.3-1 4.9 2 4.6-3.6 3.4-.4 5-5 1-3 4-4.6-2-4.6 2-3-4-5-1-.4-5L2.5 22l2-4.6-1-4.9L8 10.2 9.5 5.5l5 .5z" fill="none" stroke="#101010" strokeWidth="1.8" />
    <circle cx="20" cy="21" r="8" fill="#FFD43B" /><path d="M16.5 21l2.5 2.5 4.5-5" stroke="#101010" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </svg>
);
export const IconReturn = ({ className = "w-10 h-10" }: P) => (
  <svg viewBox="0 0 40 40" className={className}>
    <path d="M7 4h16l5 5v10M7 4v28h10" fill="none" stroke="#101010" strokeWidth="1.8" /><path d="M11 12h10M11 17h8" stroke="#101010" strokeWidth="1.8" />
    <circle cx="27" cy="27" r="10" fill="#FFD43B" /><path d="M32 27H22m4-4l-4 4 4 4" stroke="#101010" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </svg>
);
export const IconExchange = ({ className = "w-10 h-10" }: P) => (
  <svg viewBox="0 0 40 40" className={className}>
    <path d="M7 4h16l5 5v10M7 4v28h10" fill="none" stroke="#101010" strokeWidth="1.8" /><path d="M11 12h10M11 17h8" stroke="#101010" strokeWidth="1.8" />
    <circle cx="27" cy="27" r="10" fill="#FFD43B" /><path d="M22 25h10l-3-3M32 29H22l3 3" stroke="#101010" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  </svg>
);
export const LogoMark = ({ className = "w-9 h-9" }: P) => (
  <svg viewBox="0 0 48 48" className={className}>
    <circle cx="24" cy="24" r="24" fill="#3643BA" />
    <path d="M14 33c0-9 8-18 17-18 4 0 5 3 3 7-3 6-10 11-15 11h-3l6-11" stroke="white" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconBell = ({ className = "w-6 h-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base}>
    <path d="M6 16.5V11a6 6 0 0112 0v5.5l1.6 1.8H4.4L6 16.5z" /><path d="M10 21h4" />
  </svg>
);

/** Decathlon swoosh mark, from the official logo (public/decathlon-logo.svg). Colour follows currentColor. */
export const DecathlonMark = ({ className = "w-6 h-6" }: P) => (
  <svg viewBox="0 0 34.5 28" className={className} aria-hidden>
    <path fill="currentColor" d="M25.2111 0C14.2668 0 0.653107 11.3236 0.653107 20.7085C0.653107 25.5554 4.37614 28 9.29335 28C12.904 28 17.2733 26.6794 21.488 24.1365V5.40893C20.3641 7.33366 15.0816 15.0888 10.8388 19.2193C8.67519 21.3266 6.96119 22.2398 5.48603 22.2398C3.82822 22.2398 3.04147 21.1159 3.04147 19.4441C3.04147 11.8575 15.8122 1.99498 24.2698 1.99498C27.754 1.99498 30.0018 3.54039 30.0018 6.54692C30.0018 9.30055 28.1333 12.7566 24.9441 15.9458V21.7481C30.5076 17.3507 33.8373 11.7451 33.8373 7.22127C33.8373 2.4586 30.1283 0 25.2111 0Z" />
  </svg>
);
