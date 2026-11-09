import type { AgentConfig, HairStyle } from "./types";

/**
 * World coordinates are expressed in metres on the office floor.
 * `x` = east/west, `y` = south/north (rendered as Z in 3D).
 * The camera looks from the south, so larger `y` is closer to the viewer.
 */
export interface Vec2 {
  x: number;
  y: number;
}

export type RoomKey =
  | "workstation"
  | "meeting"
  | "musholla"
  | "pantry"
  | "lounge"
  | "toilet"
  | "sickbay";

export interface RoomDef {
  key: RoomKey;
  x: number;
  y: number;
  w: number;
  h: number;
  door: Vec2;
  inside: Vec2;
  outside: Vec2;
  doorSide: "north" | "south";
  doorAxis?: "x" | "z";
  label: string;
  accent: string;
  floor: string;
  glass?: boolean;
}

export const WORLD = { width: 19.6, depth: 14.4 };

export const ROOMS: Record<RoomKey, RoomDef> = {
  workstation: {
    key: "workstation",
    x: -10.2,
    y: -7.2,
    w: 10.0,
    h: 5.5,
    door: { x: -2.8, y: -1.7 },
    inside: { x: -2.8, y: -2.25 },
    outside: { x: -2.8, y: -1.15 },
    doorSide: "south",
    label: "Workstation Area",
    accent: "#7dd3fc",
    floor: "#cfd9e4",
  },
  meeting: {
    key: "meeting",
    x: 0.0,
    y: -7.2,
    w: 9.4,
    h: 5.5,
    door: { x: 4.7, y: -1.7 },
    inside: { x: 4.7, y: -2.25 },
    outside: { x: 4.7, y: -1.15 },
    doorSide: "south",
    label: "Meeting Room",
    accent: "#5eead4",
    floor: "#182642",
    glass: true,
  },
  musholla: {
    key: "musholla",
    x: -10.2,
    y: 1.7,
    w: 3.9,
    h: 5.5,
    door: { x: -8.2, y: 1.7 },
    inside: { x: -8.2, y: 2.25 },
    outside: { x: -8.2, y: 1.15 },
    doorSide: "north",
    label: "Musholla",
    accent: "#34d399",
    floor: "#1b6a49",
  },
  pantry: {
    key: "pantry",
    x: -6.1,
    y: 1.7,
    w: 3.7,
    h: 5.5,
    door: { x: -4.2, y: 1.7 },
    inside: { x: -4.2, y: 2.25 },
    outside: { x: -4.2, y: 1.15 },
    doorSide: "north",
    label: "Pantry & Water",
    accent: "#fbbf24",
    floor: "#e8dbc4",
  },
  lounge: {
    key: "lounge",
    x: -2.2,
    y: 1.7,
    w: 4.2,
    h: 5.5,
    door: { x: 0.0, y: 1.7 },
    inside: { x: 0.0, y: 2.25 },
    outside: { x: 0.0, y: 1.15 },
    doorSide: "north",
    label: "TV Lounge",
    accent: "#a78bfa",
    floor: "#2c2440",
  },
  toilet: {
    key: "toilet",
    x: 2.2,
    y: 1.7,
    w: 2.2,
    h: 2.4,
    door: { x: 3.3, y: 1.7 },
    inside: { x: 3.3, y: 2.25 },
    outside: { x: 3.3, y: 1.15 },
    doorSide: "north",
    label: "Toilet",
    accent: "#cbd5e1",
    floor: "#b9c6d2",
  },
  sickbay: {
    key: "sickbay",
    x: 2.2,
    y: 1.7,
    w: 7.2,
    h: 5.5,
    door: { x: 5.8, y: 1.7 },
    inside: { x: 5.8, y: 2.25 },
    outside: { x: 5.8, y: 1.15 },
    doorSide: "north",
    label: "Sick Bay",
    accent: "#fb7185",
    floor: "#3a2029",
  },
};

export const ROOM_LIST = Object.values(ROOMS);

export const CORRIDOR = { x: -10.2, y: -1.7, w: 19.6, h: 3.4 };

/** Main exit and corridor hand-off points used when agents leave the building. */
export const MAIN_EXIT = {
  door: { x: 9.36, y: 0 },
  inside: { x: 8.85, y: 0 },
  outside: { x: 10.7, y: 0 },
};

/** Front lobby exit — interior glass door on the south face. */
export const LOBBY_EXIT = {
  door: { x: -0.4, y: 7.2 },
  inside: { x: -0.4, y: 6.55 },
  outside: { x: -0.4, y: 8.35 },
};

/** Where an agent stands beside the parked car before driving it. */
export const CAR_ENTRY = { x: 18.7, y: 2.6 };

export function roomAt(point: Vec2): RoomKey | "corridor" | null {
  for (const room of ROOM_LIST) {
    if (
      point.x >= room.x &&
      point.x <= room.x + room.w &&
      point.y >= room.y &&
      point.y <= room.y + room.h
    ) {
      return room.key;
    }
  }
  if (
    point.x >= CORRIDOR.x &&
    point.x <= CORRIDOR.x + CORRIDOR.w &&
    point.y >= CORRIDOR.y &&
    point.y <= CORRIDOR.y + CORRIDOR.h
  ) {
    return "corridor";
  }
  return null;
}

const MEETING_AISLE_Z = -2.25;
const MEETING_WEST_AISLE = 1.75;
const MEETING_EAST_AISLE = 7.65;
const CORRIDOR_LANE_Z = 0.45;

/** Routes around the table instead of cutting through it. */
function meetingApproach(points: Vec2[], seat: Vec2) {
  points.push({ x: 4.7, y: MEETING_AISLE_Z });
  if (seat.y < -4.9) {
    const sideX = seat.x <= 4.7 ? MEETING_WEST_AISLE : MEETING_EAST_AISLE;
    points.push({ x: sideX, y: MEETING_AISLE_Z });
    points.push({ x: sideX, y: seat.y });
  } else {
    points.push({ x: seat.x, y: MEETING_AISLE_Z });
  }
  points.push(seat);
}

function meetingExit(points: Vec2[], from: Vec2) {
  if (from.y < -4.9) {
    const sideX = from.x <= 4.7 ? MEETING_WEST_AISLE : MEETING_EAST_AISLE;
    points.push({ x: sideX, y: from.y });
    points.push({ x: sideX, y: MEETING_AISLE_Z });
  } else {
    points.push({ x: from.x, y: MEETING_AISLE_Z });
  }
  points.push({ x: 4.7, y: MEETING_AISLE_Z });
}

/**
 * Turns a straight-line destination into a route through doorways, around the
 * meeting table and coffee table, and out of either the lobby door or the
 * parking exit depending on which side is closer.
 */

// Coffee table in the TV lounge: 0.62 x 1.15 after rotation, inflated by 0.32
// so walking agents keep a believable clearance from the legs.
const TABLE_RECT = { x: -0.93, y: 2.655, w: 1.26, h: 1.79 };
const LOUNGE_SW = { x: -1.15, y: 2.5 };
const LOUNGE_E1 = { x: 0.45, y: 2.6 };
const LOUNGE_E2 = { x: 0.45, y: 5.15 };
// Solid building footprint — outdoor routes may never cut through it.
const BUILDING_RECT = { x: -10.9, y: -7.5, w: 21.0, h: 14.9 };

function segHitsRect(
  a: Vec2,
  b: Vec2,
  r: { x: number; y: number; w: number; h: number },
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let tMin = 0;
  let tMax = 1;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > tMax) return false;
      if (t > tMin) tMin = t;
    } else {
      if (t < tMin) return false;
      if (t < tMax) tMax = t;
    }
    return true;
  };
  return (
    clip(-dx, a.x - r.x) &&
    clip(dx, r.x + r.w - a.x) &&
    clip(-dy, a.y - r.y) &&
    clip(dy, r.y + r.h - a.y)
  );
}

function exitNear(p: Vec2): "lobby" | "east" {
  const dl = Math.hypot(p.x - LOBBY_EXIT.outside.x, p.y - LOBBY_EXIT.outside.y);
  const de = Math.hypot(p.x - MAIN_EXIT.outside.x, p.y - MAIN_EXIT.outside.y);
  return dl <= de ? "lobby" : "east";
}

/** Route between two points inside the lounge, dodging the coffee table. */
function loungeLeg(points: Vec2[], a: Vec2, b: Vec2) {
  const push = (p: Vec2) => {
    const last = points[points.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.12) points.push(p);
  };
  const aLobby = a.y > 4.6;
  const bLobby = b.y > 4.6;
  if (aLobby && bLobby) return;
  if (!aLobby && !bLobby) {
    if (segHitsRect(a, b, TABLE_RECT)) push(LOUNGE_SW);
    return;
  }
  if (!aLobby && bLobby) {
    if (segHitsRect(a, LOUNGE_E1, TABLE_RECT)) push(LOUNGE_SW);
    push(LOUNGE_E1);
    push(LOUNGE_E2);
    return;
  }
  // lobby side -> corridor side
  push(LOUNGE_E2);
  push(LOUNGE_E1);
  if (segHitsRect(LOUNGE_E1, b, TABLE_RECT)) push(LOUNGE_SW);
}

/**
 * East parking lot: walk around the parked cars instead of through them.
 * Returned in outbound order (from `p` toward the exit); reverse for inbound.
 */
function lotStaging(p: Vec2): Vec2[] {
  if (p.x <= MAIN_EXIT.outside.x || p.y <= 1.0) return [];
  const pts: Vec2[] = [];
  if (p.x > 17) pts.push({ x: 18.7, y: 6.4 }); // clear of the driven slot
  pts.push({ x: MAIN_EXIT.outside.x, y: 6.4 });
  return pts;
}

export const DESKS = [
  { id: 0, cx: -8.5, top: -6.0, seat: { x: -8.5, y: -5.40 } },
  { id: 1, cx: -5.3, top: -6.0, seat: { x: -5.3, y: -5.40 } },
  { id: 2, cx: -2.1, top: -6.0, seat: { x: -2.1, y: -5.40 } },
  { id: 3, cx: -8.5, top: -3.4, seat: { x: -8.5, y: -2.80 } },
  { id: 4, cx: -5.3, top: -3.4, seat: { x: -5.3, y: -2.80 } },
  { id: 5, cx: -2.1, top: -3.4, seat: { x: -2.1, y: -2.80 } },
];

/** Seat sits just in front of the desk edge; the chair model follows it. */
export const DESK_APPROACH = 0.16;

export const DESK_SIZE = { width: 2.0, depth: 0.62, height: 0.74 };

// Workstation desks — walkers go round the ends instead of clipping through them.
const DESK_RECTS = DESKS.map((desk) => ({
  x: desk.cx - DESK_SIZE.width / 2 - 0.14,
  y: desk.top - DESK_SIZE.depth / 2 - 0.14,
  w: DESK_SIZE.width + 0.28,
  h: DESK_SIZE.depth + 0.28,
}));
// Routes between desk rows and the workstation door (x -2.8).
const DESK_LANE_X = [-7.2, -4.0, -0.95];
const DESK_ROW_GAP = -4.7;

function deskRoute(a: Vec2, b: Vec2): Vec2[] {
  const hitsDesk = (p: Vec2, q: Vec2) => DESK_RECTS.some((r) => segHitsRect(p, q, r));
  const clearPoint = (p: Vec2) =>
    DESK_RECTS.some(
      (r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h,
    );
  if (!clearPoint(a) && !clearPoint(b) && !hitsDesk(a, b)) return [];
  let best: Vec2[] | null = null;
  let bestLen = Infinity;
  for (const laneX of DESK_LANE_X) {
    for (const via of [
      [{ x: laneX, y: DESK_ROW_GAP }],
      [{ x: laneX, y: -2.05 }],
      [{ x: laneX, y: DESK_ROW_GAP }, { x: laneX, y: -2.05 }],
    ]) {
      if (hitsDesk(a, via[0]) || hitsDesk(via[via.length - 1], b)) continue;
      if (via.length === 2 && hitsDesk(via[0], via[1])) continue;
      const length =
        Math.hypot(via[0].x - a.x, via[0].y - a.y) +
        (via.length === 2 ? Math.abs(via[1].y - via[0].y) : 0) +
        Math.hypot(b.x - via[via.length - 1].x, b.y - via[via.length - 1].y);
      if (length < bestLen) {
        bestLen = length;
        best = via;
      }
    }
  }
  return best ?? [];
}

export function planPath(from: Vec2, to: Vec2): Vec2[] {
  const fromRoom = roomAt(from);
  const toRoom = roomAt(to);
  const fromOutside = !fromRoom;
  const toOutside = !toRoom;

  const finish = (points: Vec2[]) =>
    points.filter((point, index) => {
      if (index === 0) return true;
      const prev = points[index - 1];
      return Math.hypot(point.x - prev.x, point.y - prev.y) > 0.12;
    });

  if (fromRoom === "workstation" && toRoom === "workstation") {
    return finish([from, ...deskRoute(from, to), to]);
  }
  if (fromRoom === "workstation") {
    const inner = [...deskRoute(from, ROOMS.workstation.outside)];
    const rest = planPath(ROOMS.workstation.outside, to);
    return finish([from, ...inner, ...rest]);
  }
  if (toRoom === "workstation") {
    const toApproach = deskRoute(ROOMS.workstation.outside, to);
    const head = planPath(from, ROOMS.workstation.outside);
    const headDrop =
      head.length && Math.hypot(
        head[head.length - 1].x - ROOMS.workstation.outside.x,
        head[head.length - 1].y - ROOMS.workstation.outside.y,
      ) < 0.01
        ? head.slice(0, -1)
        : head;
    return finish([...headDrop, ROOMS.workstation.outside, ...toApproach, to]);
  }

  if (fromOutside && toOutside) {
    if (!segHitsRect(from, to, BUILDING_RECT)) return [to];
    // never walk through the building — go around the south-east corner
    return finish([from, { x: 11.6, y: 9.0 }, { x: 11.6, y: to.y }, to]);
  }

  if (fromRoom && toRoom && fromRoom === toRoom) {
    if (fromRoom !== "lounge") return [to];
    const pts: Vec2[] = [from];
    loungeLeg(pts, from, to);
    pts.push(to);
    return finish(pts);
  }

  // direct lobby shortcuts — no corridor needed
  if (fromRoom === "lounge" && toOutside && exitNear(to) === "lobby") {
    const pts: Vec2[] = [from];
    loungeLeg(pts, from, LOBBY_EXIT.inside);
    pts.push(LOBBY_EXIT.inside, LOBBY_EXIT.door, LOBBY_EXIT.outside, to);
    return finish(pts);
  }
  if (fromOutside && toRoom === "lounge" && exitNear(from) === "lobby") {
    const pts: Vec2[] = [from, LOBBY_EXIT.outside, LOBBY_EXIT.door, LOBBY_EXIT.inside];
    loungeLeg(pts, LOBBY_EXIT.inside, to);
    pts.push(to);
    return finish(pts);
  }

  const points: Vec2[] = [];
  let laneX = from.x;

  if (fromOutside) {
    if (exitNear(from) === "lobby") {
      points.push(LOBBY_EXIT.outside, LOBBY_EXIT.door, LOBBY_EXIT.inside);
      loungeLeg(points, LOBBY_EXIT.inside, ROOMS.lounge.inside);
      points.push(ROOMS.lounge.inside, ROOMS.lounge.outside);
      laneX = 0;
    } else {
      points.push(...lotStaging(from));
      points.push(MAIN_EXIT.outside, MAIN_EXIT.inside);
      laneX = MAIN_EXIT.inside.x;
    }
  } else if (fromRoom !== "corridor") {
    if (fromRoom === "meeting") meetingExit(points, from);
    const room = ROOMS[fromRoom];
    if (fromRoom === "lounge") loungeLeg(points, from, room.inside);
    points.push(room.inside, room.outside);
    laneX = room.outside.x;
  }

  // Walk down the middle of the corridor. This keeps routes clear of the
  // corridor sofa, plants, water cooler, and coat rack along the walls.
  points.push({ x: laneX, y: CORRIDOR_LANE_Z });

  if (toOutside) {
    if (exitNear(to) === "lobby") {
      points.push({ x: 0, y: CORRIDOR_LANE_Z });
      points.push(ROOMS.lounge.outside, ROOMS.lounge.inside);
      loungeLeg(points, ROOMS.lounge.inside, LOBBY_EXIT.inside);
      points.push(LOBBY_EXIT.inside, LOBBY_EXIT.door, LOBBY_EXIT.outside, to);
    } else {
      points.push({ x: MAIN_EXIT.inside.x, y: CORRIDOR_LANE_Z });
      points.push(MAIN_EXIT.inside);
      points.push(MAIN_EXIT.outside, ...lotStaging(to).reverse(), to);
    }
  } else if (toRoom !== "corridor") {
    const room = ROOMS[toRoom];
    points.push({ x: room.outside.x, y: CORRIDOR_LANE_Z });
    points.push(room.outside, room.inside);
    if (toRoom === "lounge") loungeLeg(points, room.inside, to);
    if (toRoom === "meeting") meetingApproach(points, to);
    points.push(to);
  } else {
    points.push({ x: to.x, y: CORRIDOR_LANE_Z }, to);
  }

  return finish(points);
}

export const ELEVATOR_SPOT = { x: -8.8, y: 0 };
export const ELEVATOR_CAB = { x: -9.3, y: 0 };

import { FLOOR2 } from "./floor2";
export { FLOOR2 };

export const FLOOR2_SPOTS = [
  ...FLOOR2.monitorSeats.map((seat) => ({ x: seat.x, y: seat.y, label: "Ruang Server" })),
  ...FLOOR2.meeting2Seats.map((seat) => ({ x: seat.x, y: seat.y, label: "Ruang Meeting 2" })),
  { x: FLOOR2.bossChair.x, y: FLOOR2.bossChair.y, label: "Ruang Bos" },
  ...FLOOR2.bossGuests.map((g) => ({ x: g.x, y: g.y, label: "Tamu Bos" })),
  { x: FLOOR2.sofaSeats[0].x, y: FLOOR2.sofaSeats[0].y, label: "Sofa Santai" },
  { x: FLOOR2.sofaSeats[1].x, y: FLOOR2.sofaSeats[1].y, label: "Sofa Santai" },
  ...[...FLOOR2.hotDesksWest, ...FLOOR2.hotDesksEast].map((x) => ({ x, y: FLOOR2.hotDeskSeatY, label: "Hot Desk" })),
  ...[...FLOOR2.hotDesksWest, ...FLOOR2.hotDesksEast].map((x) => ({ x, y: FLOOR2.hotDesk2SeatY, label: "Hot Desk" })),
  ...FLOOR2.meetingSeats.map((seat) => ({ x: seat.x, y: seat.y, label: "Ruang Meeting" })),
];

/** Floor 3 has its own plan: cafe, terrace, garden, games. */
export const FLOOR3 = {
  cafeCounter: { x: -7.6, y: 5.6, w: 4.6, h: 0.8 },
  barStools: [-9.2, -8.0, -6.8, -5.6].map((x) => ({ x, y: 4.7 })),
  tables: [
    [-7.2, 1.2],
    [-5.0, 1.2],
    [-7.2, 3.4],
    [-5.0, 3.4],
    [3.0, 1.0],
    [5.2, 1.0],
    [7.4, 1.0],
    [3.0, 3.4],
    [5.2, 3.4],
    [7.4, 3.4],
  ] as [number, number][],
  sofas: [
    { x: -1.4, y: 3.0 },
    { x: 1.4, y: 3.0 },
  ],
  benches: [
    { x: -2.4, y: -3.4 },
    { x: 2.4, y: -3.4 },
  ],
  loungers: [
    { x: 7.9, y: 5.9 },
    { x: 9.6, y: 5.9 },
  ],
  parasol: { x: 9.0, y: 6.1 },
  pingpong: { x: -4.6, y: -4.6 },
  foosball: { x: 5.2, y: -4.8 },
  planters: [
    [-8.6, -6.2],
    [-3.8, -6.2],
    [1.2, -6.2],
    [6.0, -6.2],
    [9.4, -3.0],
    [-9.4, -3.0],
  ] as [number, number][],
};

/** One chair per cafe table (the side facing the camera). */
export const FLOOR3_TABLE_SEATS = FLOOR3.tables.map(([x, z]) => ({ x, y: z + 0.62 }));

/** The two ends of the ping-pong table. */
export const PINGPONG_SEATS = [
  { x: FLOOR3.pingpong.x, y: FLOOR3.pingpong.y + 0.95 },
  { x: FLOOR3.pingpong.x, y: FLOOR3.pingpong.y - 0.95 },
];

export const FLOOR3_SPOTS = [
  ...FLOOR3.barStools.map((s) => ({ x: s.x, y: s.y, label: "Cafe Bar" })),
  ...FLOOR3_TABLE_SEATS.map((s) => ({ x: s.x, y: s.y, label: "Meja Cafe" })),
  ...FLOOR3.sofas.map((s) => ({ x: s.x, y: s.y, label: "Sofa" })),
  ...FLOOR3.benches.map((s) => ({ x: s.x, y: s.y, label: "Bangku Taman" })),
  ...FLOOR3.loungers.map((s) => ({ x: s.x, y: s.y, label: "Kursi Teras" })),
  { x: FLOOR3.pingpong.x, y: FLOOR3.pingpong.y + 0.95, label: "Meja Pingpong" },
  { x: FLOOR3.pingpong.x, y: FLOOR3.pingpong.y - 0.95, label: "Meja Pingpong" },
  { x: FLOOR3.foosball.x, y: FLOOR3.foosball.y + 0.7, label: "Foosball" },
  { x: FLOOR3.foosball.x, y: FLOOR3.foosball.y - 0.7, label: "Foosball" },
];

/** Benches on the plaza in front of the lobby, reached through the sliding door. */
export const OUTDOOR_SEATS = [
  { x: -3.4, y: 9.6 },
  { x: 0.6, y: 9.6 },
  { x: 3.6, y: 9.6 },
  { x: -2.0, y: 11.0 },
  { x: 2.0, y: 11.0 },
];


export const MEETING_TABLE = { x: 4.7, y: -4.45, w: 3.8, h: 1.6 };
export const PROJECTOR = { x: 4.7, y: -7.06, width: 3.4, height: 1.25 };

export const MEETING_SEATS = [
  { x: 3.4, y: -5.65 },
  { x: 4.7, y: -5.65 },
  { x: 6.0, y: -5.65 },
  { x: 7.0, y: -4.45 },
  { x: 6.0, y: -3.25 },
  { x: 4.7, y: -3.25 },
  { x: 3.4, y: -3.25 },
  { x: 2.4, y: -4.45 },
];

export const PRAYER_MATS = [
  { x: -9.2, y: 4.9 },
  { x: -8.4, y: 4.9 },
  { x: -7.6, y: 4.9 },
  { x: -6.8, y: 4.9 },
].map((mat) => ({ ...mat, seat: { x: mat.x, y: mat.y } }));

export const DRINK_SPOTS = [
  { x: -4.9, y: 6.1, label: "Dispenser" },
  { x: -4.2, y: 6.1, label: "Coffee" },
  { x: -3.5, y: 6.1, label: "Cups" },
];

export const COOK_SPOTS = [
  { x: -5.05, y: 4.35 },
  { x: -5.05, y: 5.25 },
];

/** Bar stools in front of the pantry counter — agents can sit here. */
export const PANTRY_SEATS = [
  { x: -5.2, y: 5.8 },
  { x: -4.4, y: 5.8 },
];

export const TV_SEATS = [
  { x: -1.48, y: 2.77 },
  { x: -1.48, y: 3.55 },
  { x: -1.48, y: 4.33 },
];

export const CHAT_SPOTS = [
  { x: -3.6, y: 0.35, facing: "right" as const },
  { x: -2.6, y: 0.35, facing: "left" as const },
];

/** Berbagai area ngobrol berpasangan di seluruh kantor */
export const CHAT_LOCATIONS = [
  {
    name: "Sofa Koridor",
    spots: [
      { x: 2.3, y: -0.95, facing: "right" as const, pose: "sitting" as const },
      { x: 3.3, y: -0.95, facing: "left" as const, pose: "sitting" as const },
    ],
  },
  {
    name: "Pantry",
    spots: [
      { x: -5.2, y: 5.6, facing: "right" as const, pose: "sitting" as const },
      { x: -4.4, y: 5.6, facing: "left" as const, pose: "sitting" as const },
    ],
  },
  {
    name: "TV Lounge",
    spots: [
      { x: -1.48, y: 2.9, facing: "right" as const, pose: "sitting" as const },
      { x: -1.48, y: 4.1, facing: "right" as const, pose: "sitting" as const },
    ],
  },
  {
    name: "Lorong Depan Musholla",
    spots: [
      { x: -7.2, y: 0.45, facing: "right" as const, pose: "standing" as const },
      { x: -6.2, y: 0.45, facing: "left" as const, pose: "standing" as const },
    ],
  },
  {
    name: "Workstation Aisle",
    spots: [
      { x: -3.8, y: -4.2, facing: "right" as const, pose: "standing" as const },
      { x: -2.8, y: -4.2, facing: "left" as const, pose: "standing" as const },
    ],
  },
];

/** two recovery beds at the top-right (east), headboard against the east wall toward parking */
export const BED_SPOTS = [
  { x: 8.0, y: 5.85 },
  { x: 8.0, y: 3.65 },
];
export const SLEEP_SPOT = BED_SPOTS[0];
export const TOILET_SPOT = { x: 3.2, y: 2.9 };
export const CORRIDOR_SOFA = { x: 2.8, y: -1.18, w: 2.2, h: 0.95 };
export const CORRIDOR_SOFA_SEATS = [
  { x: 2.18, y: -1.02 },
  { x: 2.8, y: -1.02 },
  { x: 3.42, y: -1.02 },
];
export const LOUNGE_SOFA = { x: -1.5, y: 3.55, w: 2.2, h: 1.05 };
export const LOUNGE_TV = { x: 1.92, y: 3.4, width: 2.4, height: 1.35 };
export const PANTRY_COUNTER = { x: -5.7, y: 6.9, w: 2.9, h: 0.5 };

export const IDLE_SPOTS = [
  { x: 0, y: 0.4 },
  { x: -4.0, y: 3.4 },
  { x: 4.0, y: 0.4 },
  { x: 6.3, y: 2.6 },
  { x: -8.0, y: 0.4 },
  { x: 11.1, y: 8.1 },
  { x: 11.1, y: -2.2 },
  { x: 14.0, y: 8.0 },
  // front plaza — reached through the lobby door
  { x: -3.4, y: 9.0 },
  { x: 3.4, y: 9.0 },
];

/** Rotation (around Y) for the character model, which faces +Z at angle 0. */
export function characterFacing(
  activity: string,
  pose: string,
  point: Vec2,
): number {
  switch (activity) {
    case "MEETING":
      return Math.atan2(MEETING_TABLE.x - point.x, MEETING_TABLE.y - point.y);
    case "WORKING":
      return Math.PI;
    case "WATCHING_TV":
      return Math.PI / 2;
    case "TOILET":
      return -Math.PI / 2;
    case "COOKING":
      return -Math.PI / 2;
    case "ERROR":
    case "RESTING":
      return pose === "sleeping" ? -Math.PI / 2 : 0;
    case "PRAYING":
    case "DRINKING":
      return 0;
    case "CHATTING":
      return point.x < -3.1 ? Math.PI / 2 : -Math.PI / 2;
    case "IDLE":
      return pose === "sitting" || pose === "working" ? Math.PI : 0;
    default:
      return pose === "sitting" || pose === "working" ? Math.PI : 0;
  }
}

export const SHIRT_COLORS = [
  "#6366f1",
  "#14b8a6",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#0ea5e9",
  "#ec4899",
  "#22c55e",
];

export const SKIN_TONES = ["#f2c49b", "#e8b48a", "#d9a06b", "#c98a5b", "#a96b43"];

export const HAIR_STYLES: { value: HairStyle; label: string }[] = [
  { value: "short", label: "Rapi Pendek" },
  { value: "long", label: "Panjang" },
  { value: "bun", label: "Sanggul" },
  { value: "curly", label: "Keriting" },
  { value: "buzz", label: "Cepak" },
  { value: "cap", label: "Topi Dev" },
];

function agentMd(
  name: string,
  role: string,
  personality: string,
  voice: string,
  sop: string,
  boundary: string,
  skills: string[],
) {
  return `# agent.md — ${name}

## Peran
${role} di AI Office Orchestra. ${personality}

## Kepribadian
- ${personality}
- Kolaboratif, terbuka pada kritik, dan fokus pada solusi.

## Gaya Bicara Saat Rapat
${voice}
- Selalu rujuk keahlian: ${skills.join(", ")}.
- Jawab 2–4 kalimat, ringkas dan konkret.

## SOP Kerja
${sop}

## Batasan Peran
${boundary}
- Tidak mengambil keputusan produk sendirian tanpa persetujuan Tech Lead.

## AI Skills
${skills.map((s) => `- ${s}`).join("\n")}`;
}

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: "agent-budi",
    name: "Budi Santoso",
    role: "Tech Lead",
    shirtColor: "#6366f1",
    hairStyle: "short",
    skinTone: "#e8b48a",
    skills: ["System Design", "Next.js", "Node.js", "Leadership", "Code Review"],
    agentMd: agentMd(
      "Budi Santoso",
      "Tech Lead",
      "Tenang, strategic, dan suka mengubah diskusi liar menjadi rencana eksekusi.",
      "- Membuka rapat dengan merangkum tujuan dan ekspektasi hasil.\n- Menengahi perbedaan pendapat teknis dan menyimpulkan keputusan.",
      "- Pecah pekerjaan menjadi milestone kecil dan pastikan setiap peran punya deliverable jelas.",
      "- Jangan menulis implementasi detail; delegasikan sesuai spesialisasi.",
      ["System Design", "Next.js", "Node.js", "Leadership", "Code Review"],
    ),
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    demoMode: true,
    deskIndex: 0,
  },
  {
    id: "agent-rina",
    name: "Rina Putri",
    role: "Backend Developer",
    shirtColor: "#14b8a6",
    hairStyle: "long",
    skinTone: "#f2c49b",
    skills: ["Node.js", "PostgreSQL", "Redis", "REST API", "Docker"],
    agentMd: agentMd(
      "Rina Putri",
      "Backend Developer",
      "Praktis, perfeksionis pada kontrak API, dan sangat peduli reliability.",
      "- Bicara dengan contoh endpoint, skema payload, dan pertimbangan performa.\n- Sering mengusulkan caching atau antrean saat trafik naik.",
      "- Tulis kontrak API sebelum implementasi, tambahkan rate limit dan observability.",
      "- Tidak mengubah skema database tanpa koordinasi Database Architect.",
      ["Node.js", "PostgreSQL", "Redis", "REST API", "Docker"],
    ),
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    demoMode: true,
    deskIndex: 1,
  },
  {
    id: "agent-dimas",
    name: "Dimas Pratama",
    role: "Frontend Developer",
    shirtColor: "#f59e0b",
    hairStyle: "curly",
    skinTone: "#d9a06b",
    skills: ["React", "Next.js", "TypeScript", "Tailwind CSS", "Framer Motion"],
    agentMd: agentMd(
      "Dimas Pratama",
      "Frontend Developer",
      "Kreatif, antusias pada detail animasi, dan vokal soal pengalaman pengguna.",
      "- Sering memakai analogi UI, membahas state management dan aksesibilitas.\n- Menantang desain yang membingungkan pengguna.",
      "- Validasi di dua breakpoint, ukur Core Web Vitals, dan jaga konsistensi design system.",
      "- Tidak menambah library baru tanpa persetujuan Tech Lead.",
      ["React", "Next.js", "TypeScript", "Tailwind CSS", "Framer Motion"],
    ),
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    demoMode: true,
    deskIndex: 2,
  },
  {
    id: "agent-siti",
    name: "Siti Aminah",
    role: "Database Architect",
    shirtColor: "#a855f7",
    hairStyle: "bun",
    skinTone: "#e8b48a",
    skills: ["PostgreSQL", "Data Modeling", "Query Tuning", "Redis", "SQL"],
    agentMd: agentMd(
      "Siti Aminah",
      "Database Architect",
      "Analitis, hati-hati, dan selalu berpikir tentang integritas serta skalabilitas data.",
      "- Bicara tentang normalisasi, index, migrasi, dan strategi rollback.\n- Memakai angka estimasi pertumbuhan data.",
      "- Setiap perubahan skema harus lewat migrasi reversible dan review query plan.",
      "- Tidak memberikan akses produksi atau menjalankan migrasi destruktif tanpa persetujuan.",
      ["PostgreSQL", "Data Modeling", "Query Tuning", "Redis", "SQL"],
    ),
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    demoMode: true,
    deskIndex: 3,
  },
  {
    id: "agent-andi",
    name: "Andi Saputra",
    role: "QA Engineer",
    shirtColor: "#ef4444",
    hairStyle: "buzz",
    skinTone: "#c98a5b",
    skills: ["Playwright", "Test Automation", "API Testing", "Bug Triage", "CI/CD"],
    agentMd: agentMd(
      "Andi Saputra",
      "QA Engineer",
      "Skeptis sehat, teliti, dan senang menemukan edge case yang orang lain lewatkan.",
      "- Mengajukan pertanyaan tajam tentang skenario gagal dan data tidak valid.\n- Sering menyebut test case, coverage, dan kriteria penerimaan.",
      "- Susun test matrix sebelum rilis, prioritaskan regression pada alur kritis.",
      "- Tidak menandai rilis lolos tanpa bukti pengujian yang terdokumentasi.",
      ["Playwright", "Test Automation", "API Testing", "Bug Triage", "CI/CD"],
    ),
    apiBaseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    demoMode: true,
    deskIndex: 4,
  },
];

export const DEFAULT_PROJECT = "SaaS AI Automation & Analytics Dashboard (ORCAI Suite)";

export const DEFAULT_TOPIC =
  "Rancang arsitektur MVP dashboard analitik real-time untuk 50.000 pengguna aktif.";

export const ROLE_PRESETS = [
  "Tech Lead",
  "Backend Developer",
  "Frontend Engineer",
  "System Architect",
  "DevOps & DB Specialist",
  "QA Tester",
  "Product Manager",
  "UI/UX Designer",
  "AI Engineer",
];
