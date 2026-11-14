import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const HeartIcon = (p: P) => (
  <Icon {...p}><path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10z" /></Icon>
);
export const RecordIcon = (p: P) => (
  <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h4" /></Icon>
);
export const WatchIcon = (p: P) => (
  <Icon {...p}><rect x="6" y="6" width="12" height="12" rx="3" /><path d="M9 6V3h6v3M9 18v3h6v-3" /><path d="M9 12h1.5l1-2 1.5 4 1-2H15" /></Icon>
);
export const CheckIcon = (p: P) => (
  <Icon strokeWidth={2.5} {...p}><path d="M20 6 9 17l-5-5" /></Icon>
);
export const LockIcon = (p: P) => (
  <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Icon>
);
export const AnonIcon = (p: P) => (
  <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /><path d="M3 3l18 18" /></Icon>
);
export const TrashIcon = (p: P) => (
  <Icon {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Icon>
);
export const ChatIcon = (p: P) => (
  <Icon {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Icon>
);
export const HomeIcon = (p: P) => (
  <Icon {...p}><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Icon>
);
export const LinkIcon = (p: P) => (
  <Icon {...p}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></Icon>
);
export const BackIcon = (p: P) => (
  <Icon {...p}><path d="M15 18l-6-6 6-6" /></Icon>
);
export const SendIcon = (p: P) => (
  <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
);
export const WarningIcon = (p: P) => (
  <Icon {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></Icon>
);
export const PhoneIcon = (p: P) => (
  <Icon {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></Icon>
);
export const InfoIcon = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></Icon>
);
export const CloseIcon = (p: P) => (
  <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>
);
export const CubeIcon = (p: P) => (
  <Icon {...p}><path d="m21 16-9 5-9-5V8l9-5 9 5z" /><path d="m3.3 7.5 8.7 5 8.7-5M12 22V12.5" /></Icon>
);
export const UploadIcon = (p: P) => (
  <Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" /></Icon>
);
export const FileIcon = (p: P) => (
  <Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Icon>
);
export const ChevronIcon = (p: P) => (
  <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
);
