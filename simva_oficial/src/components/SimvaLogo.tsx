import React, { SVGProps } from "react";

export function SimvaLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="simva-gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2AC1FF" />
          <stop offset="100%" stopColor="#54FFB5" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Gear outer shape */}
      <path
        fill="url(#simva-gradient)"
        filter="url(#glow)"
        d="M50 0C48.1 0 46.5 1.5 46.5 3.4V9.6C41 10.7 35.8 12.8 31.1 15.9L26.7 11.5C25.4 10.2 23.3 10.2 22 11.5L11.5 22C10.2 23.3 10.2 25.4 11.5 26.7L15.9 31.1C12.8 35.8 10.7 41 9.6 46.5H3.4C1.5 46.5 0 48.1 0 50C0 51.9 1.5 53.5 3.4 53.5H9.6C10.7 59 12.8 64.2 15.9 68.9L11.5 73.3C10.2 74.6 10.2 76.7 11.5 78L22 88.5C23.3 89.8 25.4 89.8 26.7 88.5L31.1 84.1C35.8 87.2 41 89.3 46.5 90.4V96.6C46.5 98.5 48.1 100 50 100C51.9 100 53.5 98.5 53.5 96.6V90.4C59 89.3 64.2 87.2 68.9 84.1L73.3 88.5C74.6 89.8 76.7 89.8 78 88.5L88.5 78C89.8 76.7 89.8 74.6 88.5 73.3L84.1 68.9C87.2 64.2 89.3 59 90.4 53.5H96.6C98.5 53.5 100 51.9 100 50C100 48.1 98.5 46.5 96.6 46.5H90.4C89.3 41 87.2 35.8 84.1 31.1L88.5 26.7C89.8 25.4 89.8 23.3 88.5 22L78 11.5C76.7 10.2 74.6 10.2 73.3 11.5L68.9 15.9C64.2 12.8 59 10.7 53.5 9.6V3.4C53.5 1.5 51.9 0 50 0ZM50 22C65.5 22 78 34.5 78 50C78 65.5 65.5 78 50 78C34.5 78 22 65.5 22 50C22 34.5 34.5 22 50 22Z"
      />
      
      {/* Inner Stylized S / Checkmark */}
      <path
        stroke="url(#simva-gradient)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M38 52L47 61L65 42"
        filter="url(#glow)"
      />
      
      {/* Circle separation for the 'S' feel */}
      <path
        stroke="url(#simva-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
        d="M60 30C68 35 72 45 72 50C72 62 62 72 50 72C38 72 28 62 28 50C28 45 32 35 40 30"
      />
    </svg>
  );
}
