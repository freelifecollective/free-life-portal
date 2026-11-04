/* eslint-disable @next/next/no-img-element */
import { TESTIMONIALS_TALL, TESTIMONIALS_WIDE } from "./testimonials";

function Track({ urls, className }: { urls: string[]; className: string }) {
  /* the list is shown twice so the slide loops without a jump */
  const all = [...urls, ...urls];
  return (
    <div className={`lpn-mq ${className}`}>
      <div className="lpn-mq-track">
        {all.map((u, i) => <div className="lpn-card" key={i}><img src={u} alt="Testimonial screenshot" loading="lazy" /></div>)}
      </div>
    </div>
  );
}

/** The testimonials sliding across; hovering pauses them. Wide cards for computers and tablets, tall cards for phones. */
export function Marquee() {
  return (
    <>
      <Track urls={TESTIMONIALS_WIDE} className="lpn-mq-wide" />
      <Track urls={TESTIMONIALS_TALL} className="lpn-mq-tall" />
    </>
  );
}
