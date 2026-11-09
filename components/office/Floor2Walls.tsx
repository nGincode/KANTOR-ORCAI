"use client";

import { useOffice } from "@/lib/store";
import { FLOOR2 } from "@/lib/office";
import { PortalHtml } from "./HtmlPortal";

type P = [number, number];

const MODULE_H = 2.4;

/** Inside any of these rectangles = a person is in the room, door opens. */
type Rect = { x: number; y: number; w: number; h: number };

function inside(r: Rect, x: number, y: number) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Same maths as Office3D's <Wall>. Glass walls are see-through partitions. */
function Wall({
  from,
  to,
  height,
  color,
  thickness = 0.1,
  glass = false,
}: {
  from: P;
  to: P;
  height: number;
  color: string;
  thickness?: number;
  glass?: boolean;
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = -Math.atan2(dz, dx);
  const bays = Math.max(0, Math.round(length / 2.2) - 1);
  return (
    <group position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]} rotation-y={angle}>
      {glass ? (
        <>
          <mesh position={[0, height / 2, 0]}>
            <boxGeometry args={[length, height - 0.12, thickness]} />
            <meshStandardMaterial
              color={color}
              roughness={0.05}
              metalness={0.2}
              transparent
              opacity={0.2}
              depthWrite={false}
            />
          </mesh>
          {[0.05, height - 0.05].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[length, 0.08, thickness + 0.03]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
            </mesh>
          ))}
          {Array.from({ length: bays }, (_, i) => {
            const x = -length / 2 + (length / (bays + 1)) * (i + 1);
            return (
              <mesh key={`m${i}`} position={[x, height / 2, 0]}>
                <boxGeometry args={[0.06, height - 0.12, thickness + 0.02]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
              </mesh>
            );
          })}
        </>
      ) : (
        <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[length, height, thickness]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0.04} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Automatic sliding door: shut while the room is empty, opens when an agent
 * (or anyone else) is standing inside the room.
 */
function AutoDoor({
  at,
  axis,
  width = 1.4,
  open,
  glass = false,
}: {
  at: P;
  axis: "x" | "z";
  width?: number;
  open: boolean;
  /** true = frameless glass leaf, false = solid opaque leaf */
  glass?: boolean;
}) {
  const slide = open ? width / 2 - 0.08 : 0;
  const panels: number[] = [-1, 1];
  return (
    <group position={[at[0], 0, at[1]]} rotation-y={axis === "x" ? 0 : Math.PI / 2}>
      {panels.map((s) => (
        <mesh key={s} position={[s * (width / 4 + slide), 1.0, 0]}>
          <boxGeometry args={[width / 2, 1.96, 0.05]} />
          <meshStandardMaterial
            color={glass ? "#bfe9f5" : "#e2e8f0"}
            roughness={glass ? 0.05 : 0.6}
            metalness={glass ? 0.25 : 0.05}
            transparent={glass}
            opacity={glass ? 0.35 : 1}
            depthWrite={!glass}
          />
        </mesh>
      ))}
      {/* frame */}
      <mesh position={[0, 2.02, 0]}>
        <boxGeometry args={[width + 0.16, 0.1, 0.14]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`j${s}`} position={[s * (width / 2 + 0.05), 1.0, 0]}>
          <boxGeometry args={[0.1, 2.0, 0.14]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {/* motion sensor */}
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[0.16, 0.06, 0.1]} />
        <meshStandardMaterial color="#0f172a" emissive={open ? "#34d399" : "#f97316"} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

/**
 * One straight partition line split around a doorway: walls either side, a
 * lintel above, and an automatic door in the opening.
 */
function Segment({
  from,
  to,
  height,
  color,
  thickness,
  glass,
  door,
  open = false,
}: {
  from: P;
  to: P;
  height: number;
  color: string;
  thickness?: number;
  glass?: boolean;
  door?: P;
  open?: boolean;
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const ux = dx / (length || 1);
  const uz = dz / (length || 1);
  const at = (t: number): P => [from[0] + ux * t, from[1] + uz * t];

  if (!door) {
    return <Wall from={from} to={to} height={height} color={color} thickness={thickness} glass={glass} />;
  }

  const d = (door[0] - from[0]) * ux + (door[1] - from[1]) * uz;
  const half = 0.75;
  const a0 = Math.max(0, d - half);
  const a1 = Math.min(length, d + half);
  const leafHeight = 2.0;
  return (
    <group>
      {a0 > 0.05 && (
        <Wall from={at(0)} to={at(a0)} height={height} color={color} thickness={thickness} glass={glass} />
      )}
      {a1 < length - 0.05 && (
        <Wall from={at(a1)} to={at(length)} height={height} color={color} thickness={thickness} glass={glass} />
      )}
      <Wall from={at(a0)} to={at(a1)} height={height - leafHeight} color={color} thickness={thickness} glass={glass} />
      <AutoDoor at={at(d)} axis={Math.abs(ux) > Math.abs(uz) ? "x" : "z"} open={open} glass={glass} />
    </group>
  );
}

/* ------------------------------------------------------------ furniture bits */

function OfficeChair({ color = "#334155", rotation = 0 }: { color?: string; rotation?: number }) {
  return (
    <group rotation-y={rotation}>
      <mesh position={[0, 0.44, 0]} castShadow>
        <boxGeometry args={[0.5, 0.09, 0.48]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.72, 0.22]} castShadow>
        <boxGeometry args={[0.48, 0.52, 0.08]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.42, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.04, 12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.4} />
      </mesh>
    </group>
  );
}

/** The single server operator station, facing north towards the racks. */
function MonitorDesk({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.73, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.06, 0.78]} />
        <meshStandardMaterial color="#2f3a46" roughness={0.5} metalness={0.35} />
      </mesh>
      {[-0.72, 0.72].map((dx) => (
        <mesh key={dx} position={[dx, 0.36, 0]}>
          <boxGeometry args={[0.06, 0.72, 0.6]} />
          <meshStandardMaterial color="#475569" metalness={0.45} roughness={0.5} />
        </mesh>
      ))}
      {[
        { dx: -0.42, ry: 0.32 },
        { dx: 0, ry: 0 },
        { dx: 0.42, ry: -0.32 },
      ].map((m) => (
        <group key={m.dx} position={[m.dx, 1.02, -0.16]} rotation-y={m.ry}>
          <mesh>
            <boxGeometry args={[0.44, 0.3, 0.03]} />
            <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[0.4, 0.26]} />
            <meshStandardMaterial color="#042f2e" emissive="#22d3ee" emissiveIntensity={0.85} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.78, 0.12]}>
        <boxGeometry args={[0.46, 0.015, 0.16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <group position={[0, 0, 0.66]}>
        <OfficeChair />
      </group>
    </group>
  );
}

/** One free-standing desk for the open workspace; the chair always faces it. */
function SingleDesk({ x, z, facing = -1 }: { x: number; z: number; facing?: 1 | -1 }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.73, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.07, 0.72]} />
        <meshStandardMaterial color="#b98a52" roughness={0.65} />
      </mesh>
      {[-0.64, 0.64].map((dx) => (
        <mesh key={dx} position={[dx, 0.36, 0]}>
          <boxGeometry args={[0.06, 0.72, 0.66]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.98, -0.2 * facing]} castShadow>
        <boxGeometry args={[0.68, 0.4, 0.04]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.98, -0.17 * facing]} rotation-y={facing === 1 ? Math.PI : 0}>
        <planeGeometry args={[0.62, 0.34]} />
        <meshStandardMaterial color="#042f2e" emissive="#22d3ee" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0, 0.79, 0.16 * facing]}>
        <boxGeometry args={[0.48, 0.015, 0.16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <group position={[0, 0, 0.68 * facing]} rotation-y={facing === 1 ? Math.PI : 0}>
        <OfficeChair />
      </group>
    </group>
  );
}

/** Continuous hot-desk row. Chairs sit on the south side, facing the desk. */
function HotDeskRow({ xs, z }: { xs: number[]; z: number }) {
  const min = Math.min(...xs) - 1.0;
  const max = Math.max(...xs) + 1.0;
  return (
    <group>
      <mesh position={[(min + max) / 2, 0.73, z]} castShadow receiveShadow>
        <boxGeometry args={[max - min, 0.07, 0.78]} />
        <meshStandardMaterial color="#b98a52" roughness={0.65} />
      </mesh>
      {xs.map((x) => (
        <group key={x} position={[x, 0, z]}>
          <mesh position={[0, 0.24, -0.33]} castShadow>
            <boxGeometry args={[1.4, 0.48, 0.06]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.25} roughness={0.55} />
          </mesh>
          <group position={[0, 0.98, -0.2]}>
            <mesh castShadow>
              <boxGeometry args={[0.68, 0.4, 0.04]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0, 0.024]}>
              <planeGeometry args={[0.62, 0.34]} />
              <meshStandardMaterial color="#042f2e" emissive="#22d3ee" emissiveIntensity={0.7} />
            </mesh>
          </group>
          <mesh position={[0, 0.79, 0.16]} castShadow>
            <boxGeometry args={[0.48, 0.015, 0.16]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <group position={[0, 0, 0.68]}>
            <OfficeChair />
          </group>
        </group>
      ))}
    </group>
  );
}

function Rack({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[1.0, 2.0, 0.78]} />
        <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.65} />
      </mesh>
      {[0.2, 0.42, 0.64, 0.86, 1.08, 1.3, 1.52, 1.74].map((ly, j) => (
        <mesh key={j} position={[0, ly, 0.4]}>
          <boxGeometry args={[0.88, 0.1, 0.02]} />
          <meshStandardMaterial
            color={j % 3 === 0 ? "#042f2e" : "#0b1220"}
            emissive={j % 3 === 0 ? "#34d399" : "#38bdf8"}
            emissiveIntensity={j % 3 === 0 ? 1.1 : 0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

function Plant({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.17, 0.44, 10]} />
        <meshStandardMaterial color="#7c4a2d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <sphereGeometry args={[0.36, 10, 8]} />
        <meshStandardMaterial color="#3f8f4e" roughness={0.9} />
      </mesh>
      <mesh position={[0.14, 0.86, -0.08]} castShadow>
        <sphereGeometry args={[0.24, 10, 8]} />
        <meshStandardMaterial color="#4caf5d" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Label({ x, z, text, color }: { x: number; z: number; text: string; color: string }) {
  return (
    <PortalHtml position={[x, 2.45, z]} center distanceFactor={12} zIndexRange={[55, 0]}>
      <div
        className="pointer-events-none flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.16em] shadow-lg"
        style={{ color, borderColor: `${color}55`, background: "rgba(3,7,18,0.88)" }}
      >
        <span className="h-1 w-1 rounded-full" style={{ background: color }} />
        {text}
      </div>
    </PortalHtml>
  );
}

/* ------------------------------------------------------------------- rooms */

/** Doors react to the agents standing inside their room. */
function useDoors() {
  const agents = useOffice((s) => s.agents);
  const rooms: Record<string, Rect> = {
    server: FLOOR2.serverRoom,
    meeting2: FLOOR2.meeting2Room,
    boss: FLOOR2.bossRoom,
    workstation: FLOOR2.workstationRoom,
    toilet: FLOOR2.toiletRoom,
    wash: FLOOR2.washRoom,
  };
  return (key: keyof typeof rooms) =>
    agents.some((a) => (a.floor ?? 1) === 2 && inside(rooms[key], a.x, a.y));
}

/** North wall of the building, shared by all five north rooms. */
function NorthRow() {
  const yN = -7.2;
  return (
    <>
      {[FLOOR2.serverRoom, FLOOR2.meeting2Room, FLOOR2.bossRoom].map((r) => (
        <Wall key={r.x} from={[r.x, yN]} to={[r.x + r.w, yN]} height={MODULE_H} color="#8bd9ee" glass />
      ))}
      {[FLOOR2.toiletRoom, FLOOR2.washRoom].map((r) => (
        <Wall key={r.x} from={[r.x, yN]} to={[r.x + r.w, yN]} height={MODULE_H} color="#cbd5e1" />
      ))}
    </>
  );
}

function ServerRoom({ open }: { open: boolean }) {
  const r = FLOOR2.serverRoom;
  const d = FLOOR2.serverDoor;
  const racks = FLOOR2.serverRacks;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[r.x + r.w / 2, 0.012, r.y + r.h / 2]} receiveShadow>
        <planeGeometry args={[r.w - 0.08, r.h - 0.08]} />
        <meshStandardMaterial color="#22303c" roughness={0.85} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[r.x + 1.08 + i * 1.08, 0.016, r.y + r.h / 2]}>
          <planeGeometry args={[0.02, r.h - 0.4]} />
          <meshStandardMaterial color="#31424f" />
        </mesh>
      ))}

      <Wall from={[r.x, r.y]} to={[r.x, r.y + r.h]} height={MODULE_H} color="#8bd9ee" glass />
      <Segment
        from={[r.x, r.y + r.h]}
        to={[r.x + r.w, r.y + r.h]}
        height={MODULE_H}
        color="#8bd9ee"
        glass
        door={[d.x, d.y] as P}
        open={open}
      />
      <Wall from={[r.x + r.w, r.y]} to={[r.x + r.w, r.y + r.h]} height={MODULE_H} color="#8bd9ee" glass />

      {racks.xs.map((x) => (
        <Rack key={`a${x}`} x={x} z={racks.z} />
      ))}
      {racks.xs.map((x) => (
        <Rack key={`b${x}`} x={x} z={racks.z - 1.0} />
      ))}
      <mesh position={[r.x + r.w / 2, 2.3, racks.z - 0.5]}>
        <boxGeometry args={[r.w - 0.7, 0.12, 2.4]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
      </mesh>
      {[r.x + 0.45, r.x + r.w - 0.45].map((x) => (
        <mesh key={x} position={[x, 0.7, r.y + 0.75]} castShadow>
          <boxGeometry args={[0.6, 1.4, 0.55]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}

      {/* one operator desk only */}
      {FLOOR2.monitorSeats.map((s) => (
        <MonitorDesk key={`${s.x}-${s.y}`} x={s.x} z={s.y} />
      ))}

      <pointLight position={[r.x + r.w / 2, 2.1, r.y + r.h / 2]} intensity={5} distance={9} color="#a5d8ff" />
      <Label x={d.x} z={d.y} text="Ruang Server" color="#7dd3fc" />
    </group>
  );
}

function Meeting2Room({ open }: { open: boolean }) {
  const r = FLOOR2.meeting2Room;
  const d = FLOOR2.meeting2Door;
  const t = FLOOR2.meeting2Table;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[r.x + r.w / 2, 0.012, r.y + r.h / 2]} receiveShadow>
        <planeGeometry args={[r.w - 0.1, r.h - 0.1]} />
        <meshStandardMaterial color="#e8e2d6" roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[t.x, 0.016, t.y]}>
        <planeGeometry args={[3.4, 2.4]} />
        <meshStandardMaterial color="#2a4a5f" roughness={1} />
      </mesh>

      <Wall from={[r.x, r.y]} to={[r.x, r.y + r.h]} height={MODULE_H} color="#8bd9ee" glass />
      <Wall from={[r.x + r.w, r.y]} to={[r.x + r.w, r.y + r.h]} height={MODULE_H} color="#8bd9ee" glass />
      <Segment
        from={[r.x, r.y + r.h]}
        to={[r.x + r.w, r.y + r.h]}
        height={MODULE_H}
        color="#8bd9ee"
        glass
        door={[d.x, d.y] as P}
        open={open}
      />

      <group position={[t.x, 0, t.y]}>
        <mesh position={[0, 0.74, 0]} castShadow>
          <boxGeometry args={[2.4, 0.07, 1.0]} />
          <meshStandardMaterial color="#5b3a1e" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.37, 0]}>
          <boxGeometry args={[2.0, 0.7, 0.5]} />
          <meshStandardMaterial color="#3f2a14" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.79, 0]}>
          <sphereGeometry args={[0.16, 12, 10]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
      </group>
      {FLOOR2.meeting2Seats.map((s) => (
        <group key={`${s.x}-${s.y}`} position={[s.x, 0, s.y]}>
          <OfficeChair color="#1d4ed8" rotation={Math.atan2(s.x - t.x, s.y - t.y)} />
        </group>
      ))}
      <mesh position={[t.x, 1.55, r.y + 0.12]}>
        <boxGeometry args={[2.2, 1.2, 0.06]} />
        <meshStandardMaterial color="#0b1220" roughness={0.4} />
      </mesh>
      <mesh position={[t.x, 1.55, r.y + 0.16]}>
        <planeGeometry args={[2.08, 1.08]} />
        <meshStandardMaterial color="#0b2a3a" emissive="#38bdf8" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[r.x + 0.14, 1.4, t.y]}>
        <boxGeometry args={[0.05, 0.9, 2.0]} />
        <meshStandardMaterial color="#eef2f7" roughness={0.35} />
      </mesh>
      <Plant x={r.x + r.w - 0.5} z={r.y + r.h - 0.55} scale={0.75} />
      <pointLight position={[t.x, 2.15, t.y]} intensity={5} distance={8} color="#e0f2fe" />
      <Label x={d.x} z={d.y} text="Ruang Meeting 2" color="#5eead4" />
    </group>
  );
}

function BossRoom({ open }: { open: boolean }) {
  const r = FLOOR2.bossRoom;
  const d = FLOOR2.bossDoor;
  const desk = FLOOR2.bossDesk;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[r.x + r.w / 2, 0.012, r.y + r.h / 2]} receiveShadow>
        <planeGeometry args={[r.w - 0.1, r.h - 0.1]} />
        <meshStandardMaterial color="#1b2438" roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[desk.x, 0.017, desk.y - 0.1]}>
        <planeGeometry args={[2.8, 2.4]} />
        <meshStandardMaterial color="#2b3550" roughness={1} />
      </mesh>

      <Wall from={[r.x, r.y]} to={[r.x, r.y + r.h]} height={MODULE_H} color="#8bd9ee" glass />
      <Wall from={[r.x + r.w, r.y]} to={[r.x + r.w, r.y + r.h]} height={MODULE_H} color="#8bd9ee" glass />
      <Segment
        from={[r.x, r.y + r.h]}
        to={[r.x + r.w, r.y + r.h]}
        height={MODULE_H}
        color="#8bd9ee"
        glass
        door={[d.x, d.y] as P}
        open={open}
      />

      {/* desk; the boss sits on the north side, guests face him from the south */}
      <group position={[desk.x, 0, desk.y]}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <boxGeometry args={[2.2, 0.08, 0.95]} />
          <meshStandardMaterial color="#6d4a28" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[2.0, 0.66, 0.8]} />
          <meshStandardMaterial color="#4a3018" roughness={0.7} />
        </mesh>
        <mesh position={[0.45, 0.83, -0.12]} castShadow>
          <boxGeometry args={[0.85, 0.4, 0.06]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.6} />
        </mesh>
        <mesh position={[0.45, 0.83, -0.16]} rotation-y={Math.PI}>
          <planeGeometry args={[0.8, 0.34]} />
          <meshStandardMaterial color="#0b2a3a" emissive="#38bdf8" emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[-0.6, 0.8, -0.1]}>
          <boxGeometry args={[0.3, 0.02, 0.22]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      </group>
      {/* the two chairs sit across the desk from each other, both turned to it */}
      <group position={[desk.x, 0, desk.y + 0.8]}>
        <OfficeChair color="#1f2937" />
      </group>
      {FLOOR2.bossGuests.map((g) => (
        <group key={`${g.x}-${g.y}`} position={[g.x, 0, g.y]}>
          <OfficeChair color="#475569" rotation={Math.PI} />
        </group>
      ))}
      <mesh position={[desk.x, 1.55, r.y + 0.12]}>
        <boxGeometry args={[2.8, 1.4, 0.06]} />
        <meshStandardMaterial color="#16233a" roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[desk.x, 1.55, r.y + 0.16]}>
        <planeGeometry args={[2.66, 1.26]} />
        <meshStandardMaterial color="#1e3a5f" emissive="#0ea5e9" emissiveIntensity={0.25} roughness={0.5} />
      </mesh>
      <mesh position={[r.x + 0.5, 0.42, r.y + 1.2]} castShadow>
        <boxGeometry args={[0.5, 0.84, 1.4]} />
        <meshStandardMaterial color="#3b2a1a" roughness={0.7} />
      </mesh>
      <mesh position={[r.x + 0.5, 0.9, r.y + 1.2]}>
        <boxGeometry args={[0.52, 0.06, 1.42]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} />
      </mesh>
      <Plant x={r.x + r.w - 0.5} z={r.y + r.h - 0.55} scale={0.8} />
      <pointLight position={[desk.x, 2.2, desk.y - 0.4]} intensity={6} distance={9} color="#ffe4b5" />
      <Label x={d.x} z={d.y} text="Ruang Bos" color="#fcd34d" />
    </group>
  );
}

function ToiletRoom({ open }: { open: boolean }) {
  const r = FLOOR2.toiletRoom;
  const d = FLOOR2.toiletDoor;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[r.x + r.w / 2, 0.014, r.y + r.h / 2]} receiveShadow>
        <planeGeometry args={[r.w - 0.06, r.h - 0.06]} />
        <meshStandardMaterial color="#cfd8e0" roughness={0.75} />
      </mesh>
      <Wall from={[r.x, r.y]} to={[r.x, r.y + r.h]} height={MODULE_H} color="#cbd5e1" />
      <Wall from={[r.x + r.w, r.y]} to={[r.x + r.w, r.y + r.h]} height={MODULE_H} color="#cbd5e1" />
      <Segment
        from={[r.x, r.y + r.h]}
        to={[r.x + r.w, r.y + r.h]}
        height={MODULE_H}
        color="#cbd5e1"
        door={[d.x, d.y] as P}
        open={open}
      />

      <group position={[r.x + 0.85, 0, r.y + 0.42]}>
        <mesh position={[0, 0.58, 0]} castShadow>
          <boxGeometry args={[0.52, 0.62, 0.18]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.3, 0.2]} castShadow>
          <cylinderGeometry args={[0.22, 0.17, 0.26, 18]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.45, 0.2]}>
          <cylinderGeometry args={[0.255, 0.24, 0.06, 18]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
        </mesh>
      </group>
      <mesh position={[r.x + r.w - 0.3, 0.7, r.y + 0.5]} rotation-y={Math.PI / 2}>
        <boxGeometry args={[0.26, 0.26, 0.14]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.8} />
      </mesh>
      <pointLight position={[r.x + r.w / 2, 1.9, r.y + r.h / 2]} intensity={3} distance={4.5} color="#e0f2fe" />
      <Label x={d.x} z={d.y} text="Toilet" color="#e2e8f0" />
    </group>
  );
}

/** Wash basin + mirror room beside the toilet. */
function WashRoom({ open }: { open: boolean }) {
  const r = FLOOR2.washRoom;
  const d = FLOOR2.washDoor;
  const basins = [r.x + 0.9, r.x + 2.1];
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[r.x + r.w / 2, 0.014, r.y + r.h / 2]} receiveShadow>
        <planeGeometry args={[r.w - 0.06, r.h - 0.06]} />
        <meshStandardMaterial color="#dbe4ea" roughness={0.7} />
      </mesh>
      <Wall from={[r.x, r.y]} to={[r.x, r.y + r.h]} height={MODULE_H} color="#cbd5e1" />
      <Wall from={[r.x + r.w, r.y]} to={[r.x + r.w, r.y + r.h]} height={MODULE_H} color="#cbd5e1" />
      <Segment
        from={[r.x, r.y + r.h]}
        to={[r.x + r.w, r.y + r.h]}
        height={MODULE_H}
        color="#cbd5e1"
        door={[d.x, d.y] as P}
        open={open}
      />

      {/* counter along the north wall with two basins + mirror above */}
      <mesh position={[r.x + r.w / 2, 0.46, r.y + 0.34]} castShadow>
        <boxGeometry args={[2.4, 0.9, 0.6]} />
        <meshStandardMaterial color="#eef2f7" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[r.x + r.w / 2, 0.93, r.y + 0.34]}>
        <boxGeometry args={[2.5, 0.06, 0.68]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[r.x + r.w / 2, 1.45, r.y + 0.06]}>
        <planeGeometry args={[2.4, 0.8]} />
        <meshStandardMaterial color="#bae6fd" emissive="#38bdf8" emissiveIntensity={0.25} metalness={0.75} roughness={0.12} />
      </mesh>
      {basins.map((x) => (
        <group key={x} position={[x, 0, r.y + 0.34]}>
          <mesh position={[0, 0.98, 0]} castShadow>
            <cylinderGeometry args={[0.19, 0.15, 0.14, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.22} />
          </mesh>
          <mesh position={[0, 1.12, -0.1]}>
            <cylinderGeometry args={[0.02, 0.02, 0.18, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}
      <mesh position={[r.x + r.w - 0.28, 0.72, r.y + 0.55]} rotation-y={Math.PI / 2}>
        <boxGeometry args={[0.24, 0.28, 0.14]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </mesh>
      <pointLight position={[r.x + r.w / 2, 2.0, r.y + 1.0]} intensity={3} distance={5} color="#e0f2fe" />
      <Label x={d.x} z={d.y} text="Wastafel" color="#bae6fd" />
    </group>
  );
}

function WorkstationArea({ open }: { open: boolean }) {
  const r = FLOOR2.workstationRoom;
  const d = FLOOR2.workstationDoor;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[r.x + r.w / 2, 0.012, r.y + r.h / 2]} receiveShadow>
        <planeGeometry args={[r.w - 0.08, r.h - 0.08]} />
        <meshStandardMaterial color="#d8cfc0" roughness={0.9} />
      </mesh>
      {/* north wall + door (faces the corridor), plus the other three glass sides */}
      <Segment
        from={[r.x, r.y]}
        to={[r.x + r.w, r.y]}
        height={MODULE_H}
        color="#8bd9ee"
        glass
        door={[d.x, d.y] as P}
        open={open}
      />
      <Wall from={[r.x, r.y]} to={[r.x, r.y + r.h]} height={MODULE_H} color="#8bd9ee" glass />
      <Wall from={[r.x + r.w, r.y]} to={[r.x + r.w, r.y + r.h]} height={MODULE_H} color="#8bd9ee" glass />
      <Wall from={[r.x, r.y + r.h]} to={[r.x + r.w, r.y + r.h]} height={MODULE_H} color="#8bd9ee" glass />

      {/* two desk banks cut down the middle so people can walk through */}
      <HotDeskRow xs={FLOOR2.hotDesksWest} z={FLOOR2.hotDeskRowZ} />
      <HotDeskRow xs={FLOOR2.hotDesksEast} z={FLOOR2.hotDeskRowZ} />
      <HotDeskRow xs={FLOOR2.hotDesksWest} z={FLOOR2.hotDesk2RowZ} />
      <HotDeskRow xs={FLOOR2.hotDesksEast} z={FLOOR2.hotDesk2RowZ} />

      <pointLight position={[r.x + r.w / 2, 2.1, r.y + r.h / 2]} intensity={5} distance={9} color="#a5d8ff" />
      <Label x={d.x} z={d.y} text="Workstation 2" color="#7dd3fc" />
    </group>
  );
}

/** Corridor spine crossing the floor between the north rooms and the workspace. */
function Corridor() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, FLOOR2.corridorZ]} receiveShadow>
        <planeGeometry args={[20.0, 2.0]} />
        <meshStandardMaterial color="#c9b394" roughness={0.92} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.011, FLOOR2.corridorZ]}>
        <planeGeometry args={[20.0, 0.9]} />
        <meshStandardMaterial color="#d9c5a6" roughness={0.92} />
      </mesh>
    </group>
  );
}

/** Dark stone landing right outside the lift. */
function LiftLobby() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[-7.7, 0.013, FLOOR2.corridorZ]}>
      <planeGeometry args={[2.6, 2.0]} />
      <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.2} />
    </mesh>
  );
}

/* ------------------------------------------------- waiting lounge, L2 north */

/** Slatted bench with backrest + armrests — the "kursi panjang" for visitors. */
function LongBench({ x, z, rotation = 0 }: { x: number; z: number; rotation?: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={rotation}>
      {[-0.24, -0.08, 0.08, 0.24].map((dz) => (
        <mesh key={`s${dz}`} position={[0, 0.45, dz]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.06, 0.13]} />
          <meshStandardMaterial color="#a97142" roughness={0.8} />
        </mesh>
      ))}
      {/* backrest slats, tilted */}
      <group position={[0, 0.72, 0.34]} rotation-x={-0.18}>
        {[0, 0.14, 0.28].map((dy) => (
          <mesh key={dy} position={[0, dy, 0]} castShadow>
            <boxGeometry args={[2.2, 0.11, 0.05]} />
            <meshStandardMaterial color="#8c5a30" roughness={0.85} />
          </mesh>
        ))}
      </group>
      {/* frame + legs */}
      {[-1.0, 1.0].map((dx) => (
        <group key={dx}>
          <mesh position={[dx, 0.22, 0]} castShadow>
            <boxGeometry args={[0.08, 0.44, 0.56]} />
            <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.4} />
          </mesh>
          <mesh position={[dx, 0.62, 0.34]}>
            <boxGeometry args={[0.07, 0.42, 0.07]} />
            <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.4} />
          </mesh>
          {/* armrest */}
          <mesh position={[dx * 0.98, 0.66, -0.02]}>
            <boxGeometry args={[0.06, 0.05, 0.6]} />
            <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[2.0, 0.05, 0.5]} />
        <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.45} />
      </mesh>
    </group>
  );
}

/** Round side table with a small lamp — fills the gap between the two benches. */
function SideTable({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.52, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.05, 20]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.5, 10]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 0.24, 12]} />
        <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={0.5} roughness={0.5} />
      </mesh>
      <pointLight position={[0, 0.9, 0]} intensity={1.6} distance={2.4} color="#ffd9a0" />
    </group>
  );
}

/**
 * Waiting area in front of the toilet + wash room. Benches run parallel to the
 * block wall (never across a doorway), one per room, with a side table between.
 */
function WaitingLounge() {
  const a = FLOOR2.toiletBench;
  const b = FLOOR2.washBench;
  const mid = (a.x + b.x) / 2;
  return (
    <group>
      {/* rug spanning both benches */}
      <mesh rotation-x={-Math.PI / 2} position={[mid, 0.015, a.y + 0.1]}>
        <planeGeometry args={[6.4, 1.5]} />
        <meshStandardMaterial color="#3f4a57" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[mid, 0.018, a.y + 0.1]}>
        <planeGeometry args={[5.9, 1.1]} />
        <meshStandardMaterial color="#46566a" roughness={1} />
      </mesh>

      {/* benches turned vertical and pushed to the side walls so they never
          block the toilet or wash doorways */}
      <LongBench x={4.35} z={a.y + 0.3} rotation={-Math.PI / 2} />
      <LongBench x={9.65} z={a.y + 0.3} rotation={Math.PI / 2} />
      <SideTable x={mid} z={a.y + 0.3} />

      {/* planters bookending the lounge */}
      {[mid - 3.6, mid + 3.6].map((x) => (
        <group key={x} position={[x, 0, a.y]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.72, 0.6, 0.72]} />
            <meshStandardMaterial color="#7c4a2d" roughness={0.9} />
          </mesh>
          <Plant x={0} z={0} scale={1.15} />
        </group>
      ))}

      {/* framed artwork above each bench, mounted on the opaque block wall */}
      {[
        { x: a.x, color: "#0ea5e9" },
        { x: b.x, color: "#34d399" },
      ].map((f) => (
        <group key={f.x} position={[f.x, 1.6, -4.13]}>
          <mesh>
            <boxGeometry args={[1.5, 0.95, 0.05]} />
            <meshStandardMaterial color="#1f2937" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[1.36, 0.81]} />
            <meshStandardMaterial color="#0b1a2a" emissive={f.color} emissiveIntensity={0.18} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.2, 0.04]}>
            <planeGeometry args={[1.1, 0.1]} />
            <meshStandardMaterial color={f.color} emissive={f.color} emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0.1, 0.12, 0.04]}>
            <planeGeometry args={[0.7, 0.4]} />
            <meshStandardMaterial color="#12253a" emissive={f.color} emissiveIntensity={0.25} />
          </mesh>
          {/* picture light */}
          <mesh position={[0, 0.53, 0.12]}>
            <boxGeometry args={[0.8, 0.06, 0.16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Lantai 2 — partitioned office: server room, meeting 2 butted against the boss
 * office, toilet + wash room on the north side, open workspace to the south.
 * All partitions are glass except the toilet / wash block, and every door is an
 * automatic slider that opens when somebody is in the room.
 */
export function Floor2Plan({ visible = true }: { visible?: boolean }) {
  const focusedFloor = useOffice((s) => s.focusedFloor);
  const isOpen = useDoors();
  if (!visible) return null;
  // floor-plan sanity: rooms must stay inside the slab (x -10.4..10.4, z -7.4..7.4)
  if (process.env.NODE_ENV !== "production") {
    for (const r of [FLOOR2.serverRoom, FLOOR2.meeting2Room, FLOOR2.bossRoom, FLOOR2.toiletRoom, FLOOR2.washRoom, FLOOR2.workstationRoom]) {
      if (r.x < -10.4 || r.x + r.w > 10.4 || r.y < -7.4 || r.y + r.h > 7.4) {
        console.warn("[Lantai 2] room outside the slab", r);
      }
    }
  }
  const showLabels = focusedFloor === "all" || focusedFloor === 2;
  return (
    <group position={[-0.4, 3.2, 0]}>
      <NorthRow />
      <ServerRoom open={isOpen("server")} />
      <Meeting2Room open={isOpen("meeting2")} />
      <BossRoom open={isOpen("boss")} />
      <ToiletRoom open={isOpen("toilet")} />
      <WashRoom open={isOpen("wash")} />
      <WaitingLounge />
      <Corridor />
      <LiftLobby />
      <WorkstationArea open={isOpen("workstation")} />
      {showLabels && <Label x={-0.2} z={-7.4} text="Lantai 2 · Perkantoran" color="#67e8f9" />}
    </group>
  );
}
