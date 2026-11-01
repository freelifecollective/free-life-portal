import Link from "next/link";

/** Where affiliates choose when their leads can book a coaching call with them. */
export function OpenHoursCard() {
  return (
    <section className="card-s" style={{ maxWidth: 860, marginBottom: 16 }}>
      <h2 className="qh" style={{ marginTop: 0 }}>My Availability</h2>
      <p className="when" style={{ margin: "0 0 12px" }}>Choose when leads can book a coaching call with you.</p>
      <Link className="btn small primary" href="/settings/availability" style={{ textDecoration: "none" }}>Set my availability</Link>
    </section>
  );
}
