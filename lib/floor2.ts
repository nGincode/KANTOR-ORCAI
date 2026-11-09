/**
 * Lantai 2 plan — kantor partitioned per room, X = east/west, Y = south/north.
 * Floor-local bounds: x -10.4..10.4, z -7.4..7.4 (Office3D offsets by x -0.4).
 *
 *   north (y -7.2) [ SERVER ][ MEETING 2 ][ BOS ][ TOILET | WASTAFEL ]
 *   y -0.6         | pintu  |   pintu    | pintu|  pintu  |  pintu    |
 *   y -0.2         ============= KORIDOR ============================>
 *   south (y +7.2) [ WORKSTATION AREA 2 (Open Workspace) ]          [LIFT]
 *
 * All partitions are glass except the toilet / washroom block.
 */
export const FLOOR2 = {
  /** north band rooms */
  serverRoom: { x: -10.2, y: -7.2, w: 5.4, h: 6.6 },
  serverDoor: { x: -7.5, y: -0.6 },
  serverRacks: {
    xs: [-9.3, -7.8, -6.3],
    z: -5.4,
  },
  /** single operator station, facing the rack wall */
  monitorSeats: [{ x: -7.5, y: -3.5 }],
  serverOperator: { x: -7.5, y: -3.5 },
  /** bench + decor in front of the toilet / wash-room block */
  toiletBench: { x: 5.5, y: -2.7 },
  washBench: { x: 8.5, y: -2.7 },

  /** meeting 2 — butted straight against the boss office, no gap */
  meeting2Room: { x: -4.8, y: -7.2, w: 4.6, h: 6.6 },
  meeting2Door: { x: -2.5, y: -0.6 },
  meeting2Table: { x: -2.5, y: -3.6 },
  meeting2Seats: [
    { x: -4.0, y: -3.6 },
    { x: -1.0, y: -3.6 },
    { x: -2.5, y: -5.1 },
    { x: -2.5, y: -2.1 },
  ],

  /** boss office at x 0.4..~4.4 */
  bossRoom: { x: -0.2, y: -7.2, w: 4.2, h: 6.6 },
  bossDoor: { x: 1.9, y: -0.6 },
  bossDesk: { x: 1.9, y: -4.2 },
  /** boss chair south of the desk; two guests sit opposite, all facing the desk */
  bossChair: { x: 1.9, y: -3.4 },
  /** two guest chairs across the desk, facing the boss */
  bossGuests: [{ x: 1.9, y: -5.2 }],

  /** toilet (opaque) immediately right of the boss office */
  toiletRoom: { x: 4.0, y: -7.2, w: 3.0, h: 3.2 },
  toiletDoor: { x: 5.5, y: -4.0 },
  toiletSpot: { x: 5.5, y: -6.2 },

  /** wash basin + mirror room right next to the toilet */
  washRoom: { x: 7.0, y: -7.2, w: 3.0, h: 3.2 },
  washDoor: { x: 8.5, y: -4.0 },

  /** planter by the meeting 2 door, south of the glass front */
  /** south band: open workspace */
  workstationRoom: { x: -10.2, y: 1.6, w: 20.4, h: 5.6 },
  workstationDoor: { x: -2.8, y: 1.6 },
  /** two desk banks split by a central aisle, kept clear of the side walls */
  hotDesksWest: [-6.9, -4.7, -2.5],
  hotDesksEast: [1.5, 3.7, 5.9],
  hotDeskRuns: [
    { cx: -4.7, west: -7.9, east: -1.55 },
    { cx: 3.7, west: 0.55, east: 6.9 },
  ],
  hotDeskRowZ: 3.2,
  hotDeskSeatY: 3.9,
  /** second bank of hot desks, facing the first across the middle aisle */
  hotDesk2RowZ: 5.0,
  hotDesk2SeatY: 5.7,
  meetingTable: { x: 4.0, y: 6.2 },
  meetingSeats: [
    { x: 2.4, y: 6.2 },
    { x: 5.6, y: 6.2 },
  ],
  /** middle aisle between the two desk blocks: 1.9 m of free walking room */
  aisle: { x: -1.0, w: 1.9 },
  aislePlanters: [-3.0, 1.0],

  /** corridor spine */
  corridorZ: 0.6,

  sofa: { x: -5.8, y: 7.0 },
  sofaSeats: [
    { x: -6.4, y: 6.4 },
    { x: -5.2, y: 6.4 },
  ],
  rug: null,
  pingpong: { x: 8.6, y: 2.9 },
  loungeTable: { x: 4.0, y: 6.2 },
};
