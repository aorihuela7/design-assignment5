import { RADIUS_NM, STATUS_ORDER, type AircraftStatus, type LiveAircraft } from "@/lib/live";

// The SVG's scale: the 30 NM ring is 100 units from the airport.
const R = 100;
const RINGS = [10, 20, 30];
const toUnits = (nm: number) => (nm / RADIUS_NM) * R;

// Status by shape and mark, never color alone: a plane with ↓ or ↑ when descending or
// climbing, a plain plane passing over, a dot on the ground.
const MARK: Record<AircraftStatus, string> = { descending: "↓", climbing: "↑", level: "", on_ground: "" };
const WORDS: Record<AircraftStatus, string> = {
  descending: "descending",
  climbing: "climbing",
  on_ground: "on the ground",
  level: "passing over",
};

// A plane pointing north, about 10 units across, drawn around its middle.
const PLANE =
  "M0,-5 L1,-1.2 L5,1 L5,2.2 L1,1.2 L0.7,3.8 L2,4.9 L2,5.7 L0,5.1 L-2,5.7 L-2,4.9 L-0.7,3.8 L-1,1.2 L-5,2.2 L-5,1 L-1,-1.2 Z";

// A radar for one airport: where each aircraft is (distance and bearing from the
// airport) and which way it's heading. Decorative for screen readers, with a summary;
// the table below is the accessible view. On each update the planes glide to their
// new places (300 ms), and jump there with reduced motion.
export function Radar({ code, aircraft }: { code: string; aircraft: LiveAircraft[] }) {
  const placed = aircraft.filter((a) => a.bearing_deg !== null);
  const summary = STATUS_ORDER.map((status) => [status, aircraft.filter((a) => a.status === status).length] as const)
    .filter(([, n]) => n > 0)
    .map(([status, n]) => `${n} ${WORDS[status]}`)
    .join(", ");
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg
        aria-hidden="true"
        viewBox="-112 -114 224 228"
        className="w-full max-w-md font-mono text-amber"
      >
        {/* North, and the rings with their distances. */}
        <line x1="0" y1={-R} x2="0" y2={R} className="stroke-white/15" strokeWidth="0.5" />
        <line x1={-R} y1="0" x2={R} y2="0" className="stroke-white/15" strokeWidth="0.5" />
        <text x="0" y={-R - 4} textAnchor="middle" className="fill-white text-[7px]">
          N
        </text>
        {RINGS.map((nm) => (
          <g key={nm}>
            <circle r={toUnits(nm)} fill="none" className="stroke-white/25" strokeWidth="0.6" />
            <text x="2" y={-toUnits(nm) + 6} className="fill-white text-[5px]">
              {nm} NM
            </text>
          </g>
        ))}
        {/* The airport. */}
        <rect x="-2" y="-2" width="4" height="4" className="fill-white" />
        <text x="4" y="8" className="fill-white text-[6px]">
          {code}
        </text>
        {placed.map((a) => {
          const units = toUnits(a.distance_nm);
          const radians = ((a.bearing_deg ?? 0) * Math.PI) / 180;
          const x = units * Math.sin(radians);
          const y = -units * Math.cos(radians);
          return (
            <g
              key={a.hex}
              style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` }}
              className="transition-transform duration-300 ease-out motion-reduce:transition-none"
            >
              {a.status === "on_ground" ? (
                <circle r="1.4" className="fill-amber" />
              ) : (
                <>
                  <g
                    style={{ transform: `rotate(${a.track_deg ?? 0}deg)` }}
                    className="transition-transform duration-300 ease-out motion-reduce:transition-none"
                  >
                    <path d={PLANE} className="fill-amber" transform="scale(0.8)" />
                  </g>
                  {a.callsign && (
                    <text x="5" y="-3" className="fill-amber text-[5px]">
                      {a.callsign}
                      {MARK[a.status]}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-white">
        <span aria-hidden="true">↓ descending · ↑ climbing · plane passing over · dot on the ground</span>
        <span className="sr-only">
          Radar of {code}: {aircraft.length} aircraft within {RADIUS_NM} NM{summary ? `: ${summary}` : ""}. The table
          below lists each one.
        </span>
      </figcaption>
    </figure>
  );
}
