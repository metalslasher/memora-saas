"use client";

import { useId } from "react";

export function LogoMark({
  className = "size-8",
  title,
}: {
  className?: string;
  title?: string;
}) {
  // Unique id: a gradient defined inside a hidden copy would break the others.
  const gradientId = useId();

  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={`shrink-0 ${className}`}
      role={title ? "img" : undefined}
      viewBox="0 0 32 32"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#6cf0d6" />
          <stop offset="1" stopColor="#9b8cff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <path
        d="M9 22.5V11.9c0-.9 1.1-1.4 1.8-.7L16 16.7l5.2-5.5c.7-.7 1.8-.2 1.8.7v10.6"
        fill="none"
        stroke="#03120f"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.7"
      />
      <circle cx="16" cy="8.3" r="1.8" fill="#03120f" />
    </svg>
  );
}

export function Wordmark({
  className = "",
  markClassName = "size-8",
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      <span className="text-[17px] font-semibold tracking-tight text-text">
        Memora
      </span>
    </span>
  );
}
