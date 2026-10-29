"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Map as LMap, Marker, CircleMarker } from "leaflet";
import { Avatar } from "@/components/Avatar";
import { searchPlace } from "@/app/(app)/water-map/actions";
import { formatDistance, nearest } from "@/lib/water/geo";
import { pinName, WATER_LABEL, type Place, type WaterPin } from "@/lib/water/types";

type Search = (q: string) => Promise<{ ok: true; place: Place } | { ok: false; error: string }>;
type Found = { place: Place; list: (WaterPin & { km: number })[] };

/** An interactive world map (OpenStreetMap, like Google Maps): drag, zoom, tap a dot. The search box finds the closest affiliates to any town. */
export function WaterMap({ pins, myId, search = searchPlace }: { pins: WaterPin[]; myId: string | null; search?: Search }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const markers = useRef(new Map<string, CircleMarker>());
  const target = useRef<Marker | CircleMarker | null>(null);
  const lib = useRef<typeof import("leaflet") | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [pending, run] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default as unknown as typeof import("leaflet");
      if (cancelled || !box.current) return;
      lib.current = L;
      const m = L.map(box.current, { worldCopyJump: true, minZoom: 2, zoomControl: true }).setView([25, 0], 2);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(m);
      for (const p of pins) {
        const mine = p.member_id === myId;
        const c = L.circleMarker([p.lat, p.lng], { radius: mine ? 10 : 8, color: "#fff", weight: 2, fillColor: mine ? "#e5251b" : "#1e78b4", fillOpacity: 0.95 }).addTo(m);
        c.bindPopup(popupFor(p, mine));
        markers.current.set(p.member_id, c);
      }
      map.current = m;
    })();
    const ms = markers.current;
    return () => { cancelled = true; map.current?.remove(); map.current = null; ms.clear(); };
  }, [pins, myId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    run(async () => {
      setError("");
      const r = await search(q);
      const m = map.current, L = lib.current;
      if (!r.ok) { setError(r.error); return; }
      const list = nearest(pins, r.place, 8);
      setFound({ place: r.place, list });
      if (!m || !L) return;
      target.current?.remove();
      target.current = L.circleMarker([r.place.lat, r.place.lng], { radius: 9, color: "#2b2522", weight: 3, fillColor: "#fff", fillOpacity: 1 }).addTo(m).bindTooltip(r.place.label);
      const pts: [number, number][] = [[r.place.lat, r.place.lng], ...list.slice(0, 3).map((p) => [p.lat, p.lng] as [number, number])];
      if (list.length) m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 9 }); else m.setView([r.place.lat, r.place.lng], 8);
    });
  }

  function show(p: WaterPin) {
    const c = markers.current.get(p.member_id);
    map.current?.flyTo([p.lat, p.lng], Math.max(map.current.getZoom(), 8));
    c?.openPopup();
  }

  return (
    <div className="ws-wrap">
      <form className="ws-search" onSubmit={submit} role="search">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a town or city, e.g. Brisbane, Australia" aria-label="Search a town or city" />
        <button type="submit" className="btn primary" disabled={pending}>{pending ? "Searching…" : "Find Closest Water Share"}</button>
      </form>
      {error ? <p className="err" role="alert">{error}</p> : null}
      <div className="ws-grid">
        <div ref={box} className="ws-map" role="application" aria-label="World map of Water Share members" />
        {found ? (
          <aside className="ws-results" aria-label="Closest affiliates">
            <h2 className="qh" style={{ margin: "0 0 4px", fontSize: 18 }}>Closest to {found.place.label}</h2>
            {found.list.length === 0 ? <p className="when">Nobody is on the map yet.</p> : (
              <ol>
                {found.list.map((p) => (
                  <li key={p.member_id}>
                    <button type="button" onClick={() => show(p)}>
                      <Avatar url={p.avatar_url} initials={initialsOf(p)} size={40} label={pinName(p)} />
                      <span className="ws-res-text">
                        <strong>{pinName(p)}{p.member_id === myId ? " (you)" : ""}</strong>
                        <span>{formatDistance(p.km)} away</span>
                        <span className="when">{p.place} · {WATER_LABEL[p.water_type]} · {p.prefilter ? "Prefilter" : "No prefilter"}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        ) : null}
      </div>
      <p className="when">{pins.length} {pins.length === 1 ? "affiliate is" : "affiliates are"} on the map. Drag to look around the world, pinch or scroll to zoom, and tap a dot to see who it is.</p>
    </div>
  );
}

/** Built from plain elements, never HTML strings, so a name can never inject markup. */
function popupFor(p: WaterPin, mine: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = "ws-pop";
  const head = document.createElement("div");
  head.className = "ws-pop-head";
  const size = "56px";
  if (p.avatar_url) {
    const img = document.createElement("img");
    img.className = "avatar";
    img.src = p.avatar_url;
    img.alt = "";
    img.width = img.height = 56;
    img.style.width = img.style.height = size;
    head.appendChild(img);
  } else {
    const dot = document.createElement("span");
    dot.className = "avatar";
    dot.textContent = initialsOf(p);
    dot.style.width = dot.style.height = size;
    dot.style.fontSize = "21px";
    head.appendChild(dot);
  }
  const text = document.createElement("div");
  text.className = "ws-pop-text";
  head.appendChild(text);
  el.appendChild(head);
  const add = (tag: string, line: string, cls?: string, into: HTMLElement = el) => { const n = document.createElement(tag); n.textContent = line; if (cls) n.className = cls; into.appendChild(n); };
  add("strong", pinName(p) + (mine ? " (you)" : ""), undefined, text);
  if (p.username) add("span", "@" + p.username, "when", text);
  add("span", p.place);
  if (p.rank) add("span", "Rank: " + p.rank);
  add("span", p.prefilter ? "Has a prefilter" : "No prefilter");
  add("span", WATER_LABEL[p.water_type]);
  return el;
}

function initialsOf(p: WaterPin): string {
  return ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";
}
