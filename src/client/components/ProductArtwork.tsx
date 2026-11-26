import React from 'react';

interface ProductArtworkProps {
  theme: string;
  className?: string;
}

export const ProductArtwork: React.FC<ProductArtworkProps> = ({ theme, className = 'w-full h-full' }) => {
  switch (theme) {
    case 'speaker':
      return (
        <svg viewBox="0 0 320 260" className={className} fill="none" aria-hidden="true">
          <rect width="320" height="260" fill="currentColor" fillOpacity="0.03" />
          <rect x="86" y="34" width="148" height="192" rx="16" stroke="currentColor" strokeWidth="2.5" fill="var(--surface-card)" />
          <rect x="98" y="46" width="124" height="168" rx="10" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" />
          <circle cx="160" cy="96" r="22" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="160" cy="96" r="8" fill="var(--brand-accent)" fillOpacity="0.85" />
          <circle cx="160" cy="164" r="38" stroke="currentColor" strokeWidth="2.4" />
          <circle cx="160" cy="164" r="24" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
          <circle cx="160" cy="164" r="10" fill="var(--brand-primary)" />
          <line x1="128" y1="226" x2="192" y2="226" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'lamp':
      return (
        <svg viewBox="0 0 320 260" className={className} fill="none" aria-hidden="true">
          <rect width="320" height="260" fill="currentColor" fillOpacity="0.03" />
          <ellipse cx="160" cy="212" rx="56" ry="12" fill="var(--brand-accent)" fillOpacity="0.22" stroke="currentColor" strokeWidth="2.2" />
          <path d="M132 208 L142 96 L214 70" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M190 58 L244 82 L222 104 L180 84 Z" fill="var(--brand-accent)" fillOpacity="0.78" stroke="currentColor" strokeWidth="2.2" />
          <path d="M188 94 L164 156 L244 156 L224 102" fill="var(--brand-accent)" fillOpacity="0.12" />
          <circle cx="142" cy="96" r="6" fill="var(--brand-primary)" />
        </svg>
      );
    case 'fragrance':
      return (
        <svg viewBox="0 0 320 260" className={className} fill="none" aria-hidden="true">
          <rect width="320" height="260" fill="currentColor" fillOpacity="0.03" />
          <rect x="136" y="42" width="48" height="30" rx="4" fill="var(--brand-primary)" stroke="currentColor" strokeWidth="2" />
          <rect x="148" y="72" width="24" height="14" stroke="currentColor" strokeWidth="2" />
          <rect x="108" y="86" width="104" height="132" rx="14" fill="var(--brand-accent)" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.4" />
          <rect x="124" y="114" width="72" height="72" rx="4" fill="var(--surface-card)" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
          <line x1="138" y1="138" x2="182" y2="138" stroke="currentColor" strokeWidth="2" />
          <line x1="146" y1="152" x2="174" y2="152" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />
          <circle cx="160" cy="170" r="4" fill="var(--brand-accent)" />
        </svg>
      );
    case 'leather':
      return (
        <svg viewBox="0 0 320 260" className={className} fill="none" aria-hidden="true">
          <rect width="320" height="260" fill="currentColor" fillOpacity="0.03" />
          <rect x="66" y="64" width="188" height="136" rx="12" fill="var(--brand-accent)" fillOpacity="0.22" stroke="currentColor" strokeWidth="2.4" />
          <path d="M66 96 L160 138 L254 96" stroke="currentColor" strokeWidth="2.2" fill="var(--brand-accent)" fillOpacity="0.14" />
          <rect x="76" y="74" width="168" height="116" rx="8" stroke="currentColor" strokeOpacity="0.28" strokeDasharray="5 4" strokeWidth="1.5" />
          <circle cx="160" cy="138" r="8" fill="var(--brand-primary)" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'tray':
      return (
        <svg viewBox="0 0 320 260" className={className} fill="none" aria-hidden="true">
          <rect width="320" height="260" fill="currentColor" fillOpacity="0.03" />
          <path d="M56 146 L94 98 L258 98 L220 146 Z" fill="var(--brand-accent)" fillOpacity="0.24" stroke="currentColor" strokeWidth="2.4" />
          <path d="M56 146 L56 168 L220 168 L258 120 L258 98" stroke="currentColor" strokeWidth="2.2" />
          <line x1="220" y1="146" x2="220" y2="168" stroke="currentColor" strokeWidth="2.2" />
          <rect x="108" y="108" width="66" height="28" rx="4" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
          <circle cx="204" cy="122" r="11" stroke="var(--brand-primary)" strokeWidth="2" />
        </svg>
      );
    case 'kettle':
    default:
      return (
        <svg viewBox="0 0 320 260" className={className} fill="none" aria-hidden="true">
          <rect width="320" height="260" fill="currentColor" fillOpacity="0.03" />
          <path d="M112 204 L126 98 L194 98 L208 204 Z" fill="var(--brand-primary)" fillOpacity="0.16" stroke="currentColor" strokeWidth="2.4" />
          <ellipse cx="160" cy="98" rx="34" ry="8" fill="var(--surface-card)" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="160" cy="84" r="7" fill="var(--brand-accent)" stroke="currentColor" strokeWidth="2" />
          <path d="M116 176 C84 172 86 122 64 108" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M196 114 C236 114 238 176 204 176" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <line x1="100" y1="212" x2="220" y2="212" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
  }
};

export const HeroAtelierShowcase: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg viewBox="0 0 560 440" className={className} fill="none" aria-hidden="true">
    <rect x="16" y="16" width="528" height="408" rx="20" fill="var(--surface-muted)" stroke="var(--border-hairline)" strokeWidth="1.5" />
    {/* Architectural Grid Lines */}
    <line x1="16" y1="290" x2="544" y2="290" stroke="var(--border-hairline)" strokeWidth="1.5" />
    <line x1="210" y1="16" x2="210" y2="424" stroke="var(--border-hairline)" strokeWidth="1" strokeDasharray="4 4" />
    {/* Studio Speaker Object */}
    <rect x="64" y="96" width="118" height="194" rx="12" fill="var(--surface-card)" stroke="currentColor" strokeWidth="2.2" />
    <circle cx="123" cy="146" r="16" stroke="currentColor" strokeWidth="2" />
    <circle cx="123" cy="146" r="5" fill="var(--brand-accent)" />
    <circle cx="123" cy="222" r="34" stroke="currentColor" strokeWidth="2.2" />
    <circle cx="123" cy="222" r="10" fill="var(--brand-primary)" />
    {/* Cantilever Brass Lamp */}
    <path d="M276 290 L292 128 L382 98" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="252" y="280" width="56" height="10" rx="4" fill="var(--brand-primary)" />
    <path d="M366 84 L424 110 L404 134 L356 110 Z" fill="var(--brand-accent)" fillOpacity="0.88" stroke="currentColor" strokeWidth="2" />
    {/* Botanical Extrait Bottle */}
    <rect x="444" y="162" width="56" height="128" rx="8" fill="var(--brand-accent)" fillOpacity="0.22" stroke="currentColor" strokeWidth="2.2" />
    <rect x="458" y="136" width="28" height="26" rx="3" fill="var(--brand-primary)" stroke="currentColor" strokeWidth="2" />
    <rect x="454" y="196" width="36" height="44" rx="2" fill="var(--surface-card)" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.2" />
    {/* Subtle Architectural Ledger Card inside Plinth */}
    <rect x="64" y="318" width="436" height="78" rx="10" fill="var(--surface-card)" stroke="var(--border-hairline)" strokeWidth="1.5" />
    <line x1="88" y1="344" x2="210" y2="344" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="88" y1="366" x2="170" y2="366" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
    <rect x="372" y="336" width="104" height="38" rx="8" fill="var(--brand-primary)" />
  </svg>
);
