import React from 'react';

interface ClubLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export const ClubLogo: React.FC<ClubLogoProps> = ({ className, style }) => {
  return (
    <svg
      viewBox="0 0 1200 800"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label="Badminton Club Logo"
    >
      {/* White background */}
      <rect width="1200" height="800" fill="#FFFFFF" rx="40" />

      {/* =========================
           MOTION TRAILS
           ========================= */}
      <path
        d="M170 430
           C300 285, 455 230, 620 220
           C450 265, 315 340, 185 455
           C170 468, 150 450, 170 430Z"
        fill="#1478F2"
      />

      <path
        d="M235 455
           C355 335, 465 285, 575 265
           C455 305, 355 370, 250 475
           C235 489, 220 470, 235 455Z"
        fill="#1478F2"
      />

      {/* =========================
           SHUTTLECOCK
           ========================= */}

      {/* Feather 1 */}
      <path
        d="M625 285
           L680 85
           L735 45
           L735 115
           L660 300Z"
        fill="#082A55"
      />

      {/* Feather 2 */}
      <path
        d="M665 305
           L755 115
           L835 130
           L790 195
           L700 325Z"
        fill="#082A55"
      />

      {/* Feather 3 */}
      <path
        d="M710 330
           L820 200
           L890 235
           L840 285
           L735 350Z"
        fill="#082A55"
      />

      {/* Feather 4 */}
      <path
        d="M745 360
           L875 290
           L920 345
           L840 370
           L760 380Z"
        fill="#082A55"
      />

      {/* Blue shuttle band */}
      <path
        d="M605 320
           Q650 300 700 345
           Q730 375 720 410
           L685 430
           Q675 390 635 360
           Q615 345 590 345Z"
        fill="#1478F2"
      />

      {/* White separator */}
      <path
        d="M585 350
           Q640 355 685 425"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="10"
      />

      {/* Cork / shuttle head */}
      <path
        d="M585 350
           Q635 365 680 430
           Q650 495 590 485
           Q530 475 525 425
           Q520 380 585 350Z"
        fill="#082A55"
      />

      {/* =========================
           BRAND NAME
           ========================= */}
      <text
        x="600"
        y="620"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="118"
        fontWeight="800"
        letterSpacing="-6"
      >
        <tspan fill="#082A55">Shuttler</tspan>
        <tspan fill="#1478F2">Club</tspan>
      </text>

      {/* =========================
           TAGLINE
           ========================= */}
      <text
        x="600"
        y="690"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="27"
        fontWeight="400"
        letterSpacing="10"
        fill="#082A55"
      >
        PLAY
        <tspan fill="#1478F2" fontSize="32" letterSpacing="5">
          {' • '}
        </tspan>
        CONNECT
        <tspan fill="#1478F2" fontSize="32" letterSpacing="5">
          {' • '}
        </tspan>
        BELONG
      </text>
    </svg>
  );
};

export { WhiteBackgroundLogo } from './WhiteBackgroundLogo';
export default ClubLogo;

