import { facebookUrl, instagramUrl } from "@/lib/landing/types";

/** Small round buttons that open the member's profiles in a new tab. */
export function SocialButtons({ instagram, facebook }: { instagram: string | null; facebook: string | null }) {
  if (!instagram && !facebook) return null;
  return (
    <ul className="social" aria-label="Social profiles">
      {instagram ? (
        <li><a href={instagramUrl(instagram)} target="_blank" rel="noopener noreferrer" aria-label={`Instagram: @${instagram}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" /></svg>
        </a></li>
      ) : null}
      {facebook ? (
        <li><a href={facebookUrl(facebook)} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.8v3h2.7V21h3z" /></svg>
        </a></li>
      ) : null}
    </ul>
  );
}
