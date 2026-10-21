import type { ReactNode } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// Sitedeki simgelerin aynısı (apps/web/components/Icon.tsx).
const P: Record<string, ReactNode> = {
  car: <><Path d="M4 15l1.6-5.2A2 2 0 017.5 8.4h9a2 2 0 011.9 1.4L20 15v4h-2.5v-2h-11v2H4z" /><Path d="M7.5 13.5h.01M16.5 13.5h.01" strokeWidth="2.6" /></>,
  home: <><Path d="M3 11l9-7 9 7" /><Path d="M5 10v10h14V10" /><Path d="M10 20v-6h4v6" /></>,
  phone: <><Rect x="7" y="3" width="10" height="18" rx="1.5" /><Path d="M11 18h2" /></>,
  sofa: <><Path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3" /><Path d="M3 13a1.5 1.5 0 013 0v1h12v-1a1.5 1.5 0 013 0v4H3z" /><Path d="M5 17v2M19 17v2" /></>,
  gear: <><Circle cx="12" cy="12" r="3" /><Path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>,
  wrench: <Path d="M14.7 6.3a4 4 0 00-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 005.4-5.4l-2.4 2.4-2.6-.4-.4-2.6z" />,
  book: <><Path d="M5 4h12a2 2 0 012 2v14H7a2 2 0 01-2-2z" /><Path d="M5 18a2 2 0 012-2h12" /><Path d="M9 8h6" /></>,
  crane: <><Path d="M3 21h18" /><Path d="M6 21V5l11-2" /><Path d="M6 5h14" /><Path d="M17 5v6" /><Rect x="15" y="11" width="4" height="3" /><Path d="M6 10l5-5" /></>,
  shirt: <Path d="M8 3L3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 01-8 0z" />,
  stroller: <><Path d="M4 4h2l2 9h10" /><Path d="M13 4a6 6 0 016 6h-6z" /><Circle cx="9" cy="19" r="1.7" /><Circle cx="17" cy="19" r="1.7" /><Path d="M8 13l1 4M18 13l-1 4" /></>,
  bike: <><Circle cx="6" cy="16" r="3.5" /><Circle cx="18" cy="16" r="3.5" /><Path d="M6 16l4-7h5l3 7" /><Path d="M10 9l3.5 7" /><Path d="M14 6h3" /></>,
  box: <><Path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><Path d="M3 7l9 4 9-4" /><Path d="M12 11v10" /></>,
  lock: <><Rect x="5" y="11" width="14" height="10" rx="2" /><Path d="M8 11V8a4 4 0 018 0v3" /></>,
  shield: <><Path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" /><Path d="M8.8 12.2l2.2 2.2 4.2-4.4" /></>,
  check: <Path d="M5 12.5l4.2 4.2L19 7" />,
  bell: <><Path d="M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><Path d="M10 20a2 2 0 004 0" /></>,
  heart: <Path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />,
  flag: <Path d="M5 21V4h11l-1.5 4L16 12H5" />,
  search: <><Circle cx="11" cy="11" r="7" /><Path d="M20 20l-3.5-3.5" /></>,
  plus: <Path d="M12 5v14M5 12h14" />,
  play: <Path d="M8 5v14l11-7z" />,
  bolt: <Path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" />,
  chat: <Path d="M4 5h16v11H9l-5 4z" />,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4 21a8 8 0 0116 0" /></>,
  list: <Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  camera: <><Path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><Circle cx="12" cy="13" r="3.5" /></>,
  pin: <><Path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" /><Circle cx="12" cy="9.5" r="2.5" /></>,
  calendar: <><Rect x="4" y="5" width="16" height="16" rx="2" /><Path d="M4 10h16M9 3v4M15 3v4" /></>,
  tag: <><Path d="M3 12V4h8l10 10-8 8z" /><Circle cx="7.5" cy="8.5" r="1.3" /></>,
  share: <><Circle cx="6" cy="12" r="2.5" /><Circle cx="18" cy="6" r="2.5" /><Circle cx="18" cy="18" r="2.5" /><Path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" /></>,
  clock: <><Circle cx="12" cy="12" r="9" /><Path d="M12 7v5l3 2" /></>,
  wallet: <><Path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H4z" /><Path d="M4 7V6a2 2 0 012-2h10" /><Path d="M16 13.5h.01" strokeWidth="2.6" /></>,
  mail: <><Rect x="3" y="5" width="18" height="14" rx="2" /><Path d="M3.5 6.5L12 13l8.5-6.5" /></>,
  chevl: <Path d="M15 5l-7 7 7 7" />,
  x: <Path d="M6 6l12 12M18 6L6 18" />,
  chevr: <Path d="M9 5l7 7-7 7" />,
};
export type IconName = keyof typeof P;
export function Icon({ name, size = 22, color = "#13235B", sw = 1.8, fill = "none" }: { name: string; size?: number; color?: string; sw?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {P[name] ?? P.box}
    </Svg>
  );
}
