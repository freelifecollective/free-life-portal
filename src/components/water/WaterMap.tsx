"use client";

import { openDockChat } from "@/components/messages/MessageDock";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Map as GLMap, Marker, Popup } from "maplibre-gl";
import { currentLang } from "@/lib/language";
import { Avatar } from "@/components/Avatar";
import { ProfileCard, type MemberPerson } from "@/components/chats/ProfileCard";
import { createClient } from "@/lib/supabase/client";
import { searchPlace } from "@/app/(app)/water-map/actions";
import { formatDistance, nearest } from "@/lib/water/geo";
import { pinName, WATER_LABEL, type Place, type WaterPin } from "@/lib/water/types";

type Search = (q: string) => Promise<{ ok: true; place: Place } | { ok: false; error: string }>;
type Found = { place: Place; list: (WaterPin & { km: number })[] };

/**
 * An interactive world map: drag, zoom, tap a dot. It is a modern vector map (OpenFreeMap, built on OpenStreetMap) whose place names
 * are shown in the language the member picked. The search box finds the closest affiliates to any town.
 */
export function WaterMap({ pins, myId, search = searchPlace }: { pins: WaterPin[]; myId: string | null; search?: Search }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<GLMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; popup: Popup }>());
  const target = useRef<Marker | null>(null);
  const profileDlg = useRef<HTMLDialogElement>(null);
  const [person, setPerson] = useState<MemberPerson | null>(null);
  const openRef = useRef<(id: string) => void>(() => {});
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [pending, run] = useTransition();

  /* clicking the picture or name in a dot's popup opens that person's profile, the same one as in Chats */
  async function showProfile(id: string) {
    const { data } = await createClient().rpc("speaker_profile", { p_id: id });
    const r = ((data ?? []) as ({ found: boolean } & MemberPerson)[])[0];
    if (!r?.found) return;
    markers.current.forEach((m) => m.popup.remove());
    setPerson(r);
    profileDlg.current?.showModal();
  }
  useEffect(() => { openRef.current = (id) => { void showProfile(id); }; });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      lib.current = ml;
      const lang = currentLang();
      const m = new ml.Map({ container: box.current, style: "https://tiles.openfreemap.org/styles/liberty", center: [5, 25], zoom: 1.6, minZoom: 1.2, maxZoom: 18, attributionControl: { compact: true } });
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      /* every place name on the map is written in the member's language (falling back to the local name where there is no translation) */
      /* done once, when the map's style has loaded (doing it on every style change made the map keep redrawing itself, and no names ever appeared) */
      m.once("load", () => {
        const done = new Set<string>();
        let layers: ReturnType<typeof m.getStyle>["layers"] = [];
        try { layers = m.getStyle().layers ?? []; } catch { return; }
        for (const layer of layers) {
          if (layer.type !== "symbol" || done.has(layer.id)) continue;
          done.add(layer.id);
          const field = layer.layout?.["text-field"];
          if (field === undefined || !JSON.stringify(field).includes("name")) continue;
          try { m.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", `name:${lang}`], ["get", "name:latin"], ["get", "name"]]); } catch { /* keep the map's own names for this layer */ }
        }
      });
      for (const p of pins) {
        const mine = p.member_id === myId;
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "ws-dot" + (mine ? " mine" : "");
        dot.setAttribute("aria-label", pinName(p));
        const popup = new ml.Popup({ offset: 16, maxWidth: "300px", closeButton: true }).setDOMContent(popupFor(p, mine, (id) => openRef.current(id)));
        const marker = new ml.Marker({ element: dot }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(m);
        /* clicking a dot zooms in to where that person is */
        dot.addEventListener("click", () => m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 12), duration: 800 }));
        markers.current.set(p.member_id, { marker, popup });
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
      const ring = document.createElement("div");
      ring.className = "ws-target";
      target.current = new L.Marker({ element: ring }).setLngLat([r.place.lng, r.place.lat]).setPopup(new L.Popup({ offset: 14, closeButton: false }).setText(r.place.label)).addTo(m);
      target.current.togglePopup();
      if (list.length) {
        const bounds = new L.LngLatBounds([r.place.lng, r.place.lat], [r.place.lng, r.place.lat]);
        for (const p of list.slice(0, 3)) bounds.extend([p.lng, p.lat]);
        m.fitBounds(bounds, { padding: 60, maxZoom: 9 });
      } else m.flyTo({ center: [r.place.lng, r.place.lat], zoom: 8 });
    });
  }

  function show(p: WaterPin) {
    const c = markers.current.get(p.member_id);
    map.current?.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.current.getZoom(), 8) });
    if (c && !c.popup.isOpen()) c.marker.togglePopup();
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
      <dialog ref={profileDlg} className="rs-dialog members-dialog" aria-label="Profile" onClose={() => setPerson(null)}
        onClick={(e) => { if (e.target === profileDlg.current) profileDlg.current?.close(); }}>
        {person ? <ProfileCard p={person} canMessage onClose={() => profileDlg.current?.close()} /> : null}
      </dialog>
    </div>
  );
}

/** Built from plain elements, never HTML strings, so a name can never inject markup. */
function popupFor(p: WaterPin, mine: boolean, onOpen: (id: string) => void): HTMLElement {
  const el = document.createElement("div");
  el.className = "ws-pop";
  const head = document.createElement("button");
  head.type = "button";
  head.className = "ws-pop-head ws-pop-open";
  head.title = "See their profile";
  head.addEventListener("click", () => onOpen(p.member_id));
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
  if (!mine) {
    const msg = document.createElement("button");
    msg.type = "button";
    msg.className = "btn small primary ws-pop-msg";
    msg.textContent = "Message";
    msg.addEventListener("click", () => openDockChat(p.member_id));
    el.appendChild(msg);
  }
  return el;
}

function initialsOf(p: WaterPin): string {
  return ((p.first_name ?? "").charAt(0) + (p.last_name ?? "").charAt(0)).toUpperCase() || "?";
}
