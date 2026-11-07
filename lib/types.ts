export type HairStyle = "short" | "long" | "bun" | "curly" | "buzz" | "cap";

export type Activity =
  | "IDLE"
  | "WALKING"
  | "WORKING"
  | "MEETING"
  | "WATCHING_TV"
  | "DRINKING"
  | "PRAYING"
  | "COOKING"
  | "TOILET"
  | "CHATTING"
  | "RESTING"
  | "ERROR";

export type Pose =
  | "standing"
  | "walking"
  | "sitting"
  | "working"
  | "sleeping"
  | "praying"
  | "drinking";

export type MeetingPhase = "gathering" | "discussing" | "ended";

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  shirtColor: string;
  hairStyle: HairStyle;
  skinTone: string;
  skills: string[];
  agentMd: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  demoMode: boolean;
  deskIndex: number;
}

export interface AgentRuntime extends AgentConfig {
  activity: Activity;
  pose: Pose;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  moveId: number;
  moving: boolean;
  hasError: boolean;
  direction: "left" | "right";
  speech: string | null;
  speaking: boolean;
  statusNote: string | null;
  task: string | null;
  meetingSeat: number | null;
  chatPartnerId: string | null;
  chatStarted?: boolean;
  lastReply?: string | null;
  pending: { activity: Activity; pose: Pose; note: string | null } | null;
}

export interface TranscriptMessage {
  id: string;
  round: number;
  agentId: string;
  agentName: string;
  role: string;
  color: string;
  content: string;
  typing: boolean;
  simulated: boolean;
  kind: "meeting" | "chat" | "system" | "task";
}

export interface MeetingState {
  id: string;
  topic: string;
  rounds: number;
  participantIds: string[];
  phase: MeetingPhase;
  currentRound: number;
  speakingId: string | null;
  transcript: TranscriptMessage[];
  simulated: boolean;
}

export interface EventLogEntry {
  id: string;
  at: number;
  agentName?: string;
  color?: string;
  message: string;
  kind: "info" | "success" | "error";
}

export interface QuickAction {
  type:
    | "WORK"
    | "MEETING"
    | "TV"
    | "DRINK"
    | "PRAY"
    | "COOK"
    | "SLEEP"
    | "SOFA"
    | "ERROR"
    | "CHAT"
    | "RECOVER"
    | "DESK";
  label: string;
}
