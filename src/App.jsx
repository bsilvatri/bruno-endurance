import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

/* ─── TOKENS ─── */
const SB_URL = import.meta.env.VITE_SB_URL;
const _BUILD=Date.now();const SB_KEY = import.meta.env.VITE_SB_KEY;
const MB_TOKEN = import.meta.env.VITE_MB_TOKEN;

const SBH = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const rpc = (fn, args = {}) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: SBH, body: JSON.stringify(args) }).then(r => r.json());
const q = path => fetch(`${SB_URL}/rest/v1/${path}`, { headers: SBH }).then(r => r.json());
const safe = (d, fb = []) => Array.isArray(d) ? d : fb;

/* ─── COLORS ─── */
const C = {
  bg: "#EDE8DC",
  surface: "#E5E0D4",
  card: "#DDD8CC",
  border: "#C8C2B4",
  ink: "#1A1A18",
  dim: "#3A3A36",
  muted: "#6B6860",
  faint: "#9A9488",
  green: "#4A7A5A",
  greenMid: "#5C7A45",
  greenLight: "#5C7A45",
  run: "#5C7A45",
  ride: "#C4622D",
  swim: "#2E7DA6",
  white: "#FFFFFF",
};

/* ─── FONTS ─── */
const F = {
  heading: "'Syne', sans-serif",
  body: "'Manrope', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

/* ─── POLYLINE DECODER ─── */
function decodePoly(str) {
  if (!str) return [];
  let i = 0, lat = 0, lng = 0, coords = [];
  while (i < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

/* ─── MAPBOX LOADER ─── */
let mbReady = false, mbCbs = [];
function loadMapbox(cb) {
  if (window.mapboxgl) { window.mapboxgl.accessToken = MB_TOKEN; cb(); return; }
  if (mbReady) { mbCbs.push(cb); return; }
  mbReady = true;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"; document.head.appendChild(l);
  const s = document.createElement("script"); s.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
  s.onload = () => { window.mapboxgl.accessToken = MB_TOKEN; cb(); mbCbs.forEach(f => f()); mbCbs = []; };
  document.head.appendChild(s);
}

/* ─── HOOKS ─── */
function useCountUp(target, duration = 2000) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!target || started.current) return;
    started.current = true;
    const start = performance.now();
    const tick = now => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 4);
      setVal(Math.floor(e * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}

function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const fn = () => {
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 80) cur = id;
      }
      setActive(cur);
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return [active, setActive];
}

/* ─── ACTIVITY MAP ─── */
function ActivityMap({ polyline, type, height = 300 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const color = type === "Swim" ? "#4A8FD4" : type === "Ride" || type === "VirtualRide" ? "#C06030" : "#4A7A58";

  useEffect(() => {
    if (!polyline) { setReady(true); return; }
    loadMapbox(() => {
      if (!ref.current || mapRef.current) return;
      const coords = decodePoly(polyline);
      if (!coords.length) { setReady(true); return; }
      const lngs = coords.map(c => c[0]), lats = coords.map(c => c[1]);
      const map = new window.mapboxgl.Map({
        container: ref.current,
        style: "mapbox://styles/mapbox/dark-v11",
        bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        fitBoundsOptions: { padding: 40 },
        interactive: false,
        attributionControl: false,
      });
      mapRef.current = map;
      map.on("load", () => {
        map.addSource("r", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: coords } } });
        map.addLayer({ id: "r", type: "line", source: "r", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": 3, "line-opacity": 0.95 } });
        setReady(true);
      });
    });
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [polyline]);

  return (
    <div style={{ position: "relative", height, background: "#1a1a2e", borderRadius: 4, overflow: "hidden" }}>
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontFamily: F.mono, fontSize: "0.7rem" }}>
          {polyline ? "loading..." : "no route data"}
        </div>
      )}
      {ready && <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: F.mono, fontSize: "0.55rem", color: "rgba(255,255,255,0.4)" }}>mapbox</div>}
    </div>
  );
}

/* ─── SHARED COMPONENTS ─── */
const Divider = ({ my = "2.5rem" }) => <div style={{ borderTop: `1px solid ${C.border}`, margin: `${my} 0` }} />;

const Label = ({ children, color }) => (
  <div style={{ fontFamily: F.mono, fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", color: color || C.muted, marginBottom: "0.4rem" }}>
    {children}
  </div>
);

const SectionNum = ({ n }) => (
  <div style={{ fontFamily: F.mono, fontSize: "0.6rem", color: C.muted, marginBottom: "0.5rem" }}>0{n}</div>
);

const SportTab = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    fontFamily: F.mono, fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase",
    padding: "5px 14px", border: `1px solid ${active ? color : C.border}`, borderRadius: 2,
    background: "transparent", color: active ? color : C.muted, cursor: "pointer",
    transition: "all 0.15s",
  }}>{label}</button>
);

const SubTab = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    fontFamily: F.mono, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase",
    padding: "5px 16px", border: `1px solid ${active ? C.ink : C.border}`, borderRadius: 2,
    background: active ? C.ink : "transparent", color: active ? C.white : C.muted,
    cursor: "pointer", transition: "all 0.15s",
  }}>{label}</button>
);

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "8px 12px", fontFamily: F.mono, fontSize: "0.65rem", color: C.ink }}>
      {label && <div style={{ color: C.faint, marginBottom: 4 }}>{label}</div>}
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || C.white }}>
          {p.name || p.dataKey}: <strong>{typeof p.value === "number" ? (Number.isInteger(p.value) ? p.value.toLocaleString() : p.value.toFixed(1)) : p.value}</strong>{p.unit||""}
        </div>
      ))}
    </div>
  );
};



function NotableTable({ rows, cols, selected, onSelect, sportColor }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: cols.map(c => c.w).join(" "), padding: "0.4rem 0.75rem", borderBottom: `1px solid ${C.border}` }}>
        {cols.map(c => <div key={c.k} style={{ fontFamily: F.mono, fontSize: "0.52rem", letterSpacing: "0.12em", textTransform: "uppercase", color: C.faint }}>{c.l}</div>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} onClick={() => onSelect(i)}
          style={{ display: "grid", gridTemplateColumns: cols.map(c => c.w).join(" "), padding: "0.7rem 0.75rem", borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected === i ? C.card : "transparent", transition: "background 0.12s" }}>
          {cols.map(c => (
            <div key={c.k} style={{ fontFamily: F.mono, fontSize: "0.82rem", color: c.accent ? sportColor : C.ink, fontWeight: c.bold ? 600 : 400 }}>
              {c.k === "#" ? `#${i + 1}` : r[c.k]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── NOTABLE SECTION ─── */
function NotableSection({ unitSystem="metric" }) {
  const [sport, setSport] = useState("races");
  const [tab, setTab] = useState("pbs");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [prs, setPrs] = useState([]);
  useEffect(() => {
    const ACT_MAP = {"400m":6796419022,"1/2 mile":12017370695,"1K":12017370695,"1 mile":10799004879,"2 mile":10799004879,"5K":10991460408,"10K":14300148280,"15K":14300148280,"10 mile":14300148280,"20K":14300148280,"Half-Marathon":14300148280,"30K":17985954019};
    setLoading(true);
    q("best_efforts?select=distance_label,elapsed_time,sport&sport=eq.run&order=elapsed_time.asc")
      .then(async bes => {
        if (!Array.isArray(bes)) { setLoading(false); return; }
        // Only show distances we have activity IDs for
        const relevant = bes.filter(b => ACT_MAP[b.distance_label]);
        // Fetch unique activities
        const uniqueIds = [...new Set(relevant.map(b => ACT_MAP[b.distance_label]))];
        const actMap = {};
        await Promise.all(uniqueIds.map(id =>
          q(`activities?select=id,name,start_date_local,distance,total_elevation_gain,average_heartrate,map_summary_polyline&id=eq.${id}`)
            .then(rows => { if (Array.isArray(rows) && rows.length) actMap[id] = rows[0]; })
        ));
        const result = relevant.map(b => ({
          _label: b.distance_label,
          _elapsed: b.elapsed_time,
          ...actMap[ACT_MAP[b.distance_label]],
        }));
        setPrs(result);
        setLoading(false);
      });
  }, []);
  const sportColor = sport === "run" ? C.run : sport === "ride" ? C.ride : C.swim;
  useEffect(() => {
    if (sport === "races") { setLoading(false); return; }
    setLoading(true); setSelected(0);
    let queryUrl = "";
    if (sport === "run" && tab === "pbs") { setLoading(false); return; } // pbs uses best_efforts table instead
    else if (tab === "longest") { const tf = sport==="ride"?"type=in.(Ride,VirtualRide)":sport==="swim"?"type=eq.Swim":"type=eq.Run"; queryUrl=`activities?select=id,name,start_date_local,distance,moving_time,total_elevation_gain,average_heartrate,average_speed,map_summary_polyline&${tf}&order=distance.desc&limit=10`; }
    else if (tab === "elevation") { const tf = sport==="ride"?"type=in.(Ride,VirtualRide)":"type=eq.Run"; queryUrl=`activities?select=id,name,start_date_local,distance,moving_time,total_elevation_gain,average_heartrate,average_speed,map_summary_polyline&${tf}&total_elevation_gain=gt.0&order=total_elevation_gain.desc&limit=10`; }
    if (!queryUrl) { setLoading(false); return; }
    q(queryUrl).then(data => { setRows(safe(data)); setLoading(false); }).catch(() => setLoading(false));
  }, [sport, tab]);
  useEffect(() => {
    if (sport === "races") return;
    if (sport === "ride" || sport === "swim") setTab("longest"); else setTab("pbs");
  }, [sport]);
  const cur = rows[selected];
  const fmtTime = s => { if (!s) return "—"; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return h>0?`${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`:`${m}:${String(sec).padStart(2,"0")}`; };
  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";
  const fmtPace = (t,d) => { if(!t||!d) return "—"; const s=unitSystem==="imperial"?t/(d/1609.34):t/(d/1000); return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}/${unitSystem==="imperial"?"mi":"km"}`; };
  const fmtSpeed = s => s?`${unitSystem==="imperial"?(s*2.237).toFixed(1):(s*3.6).toFixed(1)} ${unitSystem==="imperial"?"mi/h":"km/h"}`:"—";
  const fmtSwimPace = (t,d) => { if(!t||!d) return "—"; const s=unitSystem==="imperial"?t/(d/91.44):t/(d/100); return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}/${unitSystem==="imperial"?"100yd":"100m"}`; };
  const cols = tab==="pbs"?[{k:"#",l:"#",w:"40px"},{k:"date",l:"Date",w:"110px"},{k:"dist",l:"Distance",w:"100px"},{k:"time",l:"Time",w:"1fr",mono:true,accent:true}]:tab==="elevation"?[{k:"#",l:"#",w:"40px"},{k:"date",l:"Date",w:"110px"},{k:"dist",l:"Dist",w:"80px"},{k:"elev",l:"Elevation",w:"1fr",accent:true}]:[{k:"#",l:"#",w:"40px"},{k:"date",l:"Date",w:"110px"},{k:"dist",l:"Distance",w:"1fr",accent:true}];
  const tableRows = rows.map(r => ({
    dist: sport==="swim"?(unitSystem==="imperial"?Math.round(r.distance*1.09361)+" yd":Math.round(r.distance)+" m"):(unitSystem==="imperial"?(r.distance/1609.34).toFixed(1)+" mi":(r.distance/1000).toFixed(1)+" km"),
    date: fmtDate(r.start_date_local), time: fmtTime(r.moving_time),
    elev: unitSystem==="imperial"?`${Math.round((r.total_elevation_gain||0)*3.28084)} ft`:`${Math.round(r.total_elevation_gain||0)} m`,
    name: r.name,
  }));
  const RACES = [
    {race:"IM70.3 Cascais",date:"Oct '22",swim:"0:30:39",bike:"2:33:46",run:"1:35:13",finish:"4:48:04",s:"fin"},
    {race:"IM70.3 Florianópolis",date:"Apr '23",swim:"0:31:25",bike:"2:25:23",run:"1:36:15",finish:"4:39:27",s:"fin"},
    {race:"Challenge Geraardsbergen",date:"Jun '23",swim:"0:34:50",bike:"1:01:37",run:"—",finish:"DNF",s:"dnf"},
    {race:"IM70.3 Rio de Janeiro",date:"Jul '23",swim:"0:34:36",bike:"2:31:53",run:"1:40:41",finish:"4:55:39",s:"fin"},
    {race:"IM70.3 São Paulo",date:"Sep '23",swim:"0:32:15",bike:"2:24:13",run:"1:38:20",finish:"4:42:56",s:"fin"},
    {race:"IM70.3 Cascais",date:"Oct '23",swim:"0:28:29",bike:"2:32:53",run:"1:25:14",finish:"4:34:03",s:"fin"},
    {race:"IM70.3 Panama City",date:"Feb '24",swim:"0:23:27",bike:"2:26:08",run:"1:49:40",finish:"4:46:08",s:"fin"},
    {race:"IM70.3 Eagleman",date:"Jun '24",swim:"0:36:29",bike:"2:27:10",run:"1:42:01",finish:"4:52:26",s:"fin"},
    {race:"IM70.3 São Paulo",date:"Sep '24",swim:"—",bike:"—",run:"—",finish:"DNS",s:"dns"},
    {race:"IM70.3 Cascais",date:"Oct '24",swim:"0:31:06",bike:"2:24:08",run:"1:28:34",finish:"4:30:59",s:"fin"},
    {race:"Challenge Florianópolis",date:"Nov '24",swim:"0:28:13",bike:"2:18:59",run:"1:26:56",finish:"4:21:47",s:"fin",pr:2},
    {race:"IM70.3 Punta del Este",date:"Mar '25",swim:"0:24:30",bike:"1:19:19",run:"—",finish:"DNF",s:"dnf"},
    {race:"IM70.3 Brasília",date:"Apr '25",swim:"0:28:28",bike:"2:16:45",run:"1:38:18",finish:"4:28:00",s:"fin",pr:3},
    {race:"Challenge Samorin",date:"May '25",swim:"0:10:48",bike:"2:27:18",run:"1:26:20",finish:"DNC",s:"dnc"},
    {race:"IM70.3 Marbella World Championship",date:"Nov '25",swim:"0:30:30",bike:"2:46:13",run:"1:26:48",finish:"4:52:24",s:"fin"},
    {race:"Challenge Florianópolis",date:"Nov '25",swim:"0:27:45",bike:"2:18:45",run:"1:41:10",finish:"4:32:46",s:"fin"},
    {race:"IM70.3 Curitiba",date:"Mar '26",swim:"0:27:49",bike:"2:42:58",run:"1:33:08",finish:"4:48:41",s:"fin"},
    {race:"IM70.3 Brasília",date:"Apr '26",swim:"0:27:57",bike:"2:14:26",run:"1:30:46",finish:"4:18:09",s:"fin",pr:1},
  ];
  return (
    <section id="notable" style={{ scrollMarginTop:50, paddingBottom:"4rem" }}>
      <Divider />
      <SectionNum n={2} />
      <h2 style={{ fontFamily:F.heading, fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:800, color:C.ink, margin:"0 0 1.5rem", lineHeight:0.9, letterSpacing:"-1px" }}>
        NOTABLE <span style={{ color:sport==="races"?"#A63D2F":sportColor }}>{sport==="races"?"RACES":sport.toUpperCase()+"S"}</span>
      </h2>
      <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem" }}>
        <SportTab label="RACES" active={sport==="races"} onClick={()=>setSport("races")} color="#A63D2F" />
        <SportTab label="RUNS" active={sport==="run"} onClick={()=>setSport("run")} color={C.run} />
        <SportTab label="RIDES" active={sport==="ride"} onClick={()=>setSport("ride")} color={C.ride} />
        <SportTab label="SWIMS" active={sport==="swim"} onClick={()=>setSport("swim")} color={C.swim} />
      </div>
      {sport==="races" ? (
        <div>
          <div style={{ fontFamily:F.mono, fontSize:"0.48rem", letterSpacing:"0.12em", color:C.muted, marginBottom:"0.75rem" }}>PERSONAL RECORDS</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"1px", background:C.border, border:"1px solid "+C.border, marginBottom:"1.5rem" }}>
            {[{l:"SWIM",v:"0:23:27",sub:"Panama '24",c:C.swim},{l:"BIKE",v:"2:14:26",sub:"Brasília '26",c:C.ride},{l:"RUN",v:"1:25:14",sub:"Cascais '23",c:C.run},{l:"FINISH",v:"4:18:09",sub:"Brasília '26",c:C.ink}].map((pr,i)=>(
              <div key={i} style={{ background:C.bg, padding:"0.65rem 0.75rem" }}>
                <div style={{ fontFamily:F.mono, fontSize:"0.45rem", letterSpacing:"0.1em", color:C.faint, marginBottom:"0.2rem" }}>{pr.l}</div>
                <div style={{ fontFamily:F.mono, fontSize:"0.82rem", fontWeight:700, color:pr.c }}>{pr.v}</div>
                <div style={{ fontFamily:F.mono, fontSize:"0.45rem", color:C.muted, marginTop:"0.15rem" }}>{pr.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily:F.mono, fontSize:"0.48rem", letterSpacing:"0.12em", color:C.muted, marginBottom:"0.75rem" }}>RACE HISTORY — 18 RACES · 15 FINISHES · 2 DNF · 1 DNS · 1 DNC</div>
          <div style={{ overflowX:"auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1.5fr 90px 80px 80px 80px 90px", gap:"1px", background:C.border, border:"1px solid "+C.border, minWidth:"520px" }}>
              {["RACE","DATE","SWIM","BIKE","RUN","FINISH"].map((h,i)=>(
                <div key={i} style={{ background:C.surface, padding:"0.4rem 0.5rem", fontFamily:F.mono, fontSize:"0.45rem", letterSpacing:"0.1em", color:[C.faint,C.faint,C.swim,C.ride,C.run,C.ink][i], textAlign:i>1?"center":"left" }}>{h}</div>
              ))}
              {RACES.map((r,i)=>{
                const dnx=r.s!=="fin"; const bg=i%2===0?C.bg:C.surface;
                const fc=r.s==="dnf"?"#c04040":r.s==="dns"?"#888":r.s==="dnc"?"#7050b0":C.green;
                return [
                  <div key={"n"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.ink,opacity:dnx?"0.5":"1",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                    {r.race}{r.pr&&<span style={{fontFamily:F.mono,fontSize:"0.45rem",letterSpacing:"0.08em",background:r.pr===1?"#D4AF37":r.pr===2?"#A8A9AD":"#CD7F32",color:"#fff",padding:"0.1rem 0.3rem",borderRadius:2,fontWeight:700,flexShrink:0}}>{r.pr===1?"PR #1":r.pr===2?"PR #2":"PR #3"}</span>}
                  </div>,
                  <div key={"d"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.muted,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.date}</div>,
                  <div key={"s"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.swim,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.swim}</div>,
                  <div key={"b"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.ride,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.bike}</div>,
                  <div key={"r"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.run,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.run}</div>,
                  <div key={"f"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",fontWeight:dnx?400:700,color:fc,textAlign:"center"}}>{r.finish}</div>
                ];
              })}
            </div>
          </div>
          <div style={{ fontFamily:F.mono, fontSize:"0.48rem", color:C.faint, marginTop:"0.75rem", letterSpacing:"0.05em" }}>DNF — Did not finish | DNS — Did not start | DNC — Did not count</div>
        </div>
      ) : (
        <>
          <div style={{ display:"flex", gap:"0.4rem", justifyContent:"center", marginBottom:"0.5rem" }}>
            {sport==="run"&&<SubTab label="PERSONAL BESTS" active={tab==="pbs"} onClick={()=>setTab("pbs")} />}
            <SubTab label="LONGEST" active={tab==="longest"} onClick={()=>setTab("longest")} />
            {sport!=="swim"&&<SubTab label="ELEVATION GAIN" active={tab==="elevation"} onClick={()=>setTab("elevation")} />}
          </div>
          <div style={{ fontFamily:F.mono, fontSize:"0.62rem", color:C.faint, marginBottom:"1rem" }}>
            {tab==="pbs"?"fastest times across standard running distances":tab==="longest"?`my longest ${sport}s on record`:`the most vertical gain in a single ${sport}`}
          </div>
          {sport==="run"&&tab==="pbs" ? (
            loading ? (
              <div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint, padding:"3rem 0" }}>loading...</div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"300px 1fr 280px", gap:"0", border:"1px solid "+C.border, borderRadius:4, overflow:"hidden", background:C.surface }}>
                <div style={{ borderRight:`1px solid ${C.border}` }}>
                  <NotableTable
                    rows={prs.map(r=>({ dist:r._label, date:fmtDate(r.start_date_local), time:fmtTime(r._elapsed), name:r.name }))}
                    cols={[{k:"#",l:"#",w:"40px"},{k:"dist",l:"Distance",w:"120px"},{k:"time",l:"Time",w:"1fr",mono:true,accent:true}]}
                    selected={selected} onSelect={setSelected} sportColor={sportColor}
                  />
                </div>
                <div>
                  <ActivityMap polyline={prs[selected]?.map_summary_polyline} type="Run" height={380} />
                </div>
                <div style={{ padding:"1.25rem", borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                  {prs[selected] && (<>
                    <div style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, marginBottom:"0.5rem" }}>{fmtDate(prs[selected].start_date_local)}</div>
                    <div style={{ fontFamily:F.heading, fontSize:"1.1rem", fontWeight:700, color:C.ink, marginBottom:"1rem", lineHeight:1.2 }}>{prs[selected].name}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0", borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
                      {[
                        {l:"DISTANCE", v:prs[selected]._label},
                        {l:"TIME", v:fmtTime(prs[selected]._elapsed)},
                        {l:"AVG PACE", v:(()=>{const dm={"400m":400,"1/2 mile":804,"1K":1000,"1 mile":1609,"2 mile":3218,"5K":5000,"10K":10000,"15K":15000,"10 mile":16093,"20K":20000,"Half-Marathon":21097,"30K":30000}; const d=dm[prs[selected]._label]; if(!d) return "—"; const s=prs[selected]._elapsed/d*(unitSystem==="imperial"?1609.34:1000); return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}/${unitSystem==="imperial"?"mi":"km"}`; })()},
                        {l:"ELEVATION", v:unitSystem==="imperial"?`${Math.round((prs[selected].total_elevation_gain||0)*3.28084)} ft`:`${Math.round(prs[selected].total_elevation_gain||0)} m`},
                      ].map(({l,v})=>(
                        <div key={l}>
                          <div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>{l}</div>
                          <div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {prs[selected].average_heartrate && (
                      <div>
                        <div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>AVG HR (BPM)</div>
                        <div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{Math.round(prs[selected].average_heartrate)}</div>
                      </div>
                    )}
                    <div style={{ marginTop:"auto", paddingTop:"1rem", borderTop:`1px solid ${C.border}` }}>
                      <a href={`https://www.strava.com/activities/${prs[selected].id}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily:F.mono, fontSize:"0.58rem", letterSpacing:"0.1em", color:C.muted, textDecoration:"none" }}>
                        VIEW ON STRAVA →
                      </a>
                    </div>
                  </>)}
                </div>
              </div>
            )
          ) : loading?(<div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint, padding:"3rem 0" }}>loading...</div>):(
            <div style={{ display:"grid", gridTemplateColumns:"300px 1fr 280px", gap:"0", border:`1px solid ${C.border}`, borderRadius:4, overflow:"hidden", background:C.surface }}>
              <div style={{ borderRight:`1px solid ${C.border}` }}><NotableTable rows={tableRows} cols={cols} selected={selected} onSelect={setSelected} sportColor={sportColor} /></div>
              <div><ActivityMap polyline={cur?.map_summary_polyline} type={sport==="run"?"Run":sport==="ride"?"Ride":"Swim"} height={380} /></div>
              <div style={{ padding:"1.25rem", borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                {cur&&(<>
                  <div style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, marginBottom:"0.5rem" }}>{fmtDate(cur.start_date_local)}</div>
                  <div style={{ fontFamily:F.heading, fontSize:"1.1rem", fontWeight:700, color:C.ink, marginBottom:"1rem", lineHeight:1.2 }}>{cur.name}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0", borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
                    {[
                      {l:unitSystem==="imperial"?"MILES":"KILOMETERS",v:unitSystem==="imperial"?`${(cur.distance/1609.34).toFixed(1)} mi`:`${(cur.distance/1000).toFixed(1)} km`},
                      {l:"TIME",v:fmtTime(cur.moving_time)},
                      {l:sport==="ride"?"AVG SPEED":"AVG PACE",v:sport==="ride"?fmtSpeed(cur.average_speed):sport==="swim"?fmtSwimPace(cur.moving_time,cur.distance):fmtPace(cur.moving_time,cur.distance)},
                      {l:"ELEVATION",v:unitSystem==="imperial"?`${Math.round((cur.total_elevation_gain||0)*3.28084)} ft`:`${Math.round(cur.total_elevation_gain||0)} m`},
                    ].map(({l,v})=>(<div key={l}><div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>{l}</div><div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{v}</div></div>))}
                  </div>
                  {cur.average_heartrate&&(<div><div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>AVG HR (BPM)</div><div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{Math.round(cur.average_heartrate)}</div></div>)}
                  <div style={{ marginTop:"auto", paddingTop:"1rem", borderTop:`1px solid ${C.border}` }}>
                    <a href={`https://www.strava.com/activities/${cur.id}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily:F.mono, fontSize:"0.58rem", letterSpacing:"0.1em", color:C.muted, textDecoration:"none" }}>VIEW ON STRAVA →</a>
                  </div>
                </>)}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}


const ChartBox = ({ title, subtitle, children, minH }) => (
  <div style={{ background:C.bg, padding:"1.25rem", display:"flex", flexDirection:"column", minHeight:minH||280 }}>
    <div style={{ textAlign:"center", marginBottom:"0.75rem" }}>
      <div style={{ fontFamily:F.mono, fontSize:"0.58rem", letterSpacing:"0.15em", textTransform:"uppercase", color:C.muted, fontWeight:500 }}>{title}</div>
      {subtitle && <div style={{ fontFamily:F.mono, fontSize:"0.5rem", color:C.faint, marginTop:2, fontStyle:"italic" }}>{subtitle}</div>}
    </div>
    <div style={{ flex:1 }}>{children}</div>
  </div>
);

function StatsSection({ sportFilter, unitSystem="metric" }) {
  const isMetric = unitSystem === "metric";
  const distUnit = isMetric ? "km" : "mi";
  const toUnit = (km) => isMetric ? km : +(km * 0.621371).toFixed(1);
  const toUnitRound = (km) => Math.round(isMetric ? km : km * 0.621371);
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all activities with all fields needed for charts
    async function fetchAll() {
      const map = [];
      let offset = 0;
      const pageSize = 1000;
      while(true) {
        const res = await fetch(
          `${SB_URL}/rest/v1/activities?select=sport_type,distance,moving_time,average_heartrate,average_speed,start_date_local,trainer&order=start_date_local.asc&limit=${pageSize}&offset=${offset}`,
          { headers: SBH }
        ).then(r=>r.json());
        if(!Array.isArray(res)||res.length===0) break;
        map.push(...res);
        if(res.length<pageSize) break;
        offset+=pageSize;
      }
      setActs(map);
      setLoading(false);
    }
    fetchAll();
  }, []);

  // Sport filter helpers
  const isRun  = t => t==='Run'||t==='TrailRun';
  const isRide = t => t==='Ride'||t==='VirtualRide';
  const isSwim = t => t==='Swim';
  const matchesSport = (a) => {
    if(sportFilter==='all') return isRun(a.sport_type)||isRide(a.sport_type)||isSwim(a.sport_type);
    if(sportFilter==='run')  return isRun(a.sport_type);
    if(sportFilter==='ride') return isRide(a.sport_type);
    if(sportFilter==='swim') return isSwim(a.sport_type);
    return true;
  };

  const filtered = acts.filter(matchesSport);
  const isAll = sportFilter==='all';
  const [distTip, setDistTip] = useState(null);
  const sColor = sportFilter==='run'?C.run:sportFilter==='ride'?C.ride:sportFilter==='swim'?C.swim:C.green;
  const hrColors = ["#2d8a7e","#4a7c59","#9a7e5a","#c47a2a","#b85a3a"];

  // ── Annual Distance ──
  const annMap = {};
  acts.filter(a=>isRun(a.sport_type)||isRide(a.sport_type)||isSwim(a.sport_type)).forEach(a => {
    const yr = a.start_date_local?.slice(0,4);
    if(!yr||+yr<2019) return;
    if(!annMap[yr]) annMap[yr]={year:yr,run:0,ride:0,swim:0};
    const km = (+a.distance||0)/1000;
    if(isRun(a.sport_type))  annMap[yr].run  += km;
    if(isRide(a.sport_type)) annMap[yr].ride += km;
    if(isSwim(a.sport_type)) annMap[yr].swim += km;
  });
  const annData = Object.values(annMap).sort((a,b)=>a.year-b.year).map(y=>({
    ...y,
    run:toUnitRound(y.run), ride:toUnitRound(y.ride), swim:toUnitRound(y.swim),
    km: toUnitRound(isAll ? y.run+y.ride+y.swim : sportFilter==='run'?y.run:sportFilter==='ride'?y.ride:y.swim),
  }));

  // ── Distance Distribution ──
  const mkB = (label,arr,lo,hi) => ({label, count:arr.filter(a=>{const km=(+a.distance||0)/1000;return km>=lo&&(hi===999?true:km<hi);}).length});
  const runActs2  = acts.filter(a=>isRun(a.sport_type));
  const rideActs2 = acts.filter(a=>a.sport_type==='Ride'||a.sport_type==='VirtualRide');
  const swimActs2 = acts.filter(a=>isSwim(a.sport_type));
  const runDist  = [mkB("0–5km",runActs2,0,5),mkB("5–10km",runActs2,5,10),mkB("10–15km",runActs2,10,15),mkB("15–21km",runActs2,15,21),mkB("21–30km",runActs2,21,30),mkB("30–42km",runActs2,30,42)];
  const rideDist = [mkB("0–20km",rideActs2,0,20),mkB("20–40km",rideActs2,20,40),mkB("40–60km",rideActs2,40,60),mkB("60–80km",rideActs2,60,80),mkB("80–100km",rideActs2,80,100),mkB("100–120km",rideActs2,100,120),mkB("120km+",rideActs2,120,999)];
  const swimDist = [mkB("0–500m",swimActs2,0,0.5),mkB("500m–1km",swimActs2,0.5,1),mkB("1–2km",swimActs2,1,2),mkB("2–3km",swimActs2,2,3),mkB("3–5km",swimActs2,3,5),mkB("5km+",swimActs2,5,999)];
  const _kmBuckets = sportFilter==='swim'?[[0,0.5],[0.5,1],[1,2],[2,3],[3,5],[5,999]]:sportFilter==='ride'?[[0,20],[20,40],[40,60],[60,80],[80,100],[100,120],[120,999]]:[[0,5],[5,10],[10,15],[15,21],[21,30],[30,42]];
  const distData = _kmBuckets.map(([lo,hi]) => {
    const label = hi===999?`${lo<1?lo*1000+"m":lo+"km"}+`:lo<1&&hi<=1?`${lo*1000}–${hi*1000}m`:`${lo<1?lo*1000+"m":lo+"km"}–${hi<1?hi*1000+"m":hi+"km"}`;
    return {label, count:filtered.filter(a=>{const km=(+a.distance||0)/1000;return km>=lo&&(hi===999?true:km<hi);}).length};
  });

  // ── Pace Distribution (run only, or all running for "all") ──
  const runActs = acts.filter(a=>isRun(a.sport_type));
  const paceActsToUse = isAll||sportFilter==='run' ? runActs : [];
  const paceBuckets = [
    {bucket:"<3:30",lo:0,hi:3.5},{bucket:"3:30-4:00",lo:3.5,hi:4},{bucket:"4:00-4:30",lo:4,hi:4.5},
    {bucket:"4:30-5:00",lo:4.5,hi:5},{bucket:"5:00-5:30",lo:5,hi:5.5},{bucket:"5:30+",lo:5.5,hi:999}
  ];
  const paceData = paceBuckets.map(b => ({
    bucket: b.bucket,
    count: paceActsToUse.filter(a=>{
      if(!a.average_speed||+a.average_speed===0) return false;
      const minKm = 1000/(+a.average_speed*60);
      return minKm>=b.lo&&minKm<b.hi;
    }).length
  }));

  // ── HR Zones ──
  const hrBounds = [[0,100],[100,120],[120,140],[140,160],[160,999]];
  const hrData = [
    {zone:"Recovery"},{zone:"Easy"},{zone:"Tempo"},{zone:"Threshold"},{zone:"Max"}
  ].map((z,i)=>({
    ...z,
    count: filtered.filter(a=>a.average_heartrate&&+a.average_heartrate>=hrBounds[i][0]&&+a.average_heartrate<hrBounds[i][1]).length
  }));

  // ── Activity breakdown (sport-aware) ──
  const ioData = sportFilter==="run" ? [
    {name:"Outdoor Run",value:acts.filter(a=>isRun(a.sport_type)&&!a.trainer).length,fill:C.run},
    {name:"Treadmill",value:acts.filter(a=>isRun(a.sport_type)&&a.trainer).length,fill:"#8a9a80"},
  ].filter(d=>d.value>0) : sportFilter==="ride" ? [
    {name:"Outdoor Ride",value:acts.filter(a=>a.sport_type==='Ride').length,fill:C.ride},
    {name:"Virtual Ride",value:acts.filter(a=>a.sport_type==='VirtualRide').length,fill:"#c0805a"},
  ].filter(d=>d.value>0) : sportFilter==="swim" ? [
    {name:"Open Water",value:acts.filter(a=>isSwim(a.sport_type)&&!a.trainer).length,fill:C.swim},
    {name:"Pool Swim",value:acts.filter(a=>isSwim(a.sport_type)&&a.trainer).length,fill:"#5a9ac0"},
  ].filter(d=>d.value>0) : [
    {name:"Runs",value:acts.filter(a=>isRun(a.sport_type)).length,fill:C.run},
    {name:"Rides",value:acts.filter(a=>a.sport_type==='Ride'||a.sport_type==='VirtualRide').length,fill:C.ride},
    {name:"Swims",value:acts.filter(a=>isSwim(a.sport_type)).length,fill:C.swim},
    {name:"Other",value:acts.filter(a=>!isRun(a.sport_type)&&a.sport_type!=='Ride'&&a.sport_type!=='VirtualRide'&&!isSwim(a.sport_type)).length,fill:C.muted},
  ].filter(d=>d.value>0);
  const ioTitle = sportFilter==="run"?"Indoor vs Outdoor":sportFilter==="ride"?"Indoor vs Outdoor":sportFilter==="swim"?"Pool vs Open Water":"All-time Activities";
  const ioSubtitle = sportFilter==="run"?"road or treadmill":sportFilter==="ride"?"road or trainer":sportFilter==="swim"?"lane or open water":"by sport type";

  // ── Yearly Volume (B) ──
  const yearlyMap = {};
  acts.forEach(a => {
    if (!a.start_date_local) return;
    const yr = new Date(a.start_date_local).getFullYear();
    if (!yearlyMap[yr]) yearlyMap[yr] = { run:0, ride:0, swim:0 };
    const km = (+a.distance||0)/1000;
    if (isRun(a.sport_type)) yearlyMap[yr].run += km;
    else if (a.sport_type==='Ride'||a.sport_type==='VirtualRide') yearlyMap[yr].ride += km;
    else if (isSwim(a.sport_type)) yearlyMap[yr].swim += km;
  });
  const yearlyData = Object.entries(yearlyMap).sort(([a],[b])=>+a-+b).map(([yr,v])=>({
    year: yr,
    run:  toUnitRound(v.run),
    ride: toUnitRound(v.ride),
    swim: toUnitRound(v.swim),
  }));

  // ── Streak Tracker (C) ──
  const actDays = new Set(acts.filter(a=>a.start_date_local).map(a=>a.start_date_local.slice(0,10)));
  const sortedDays = [...actDays].sort();
  let bestStreak = 0, curStreak = 0, streakEnd = '';
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) { curStreak = 1; streakEnd = sortedDays[0]; }
    else {
      const prev = new Date(sortedDays[i-1]), curr = new Date(sortedDays[i]);
      const diff = (curr - prev) / 86400000;
      if (diff === 1) { curStreak++; streakEnd = sortedDays[i]; }
      else { curStreak = 1; streakEnd = sortedDays[i]; }
    }
    if (curStreak > bestStreak) bestStreak = curStreak;
  }
  const today = new Date().toISOString().slice(0,10);
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
  let liveStreak = 0;
  for (let i = sortedDays.length-1; i >= 0; i--) {
    const d = sortedDays[i];
    if (i === sortedDays.length-1) {
      if (d !== today && d !== yesterday) break;
      liveStreak = 1;
    } else {
      const next = new Date(sortedDays[i+1]), curr = new Date(d);
      if ((next - curr) / 86400000 === 1) liveStreak++;
      else break;
    }
  }
  const totalDaysWithActivity = actDays.size;

  // Time of day radar — 24 hours
  const buildTod = (subset) => {
    const m = {};
    for(let h=0;h<24;h++) m[h<10?'0'+h:String(h)] = 0;
    subset.forEach(a => { if(a.start_date_local) m[a.start_date_local.slice(11,13)] = (m[a.start_date_local.slice(11,13)]||0)+1; });
    return Object.entries(m).map(([hour,count])=>({hour,count}));
  };
  const todData = buildTod(filtered).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour));
  const todRun  = isAll ? buildTod(acts.filter(a=>isRun(a.sport_type))).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour))  : null;
  const todRide = isAll ? buildTod(acts.filter(a=>isRide(a.sport_type))).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour)) : null;
  const todSwim = isAll ? buildTod(acts.filter(a=>isSwim(a.sport_type))).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour)) : null;
  const todMerged = isAll ? todData.map((d,i)=>({hour:d.hour, run:todRun[i].count, ride:todRide[i].count, swim:todSwim[i].count})) : todData;

  // Day of week radar
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const buildDow = (subset) => {
    const cnt = {}; const dist = {};
    days.forEach(d=>{cnt[d]=0;dist[d]=0;});
    subset.forEach(a => {
      if(!a.start_date_local) return;
      const [yr,mo,dy] = a.start_date_local.slice(0,10).split('-').map(Number);
      const d = new Date(yr,mo-1,dy);
      const day = days[(d.getDay()+6)%7];
      cnt[day]++;
      dist[day] += (+a.distance||0)/1000;
    });
    return days.map(d=>({day:d, avg:cnt[d]>0?Math.round(toUnit(dist[d]/cnt[d])*10)/10:0}));
  };
  const dowData   = buildDow(filtered);
  const dowRun    = isAll ? buildDow(acts.filter(a=>isRun(a.sport_type)))  : null;
  const dowRide   = isAll ? buildDow(acts.filter(a=>isRide(a.sport_type))) : null;
  const dowSwim   = isAll ? buildDow(acts.filter(a=>isSwim(a.sport_type))) : null;
  const dowMerged = isAll ? days.map((d,i)=>({day:d, run:dowRun[i].avg, ride:dowRide[i].avg, swim:dowSwim[i].avg})) : dowData;

  // Activity Mix Over Time — % of hours per sport per year (ALL tab only)
  const actMixData = (() => {
    const yrMap = {};
    acts.filter(a=>isRun(a.sport_type)||isRide(a.sport_type)||isSwim(a.sport_type)).forEach(a => {
      const yr = a.start_date_local?.slice(0,4);
      if(!yr||+yr<2019) return;
      if(!yrMap[yr]) yrMap[yr]={year:yr,run:0,ride:0,swim:0};
      const hrs = (+a.moving_time||0)/3600;
      if(isRun(a.sport_type))  yrMap[yr].run  += hrs;
      if(isRide(a.sport_type)) yrMap[yr].ride += hrs;
      if(isSwim(a.sport_type)) yrMap[yr].swim += hrs;
    });
    return Object.values(yrMap).sort((a,b)=>a.year-b.year).map(y => {
      const total = y.run+y.ride+y.swim||1;
      return {
        year: y.year,
        run:  +y.run.toFixed(1), ride: +y.ride.toFixed(1), swim: +y.swim.toFixed(1),
      };
    });
  })();

  const G = { display:"grid", gap:"1px", background:C.border, border:`1px solid ${C.border}` };
  const tickStyle = { fontFamily:F.mono, fontSize:9, fill:C.faint };

  if(loading) return <div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint, padding:"2rem 0" }}>loading stats...</div>;

  return (
    <div>
      {/* ROW 0 — Annual Distance | Time of Day + Avg Dist */}
      <div style={{ ...G, gridTemplateColumns:"1fr 2fr" }}>
        <ChartBox title={`Annual Distance (${distUnit})`} subtitle={isAll?"all sports by year":sportFilter+" distance"} minH={310}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={annData} barSize={isAll?16:22}>
              <CartesianGrid vertical={false} stroke={C.border} />
              <XAxis dataKey="year" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={36} tickFormatter={v=>v>=1000?(Math.round(v/100)/10)+'k':v} />
              <Tooltip content={({ active, payload, label }) => {
                if(!active||!payload?.length) return null;
                const yearTotal = payload.reduce((s,p)=>s+(+p.value||0),0);
                return (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"8px 12px",fontFamily:F.mono,fontSize:"0.65rem",color:C.ink}}>
                    <div style={{color:C.faint,marginBottom:4}}>{label}</div>
                    {payload.map(p=>(
                      <div key={p.dataKey} style={{color:p.color||C.ink}}>
                        {p.name}: <strong>{Math.round(p.value).toLocaleString()}</strong>{p.unit||""}
                      </div>
                    ))}
                    {isAll && payload.length>1 && (
                      <>
                        <div style={{borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:4}}/>
                        <div style={{color:C.ink}}>Total: <strong>{Math.round(yearTotal).toLocaleString()}</strong> {distUnit}</div>
                      </>
                    )}
                  </div>
                );
              }} cursor={{fill:"rgba(0,0,0,0.03)"}} />
              {isAll ? <>
                <Bar dataKey="swim" stackId="a" fill={C.swim} name="Swim" unit={" "+distUnit} />
                <Bar dataKey="ride" stackId="a" fill={C.ride} name="Ride" unit={" "+distUnit} />
                <Bar dataKey="run"  stackId="a" fill={C.run}  radius={[2,2,0,0]} name="Run"  unit={" "+distUnit} />
              </> : <Bar dataKey="km" fill={sColor} radius={[2,2,0,0]} name={sportFilter==="run"?"Run":sportFilter==="ride"?"Ride":"Swim"} unit={" "+distUnit} />}
            </BarChart>
          </ResponsiveContainer>
          {(() => {
            const totalKm = Math.round(annData.reduce((s,y)=>s+(isAll?y.run+y.ride+y.swim:y.km),0));
            return (
              <>
                {isAll && (
                  <div style={{display:"flex",gap:"0.75rem",justifyContent:"center",marginTop:"0.5rem"}}>
                    {[["Run",C.run],["Ride",C.ride],["Swim",C.swim]].map(([l,c])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:3,fontFamily:F.mono,fontSize:"0.5rem",color:C.faint}}>
                        <div style={{width:7,height:7,borderRadius:1,background:c}}/>{l}
                      </div>
                    ))}
                  </div>
                )}

              </>
            );
          })()}
        </ChartBox>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1px",background:C.border}}>
          <ChartBox title="Activity by Time of Day" subtitle="peak: early morning" minH={310}>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={isAll?todMerged:todData} cx="50%" cy="50%">
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="hour" tick={{fontFamily:F.mono,fontSize:8,fill:C.faint}} />
                {isAll ? <>
                  <Radar dataKey="run"  stroke={C.run}  fill={C.run}  fillOpacity={0.1} dot={false} name="Run" />
                  <Radar dataKey="ride" stroke={C.ride} fill={C.ride} fillOpacity={0.1} dot={false} name="Ride" />
                  <Radar dataKey="swim" stroke={C.swim} fill={C.swim} fillOpacity={0.1} dot={false} name="Swim" />
                </> : <Radar dataKey="count" stroke={sColor} fill={sColor} fillOpacity={0.2} dot={false} name="activities" />}
                <Tooltip content={<Tip />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartBox>
          <ChartBox title="Avg Distance by Day" subtitle="consistency, they call it" minH={310}>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={isAll?dowMerged:dowData}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="day" tick={{fontFamily:F.mono,fontSize:8,fill:C.faint}} />
                {isAll ? <>
                  <Radar dataKey="run"  stroke={C.run}  fill={C.run}  fillOpacity={0.1} dot={false} name="Run"  unit={" "+distUnit} />
                  <Radar dataKey="ride" stroke={C.ride} fill={C.ride} fillOpacity={0.1} dot={false} name="Ride" unit={" "+distUnit} />
                  <Radar dataKey="swim" stroke={C.swim} fill={C.swim} fillOpacity={0.1} dot={false} name="Swim" unit={" "+distUnit} />
                </> : <Radar dataKey="avg" stroke={sColor} fill={sColor} fillOpacity={0.2} dot={false} name="Avg" unit={" "+distUnit} />}
                <Tooltip content={<Tip />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
      </div>

      {/* ROW 1 — Distance Dist | Indoor/Outdoor | Streaks */}
      <div style={{...G, gridTemplateColumns:"1fr 1fr 1fr", borderTop:"none"}}>
        <ChartBox title="Distance Distribution" subtitle="activity counts by distance" minH={331}>
          {isAll ? (
            <div style={{paddingTop:"0.25rem",position:"relative"}} onMouseLeave={()=>setDistTip(null)}>
              {distTip&&<div style={{position:"fixed",pointerEvents:"none",zIndex:9999,background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"6px 10px",fontFamily:F.mono,fontSize:"0.65rem",color:C.ink,top:distTip.y-40,left:distTip.x+14,whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(0,0,0,0.1)",display:"flex",gap:"0.4rem",alignItems:"center"}}><span style={{color:distTip.color,fontWeight:700}}>{distTip.label}:</span><span>{distTip.count}</span></div>}
              {[{label:"RUNS",data:runDist,color:C.run},{label:"RIDES",data:rideDist,color:C.ride},{label:"SWIMS",data:swimDist,color:C.swim}].map(({label,data,color},si)=>(
                <div key={si} style={{marginBottom:si<2?"0.75rem":"0"}}>
                  <div style={{fontFamily:F.mono,fontSize:"0.48rem",letterSpacing:"0.1em",color,marginBottom:"0.3rem"}}>{label}</div>
                  {data.map((d,i)=>{
                    const max=Math.max(...data.map(x=>x.count),1);
                    return (
                      <div key={i} onMouseEnter={e=>setDistTip({label:d.label,count:d.count,color,x:e.clientX,y:e.clientY})} style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.2rem",cursor:"default"}}>
                        <div style={{fontFamily:F.mono,fontSize:"0.48rem",color:C.faint,width:60,flexShrink:0,textAlign:"right"}}>{d.label}</div>
                        <div style={{flex:1,background:C.border,borderRadius:2,height:10,overflow:"hidden"}}>
                          <div style={{height:"100%",background:color,borderRadius:2,width:d.count>0?Math.max(4,Math.round(d.count/max*100))+"%":"0%",transition:"width 0.3s"}} />
                        </div>
                        <div style={{fontFamily:F.mono,fontSize:"0.48rem",color:C.muted,width:24,textAlign:"right"}}>{d.count}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distData} layout="vertical" barSize={14}>
                <CartesianGrid horizontal={false} stroke={C.border} />
                <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} hide />
                <YAxis type="category" dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<Tip />} cursor={{fill:"rgba(0,0,0,0.03)"}} />
                <Bar dataKey="count" fill={sColor} radius={[0,2,2,0]} name="activities" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBox>
        <ChartBox title={ioTitle} subtitle={ioSubtitle} minH={331}>
          {ioData.length>0 && (
            <div style={{height:220,display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              <ResponsiveContainer width="100%" height={155}>
                <PieChart>
                  <Pie data={ioData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value" strokeWidth={0} paddingAngle={2}>
                    {ioData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                  </Pie>
                  <Tooltip content={({active,payload})=>{
                    if(!active||!payload?.length) return null;
                    const p=payload[0]; const total=ioData.reduce((s,d)=>s+d.value,0);
                    const pct=total>0?Math.round(p.value/total*100):0;
                    return (<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"8px 12px",fontFamily:F.mono,fontSize:"0.65rem",color:C.ink,display:"flex",gap:"0.5rem",alignItems:"center"}}><span style={{color:p.payload.fill,fontWeight:700}}>{p.name}:</span><span>{p.value} · {pct}%</span></div>);
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.2rem 0.5rem"}}>
                {ioData.map(d=>(
                  <div key={d.name} style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:6,height:6,borderRadius:1,background:d.fill,flexShrink:0}}/>
                    <span style={{fontFamily:F.mono,fontSize:"0.5rem",color:C.faint}}>{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartBox>
        <ChartBox title="Activity Streaks" subtitle="consecutive days" minH={331}>
          <div style={{display:"flex",flexDirection:"column",gap:"1.25rem",paddingTop:"0.75rem"}}>
            {[
              {label:"BEST STREAK",value:bestStreak+" days",color:C.run},
              {label:"CURRENT STREAK",value:liveStreak+" days",color:liveStreak>=bestStreak?C.run:liveStreak>0?C.ride:C.faint},
              {label:"ACTIVE DAYS",value:totalDaysWithActivity.toLocaleString(),color:C.ink},
            ].map(({label,value,color})=>(
              <div key={label} style={{borderLeft:`3px solid ${color}`,paddingLeft:"0.75rem"}}>
                <div style={{fontFamily:F.mono,fontSize:"0.45rem",letterSpacing:"0.12em",color:C.faint,marginBottom:"0.2rem"}}>{label}</div>
                <div style={{fontFamily:F.mono,fontSize:"1.1rem",fontWeight:700,color}}>{value}</div>
              </div>
            ))}
          </div>
        </ChartBox>
      </div>


import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

/* ─── TOKENS ─── */
const SB_URL = import.meta.env.VITE_SB_URL;
const _BUILD=Date.now();const SB_KEY = import.meta.env.VITE_SB_KEY;
const MB_TOKEN = import.meta.env.VITE_MB_TOKEN;

const SBH = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const rpc = (fn, args = {}) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: SBH, body: JSON.stringify(args) }).then(r => r.json());
const q = path => fetch(`${SB_URL}/rest/v1/${path}`, { headers: SBH }).then(r => r.json());
const safe = (d, fb = []) => Array.isArray(d) ? d : fb;

/* ─── COLORS ─── */
const C = {
  bg: "#EDE8DC",
  surface: "#E5E0D4",
  card: "#DDD8CC",
  border: "#C8C2B4",
  ink: "#1A1A18",
  dim: "#3A3A36",
  muted: "#6B6860",
  faint: "#9A9488",
  green: "#4A7A5A",
  greenMid: "#5C7A45",
  greenLight: "#5C7A45",
  run: "#5C7A45",
  ride: "#C4622D",
  swim: "#2E7DA6",
  white: "#FFFFFF",
};

/* ─── FONTS ─── */
const F = {
  heading: "'Syne', sans-serif",
  body: "'Manrope', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

/* ─── POLYLINE DECODER ─── */
function decodePoly(str) {
  if (!str) return [];
  let i = 0, lat = 0, lng = 0, coords = [];
  while (i < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

/* ─── MAPBOX LOADER ─── */
let mbReady = false, mbCbs = [];
function loadMapbox(cb) {
  if (window.mapboxgl) { window.mapboxgl.accessToken = MB_TOKEN; cb(); return; }
  if (mbReady) { mbCbs.push(cb); return; }
  mbReady = true;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"; document.head.appendChild(l);
  const s = document.createElement("script"); s.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
  s.onload = () => { window.mapboxgl.accessToken = MB_TOKEN; cb(); mbCbs.forEach(f => f()); mbCbs = []; };
  document.head.appendChild(s);
}

/* ─── HOOKS ─── */
function useCountUp(target, duration = 2000) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!target || started.current) return;
    started.current = true;
    const start = performance.now();
    const tick = now => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 4);
      setVal(Math.floor(e * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}

function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const fn = () => {
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 80) cur = id;
      }
      setActive(cur);
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return [active, setActive];
}

/* ─── ACTIVITY MAP ─── */
function ActivityMap({ polyline, type, height = 300 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const color = type === "Swim" ? "#4A8FD4" : type === "Ride" || type === "VirtualRide" ? "#C06030" : "#4A7A58";

  useEffect(() => {
    if (!polyline) { setReady(true); return; }
    loadMapbox(() => {
      if (!ref.current || mapRef.current) return;
      const coords = decodePoly(polyline);
      if (!coords.length) { setReady(true); return; }
      const lngs = coords.map(c => c[0]), lats = coords.map(c => c[1]);
      const map = new window.mapboxgl.Map({
        container: ref.current,
        style: "mapbox://styles/mapbox/dark-v11",
        bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        fitBoundsOptions: { padding: 40 },
        interactive: false,
        attributionControl: false,
      });
      mapRef.current = map;
      map.on("load", () => {
        map.addSource("r", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: coords } } });
        map.addLayer({ id: "r", type: "line", source: "r", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": 3, "line-opacity": 0.95 } });
        setReady(true);
      });
    });
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [polyline]);

  return (
    <div style={{ position: "relative", height, background: "#1a1a2e", borderRadius: 4, overflow: "hidden" }}>
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontFamily: F.mono, fontSize: "0.7rem" }}>
          {polyline ? "loading..." : "no route data"}
        </div>
      )}
      {ready && <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: F.mono, fontSize: "0.55rem", color: "rgba(255,255,255,0.4)" }}>mapbox</div>}
    </div>
  );
}

/* ─── SHARED COMPONENTS ─── */
const Divider = ({ my = "2.5rem" }) => <div style={{ borderTop: `1px solid ${C.border}`, margin: `${my} 0` }} />;

const Label = ({ children, color }) => (
  <div style={{ fontFamily: F.mono, fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", color: color || C.muted, marginBottom: "0.4rem" }}>
    {children}
  </div>
);

const SectionNum = ({ n }) => (
  <div style={{ fontFamily: F.mono, fontSize: "0.6rem", color: C.muted, marginBottom: "0.5rem" }}>0{n}</div>
);

const SportTab = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    fontFamily: F.mono, fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase",
    padding: "5px 14px", border: `1px solid ${active ? color : C.border}`, borderRadius: 2,
    background: "transparent", color: active ? color : C.muted, cursor: "pointer",
    transition: "all 0.15s",
  }}>{label}</button>
);

const SubTab = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    fontFamily: F.mono, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase",
    padding: "5px 16px", border: `1px solid ${active ? C.ink : C.border}`, borderRadius: 2,
    background: active ? C.ink : "transparent", color: active ? C.white : C.muted,
    cursor: "pointer", transition: "all 0.15s",
  }}>{label}</button>
);

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, padding: "8px 12px", fontFamily: F.mono, fontSize: "0.65rem", color: C.ink }}>
      {label && <div style={{ color: C.faint, marginBottom: 4 }}>{label}</div>}
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color || C.white }}>
          {p.name || p.dataKey}: <strong>{typeof p.value === "number" ? (Number.isInteger(p.value) ? p.value.toLocaleString() : p.value.toFixed(1)) : p.value}</strong>{p.unit||""}
        </div>
      ))}
    </div>
  );
};



function NotableTable({ rows, cols, selected, onSelect, sportColor }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: cols.map(c => c.w).join(" "), padding: "0.4rem 0.75rem", borderBottom: `1px solid ${C.border}` }}>
        {cols.map(c => <div key={c.k} style={{ fontFamily: F.mono, fontSize: "0.52rem", letterSpacing: "0.12em", textTransform: "uppercase", color: C.faint }}>{c.l}</div>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} onClick={() => onSelect(i)}
          style={{ display: "grid", gridTemplateColumns: cols.map(c => c.w).join(" "), padding: "0.7rem 0.75rem", borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected === i ? C.card : "transparent", transition: "background 0.12s" }}>
          {cols.map(c => (
            <div key={c.k} style={{ fontFamily: F.mono, fontSize: "0.82rem", color: c.accent ? sportColor : C.ink, fontWeight: c.bold ? 600 : 400 }}>
              {c.k === "#" ? `#${i + 1}` : r[c.k]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── NOTABLE SECTION ─── */
function NotableSection({ unitSystem="metric" }) {
  const [sport, setSport] = useState("races");
  const [tab, setTab] = useState("pbs");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [prs, setPrs] = useState([]);
  useEffect(() => {
    const ACT_MAP = {"400m":6796419022,"1/2 mile":12017370695,"1K":12017370695,"1 mile":10799004879,"2 mile":10799004879,"5K":10991460408,"10K":14300148280,"15K":14300148280,"10 mile":14300148280,"20K":14300148280,"Half-Marathon":14300148280,"30K":17985954019};
    setLoading(true);
    q("best_efforts?select=distance_label,elapsed_time,sport&sport=eq.run&order=elapsed_time.asc")
      .then(async bes => {
        if (!Array.isArray(bes)) { setLoading(false); return; }
        // Only show distances we have activity IDs for
        const relevant = bes.filter(b => ACT_MAP[b.distance_label]);
        // Fetch unique activities
        const uniqueIds = [...new Set(relevant.map(b => ACT_MAP[b.distance_label]))];
        const actMap = {};
        await Promise.all(uniqueIds.map(id =>
          q(`activities?select=id,name,start_date_local,distance,total_elevation_gain,average_heartrate,map_summary_polyline&id=eq.${id}`)
            .then(rows => { if (Array.isArray(rows) && rows.length) actMap[id] = rows[0]; })
        ));
        const result = relevant.map(b => ({
          _label: b.distance_label,
          _elapsed: b.elapsed_time,
          ...actMap[ACT_MAP[b.distance_label]],
        }));
        setPrs(result);
        setLoading(false);
      });
  }, []);
  const sportColor = sport === "run" ? C.run : sport === "ride" ? C.ride : C.swim;
  useEffect(() => {
    if (sport === "races") { setLoading(false); return; }
    setLoading(true); setSelected(0);
    let queryUrl = "";
    if (sport === "run" && tab === "pbs") { setLoading(false); return; } // pbs uses best_efforts table instead
    else if (tab === "longest") { const tf = sport==="ride"?"type=in.(Ride,VirtualRide)":sport==="swim"?"type=eq.Swim":"type=eq.Run"; queryUrl=`activities?select=id,name,start_date_local,distance,moving_time,total_elevation_gain,average_heartrate,average_speed,map_summary_polyline&${tf}&order=distance.desc&limit=10`; }
    else if (tab === "elevation") { const tf = sport==="ride"?"type=in.(Ride,VirtualRide)":"type=eq.Run"; queryUrl=`activities?select=id,name,start_date_local,distance,moving_time,total_elevation_gain,average_heartrate,average_speed,map_summary_polyline&${tf}&total_elevation_gain=gt.0&order=total_elevation_gain.desc&limit=10`; }
    if (!queryUrl) { setLoading(false); return; }
    q(queryUrl).then(data => { setRows(safe(data)); setLoading(false); }).catch(() => setLoading(false));
  }, [sport, tab]);
  useEffect(() => {
    if (sport === "races") return;
    if (sport === "ride" || sport === "swim") setTab("longest"); else setTab("pbs");
  }, [sport]);
  const cur = rows[selected];
  const fmtTime = s => { if (!s) return "—"; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return h>0?`${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`:`${m}:${String(sec).padStart(2,"0")}`; };
  const fmtDate = d => d ? new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";
  const fmtPace = (t,d) => { if(!t||!d) return "—"; const s=unitSystem==="imperial"?t/(d/1609.34):t/(d/1000); return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}/${unitSystem==="imperial"?"mi":"km"}`; };
  const fmtSpeed = s => s?`${unitSystem==="imperial"?(s*2.237).toFixed(1):(s*3.6).toFixed(1)} ${unitSystem==="imperial"?"mi/h":"km/h"}`:"—";
  const fmtSwimPace = (t,d) => { if(!t||!d) return "—"; const s=unitSystem==="imperial"?t/(d/91.44):t/(d/100); return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}/${unitSystem==="imperial"?"100yd":"100m"}`; };
  const cols = tab==="pbs"?[{k:"#",l:"#",w:"40px"},{k:"date",l:"Date",w:"110px"},{k:"dist",l:"Distance",w:"100px"},{k:"time",l:"Time",w:"1fr",mono:true,accent:true}]:tab==="elevation"?[{k:"#",l:"#",w:"40px"},{k:"date",l:"Date",w:"110px"},{k:"dist",l:"Dist",w:"80px"},{k:"elev",l:"Elevation",w:"1fr",accent:true}]:[{k:"#",l:"#",w:"40px"},{k:"date",l:"Date",w:"110px"},{k:"dist",l:"Distance",w:"1fr",accent:true}];
  const tableRows = rows.map(r => ({
    dist: sport==="swim"?(unitSystem==="imperial"?Math.round(r.distance*1.09361)+" yd":Math.round(r.distance)+" m"):(unitSystem==="imperial"?(r.distance/1609.34).toFixed(1)+" mi":(r.distance/1000).toFixed(1)+" km"),
    date: fmtDate(r.start_date_local), time: fmtTime(r.moving_time),
    elev: unitSystem==="imperial"?`${Math.round((r.total_elevation_gain||0)*3.28084)} ft`:`${Math.round(r.total_elevation_gain||0)} m`,
    name: r.name,
  }));
  const RACES = [
    {race:"IM70.3 Cascais",date:"Oct '22",swim:"0:30:39",bike:"2:33:46",run:"1:35:13",finish:"4:48:04",s:"fin"},
    {race:"IM70.3 Florianópolis",date:"Apr '23",swim:"0:31:25",bike:"2:25:23",run:"1:36:15",finish:"4:39:27",s:"fin"},
    {race:"Challenge Geraardsbergen",date:"Jun '23",swim:"0:34:50",bike:"1:01:37",run:"—",finish:"DNF",s:"dnf"},
    {race:"IM70.3 Rio de Janeiro",date:"Jul '23",swim:"0:34:36",bike:"2:31:53",run:"1:40:41",finish:"4:55:39",s:"fin"},
    {race:"IM70.3 São Paulo",date:"Sep '23",swim:"0:32:15",bike:"2:24:13",run:"1:38:20",finish:"4:42:56",s:"fin"},
    {race:"IM70.3 Cascais",date:"Oct '23",swim:"0:28:29",bike:"2:32:53",run:"1:25:14",finish:"4:34:03",s:"fin"},
    {race:"IM70.3 Panama City",date:"Feb '24",swim:"0:23:27",bike:"2:26:08",run:"1:49:40",finish:"4:46:08",s:"fin"},
    {race:"IM70.3 Eagleman",date:"Jun '24",swim:"0:36:29",bike:"2:27:10",run:"1:42:01",finish:"4:52:26",s:"fin"},
    {race:"IM70.3 São Paulo",date:"Sep '24",swim:"—",bike:"—",run:"—",finish:"DNS",s:"dns"},
    {race:"IM70.3 Cascais",date:"Oct '24",swim:"0:31:06",bike:"2:24:08",run:"1:28:34",finish:"4:30:59",s:"fin"},
    {race:"Challenge Florianópolis",date:"Nov '24",swim:"0:28:13",bike:"2:18:59",run:"1:26:56",finish:"4:21:47",s:"fin",pr:2},
    {race:"IM70.3 Punta del Este",date:"Mar '25",swim:"0:24:30",bike:"1:19:19",run:"—",finish:"DNF",s:"dnf"},
    {race:"IM70.3 Brasília",date:"Apr '25",swim:"0:28:28",bike:"2:16:45",run:"1:38:18",finish:"4:28:00",s:"fin",pr:3},
    {race:"Challenge Samorin",date:"May '25",swim:"0:10:48",bike:"2:27:18",run:"1:26:20",finish:"DNC",s:"dnc"},
    {race:"IM70.3 Marbella World Championship",date:"Nov '25",swim:"0:30:30",bike:"2:46:13",run:"1:26:48",finish:"4:52:24",s:"fin"},
    {race:"Challenge Florianópolis",date:"Nov '25",swim:"0:27:45",bike:"2:18:45",run:"1:41:10",finish:"4:32:46",s:"fin"},
    {race:"IM70.3 Curitiba",date:"Mar '26",swim:"0:27:49",bike:"2:42:58",run:"1:33:08",finish:"4:48:41",s:"fin"},
    {race:"IM70.3 Brasília",date:"Apr '26",swim:"0:27:57",bike:"2:14:26",run:"1:30:46",finish:"4:18:09",s:"fin",pr:1},
  ];
  return (
    <section id="notable" style={{ scrollMarginTop:50, paddingBottom:"4rem" }}>
      <Divider />
      <SectionNum n={2} />
      <h2 style={{ fontFamily:F.heading, fontSize:"clamp(2rem,5vw,3.5rem)", fontWeight:800, color:C.ink, margin:"0 0 1.5rem", lineHeight:0.9, letterSpacing:"-1px" }}>
        NOTABLE <span style={{ color:sport==="races"?"#A63D2F":sportColor }}>{sport==="races"?"RACES":sport.toUpperCase()+"S"}</span>
      </h2>
      <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem" }}>
        <SportTab label="RACES" active={sport==="races"} onClick={()=>setSport("races")} color="#A63D2F" />
        <SportTab label="RUNS" active={sport==="run"} onClick={()=>setSport("run")} color={C.run} />
        <SportTab label="RIDES" active={sport==="ride"} onClick={()=>setSport("ride")} color={C.ride} />
        <SportTab label="SWIMS" active={sport==="swim"} onClick={()=>setSport("swim")} color={C.swim} />
      </div>
      {sport==="races" ? (
        <div>
          <div style={{ fontFamily:F.mono, fontSize:"0.48rem", letterSpacing:"0.12em", color:C.muted, marginBottom:"0.75rem" }}>PERSONAL RECORDS</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"1px", background:C.border, border:"1px solid "+C.border, marginBottom:"1.5rem" }}>
            {[{l:"SWIM",v:"0:23:27",sub:"Panama '24",c:C.swim},{l:"BIKE",v:"2:14:26",sub:"Brasília '26",c:C.ride},{l:"RUN",v:"1:25:14",sub:"Cascais '23",c:C.run},{l:"FINISH",v:"4:18:09",sub:"Brasília '26",c:C.ink}].map((pr,i)=>(
              <div key={i} style={{ background:C.bg, padding:"0.65rem 0.75rem" }}>
                <div style={{ fontFamily:F.mono, fontSize:"0.45rem", letterSpacing:"0.1em", color:C.faint, marginBottom:"0.2rem" }}>{pr.l}</div>
                <div style={{ fontFamily:F.mono, fontSize:"0.82rem", fontWeight:700, color:pr.c }}>{pr.v}</div>
                <div style={{ fontFamily:F.mono, fontSize:"0.45rem", color:C.muted, marginTop:"0.15rem" }}>{pr.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily:F.mono, fontSize:"0.48rem", letterSpacing:"0.12em", color:C.muted, marginBottom:"0.75rem" }}>RACE HISTORY — 18 RACES · 15 FINISHES · 2 DNF · 1 DNS · 1 DNC</div>
          <div style={{ overflowX:"auto" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1.5fr 90px 80px 80px 80px 90px", gap:"1px", background:C.border, border:"1px solid "+C.border, minWidth:"520px" }}>
              {["RACE","DATE","SWIM","BIKE","RUN","FINISH"].map((h,i)=>(
                <div key={i} style={{ background:C.surface, padding:"0.4rem 0.5rem", fontFamily:F.mono, fontSize:"0.45rem", letterSpacing:"0.1em", color:[C.faint,C.faint,C.swim,C.ride,C.run,C.ink][i], textAlign:i>1?"center":"left" }}>{h}</div>
              ))}
              {RACES.map((r,i)=>{
                const dnx=r.s!=="fin"; const bg=i%2===0?C.bg:C.surface;
                const fc=r.s==="dnf"?"#c04040":r.s==="dns"?"#888":r.s==="dnc"?"#7050b0":C.green;
                return [
                  <div key={"n"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.ink,opacity:dnx?"0.5":"1",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                    {r.race}{r.pr&&<span style={{fontFamily:F.mono,fontSize:"0.45rem",letterSpacing:"0.08em",background:r.pr===1?"#D4AF37":r.pr===2?"#A8A9AD":"#CD7F32",color:"#fff",padding:"0.1rem 0.3rem",borderRadius:2,fontWeight:700,flexShrink:0}}>{r.pr===1?"PR #1":r.pr===2?"PR #2":"PR #3"}</span>}
                  </div>,
                  <div key={"d"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.muted,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.date}</div>,
                  <div key={"s"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.swim,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.swim}</div>,
                  <div key={"b"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.ride,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.bike}</div>,
                  <div key={"r"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",color:C.run,textAlign:"center",opacity:dnx?"0.5":"1"}}>{r.run}</div>,
                  <div key={"f"+i} style={{background:bg,padding:"0.45rem 0.5rem",fontFamily:F.mono,fontSize:"0.82rem",fontWeight:dnx?400:700,color:fc,textAlign:"center"}}>{r.finish}</div>
                ];
              })}
            </div>
          </div>
          <div style={{ fontFamily:F.mono, fontSize:"0.48rem", color:C.faint, marginTop:"0.75rem", letterSpacing:"0.05em" }}>DNF — Did not finish | DNS — Did not start | DNC — Did not count</div>
        </div>
      ) : (
        <>
          <div style={{ display:"flex", gap:"0.4rem", justifyContent:"center", marginBottom:"0.5rem" }}>
            {sport==="run"&&<SubTab label="PERSONAL BESTS" active={tab==="pbs"} onClick={()=>setTab("pbs")} />}
            <SubTab label="LONGEST" active={tab==="longest"} onClick={()=>setTab("longest")} />
            {sport!=="swim"&&<SubTab label="ELEVATION GAIN" active={tab==="elevation"} onClick={()=>setTab("elevation")} />}
          </div>
          <div style={{ fontFamily:F.mono, fontSize:"0.62rem", color:C.faint, marginBottom:"1rem" }}>
            {tab==="pbs"?"fastest times across standard running distances":tab==="longest"?`my longest ${sport}s on record`:`the most vertical gain in a single ${sport}`}
          </div>
          {sport==="run"&&tab==="pbs" ? (
            loading ? (
              <div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint, padding:"3rem 0" }}>loading...</div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"300px 1fr 280px", gap:"0", border:"1px solid "+C.border, borderRadius:4, overflow:"hidden", background:C.surface }}>
                <div style={{ borderRight:`1px solid ${C.border}` }}>
                  <NotableTable
                    rows={prs.map(r=>({ dist:r._label, date:fmtDate(r.start_date_local), time:fmtTime(r._elapsed), name:r.name }))}
                    cols={[{k:"#",l:"#",w:"40px"},{k:"dist",l:"Distance",w:"120px"},{k:"time",l:"Time",w:"1fr",mono:true,accent:true}]}
                    selected={selected} onSelect={setSelected} sportColor={sportColor}
                  />
                </div>
                <div>
                  <ActivityMap polyline={prs[selected]?.map_summary_polyline} type="Run" height={380} />
                </div>
                <div style={{ padding:"1.25rem", borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                  {prs[selected] && (<>
                    <div style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, marginBottom:"0.5rem" }}>{fmtDate(prs[selected].start_date_local)}</div>
                    <div style={{ fontFamily:F.heading, fontSize:"1.1rem", fontWeight:700, color:C.ink, marginBottom:"1rem", lineHeight:1.2 }}>{prs[selected].name}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0", borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
                      {[
                        {l:"DISTANCE", v:prs[selected]._label},
                        {l:"TIME", v:fmtTime(prs[selected]._elapsed)},
                        {l:"AVG PACE", v:(()=>{const dm={"400m":400,"1/2 mile":804,"1K":1000,"1 mile":1609,"2 mile":3218,"5K":5000,"10K":10000,"15K":15000,"10 mile":16093,"20K":20000,"Half-Marathon":21097,"30K":30000}; const d=dm[prs[selected]._label]; if(!d) return "—"; const s=prs[selected]._elapsed/d*(unitSystem==="imperial"?1609.34:1000); return `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}/${unitSystem==="imperial"?"mi":"km"}`; })()},
                        {l:"ELEVATION", v:unitSystem==="imperial"?`${Math.round((prs[selected].total_elevation_gain||0)*3.28084)} ft`:`${Math.round(prs[selected].total_elevation_gain||0)} m`},
                      ].map(({l,v})=>(
                        <div key={l}>
                          <div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>{l}</div>
                          <div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {prs[selected].average_heartrate && (
                      <div>
                        <div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>AVG HR (BPM)</div>
                        <div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{Math.round(prs[selected].average_heartrate)}</div>
                      </div>
                    )}
                    <div style={{ marginTop:"auto", paddingTop:"1rem", borderTop:`1px solid ${C.border}` }}>
                      <a href={`https://www.strava.com/activities/${prs[selected].id}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily:F.mono, fontSize:"0.58rem", letterSpacing:"0.1em", color:C.muted, textDecoration:"none" }}>
                        VIEW ON STRAVA →
                      </a>
                    </div>
                  </>)}
                </div>
              </div>
            )
          ) : loading?(<div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint, padding:"3rem 0" }}>loading...</div>):(
            <div style={{ display:"grid", gridTemplateColumns:"300px 1fr 280px", gap:"0", border:`1px solid ${C.border}`, borderRadius:4, overflow:"hidden", background:C.surface }}>
              <div style={{ borderRight:`1px solid ${C.border}` }}><NotableTable rows={tableRows} cols={cols} selected={selected} onSelect={setSelected} sportColor={sportColor} /></div>
              <div><ActivityMap polyline={cur?.map_summary_polyline} type={sport==="run"?"Run":sport==="ride"?"Ride":"Swim"} height={380} /></div>
              <div style={{ padding:"1.25rem", borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:"0.1rem" }}>
                {cur&&(<>
                  <div style={{ fontFamily:F.mono, fontSize:"0.58rem", color:C.faint, marginBottom:"0.5rem" }}>{fmtDate(cur.start_date_local)}</div>
                  <div style={{ fontFamily:F.heading, fontSize:"1.1rem", fontWeight:700, color:C.ink, marginBottom:"1rem", lineHeight:1.2 }}>{cur.name}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0", borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
                    {[
                      {l:unitSystem==="imperial"?"MILES":"KILOMETERS",v:unitSystem==="imperial"?`${(cur.distance/1609.34).toFixed(1)} mi`:`${(cur.distance/1000).toFixed(1)} km`},
                      {l:"TIME",v:fmtTime(cur.moving_time)},
                      {l:sport==="ride"?"AVG SPEED":"AVG PACE",v:sport==="ride"?fmtSpeed(cur.average_speed):sport==="swim"?fmtSwimPace(cur.moving_time,cur.distance):fmtPace(cur.moving_time,cur.distance)},
                      {l:"ELEVATION",v:unitSystem==="imperial"?`${Math.round((cur.total_elevation_gain||0)*3.28084)} ft`:`${Math.round(cur.total_elevation_gain||0)} m`},
                    ].map(({l,v})=>(<div key={l}><div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>{l}</div><div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{v}</div></div>))}
                  </div>
                  {cur.average_heartrate&&(<div><div style={{ fontFamily:F.mono, fontSize:"0.5rem", letterSpacing:"0.12em", color:C.faint, marginBottom:2 }}>AVG HR (BPM)</div><div style={{ fontFamily:F.mono, fontSize:"0.85rem", fontWeight:700, color:C.ink }}>{Math.round(cur.average_heartrate)}</div></div>)}
                  <div style={{ marginTop:"auto", paddingTop:"1rem", borderTop:`1px solid ${C.border}` }}>
                    <a href={`https://www.strava.com/activities/${cur.id}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily:F.mono, fontSize:"0.58rem", letterSpacing:"0.1em", color:C.muted, textDecoration:"none" }}>VIEW ON STRAVA →</a>
                  </div>
                </>)}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}


const ChartBox = ({ title, subtitle, children, minH }) => (
  <div style={{ background:C.bg, padding:"1.25rem", display:"flex", flexDirection:"column", minHeight:minH||280 }}>
    <div style={{ textAlign:"center", marginBottom:"0.75rem" }}>
      <div style={{ fontFamily:F.mono, fontSize:"0.58rem", letterSpacing:"0.15em", textTransform:"uppercase", color:C.muted, fontWeight:500 }}>{title}</div>
      {subtitle && <div style={{ fontFamily:F.mono, fontSize:"0.5rem", color:C.faint, marginTop:2, fontStyle:"italic" }}>{subtitle}</div>}
    </div>
    <div style={{ flex:1 }}>{children}</div>
  </div>
);

function StatsSection({ sportFilter, unitSystem="metric" }) {
  const isMetric = unitSystem === "metric";
  const distUnit = isMetric ? "km" : "mi";
  const toUnit = (km) => isMetric ? km : +(km * 0.621371).toFixed(1);
  const toUnitRound = (km) => Math.round(isMetric ? km : km * 0.621371);
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all activities with all fields needed for charts
    async function fetchAll() {
      const map = [];
      let offset = 0;
      const pageSize = 1000;
      while(true) {
        const res = await fetch(
          `${SB_URL}/rest/v1/activities?select=sport_type,distance,moving_time,average_heartrate,average_speed,start_date_local,trainer&order=start_date_local.asc&limit=${pageSize}&offset=${offset}`,
          { headers: SBH }
        ).then(r=>r.json());
        if(!Array.isArray(res)||res.length===0) break;
        map.push(...res);
        if(res.length<pageSize) break;
        offset+=pageSize;
      }
      setActs(map);
      setLoading(false);
    }
    fetchAll();
  }, []);

  // Sport filter helpers
  const isRun  = t => t==='Run'||t==='TrailRun';
  const isRide = t => t==='Ride'||t==='VirtualRide';
  const isSwim = t => t==='Swim';
  const matchesSport = (a) => {
    if(sportFilter==='all') return isRun(a.sport_type)||isRide(a.sport_type)||isSwim(a.sport_type);
    if(sportFilter==='run')  return isRun(a.sport_type);
    if(sportFilter==='ride') return isRide(a.sport_type);
    if(sportFilter==='swim') return isSwim(a.sport_type);
    return true;
  };

  const filtered = acts.filter(matchesSport);
  const isAll = sportFilter==='all';
  const [distTip, setDistTip] = useState(null);
  const sColor = sportFilter==='run'?C.run:sportFilter==='ride'?C.ride:sportFilter==='swim'?C.swim:C.green;
  const hrColors = ["#2d8a7e","#4a7c59","#9a7e5a","#c47a2a","#b85a3a"];

  // ── Annual Distance ──
  const annMap = {};
  acts.filter(a=>isRun(a.sport_type)||isRide(a.sport_type)||isSwim(a.sport_type)).forEach(a => {
    const yr = a.start_date_local?.slice(0,4);
    if(!yr||+yr<2019) return;
    if(!annMap[yr]) annMap[yr]={year:yr,run:0,ride:0,swim:0};
    const km = (+a.distance||0)/1000;
    if(isRun(a.sport_type))  annMap[yr].run  += km;
    if(isRide(a.sport_type)) annMap[yr].ride += km;
    if(isSwim(a.sport_type)) annMap[yr].swim += km;
  });
  const annData = Object.values(annMap).sort((a,b)=>a.year-b.year).map(y=>({
    ...y,
    run:toUnitRound(y.run), ride:toUnitRound(y.ride), swim:toUnitRound(y.swim),
    km: toUnitRound(isAll ? y.run+y.ride+y.swim : sportFilter==='run'?y.run:sportFilter==='ride'?y.ride:y.swim),
  }));

  // ── Distance Distribution ──
  const mkB = (label,arr,lo,hi) => ({label, count:arr.filter(a=>{const km=(+a.distance||0)/1000;return km>=lo&&(hi===999?true:km<hi);}).length});
  const runActs2  = acts.filter(a=>isRun(a.sport_type));
  const rideActs2 = acts.filter(a=>a.sport_type==='Ride'||a.sport_type==='VirtualRide');
  const swimActs2 = acts.filter(a=>isSwim(a.sport_type));
  const runDist  = [mkB("0–5km",runActs2,0,5),mkB("5–10km",runActs2,5,10),mkB("10–15km",runActs2,10,15),mkB("15–21km",runActs2,15,21),mkB("21–30km",runActs2,21,30),mkB("30–42km",runActs2,30,42)];
  const rideDist = [mkB("0–20km",rideActs2,0,20),mkB("20–40km",rideActs2,20,40),mkB("40–60km",rideActs2,40,60),mkB("60–80km",rideActs2,60,80),mkB("80–100km",rideActs2,80,100),mkB("100–120km",rideActs2,100,120),mkB("120km+",rideActs2,120,999)];
  const swimDist = [mkB("0–500m",swimActs2,0,0.5),mkB("500m–1km",swimActs2,0.5,1),mkB("1–2km",swimActs2,1,2),mkB("2–3km",swimActs2,2,3),mkB("3–5km",swimActs2,3,5),mkB("5km+",swimActs2,5,999)];
  const _kmBuckets = sportFilter==='swim'?[[0,0.5],[0.5,1],[1,2],[2,3],[3,5],[5,999]]:sportFilter==='ride'?[[0,20],[20,40],[40,60],[60,80],[80,100],[100,120],[120,999]]:[[0,5],[5,10],[10,15],[15,21],[21,30],[30,42]];
  const distData = _kmBuckets.map(([lo,hi]) => {
    const label = hi===999?`${lo<1?lo*1000+"m":lo+"km"}+`:lo<1&&hi<=1?`${lo*1000}–${hi*1000}m`:`${lo<1?lo*1000+"m":lo+"km"}–${hi<1?hi*1000+"m":hi+"km"}`;
    return {label, count:filtered.filter(a=>{const km=(+a.distance||0)/1000;return km>=lo&&(hi===999?true:km<hi);}).length};
  });

  // ── Pace Distribution (run only, or all running for "all") ──
  const runActs = acts.filter(a=>isRun(a.sport_type));
  const paceActsToUse = isAll||sportFilter==='run' ? runActs : [];
  const paceBuckets = [
    {bucket:"<3:30",lo:0,hi:3.5},{bucket:"3:30-4:00",lo:3.5,hi:4},{bucket:"4:00-4:30",lo:4,hi:4.5},
    {bucket:"4:30-5:00",lo:4.5,hi:5},{bucket:"5:00-5:30",lo:5,hi:5.5},{bucket:"5:30+",lo:5.5,hi:999}
  ];
  const paceData = paceBuckets.map(b => ({
    bucket: b.bucket,
    count: paceActsToUse.filter(a=>{
      if(!a.average_speed||+a.average_speed===0) return false;
      const minKm = 1000/(+a.average_speed*60);
      return minKm>=b.lo&&minKm<b.hi;
    }).length
  }));

  // ── HR Zones ──
  const hrBounds = [[0,100],[100,120],[120,140],[140,160],[160,999]];
  const hrData = [
    {zone:"Recovery"},{zone:"Easy"},{zone:"Tempo"},{zone:"Threshold"},{zone:"Max"}
  ].map((z,i)=>({
    ...z,
    count: filtered.filter(a=>a.average_heartrate&&+a.average_heartrate>=hrBounds[i][0]&&+a.average_heartrate<hrBounds[i][1]).length
  }));

  // ── Activity breakdown (sport-aware) ──
  const ioData = sportFilter==="run" ? [
    {name:"Outdoor Run",value:acts.filter(a=>isRun(a.sport_type)&&!a.trainer).length,fill:C.run},
    {name:"Treadmill",value:acts.filter(a=>isRun(a.sport_type)&&a.trainer).length,fill:"#8a9a80"},
  ].filter(d=>d.value>0) : sportFilter==="ride" ? [
    {name:"Outdoor Ride",value:acts.filter(a=>a.sport_type==='Ride').length,fill:C.ride},
    {name:"Virtual Ride",value:acts.filter(a=>a.sport_type==='VirtualRide').length,fill:"#c0805a"},
  ].filter(d=>d.value>0) : sportFilter==="swim" ? [
    {name:"Open Water",value:acts.filter(a=>isSwim(a.sport_type)&&!a.trainer).length,fill:C.swim},
    {name:"Pool Swim",value:acts.filter(a=>isSwim(a.sport_type)&&a.trainer).length,fill:"#5a9ac0"},
  ].filter(d=>d.value>0) : [
    {name:"Runs",value:acts.filter(a=>isRun(a.sport_type)).length,fill:C.run},
    {name:"Rides",value:acts.filter(a=>a.sport_type==='Ride'||a.sport_type==='VirtualRide').length,fill:C.ride},
    {name:"Swims",value:acts.filter(a=>isSwim(a.sport_type)).length,fill:C.swim},
    {name:"Other",value:acts.filter(a=>!isRun(a.sport_type)&&a.sport_type!=='Ride'&&a.sport_type!=='VirtualRide'&&!isSwim(a.sport_type)).length,fill:C.muted},
  ].filter(d=>d.value>0);
  const ioTitle = sportFilter==="run"?"Indoor vs Outdoor":sportFilter==="ride"?"Indoor vs Outdoor":sportFilter==="swim"?"Pool vs Open Water":"All-time Activities";
  const ioSubtitle = sportFilter==="run"?"road or treadmill":sportFilter==="ride"?"road or trainer":sportFilter==="swim"?"lane or open water":"by sport type";

  // ── Yearly Volume (B) ──
  const yearlyMap = {};
  acts.forEach(a => {
    if (!a.start_date_local) return;
    const yr = new Date(a.start_date_local).getFullYear();
    if (!yearlyMap[yr]) yearlyMap[yr] = { run:0, ride:0, swim:0 };
    const km = (+a.distance||0)/1000;
    if (isRun(a.sport_type)) yearlyMap[yr].run += km;
    else if (a.sport_type==='Ride'||a.sport_type==='VirtualRide') yearlyMap[yr].ride += km;
    else if (isSwim(a.sport_type)) yearlyMap[yr].swim += km;
  });
  const yearlyData = Object.entries(yearlyMap).sort(([a],[b])=>+a-+b).map(([yr,v])=>({
    year: yr,
    run:  toUnitRound(v.run),
    ride: toUnitRound(v.ride),
    swim: toUnitRound(v.swim),
  }));

  // ── Streak Tracker (C) ──
  const actDays = new Set(acts.filter(a=>a.start_date_local).map(a=>a.start_date_local.slice(0,10)));
  const sortedDays = [...actDays].sort();
  let bestStreak = 0, curStreak = 0, streakEnd = '';
  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) { curStreak = 1; streakEnd = sortedDays[0]; }
    else {
      const prev = new Date(sortedDays[i-1]), curr = new Date(sortedDays[i]);
      const diff = (curr - prev) / 86400000;
      if (diff === 1) { curStreak++; streakEnd = sortedDays[i]; }
      else { curStreak = 1; streakEnd = sortedDays[i]; }
    }
    if (curStreak > bestStreak) bestStreak = curStreak;
  }
  const today = new Date().toISOString().slice(0,10);
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
  let liveStreak = 0;
  for (let i = sortedDays.length-1; i >= 0; i--) {
    const d = sortedDays[i];
    if (i === sortedDays.length-1) {
      if (d !== today && d !== yesterday) break;
      liveStreak = 1;
    } else {
      const next = new Date(sortedDays[i+1]), curr = new Date(d);
      if ((next - curr) / 86400000 === 1) liveStreak++;
      else break;
    }
  }
  const totalDaysWithActivity = actDays.size;

  // Time of day radar — 24 hours
  const buildTod = (subset) => {
    const m = {};
    for(let h=0;h<24;h++) m[h<10?'0'+h:String(h)] = 0;
    subset.forEach(a => { if(a.start_date_local) m[a.start_date_local.slice(11,13)] = (m[a.start_date_local.slice(11,13)]||0)+1; });
    return Object.entries(m).map(([hour,count])=>({hour,count}));
  };
  const todData = buildTod(filtered).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour));
  const todRun  = isAll ? buildTod(acts.filter(a=>isRun(a.sport_type))).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour))  : null;
  const todRide = isAll ? buildTod(acts.filter(a=>isRide(a.sport_type))).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour)) : null;
  const todSwim = isAll ? buildTod(acts.filter(a=>isSwim(a.sport_type))).sort((a,b)=>parseInt(a.hour)-parseInt(b.hour)) : null;
  const todMerged = isAll ? todData.map((d,i)=>({hour:d.hour, run:todRun[i].count, ride:todRide[i].count, swim:todSwim[i].count})) : todData;

  // Day of week radar
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const buildDow = (subset) => {
    const cnt = {}; const dist = {};
    days.forEach(d=>{cnt[d]=0;dist[d]=0;});
    subset.forEach(a => {
      if(!a.start_date_local) return;
      const [yr,mo,dy] = a.start_date_local.slice(0,10).split('-').map(Number);
      const d = new Date(yr,mo-1,dy);
      const day = days[(d.getDay()+6)%7];
      cnt[day]++;
      dist[day] += (+a.distance||0)/1000;
    });
    return days.map(d=>({day:d, avg:cnt[d]>0?Math.round(toUnit(dist[d]/cnt[d])*10)/10:0}));
  };
  const dowData   = buildDow(filtered);
  const dowRun    = isAll ? buildDow(acts.filter(a=>isRun(a.sport_type)))  : null;
  const dowRide   = isAll ? buildDow(acts.filter(a=>isRide(a.sport_type))) : null;
  const dowSwim   = isAll ? buildDow(acts.filter(a=>isSwim(a.sport_type))) : null;
  const dowMerged = isAll ? days.map((d,i)=>({day:d, run:dowRun[i].avg, ride:dowRide[i].avg, swim:dowSwim[i].avg})) : dowData;

  // Activity Mix Over Time — % of hours per sport per year (ALL tab only)
  const actMixData = (() => {
    const yrMap = {};
    acts.filter(a=>isRun(a.sport_type)||isRide(a.sport_type)||isSwim(a.sport_type)).forEach(a => {
      const yr = a.start_date_local?.slice(0,4);
      if(!yr||+yr<2019) return;
      if(!yrMap[yr]) yrMap[yr]={year:yr,run:0,ride:0,swim:0};
      const hrs = (+a.moving_time||0)/3600;
      if(isRun(a.sport_type))  yrMap[yr].run  += hrs;
      if(isRide(a.sport_type)) yrMap[yr].ride += hrs;
      if(isSwim(a.sport_type)) yrMap[yr].swim += hrs;
    });
    return Object.values(yrMap).sort((a,b)=>a.year-b.year).map(y => {
      const total = y.run+y.ride+y.swim||1;
      return {
        year: y.year,
        run:  +y.run.toFixed(1), ride: +y.ride.toFixed(1), swim: +y.swim.toFixed(1),
      };
    });
  })();

  const G = { display:"grid", gap:"1px", background:C.border, border:`1px solid ${C.border}` };
  const tickStyle = { fontFamily:F.mono, fontSize:9, fill:C.faint };

  if(loading) return <div style={{ fontFamily:F.mono, fontSize:"0.7rem", color:C.faint, padding:"2rem 0" }}>loading stats...</div>;

  return (
    <div>
      {/* ROW 0 — Annual Distance | Time of Day + Avg Dist */}
      <div style={{ ...G, gridTemplateColumns:"1fr 2fr" }}>
        <ChartBox title={`Annual Distance (${distUnit})`} subtitle={isAll?"all sports by year":sportFilter+" distance"} minH={310}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={annData} barSize={isAll?16:22}>
              <CartesianGrid vertical={false} stroke={C.border} />
              <XAxis dataKey="year" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={36} tickFormatter={v=>v>=1000?(Math.round(v/100)/10)+'k':v} />
              <Tooltip content={({ active, payload, label }) => {
                if(!active||!payload?.length) return null;
                const yearTotal = payload.reduce((s,p)=>s+(+p.value||0),0);
                return (
                  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"8px 12px",fontFamily:F.mono,fontSize:"0.65rem",color:C.ink}}>
                    <div style={{color:C.faint,marginBottom:4}}>{label}</div>
                    {payload.map(p=>(
                      <div key={p.dataKey} style={{color:p.color||C.ink}}>
                        {p.name}: <strong>{Math.round(p.value).toLocaleString()}</strong>{p.unit||""}
                      </div>
                    ))}
                    {isAll && payload.length>1 && (
                      <>
                        <div style={{borderTop:`1px solid ${C.border}`,marginTop:4,paddingTop:4}}/>
                        <div style={{color:C.ink}}>Total: <strong>{Math.round(yearTotal).toLocaleString()}</strong> {distUnit}</div>
                      </>
                    )}
                  </div>
                );
              }} cursor={{fill:"rgba(0,0,0,0.03)"}} />
              {isAll ? <>
                <Bar dataKey="swim" stackId="a" fill={C.swim} name="Swim" unit={" "+distUnit} />
                <Bar dataKey="ride" stackId="a" fill={C.ride} name="Ride" unit={" "+distUnit} />
                <Bar dataKey="run"  stackId="a" fill={C.run}  radius={[2,2,0,0]} name="Run"  unit={" "+distUnit} />
              </> : <Bar dataKey="km" fill={sColor} radius={[2,2,0,0]} name={sportFilter==="run"?"Run":sportFilter==="ride"?"Ride":"Swim"} unit={" "+distUnit} />}
            </BarChart>
          </ResponsiveContainer>
          {(() => {
            const totalKm = Math.round(annData.reduce((s,y)=>s+(isAll?y.run+y.ride+y.swim:y.km),0));
            return (
              <>
                {isAll && (
                  <div style={{display:"flex",gap:"0.75rem",justifyContent:"center",marginTop:"0.5rem"}}>
                    {[["Run",C.run],["Ride",C.ride],["Swim",C.swim]].map(([l,c])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:3,fontFamily:F.mono,fontSize:"0.5rem",color:C.faint}}>
                        <div style={{width:7,height:7,borderRadius:1,background:c}}/>{l}
                      </div>
                    ))}
                  </div>
                )}

              </>
            );
          })()}
        </ChartBox>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1px",background:C.border}}>
          <ChartBox title="Activity by Time of Day" subtitle="peak: early morning" minH={310}>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={isAll?todMerged:todData} cx="50%" cy="50%">
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="hour" tick={{fontFamily:F.mono,fontSize:8,fill:C.faint}} />
                {isAll ? <>
                  <Radar dataKey="run"  stroke={C.run}  fill={C.run}  fillOpacity={0.1} dot={false} name="Run" />
                  <Radar dataKey="ride" stroke={C.ride} fill={C.ride} fillOpacity={0.1} dot={false} name="Ride" />
                  <Radar dataKey="swim" stroke={C.swim} fill={C.swim} fillOpacity={0.1} dot={false} name="Swim" />
                </> : <Radar dataKey="count" stroke={sColor} fill={sColor} fillOpacity={0.2} dot={false} name="activities" />}
                <Tooltip content={<Tip />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartBox>
          <ChartBox title="Avg Distance by Day" subtitle="consistency, they call it" minH={310}>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={isAll?dowMerged:dowData}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="day" tick={{fontFamily:F.mono,fontSize:8,fill:C.faint}} />
                {isAll ? <>
                  <Radar dataKey="run"  stroke={C.run}  fill={C.run}  fillOpacity={0.1} dot={false} name="Run"  unit={" "+distUnit} />
                  <Radar dataKey="ride" stroke={C.ride} fill={C.ride} fillOpacity={0.1} dot={false} name="Ride" unit={" "+distUnit} />
                  <Radar dataKey="swim" stroke={C.swim} fill={C.swim} fillOpacity={0.1} dot={false} name="Swim" unit={" "+distUnit} />
                </> : <Radar dataKey="avg" stroke={sColor} fill={sColor} fillOpacity={0.2} dot={false} name="Avg" unit={" "+distUnit} />}
                <Tooltip content={<Tip />} />
              </RadarChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
      </div>

      {/* ROW 1 — Distance Dist | Indoor/Outdoor | Streaks */}
      <div style={{...G, gridTemplateColumns:"1fr 1fr 1fr", borderTop:"none"}}>
        <ChartBox title="Distance Distribution" subtitle="activity counts by distance" minH={331}>
          {isAll ? (
            <div style={{paddingTop:"0.25rem",position:"relative"}} onMouseLeave={()=>setDistTip(null)}>
              {distTip&&<div style={{position:"fixed",pointerEvents:"none",zIndex:9999,background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"6px 10px",fontFamily:F.mono,fontSize:"0.65rem",color:C.ink,top:distTip.y-40,left:distTip.x+14,whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(0,0,0,0.1)",display:"flex",gap:"0.4rem",alignItems:"center"}}><span style={{color:distTip.color,fontWeight:700}}>{distTip.label}:</span><span>{distTip.count}</span></div>}
              {[{label:"RUNS",data:runDist,color:C.run},{label:"RIDES",data:rideDist,color:C.ride},{label:"SWIMS",data:swimDist,color:C.swim}].map(({label,data,color},si)=>(
                <div key={si} style={{marginBottom:si<2?"0.75rem":"0"}}>
                  <div style={{fontFamily:F.mono,fontSize:"0.48rem",letterSpacing:"0.1em",color,marginBottom:"0.3rem"}}>{label}</div>
                  {data.map((d,i)=>{
                    const max=Math.max(...data.map(x=>x.count),1);
                    return (
                      <div key={i} onMouseEnter={e=>setDistTip({label:d.label,count:d.count,color,x:e.clientX,y:e.clientY})} style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.2rem",cursor:"default"}}>
                        <div style={{fontFamily:F.mono,fontSize:"0.48rem",color:C.faint,width:60,flexShrink:0,textAlign:"right"}}>{d.label}</div>
                        <div style={{flex:1,background:C.border,borderRadius:2,height:10,overflow:"hidden"}}>
                          <div style={{height:"100%",background:color,borderRadius:2,width:d.count>0?Math.max(4,Math.round(d.count/max*100))+"%":"0%",transition:"width 0.3s"}} />
                        </div>
                        <div style={{fontFamily:F.mono,fontSize:"0.48rem",color:C.muted,width:24,textAlign:"right"}}>{d.count}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distData} layout="vertical" barSize={14}>
                <CartesianGrid horizontal={false} stroke={C.border} />
                <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} hide />
                <YAxis type="category" dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<Tip />} cursor={{fill:"rgba(0,0,0,0.03)"}} />
                <Bar dataKey="count" fill={sColor} radius={[0,2,2,0]} name="activities" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBox>
        <ChartBox title={ioTitle} subtitle={ioSubtitle} minH={331}>
          {ioData.length>0 && (
            <div style={{height:220,display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              <ResponsiveContainer width="100%" height={155}>
                <PieChart>
                  <Pie data={ioData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value" strokeWidth={0} paddingAngle={2}>
                    {ioData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                  </Pie>
                  <Tooltip content={({active,payload})=>{
                    if(!active||!payload?.length) return null;
                    const p=payload[0]; const total=ioData.reduce((s,d)=>s+d.value,0);
                    const pct=total>0?Math.round(p.value/total*100):0;
                    return (<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,padding:"8px 12px",fontFamily:F.mono,fontSize:"0.65rem",color:C.ink,display:"flex",gap:"0.5rem",alignItems:"center"}}><span style={{color:p.payload.fill,fontWeight:700}}>{p.name}:</span><span>{p.value} · {pct}%</span></div>);
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.2rem 0.5rem"}}>
                {ioData.map(d=>(
                  <div key={d.name} style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{width:6,height:6,borderRadius:1,background:d.fill,flexShrink:0}}/>
                    <span style={{fontFamily:F.mono,fontSize:"0.5rem",color:C.faint}}>{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartBox>
        <ChartBox title="Activity Streaks" subtitle="consecutive days" minH={331}>
          <div style={{display:"flex",flexDirection:"column",gap:"1.25rem",paddingTop:"0.75rem"}}>
            {[
              {label:"BEST STREAK",value:bestStreak+" days",color:C.run},
              {label:"CURRENT STREAK",value:liveStreak+" days",color:liveStreak>=bestStreak?C.run:liveStreak>0?C.ride:C.faint},
              {label:"ACTIVE DAYS",value:totalDaysWithActivity.toLocaleString(),color:C.ink},
            ].map(({label,value,color})=>(
              <div key={label} style={{borderLeft:`3px solid ${color}`,paddingLeft:"0.75rem"}}>
                <div style={{fontFamily:F.mono,fontSize:"0.45rem",letterSpacing:"0.12em",color:C.faint,marginBottom:"0.2rem"}}>{label}</div>
                <div style={{fontFamily:F.mono,fontSize:"1.1rem",fontWeight:700,color}}>{value}</div>
              </div>
            ))}
          </div>
        </ChartBox>
      </div>


