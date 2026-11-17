export default function LlamaMark({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path
        d="M12.5 14V6.8M20 14V6.8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M9.6 22.4c0-6.2 4.6-10.8 10.4-10.8s10.4 4.6 10.4 10.8v4.9c0 5.5-4.1 9.7-9.3 9.7h-2.2c-5.2 0-9.3-4.2-9.3-9.7z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle cx="15.8" cy="22" r="1.9" fill="currentColor" />
      <circle cx="24.2" cy="22" r="1.9" fill="currentColor" />
      <path
        d="M18.4 28.4c1 1 2.2 1 3.2 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}