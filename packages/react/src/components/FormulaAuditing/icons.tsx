import React from "react";

/**
 * Icons of the Formulas group: 24px outline drawings in `currentColor`
 * (theme aware), drawn inline so the feature needs no sprite entries.
 */
const shapes: Record<string, React.ReactNode> = {
  tracePrecedents: (
    <>
      <rect x="3" y="4" width="6" height="5" rx="1" />
      <rect x="15" y="15" width="6" height="5" rx="1" />
      <path d="M8 9l6.2 6.2" />
      <path d="M14.8 11.8v3.9h-3.9" />
    </>
  ),
  traceDependents: (
    <>
      <rect x="3" y="15" width="6" height="5" rx="1" />
      <rect x="15" y="4" width="6" height="5" rx="1" />
      <path d="M8 15l6.2-6.2" />
      <path d="M10.9 8.3h3.9v3.9" />
    </>
  ),
  removeArrows: (
    <>
      <path d="M4 18L14 8" />
      <path d="M10 8h4v4" />
      <path d="M15 15l5 5M20 15l-5 5" />
    </>
  ),
  showFormulas: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8.5 9.5c-.5-1.2-2.5-1-2.5.5v5c0 1.5-2 1.7-2.5.5" />
      <path d="M4.5 12h3.5" />
      <path d="M11 11l4 4M15 11l-4 4" />
      <path d="M17 15.5h3" />
    </>
  ),
  errorChecking: (
    <>
      <path d="M12 3l9 16H3z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="16.5" r=".6" />
    </>
  ),
  evaluateFormula: (
    <>
      <path d="M13 5c-.8-1.8-4-1.5-4 .8v11.8c0 2.3-3 2.6-4 .8" />
      <path d="M6 10h6" />
      <path d="M15 12h6M15 16h6" />
    </>
  ),
  watchWindow: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
      <circle cx="9" cy="14" r="2.2" />
      <circle cx="15" cy="14" r="2.2" />
      <path d="M11.2 14h1.6" />
    </>
  ),
  calculation: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <rect x="8" y="6" width="8" height="3" rx=".5" />
      <path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01" />
    </>
  ),
  sheet: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18M3 14h18M9 4v16M15 4v16" />
    </>
  ),
};

type Props = { name: string; size?: number };

const AuditIcon: React.FC<Props> = ({ name, size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {shapes[name]}
  </svg>
);

export default AuditIcon;
