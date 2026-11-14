import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 19c0-8 5-13 14-14 1 9-5 14-14 14Z" />
      <path d="M5 19c2-5 5-8 10-10" />
    </Base>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </Base>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m7 14 4-4 3 2 4-5" />
    </Base>
  );
}

export function WifiIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 9a13 13 0 0 1 17 0" />
      <path d="M6.5 12.5a8.5 8.5 0 0 1 11 0" />
      <path d="M9.5 16a4 4 0 0 1 5 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 6.3" />
      <path d="M20 5v6h-6" />
    </Base>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5c3.2 3.6 6 6.6 6 10a6 6 0 0 1-12 0c0-3.4 2.8-6.4 6-10Z" />
    </Base>
  );
}

export function ThermometerIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" />
      <path d="M12 9v6" />
    </Base>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.2A3.5 3.5 0 0 0 7 18Z" />
    </Base>
  );
}

export function RainIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 15h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 8.4 3.4 3.4 0 0 0 7 15Z" />
      <path d="M8 18.5v1.5M12 18v2M16 18.5v1.5" />
    </Base>
  );
}

export function ValveIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="m12 8.5 1.8 3.5H10.2L12 8.5Z" />
    </Base>
  );
}

export function GaugeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 17a8 8 0 1 1 14 0" />
      <path d="m12 14 3.5-4" />
      <circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function ModeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 8h11a4 4 0 1 1 0 8H9" />
      <path d="m7 5-3 3 3 3" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Base>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4.5 21 20H3L12 4.5Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.2" r="0.8" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.8" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </Base>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Base>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 20V5" />
      <path d="m6 11 6-6 6 6" />
    </Base>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Base>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
    </Base>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6 15 6-6 6 6" />
    </Base>
  );
}

export function SaveIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 4h11l3 3v13H5V4Z" />
      <path d="M8 4v5h7V4" />
      <path d="M8 20v-6h8v6" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m4 20 4.5-1 9.8-9.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" />
      <path d="m13.8 7.7 3 3" />
    </Base>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M5 16v3.5h14V16" />
    </Base>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.5h6v2" />
      <path d="m6.5 6.5.8 13h9.4l.8-13" />
      <path d="M10 10.5v5.5M14 10.5v5.5" />
    </Base>
  );
}
