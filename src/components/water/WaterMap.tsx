"use client";

import { openDockChat } from "@/components/messages/MessageDock";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ExpressionSpecification, LayerSpecification, Map as GLMap, Marker, Popup, SourceSpecification } from "maplibre-gl";
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
 * An interactive world map: drag, zoom, tap a dot. It is a modern vector map (country shapes that ship with the portal, with street detail from OpenFreeMap on top) whose country names
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
      /* The map's base is drawn from country shapes that ship with the portal, so it always appears (no outside map server has to answer).
         Street-level pictures are laid on top when they load, and the country names are written in the member's own language. */
      const [{ feature }, atlas, iso] = await Promise.all([import("topojson-client"), import("world-atlas/countries-110m.json"), import("i18n-iso-countries")]);
      if (cancelled || !box.current) return;
      const topo = (atlas.default ?? atlas) as unknown as Parameters<typeof feature>[0];
      const land = feature(topo, (topo as unknown as { objects: { countries: Parameters<typeof feature>[1] } }).objects.countries) as unknown as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { name?: string }>;
      const m = new ml.Map({
        container: box.current, center: [5, 25], zoom: 1.6, minZoom: 1.2, maxZoom: 18, attributionControl: { compact: true },
        style: {
          version: 8,
          glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
          sources: { land: { type: "geojson", data: `${location.origin}/world-countries.geojson` } },
          layers: [
            { id: "sea", type: "background", paint: { "background-color": "#cfe3ee" } },
            { id: "land", type: "fill", source: "land", paint: { "fill-color": "#f3efe6" } },
            { id: "borders", type: "line", source: "land", paint: { "line-color": "#b9ae9c", "line-width": 0.8 } },
          ],
        },
      });
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      /* TEMPORARY: show what the map reports, so a missing-land problem can be seen from a screenshot */
      const diag = document.createElement("pre");
      diag.style.cssText = "position:absolute;left:8px;bottom:8px;max-width:70%;max-height:40%;overflow:auto;margin:0;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.92);font:11px/1.3 monospace;z-index:5;white-space:pre-wrap";
      diag.setAttribute("translate", "no");
      box.current.appendChild(diag);
      const say = (t: string) => { if (diag.textContent!.length < 1500) diag.textContent += t + "\n"; };
      say("v: maplibre " + ml.version);
      m.on("error", (e) => say("error: " + String((e as unknown as { error?: { message?: string } }).error?.message ?? e).slice(0, 200)));
      m.on("load", () => say("loaded; layers=" + m.getStyle().layers.length));
      m.on("idle", () => { try { say("idle; land features drawn=" + m.queryRenderedFeatures({ layers: ["land"] }).length + "; zoom=" + m.getZoom().toFixed(1)); } catch (e) { say("idle query failed " + e); } });
      /* Street-level detail (water, roads, towns) from OpenFreeMap is added on top when it answers. If it does not, the map above still works. */
      m.once("load", () => {
        void (async () => {
          try {
            const res = await fetch("https://tiles.openfreemap.org/styles/liberty");
            if (!res.ok || cancelled) return;
            const st = (await res.json()) as { sources: Record<string, SourceSpecification>; layers: LayerSpecification[] };
            for (const [id, src] of Object.entries(st.sources)) { if (!m.getSource(id)) m.addSource(id, src); }
            const field = ["coalesce", ["get", `name:${lang}`], ["get", `name_${lang}`], ["get", "name:latin"], ["get", "name"]] as ExpressionSpecification;
            for (const l of st.layers) {
              if (l.type === "symbol") {
                /* only town and city names (country names are drawn above); nothing that needs the map's own icon sheet */
                if (!/^label_(city|town|village|other)/.test(l.id) || l.layout?.["icon-image"]) continue;
                l.layout = { ...l.layout, "text-field": field };
              }
              /* the open map's own land, water and roads sit on top of the bundled country map (which stays underneath as a backup) */
              try { m.addLayer(l, l.type === "background" ? "land" : undefined); } catch { /* skip a layer this map cannot draw */ }
            }
          } catch { /* no street detail; the country map stays */ }
        })();
      });
      /* country names in the member's language, put on the map as plain text so they never depend on a font server */
      const names = (() => { try { return new Intl.DisplayNames([lang], { type: "region" }); } catch { return null; } })();
      const labels: { el: HTMLElement; lng: number; lat: number; area: number }[] = [];
      for (const f of land.features) {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        let best: number[][] | null = null, bestArea = 0;
        for (const poly of polys) {
          const ring = poly[0]; let area = 0;
          for (let i = 0; i < ring.length - 1; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
          if (Math.abs(area) > bestArea) { bestArea = Math.abs(area); best = ring; }
        }
        if (!best || bestArea < 6) continue; /* skip the tiny ones */
        let cx = 0, cy = 0, a2 = 0;
        for (let i = 0; i < best.length - 1; i++) { const k = best[i][0] * best[i + 1][1] - best[i + 1][0] * best[i][1]; a2 += k; cx += (best[i][0] + best[i + 1][0]) * k; cy += (best[i][1] + best[i + 1][1]) * k; }
        if (!a2) continue;
        const code = f.id !== undefined ? iso.default.numericToAlpha2(String(f.id)) : undefined;
        let text = f.properties?.name ?? "";
        if (code && names) { try { text = names.of(code) ?? text; } catch { /* keep the English name */ } }
        if (!text) continue;
        const el = document.createElement("div");
        el.className = "ws-country"; el.textContent = text; el.setAttribute("translate", "no");
        const lng = cx / (3 * a2), lat = cy / (3 * a2);
        new ml.Marker({ element: el }).setLngLat([lng, lat]).addTo(m);
        labels.push({ el, lng, lat, area: bestArea });
      }
      labels.sort((x, y) => y.area - x.area);
      /* the biggest countries get their names first; a name that would sit on top of one already shown is left out until you zoom in */
      const showNames = () => {
        const hide = m.getZoom() >= 6;
        box.current?.classList.toggle("ws-no-names", hide);
        if (hide) return;
        const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
        for (const l of labels) {
          const pt = m.project([l.lng, l.lat]);
          const w = l.el.offsetWidth || 70, h = l.el.offsetHeight || 14;
          const r = { x0: pt.x - w / 2 - 3, y0: pt.y - h / 2 - 2, x1: pt.x + w / 2 + 3, y1: pt.y + h / 2 + 2 };
          const clash = taken.some((t) => r.x0 < t.x1 && r.x1 > t.x0 && r.y0 < t.y1 && r.y1 > t.y0);
          l.el.style.visibility = clash ? "hidden" : "visible";
          if (!clash) taken.push(r);
        }
      };
      m.on("zoomend", showNames); m.on("resize", showNames); m.once("load", showNames); showNames();
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
