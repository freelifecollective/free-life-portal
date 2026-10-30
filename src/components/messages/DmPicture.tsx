/** A picture or GIF inside a message. Plain img on purpose: the files are already small and live in our own storage or on Giphy. */
export function DmPicture({ src, onLoad }: { src: string; onLoad?: () => void }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="dm-pic" src={src} alt="Picture" loading="lazy" onLoad={onLoad} />;
}
