import React from 'react';

interface AquaSpillLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  badgeText?: string;
  subtitle?: string;
}

export const AquaSpillLogoIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 28,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 drop-shadow-sm ${className}`}
    >
      <defs>
        {/* Outer Oceanic Droplet Gradient */}
        <linearGradient id="aquaDropletGrad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>

        {/* Inner Oil Slick Detection Glow */}
        <linearGradient id="oilSlickCoreGrad" x1="14" y1="18" x2="34" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="60%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Radar Arc Stroke Gradient */}
        <linearGradient id="radarArcGrad" x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Droplet Base Contour */}
      <path
        d="M24 4C24 4 10 19.5 10 30C10 37.732 16.268 44 24 44C31.732 44 38 37.732 38 30C38 19.5 24 4 24 4Z"
        fill="url(#aquaDropletGrad)"
      />

      {/* Internal Hydrodynamic Wave Flow */}
      <path
        d="M13 28C16.5 25.5 20.5 25.5 24 28C27.5 30.5 31.5 30.5 35 28C36.8 30.5 37.8 33.5 37.3 36.5C35.2 41 30 43.5 24 43.5C18 43.5 12.8 41 10.7 36.5C10.2 33.5 11.2 30.5 13 28Z"
        fill="#0C4A6E"
        fillOpacity="0.4"
      />

      {/* Radar / Satellite Sensing Sweep Arcs */}
      <circle
        cx="24"
        cy="29"
        r="11"
        stroke="url(#radarArcGrad)"
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
      <circle
        cx="24"
        cy="29"
        r="6.5"
        stroke="#E0F2FE"
        strokeWidth="1.2"
        strokeOpacity="0.85"
      />

      {/* Core Spill Focal Point / Detection Target */}
      <circle
        cx="24"
        cy="29"
        r="3.2"
        fill="url(#oilSlickCoreGrad)"
        stroke="#FEF3C7"
        strokeWidth="1"
      />

      {/* Satellite Crosshairs */}
      <line x1="24" y1="19" x2="24" y2="23" stroke="#BAE6FD" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="24" y1="35" x2="24" y2="39" stroke="#BAE6FD" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="14" y1="29" x2="18" y2="29" stroke="#BAE6FD" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="30" y1="29" x2="34" y2="29" stroke="#BAE6FD" strokeWidth="1.2" strokeLinecap="round" />

      {/* Top Droplet Specular Reflection Highlight */}
      <ellipse cx="20" cy="14" rx="2.5" ry="5" transform="rotate(-25 20 14)" fill="#FFFFFF" fillOpacity="0.45" />
    </svg>
  );
};

export const AquaSpillLogo: React.FC<AquaSpillLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  badgeText = 'v2.4',
  subtitle = 'MARITIME INTELLIGENCE & FORENSICS',
}) => {
  const iconPixelSize = {
    sm: 22,
    md: 28,
    lg: 38,
    xl: 52,
  }[size];

  const titleTextSize = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-3xl',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex items-center justify-center">
        <AquaSpillLogoIcon size={iconPixelSize} />
      </div>

      {showText && (
        <div className="flex flex-col justify-center select-none">
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`${titleTextSize} font-extrabold tracking-tight text-white uppercase font-sans flex items-center`}>
              Aqua <span className="text-cyan-400 ml-1">Spill</span>
            </span>
            {badgeText && (
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-700/60 shadow-inner">
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && (
            <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase mt-0.5 font-medium">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
