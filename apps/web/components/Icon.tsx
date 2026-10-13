const P: Record<string, React.ReactNode> = {
  car: <><path d="M4 15l1.6-5.2A2 2 0 017.5 8.4h9a2 2 0 011.9 1.4L20 15v4h-2.5v-2h-11v2H4z" /><path d="M7.5 13.5h.01M16.5 13.5h.01" strokeWidth="2.6" /></>,
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="1.5" /><path d="M11 18h2" /></>,
  sofa: <><path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3" /><path d="M3 13a1.5 1.5 0 013 0v1h12v-1a1.5 1.5 0 013 0v4H3z" /><path d="M5 17v2M19 17v2" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>,
  wrench: <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 005.4-5.4l-2.4 2.4-2.6-.4-.4-2.6z" />,
  book: <><path d="M5 4h12a2 2 0 012 2v14H7a2 2 0 01-2-2z" /><path d="M5 18a2 2 0 012-2h12" /><path d="M9 8h6" /></>,
  crane: <><path d="M3 21h18" /><path d="M6 21V5l11-2" /><path d="M6 5h14" /><path d="M17 5v6" /><rect x="15" y="11" width="4" height="3" /><path d="M6 10l5-5" /></>,
  shirt: <path d="M8 3L3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 01-8 0z" />,
  stroller: <><path d="M4 4h2l2 9h10" /><path d="M13 4a6 6 0 016 6h-6z" /><circle cx="9" cy="19" r="1.7" /><circle cx="17" cy="19" r="1.7" /><path d="M8 13l1 4M18 13l-1 4" /></>,
  bike: <><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l4-7h5l3 7" /><path d="M10 9l3.5 7" /><path d="M14 6h3" /></>,
  box: <><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4" /><path d="M12 11v10" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  bell: <><path d="M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 004 0" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />,
  flag: <path d="M5 21V4h11l-1.5 4L16 12H5" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M8 5v14l11-7z" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  camera: <><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
};

export function Icon({ name, size, sw = 1.8, style }: { name: string; size?: number; sw?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", ...style }}>
      {P[name] ?? P.box}
    </svg>
  );
}
