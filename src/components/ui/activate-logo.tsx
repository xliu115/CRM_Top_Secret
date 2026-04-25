export function ActivateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Right wing */}
      <path
        d="M48.7 0.5 L46.7 2.5 L45.6 4.5 L44.6 6.5 L44.1 8.5 L43.6 10.5 L42.6 12.5 L42.1 14.5 L41.5 16.5 L41.5 18.5 L41 20.5 L41 22.5 L40.5 24.5 L40.5 26.5 L40.5 28.5 L40.5 30.5 L41 32.5 L41 34.5 L41.5 36.5 L41.5 38.5 L42.1 40.5 L43.1 42.5 L43.6 44.5 L44.1 46.5 L45.1 48.5 L45.6 50.5 L46.7 52.5 L48.2 54.5 L49.2 56.5 L50.3 58.5 L51.8 60.5 L53.3 62.5 L55.4 64.5 L57.4 66.5 L59.5 68.5 L61.5 70.5 L64.6 72.5 L67.7 74.5 L71.3 76.5 L75.9 78.5 L81.5 80.5 L93.3 82.5 L95.4 82.5 L98.5 80.5 L99 78.5 L98.5 76.5 L97.4 74.5 L96.4 72.5 L95.4 70.5 L93.8 68.5 L92.8 66.5 L91.3 64.5 L90.3 62.5 L89.2 60.5 L88.2 58.5 L86.7 56.5 L85.6 54.5 L84.6 52.5 L83.1 50.5 L82.1 48.5 L80.5 46.5 L79.5 44.5 L78.5 42.5 L77.4 40.5 L75.9 38.5 L74.9 36.5 L73.3 34.5 L72.3 32.5 L71.3 30.5 L69.7 28.5 L68.7 26.5 L67.7 24.5 L66.7 22.5 L65.1 20.5 L64.1 18.5 L62.6 16.5 L61.5 14.5 L60.5 12.5 L59 10.5 L57.9 8.5 L56.4 6.5 L55.4 4.5 L54.4 2.5 L52.3 0.5Z"
        fill="currentColor"
      />
      {/* Left wing */}
      <path
        d="M32.3 23.5 L31.3 25.5 L30.3 27.5 L28.7 29.5 L27.7 31.5 L26.7 33.5 L25.6 35.5 L24.1 37.5 L23.1 39.5 L21.5 41.5 L20.5 43.5 L19.5 45.5 L17.9 47.5 L16.9 49.5 L15.9 51.5 L14.4 53.5 L13.3 55.5 L12.3 57.5 L10.8 59.5 L9.7 61.5 L8.7 63.5 L7.2 65.5 L6.2 67.5 L5.1 69.5 L3.6 71.5 L2.6 73.5 L1.5 75.5 L0.5 77.5 L0.5 79.5 L2.1 81.5 L4.1 82.5 L5.6 82.5 L11.3 81.5 L17.4 79.5 L21.5 77.5 L25.1 75.5 L27.7 73.5 L30.3 71.5 L31.8 69.5 L33.8 67.5 L35.4 65.5 L36.9 63.5 L37.9 61.5 L39 59.5 L39.5 57.5 L38.5 55.5 L37.9 53.5 L36.9 51.5 L36.4 49.5 L35.4 47.5 L34.9 45.5 L34.4 43.5 L33.8 41.5 L33.3 39.5 L32.8 37.5 L32.8 35.5 L32.3 33.5 L32.3 31.5 L32.3 29.5 L32.3 27.5 L32.3 25.5Z"
        fill="currentColor"
      />
      {/* Four-pointed star */}
      <path
        d="M46.2 63.5 L45.6 65.5 L44.6 67.5 L44.1 69.5 L43.1 71.5 L41.5 73.5 L40 75.5 L37.4 77.5 L32.8 79.5 L29.2 81.5 L35.4 83.5 L38.5 85.5 L41 87.5 L42.6 89.5 L43.6 91.5 L44.6 93.5 L45.1 95.5 L45.6 97.5 L46.2 98.5 L46.2 97.5 L46.7 95.5 L47.7 93.5 L48.2 91.5 L49.2 89.5 L51.3 87.5 L53.3 85.5 L56.9 83.5 L62.6 81.5 L59 79.5 L54.9 77.5 L51.8 75.5 L50.3 73.5 L48.7 71.5 L47.7 69.5 L47.2 67.5 L46.7 65.5 L46.2 63.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ActivateLogo({
  size = "md",
  tone = "brand",
}: {
  size?: "sm" | "md" | "lg";
  // "brand" = the default blue chip (desktop / login).
  // "dark" = black chip used by the mobile shell so blue is reserved for actions.
  tone?: "brand" | "dark";
}) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-20 w-20",
  };
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-10 w-10",
  };
  const roundedClasses = {
    sm: "rounded-md",
    md: "rounded-lg",
    lg: "rounded-2xl",
  };
  const toneClasses = {
    brand: "bg-[#2251FF] text-white",
    dark: "bg-black text-white",
  };

  return (
    <div
      className={`flex items-center justify-center ${toneClasses[tone]} ${sizeClasses[size]} ${roundedClasses[size]}`}
    >
      <ActivateIcon className={iconSizes[size]} />
    </div>
  );
}
