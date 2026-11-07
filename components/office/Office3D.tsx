"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { Coffee, HeartPulse, Layers, Monitor as MonitorIcon, MousePointerClick, Move3d, X } from "lucide-react";
import { useOffice } from "@/lib/store";
import {
  CORRIDOR,
  CORRIDOR_SOFA,
  DESKS,
  DESK_SIZE,
  LOUNGE_SOFA,
  LOUNGE_TV,
  MEETING_SEATS,
  MEETING_TABLE,
  PANTRY_COUNTER,
  PRAYER_MATS,
  PROJECTOR,
  ROOM_LIST,
  type RoomDef,
} from "@/lib/office";
import { Character3D } from "./Character3D";
import { agentPositions } from "@/lib/agentPositions";
import { HtmlPortalProvider, PortalHtml } from "./HtmlPortal";

/* --------------------------------- helpers -------------------------------- */

function useWoodTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#d3bb98";
      ctx.fillRect(0, 0, 512, 512);
      for (let row = 0; row < 8; row += 1) {
        const y = row * 64;
        const tone = row % 2 === 0 ? "rgba(126,86,46,0.16)" : "rgba(255,255,255,0.08)";
        ctx.fillStyle = tone;
        ctx.fillRect(0, y, 512, 2);
        for (let i = 0; i < 26; i += 1) {
          ctx.strokeStyle = `rgba(120,80,42,${0.03 + Math.random() * 0.06})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          const gy = y + 8 + Math.random() * 50;
          ctx.moveTo(0, gy);
          ctx.bezierCurveTo(150, gy + 4, 340, gy - 4, 512, gy + 2);
          ctx.stroke();
        }
      }
      ctx.fillStyle = "rgba(80,52,25,0.25)";
      for (let x = 0; x < 512; x += 128) ctx.fillRect(x, 0, 2, 512);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6.4, 4.7);
    texture.anisotropy = 8;
    return texture;
  }, []);
}

function Wall({
  from,
  to,
  height,
  color,
  thickness = 0.12,
  glass = false,
}: {
  from: [number, number];
  to: [number, number];
  height: number;
  color: string;
  thickness?: number;
  glass?: boolean;
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = -Math.atan2(dz, dx);
  return (
    <mesh
      position={[(from[0] + to[0]) / 2, height / 2, (from[1] + to[1]) / 2]}
      rotation={[0, angle, 0]}
      castShadow={!glass}
      receiveShadow
    >
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial
        color={glass ? "#8bd9ee" : color}
        roughness={glass ? 0.08 : 0.85}
        metalness={glass ? 0.35 : 0.04}
        transparent={glass}
        opacity={glass ? 0.22 : 1}
      />
    </mesh>
  );
}

const HOME_TARGET = new THREE.Vector3(0, 0.5, 1.6);

function Door({ room }: { room: RoomDef }) {
  const panelRef = useRef<THREE.Group>(null);
  const top = room.doorSide === "south";
  const swing = room.doorAxis === "z" ? 1.22 : top ? 1.22 : -1.22;
  const frosted = room.key === "toilet";

  useFrame((_, delta) => {
    if (!panelRef.current) return;
    const near = [...agentPositions.values()].some(
      (agent) => Math.hypot(agent.x - room.door.x, agent.y - room.door.y) < 0.45,
    );
    panelRef.current.rotation.y = THREE.MathUtils.damp(
      panelRef.current.rotation.y,
      near ? swing : 0,
      10,
      delta,
    );
  });

  return (
    <group
      position={[room.door.x, 0, room.door.y]}
      rotation={[0, room.doorAxis === "z" ? Math.PI / 2 : 0, 0]}
    >
      {/* threshold */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[1.32, 0.04, 0.5]} />
        <meshStandardMaterial color="#273343" roughness={0.7} metalness={0.2} />
      </mesh>
      {/* slim metal frame */}
      {[-0.66, 0.66].map((x) => (
        <mesh key={x} position={[x, 0.82, 0]} castShadow>
          <boxGeometry args={[0.09, 1.64, 0.2]} />
          <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 1.62, 0]} castShadow>
        <boxGeometry args={[1.41, 0.11, 0.2]} />
        <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* automatic sensor + status light */}
      <mesh position={[0.44, 1.51, 0.06]}>
        <boxGeometry args={[0.18, 0.045, 0.04]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.44, 1.51, 0.085]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={1.4} />
      </mesh>

      {/* transparent swinging panel, driven by proximity */}
      <group ref={panelRef} position={[-0.58, 0, 0]}>
        <mesh position={[0.53, 0.77, 0]} castShadow>
          <boxGeometry args={[1.04, 1.5, 0.018]} />
          <meshStandardMaterial
            color={frosted ? "#dbeafe" : "#bfe8ff"}
            roughness={frosted ? 0.5 : 0.08}
            metalness={frosted ? 0.05 : 0.2}
            transparent
            opacity={frosted ? 0.58 : 0.38}
            depthWrite={false}
          />
        </mesh>
        {/* metal stiles and rails */}
        {[0.02, 1.04].map((x) => (
          <mesh key={x} position={[x, 0.77, 0]}>
            <boxGeometry args={[0.045, 1.5, 0.045]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.25} />
          </mesh>
        ))}
        {[0.04, 1.5].map((y) => (
          <mesh key={y} position={[0.53, y, 0]}>
            <boxGeometry args={[1.04, 0.045, 0.045]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.25} />
          </mesh>
        ))}
        {frosted && (
          <mesh position={[0.53, 1.08, 0.012]}> 
            <boxGeometry args={[0.88, 0.12, 0.012]} />
            <meshStandardMaterial color="#f8fafc" transparent opacity={0.34} />
          </mesh>
        )}
        {/* long pull handle */}
        <mesh position={[0.92, 0.82, 0.07]}>
          <cylinderGeometry args={[0.016, 0.016, 0.48, 8]} />
          <meshStandardMaterial
            color={frosted ? "#c8a568" : "#e2e8f0"}
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
      </group>
    </group>
  );
}

/* -------------------------------- furniture ------------------------------- */

function makeScreenTexture(name: string, task: string | null, active: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 240;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#07111f";
  ctx.fillRect(0, 0, 384, 240);
  ctx.fillStyle = "#0d2034";
  ctx.fillRect(0, 0, 384, 26);
  ["#fb7185", "#fbbf24", "#34d399"].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(14 + i * 13, 13, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#7dd3fc";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.fillText(`${name.toLowerCase().replace(/\s+/g, "-")}.tsx`, 62, 17);
  ctx.fillStyle = "#0a1828";
  ctx.fillRect(0, 26, 92, 214);
  for (let i = 0; i < 12; i += 1) {
    ctx.fillStyle = i % 3 === 0 ? "#38bdf8" : "#243c56";
    ctx.fillRect(12, 44 + i * 15, 38 + (i % 4) * 9, 5);
  }
  const colors = ["#c084fc", "#5eead4", "#fbbf24", "#7dd3fc", "#f472b6", "#a3e635"];
  for (let i = 0; i < 11; i += 1) {
    const indent = 108 + (i % 3) * 14;
    ctx.fillStyle = "#1e293b";
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillText(String(i + 1).padStart(2, "0"), 98, 48 + i * 16);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(indent, 42 + i * 16, 30 + ((i * 37) % 74), 5);
    if (i % 4 === 0) {
      ctx.fillStyle = "#334155";
      ctx.fillRect(indent + 30 + ((i * 37) % 74) + 6, 42 + i * 16, 26, 5);
    }
  }
  ctx.fillStyle = active ? "rgba(94,234,212,0.14)" : "rgba(148,163,184,0.08)";
  ctx.fillRect(96, 206, 276, 22);
  ctx.fillStyle = active ? "#5eead4" : "#64748b";
  ctx.font = "bold 9px ui-monospace, monospace";
  ctx.fillText(active ? "TASK IN PROGRESS" : "STANDBY", 108, 221);
  if (task) {
    const cut = task.length > 46 ? `${task.slice(0, 46)}…` : task;
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "8px ui-monospace, monospace";
    ctx.fillText(cut, 108, 201);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function Monitor({ x, agent }: { x: number; agent?: import("@/lib/types").AgentRuntime }) {
  const active = agent?.activity === "WORKING";
  const focusScreen = useOffice((s) => s.focusScreen);
  const selectAgent = useOffice((s) => s.selectAgent);
  const texture = useMemo(
    () => (agent ? makeScreenTexture(agent.name, agent.task, active) : null),
    [agent?.name, agent?.task, active],
  );
  const screenMat = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => () => texture?.dispose(), [texture]);

  useFrame((state) => {
    if (!screenMat.current) return;
    screenMat.current.emissiveIntensity = active
      ? 0.62 + Math.sin(state.clock.elapsedTime * 2.4 + x * 3) * 0.08
      : 0.16;
  });

  return (
    <group
      position={[x, 0, -0.14]}
      onClick={(event) => {
        if (!agent) return;
        event.stopPropagation();
        selectAgent(agent.id);
        focusScreen(agent.id);
      }}
      onPointerOver={(event) => {
        if (!agent) return;
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, 0.06, 0.02]}>
        <cylinderGeometry args={[0.03, 0.045, 0.14, 10]} />
        <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, 0.04]}>
        <boxGeometry args={[0.3, 0.02, 0.2]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.34, 0]} castShadow>
        <boxGeometry args={[0.84, 0.52, 0.045]} />
        <meshStandardMaterial color="#0b1220" roughness={0.35} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.34, 0.026]}>
        <planeGeometry args={[0.78, 0.46]} />
        {texture ? (
          <meshStandardMaterial
            ref={screenMat}
            map={texture}
            emissiveMap={texture}
            emissive="#67e8f9"
            emissiveIntensity={active ? 0.65 : 0.16}
            roughness={0.25}
            toneMapped={false}
          />
        ) : (
          <meshStandardMaterial color="#0c1a2c" emissive="#0ea5e9" emissiveIntensity={0.25} />
        )}
      </mesh>
      <mesh position={[0, 0.62, 0.027]}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.2} />
      </mesh>
      <pointLight
        position={[0, 0.4, 0.34]}
        intensity={active ? 1.6 : 0.22}
        distance={1.35}
        color="#7dd3fc"
      />
    </group>
  );
}

function Chair({
  position,
  rotation = 0,
  color = "#243452",
  scale = 1,
}: {
  position: [number, number, number];
  rotation?: number;
  color?: string;
  scale?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <RoundedBox args={[0.52, 0.09, 0.5]} radius={0.03} smoothness={2} position={[0, 0.44, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.8} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.48, 0.07]} radius={0.03} smoothness={2} position={[0, 0.68, 0.24]} castShadow>
        <meshStandardMaterial color={color} roughness={0.8} />
      </RoundedBox>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.38, 10]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.18, 0.04, Math.sin(angle) * 0.18]} castShadow>
            <boxGeometry args={[0.24, 0.05, 0.07]} />
            <meshStandardMaterial color="#111827" roughness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

function Desk({ cx, top, agent }: { cx: number; top: number; agent?: import("@/lib/types").AgentRuntime }) {
  const working = agent?.activity === "WORKING";
  return (
    <group position={[cx, 0, top]}>
      <RoundedBox
        args={[DESK_SIZE.width, 0.07, DESK_SIZE.depth]}
        radius={0.02}
        smoothness={2}
        position={[0, DESK_SIZE.height, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#b17c43" roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, DESK_SIZE.height + 0.02, 0]}>
        <boxGeometry args={[DESK_SIZE.width - 0.06, 0.02, DESK_SIZE.depth - 0.06]} />
        <meshStandardMaterial color="#c68e4f" roughness={0.6} />
      </mesh>
      {[
        [-0.9, -0.24],
        [0.9, -0.24],
        [-0.9, 0.24],
        [0.9, 0.24],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, DESK_SIZE.height / 2, z]} castShadow>
          <boxGeometry args={[0.06, DESK_SIZE.height, 0.06]} />
          <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
      <group position={[0, DESK_SIZE.height, 0]}>
        <Monitor x={-0.5} agent={agent} />
        <Monitor x={0.5} agent={agent} />
        <mesh position={[0, 0.035, 0.16]} castShadow>
          <boxGeometry args={[0.55, 0.03, 0.16]} />
          <meshStandardMaterial color="#1f2937" roughness={0.6} />
        </mesh>
        <mesh position={[0.36, 0.03, 0.16]}>
          <boxGeometry args={[0.08, 0.04, 0.1]} />
          <meshStandardMaterial color="#334155" roughness={0.5} />
        </mesh>
        <mesh position={[0.78, 0.07, 0.1]} castShadow>
          <cylinderGeometry args={[0.055, 0.045, 0.12, 12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <mesh position={[0.78, 0.11, 0.1]}>
          <cylinderGeometry args={[0.045, 0.045, 0.03, 12]} />
          <meshStandardMaterial color="#a16207" />
        </mesh>
        <group position={[-0.82, 0.02, 0.05]}>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.44, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.46, 0.08]} rotation={[0.5, 0, 0]}>
            <coneGeometry args={[0.14, 0.12, 16, 1, true]} />
            <meshStandardMaterial
              color={working ? "#fde68a" : "#94a3b8"}
              emissive={working ? "#fbbf24" : "#000000"}
              emissiveIntensity={working ? 0.35 : 0}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.1, 0.11, 0.03, 16]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
        {working && <pointLight position={[0, 0.75, 0.2]} intensity={2.2} distance={1.6} color="#a5f3fc" />}
      </group>
      <Chair position={[0, 0, 0.85]} rotation={0} />
    </group>
  );
}

function MeetingSet() {
  const speaking = useOffice((s) => s.agents.some((agent) => agent.speech));
  return (
    <group>
      <RoundedBox
        args={[MEETING_TABLE.w, 0.08, MEETING_TABLE.h]}
        radius={0.24}
        smoothness={4}
        position={[MEETING_TABLE.x, 0.7, MEETING_TABLE.y]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#a9763a" roughness={0.55} />
      </RoundedBox>
      <mesh position={[MEETING_TABLE.x, 0.64, MEETING_TABLE.y]}>
        <boxGeometry args={[MEETING_TABLE.w - 0.25, 0.05, MEETING_TABLE.h - 0.25]} />
        <meshStandardMaterial color="#8a5c26" roughness={0.6} />
      </mesh>
      {[[-1.55, -0.5], [1.55, -0.5], [-1.55, 0.5], [1.55, 0.5]].map(([dx, dz], i) => (
        <mesh key={i} position={[MEETING_TABLE.x + dx, 0.33, MEETING_TABLE.y + dz]} castShadow>
          <boxGeometry args={[0.09, 0.66, 0.09]} />
          <meshStandardMaterial color="#5b3a1c" roughness={0.7} />
        </mesh>
      ))}
      {/* laptops and mugs */}
      {[-1.25, 0, 1.25].map((dx, i) => (
        <group key={i} position={[MEETING_TABLE.x + dx, 0.75, MEETING_TABLE.y + (i % 2 === 0 ? -0.48 : 0.48)]}>
          <mesh rotation={[-0.1, 0, 0]} castShadow>
            <boxGeometry args={[0.45, 0.02, 0.3]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0, 0.16, -0.15]} rotation={[-0.35, 0, 0]}>
            <boxGeometry args={[0.45, 0.3, 0.02]} />
            <meshStandardMaterial color="#0b1220" emissive="#22d3ee" emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
      {[-0.7, 0.7].map((dx, i) => (
        <mesh key={`mug-${i}`} position={[MEETING_TABLE.x + dx, 0.78, MEETING_TABLE.y + 0.52]} castShadow>
          <cylinderGeometry args={[0.06, 0.05, 0.12, 12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[MEETING_TABLE.x, 0.82, MEETING_TABLE.y]}>
        <cylinderGeometry args={[0.12, 0.14, 0.14, 20]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.6} />
      </mesh>
      <pointLight position={[MEETING_TABLE.x, 1.3, MEETING_TABLE.y]} intensity={3} distance={4} color="#5eead4" />

      {MEETING_SEATS.map((seat, i) => (
        <Chair
          key={i}
          position={[seat.x, 0, seat.y]}
          rotation={Math.atan2(seat.x - MEETING_TABLE.x, seat.y - MEETING_TABLE.y)}
          color="#20304d"
          scale={0.84}
        />
      ))}

      {/* projector screen */}
      <group position={[PROJECTOR.x, 1.92, PROJECTOR.y]}>
        <mesh castShadow>
          <boxGeometry args={[PROJECTOR.width + 0.12, PROJECTOR.height + 0.12, 0.08]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[PROJECTOR.width, PROJECTOR.height]} />
          <meshStandardMaterial color="#062a33" emissive="#0891b2" emissiveIntensity={0.45} roughness={0.2} />
        </mesh>
        {!speaking && (
          <PortalHtml position={[0, 0, 0.06]} center zIndexRange={[50, 0]} style={{ pointerEvents: "none" }}>
            <div className="w-[220px] text-center">
              <p className="text-[7px] font-black uppercase tracking-[0.25em] text-cyan-300">live agenda</p>
              <p className="mt-1 line-clamp-3 text-[9px] font-semibold leading-snug text-slate-100">
                <ProjectorTopic />
              </p>
            </div>
          </PortalHtml>
        )}
      </group>
    </group>
  );
}

function ProjectorTopic() {
  const meeting = useOffice((s) => s.meeting);
  return <>{meeting ? meeting.topic : "Belum ada rapat — panggil tim dari panel orkestrasi."}</>;
}

function PrayerRoom() {
  return (
    <group>
      {PRAYER_MATS.map((mat, i) => (
        <group key={i} position={[mat.x, 0, mat.y]}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.03} receiveShadow>
            <planeGeometry args={[0.62, 1.08]} />
            <meshStandardMaterial color="#0f5a3d" roughness={0.95} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position-y={0.035}>
            <ringGeometry args={[0.24, 0.3, 24]} />
            <meshStandardMaterial color="#d6b36a" emissive="#d6b36a" emissiveIntensity={0.15} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* mihrab arch on the south wall */}
      <group position={[-8.25, 0, 7.12]}>
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[1.5, 2.3, 0.06]} />
          <meshStandardMaterial color="#0d4a34" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.35, -0.045]}>
          <torusGeometry args={[0.52, 0.05, 8, 32, Math.PI]} />
          <meshStandardMaterial color="#e5c07b" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.35, -0.05]}>
          <planeGeometry args={[1.0, 0.9]} />
          <meshStandardMaterial color="#116b4c" roughness={0.9} />
        </mesh>
        <PortalHtml position={[0, 2.05, -0.1]} center zIndexRange={[50, 0]}>
          <div className="pointer-events-none whitespace-nowrap text-[8px] font-black uppercase tracking-[0.22em] text-amber-200/80">
            🕌 Qiblat
          </div>
        </PortalHtml>
      </group>
      {/* sandal rack */}
      <group position={[-9.75, 0, 2.1]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[0.8, 0.06, 0.34]} />
          <meshStandardMaterial color="#7c5a38" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.08, 0.16, 0.3]} />
          <meshStandardMaterial color="#5b412a" />
        </mesh>
        {[-0.24, 0, 0.24].map((x, i) => (
          <mesh key={i} position={[x, 0.28, 0.02]} rotation={[0, i * 0.3, 0]}>
            <boxGeometry args={[0.18, 0.04, 0.1]} />
            <meshStandardMaterial color={["#fbbf24", "#f87171", "#38bdf8"][i]} />
          </mesh>
        ))}
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[-8.25, 0.04, 3.4]}>
        <circleGeometry args={[0.22, 28]} />
        <meshStandardMaterial color="#fcd34d" metalness={0.3} roughness={0.4} />
      </mesh>
    </group>
  );
}

function PantryRoom() {
  return (
    <group>
      <group position={[PANTRY_COUNTER.x + PANTRY_COUNTER.w / 2, 0, PANTRY_COUNTER.y]}>
        <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
          <boxGeometry args={[PANTRY_COUNTER.w, 0.88, PANTRY_COUNTER.h]} />
          <meshStandardMaterial color="#c8ab80" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.9, 0]} receiveShadow>
          <boxGeometry args={[PANTRY_COUNTER.w + 0.06, 0.06, PANTRY_COUNTER.h + 0.06]} />
          <meshStandardMaterial color="#8a6238" roughness={0.6} />
        </mesh>
        {[-0.85, 0, 0.85].map((x, i) => (
          <mesh key={i} position={[x, 0.45, 0.26]}>
            <boxGeometry args={[0.7, 0.62, 0.02]} />
            <meshStandardMaterial color="#b99770" roughness={0.8} />
          </mesh>
        ))}

        {/* dispenser */}
        <group position={[-0.95, 0.93, 0.02]}>
          <mesh position={[0, 0.38, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.17, 0.7, 16]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.88, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.34, 16]} />
            <meshStandardMaterial color="#7dd3fc" transparent opacity={0.75} roughness={0.15} />
          </mesh>
          <mesh position={[-0.05, 0.6, 0.16]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[0.05, 0.6, 0.16]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[0, 0.48, 0.19]}>
            <boxGeometry args={[0.1, 0.03, 0.03]} />
            <meshStandardMaterial color="#64748b" metalness={0.5} />
          </mesh>
        </group>

        {/* coffee machine */}
        <group position={[0.1, 0.93, 0.02]}>
          <mesh position={[0, 0.24, 0]} castShadow>
            <boxGeometry args={[0.42, 0.48, 0.36]} />
            <meshStandardMaterial color="#334155" metalness={0.35} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.38, 0.19]}>
            <boxGeometry args={[0.24, 0.12, 0.02]} />
            <meshStandardMaterial color="#0b1220" emissive="#f59e0b" emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0, 0.12, 0.2]}>
            <boxGeometry args={[0.18, 0.05, 0.06]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.02, 0.2]}>
            <cylinderGeometry args={[0.06, 0.05, 0.1, 12]} />
            <meshStandardMaterial color="#f8fafc" opacity={0.8} transparent />
          </mesh>
        </group>

        {/* cups + fridge */}
        {[-0.2, -0.12, -0.04].map((x, i) => (
          <mesh key={i} position={[0.65 + x, 1.02, 0]} castShadow>
            <cylinderGeometry args={[0.038, 0.032, 0.09, 10]} />
            <meshStandardMaterial color={i === 2 ? "#f59e0b" : "#f8fafc"} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[1.0, 0.5, 0.02]} castShadow>
          <boxGeometry args={[0.4, 1.0, 0.42]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>

      {/* cooking counter on the left wall */}
      <group position={[-5.75, 0, 4.85]}>
        <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.55, 0.88, 2.9]} />
          <meshStandardMaterial color="#a8b6b0" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.91, 0]} receiveShadow>
          <boxGeometry args={[0.6, 0.06, 2.96]} />
          <meshStandardMaterial color="#d7dde0" roughness={0.35} metalness={0.2} />
        </mesh>
        {[-0.9, 0, 0.9].map((z) => (
          <mesh key={z} position={[0.29, 0.5, z]}>
            <boxGeometry args={[0.02, 0.66, 0.74]} />
            <meshStandardMaterial color="#dbe4e6" roughness={0.55} />
          </mesh>
        ))}
        {/* stove */}
        <mesh position={[0, 0.95, -0.65]}>
          <boxGeometry args={[0.54, 0.05, 0.72]} />
          <meshStandardMaterial color="#111827" metalness={0.4} roughness={0.35} />
        </mesh>
        {[[-0.13, -0.86], [0.13, -0.86], [-0.13, -0.44], [0.13, -0.44]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.98, z]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.075, 0.012, 6, 16]} />
            <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={i === 3 ? 1.1 : 0.15} />
          </mesh>
        ))}
        {/* pot of noodles */}
        <group position={[0.02, 1.0, -0.44]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.16, 0.13, 0.2, 16]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.65} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.02, 16]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.22, 0]}> 
            <cylinderGeometry args={[0.11, 0.11, 0.05, 16]} />
            <meshStandardMaterial color="#fde68a" transparent opacity={0.7} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.sin(i * 2.1) * 0.07, 0.34 + i * 0.09, Math.cos(i * 1.7) * 0.06]}>
              <sphereGeometry args={[0.035 + i * 0.012, 8, 6]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={0.25 - i * 0.05} depthWrite={false} />
            </mesh>
          ))}
        </group>
        {/* kettle */}
        <group position={[0.03, 0.94, 0.72]}>
          <mesh>
            <cylinderGeometry args={[0.11, 0.13, 0.2, 14]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0.16, 0.02, 0]} rotation-z={-0.45}>
            <cylinderGeometry args={[0.03, 0.04, 0.18, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.6} />
          </mesh>
        </group>
        {/* range hood */}
        <mesh position={[-0.05, 2.0, -0.5]} castShadow>
          <boxGeometry args={[0.62, 0.3, 0.9]} />
          <meshStandardMaterial color="#64748b" metalness={0.55} roughness={0.3} />
        </mesh>
        <mesh position={[-0.05, 1.78, -0.5]}>
          <boxGeometry args={[0.5, 0.05, 0.72]} />
          <meshStandardMaterial color="#f8fafc" emissive="#fde68a" emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* sink counter on the right wall */}
      <group position={[-2.7, 0, 4.6]}>
        <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.88, 2.5]} />
          <meshStandardMaterial color="#b4c0bd" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.91, 0]} receiveShadow>
          <boxGeometry args={[0.56, 0.06, 2.56]} />
          <meshStandardMaterial color="#d7dde0" roughness={0.35} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.93, 0.2]}> 
          <boxGeometry args={[0.34, 0.02, 0.5]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
        </mesh>
        <mesh position={[-0.08, 1.07, 0.2]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.022, 0.022, 0.24, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[-0.08, 1.17, 0.2]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.06, 0.015, 8, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.03, -0.65]}>
          <cylinderGeometry args={[0.12, 0.12, 0.2, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.13, -0.65]}>
          <boxGeometry args={[0.26, 0.02, 0.2]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      </group>

      {/* fridge + shelves + jars */}
      <group position={[-5.72, 0, 2.55]}>
        <mesh position={[0, 0.82, 0]} castShadow>
          <boxGeometry args={[0.68, 1.64, 0.72]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.55} roughness={0.25} />
        </mesh>
        <mesh position={[0.35, 0.95, 0]}>
          <boxGeometry args={[0.02, 0.25, 0.04]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} />
        </mesh>
        <mesh position={[0.35, 0.95, 0]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.8} />
        </mesh>
      </group>
      {[1.55, 2.05].map((y) => (
        <group key={y}>
          <mesh position={[-2.58, y, 4.5]}>
            <boxGeometry args={[0.25, 0.05, 2.1]} />
            <meshStandardMaterial color="#8a6238" roughness={0.75} />
          </mesh>
          {[3.8, 4.5, 5.2].map((z, i) => (
            <mesh key={z} position={[-2.58, y + 0.14, z]}>
              <cylinderGeometry args={[0.09, 0.08, 0.24, 10]} />
              <meshStandardMaterial color={["#fbbf24", "#f87171", "#34d399"][i]} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      {[-0.45, 0.45].map((z) => (
        <group key={z} position={[-3.25, 0, 5.4 + z]}>
          <mesh position={[0, 0.52, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.06, 16]} />
            <meshStandardMaterial color="#b98552" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.27, 0]}>
            <cylinderGeometry args={[0.035, 0.05, 0.5, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.5} />
          </mesh>
        </group>
      ))}
      <pointLight position={[-4.2, 2.4, 5.4]} intensity={5} distance={5} color="#fde68a" />
      <pointLight position={[-5.3, 1.6, 4.4]} intensity={2.4} distance={2.8} color="#fb923c" />
    </group>
  );
}

function LoungeRoom() {
  const tvBars = useRef<THREE.Group>(null);
  const tvLight = useRef<THREE.PointLight>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const scanline = useRef<THREE.Mesh>(null);
  const tvColor = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (tvBars.current) {
      tvBars.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        mesh.scale.y = 0.45 + Math.abs(Math.sin(t * 1.6 + i * 0.7)) * 1.15;
      });
    }
    tvColor.setHSL((0.52 + Math.sin(t * 0.32) * 0.09 + Math.sin(t * 1.7) * 0.025 + 1) % 1, 0.8, 0.6);
    if (tvLight.current) {
      tvLight.current.color.copy(tvColor);
      tvLight.current.intensity = 6 + Math.abs(Math.sin(t * 2.8)) * 4 + Math.sin(t * 13) * 0.7;
    }
    if (glowMat.current) {
      glowMat.current.color.copy(tvColor);
      glowMat.current.opacity = 0.08 + Math.abs(Math.sin(t * 2.2)) * 0.14;
    }
    if (scanline.current) {
      scanline.current.position.y = -0.62 + ((t * 0.5) % 1.25);
    }
  });

  return (
    <group>
      {/* TV on the east wall, facing the sofa and the parking side */}
      <group position={[LOUNGE_TV.x, 1.7, LOUNGE_TV.y]} rotation-y={Math.PI / 2}>
        <mesh castShadow>
          <boxGeometry args={[LOUNGE_TV.width + 0.1, LOUNGE_TV.height + 0.1, 0.08]} />
          <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, -0.045]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[LOUNGE_TV.width, LOUNGE_TV.height]} />
          <meshStandardMaterial color="#082f49" emissive="#0ea5e9" emissiveIntensity={0.55} roughness={0.2} />
        </mesh>
        <group ref={tvBars} position={[0, -0.25, -0.06]} rotation={[0, Math.PI, 0]}>
          {[-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8].map((x, i) => (
            <mesh key={i} position={[x, 0, 0]}>
              <planeGeometry args={[0.15, 0.4]} />
              <meshBasicMaterial color={i % 2 === 0 ? "#5eead4" : "#7dd3fc"} transparent opacity={0.7} />
            </mesh>
          ))}
        </group>
        {/* animated ambilight halo on the back, visible from the office camera */}
        <mesh position={[0, 0, -0.075]}>
          <planeGeometry args={[LOUNGE_TV.width + 0.2, LOUNGE_TV.height + 0.16]} />
          <meshBasicMaterial
            ref={glowMat}
            color="#22d3ee"
            transparent
            opacity={0.16}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh ref={scanline} position={[0, 0, -0.08]}>
          <planeGeometry args={[LOUNGE_TV.width + 0.15, 0.06]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <PortalHtml position={[0, 0.38, -0.06]} center zIndexRange={[50, 0]}>
          <div className="pointer-events-none text-[7px] font-black uppercase tracking-[0.2em] text-sky-200/90">
            📺 NEWS
          </div>
        </PortalHtml>
        <pointLight ref={tvLight} position={[0, 0, -0.7]} intensity={8} distance={6} color="#38bdf8" />
      </group>

      {/* stereo speakers flanking the TV */}
      {[2.15, 4.65].map((z) => (
        <group key={z} position={[1.72, 0, z]}>
          <mesh position={[0, 1.18, 0]} castShadow>
            <boxGeometry args={[0.26, 1.15, 0.36]} />
            <meshStandardMaterial color="#111827" roughness={0.55} metalness={0.25} />
          </mesh>
          <mesh position={[0, 0.48, 0]}>
            <boxGeometry args={[0.08, 0.95, 0.08]} />
            <meshStandardMaterial color="#334155" metalness={0.6} />
          </mesh>
          {[1.48, 1.2, 0.94].map((y, i) => (
            <group key={y}>
              <mesh position={[-0.135, y, 0]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[i === 0 ? 0.1 : 0.08, i === 0 ? 0.1 : 0.08, 0.02, 16]} />
                <meshStandardMaterial color="#1f2937" roughness={0.8} />
              </mesh>
              <mesh position={[-0.147, y, 0]} rotation-z={Math.PI / 2}>
                <sphereGeometry args={[i === 0 ? 0.045 : 0.034, 10, 8]} />
                <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
              </mesh>
            </group>
          ))}
          <mesh position={[-0.136, 1.66, 0.1]}>
            <sphereGeometry args={[0.016, 8, 8]} />
            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}

      {/* sofa-bed on the left side, facing the TV / parking side */}
      <group position={[LOUNGE_SOFA.x, 0, LOUNGE_SOFA.y]} rotation-y={Math.PI / 2}>
        <RoundedBox args={[LOUNGE_SOFA.w, 0.24, LOUNGE_SOFA.h]} radius={0.09} smoothness={3} position={[0, 0.36, 0]} castShadow>
          <meshStandardMaterial color="#4a3d63" roughness={0.85} />
        </RoundedBox>
        <RoundedBox args={[LOUNGE_SOFA.w, 0.55, 0.22]} radius={0.08} smoothness={3} position={[0, 0.6, -0.38]} castShadow>
          <meshStandardMaterial color="#56476f" roughness={0.85} />
        </RoundedBox>
        {[-0.78, 0, 0.78].map((x, i) => (
          <RoundedBox key={i} args={[0.68, 0.14, 0.78]} radius={0.05} smoothness={2} position={[x, 0.49, 0.05]} castShadow>
            <meshStandardMaterial color="#5d4d78" roughness={0.9} />
          </RoundedBox>
        ))}
        <mesh position={[-1.14, 0.55, 0.05]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.86]} />
          <meshStandardMaterial color="#443759" roughness={0.9} />
        </mesh>
        <mesh position={[1.14, 0.55, 0.05]} castShadow>
          <boxGeometry args={[0.16, 0.5, 0.86]} />
          <meshStandardMaterial color="#443759" roughness={0.9} />
        </mesh>
        {/* sofa-bed pillow + duvet */}
        <mesh position={[-0.8, 0.64, -0.02]} rotation={[0.03, 0.2, 0]} castShadow>
          <boxGeometry args={[0.36, 0.13, 0.34]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.95} />
        </mesh>
        <mesh position={[0.34, 0.58, 0.02]} rotation={[-0.02, 0, 0]} castShadow>
          <boxGeometry args={[1.15, 0.08, 0.72]} />
          <meshStandardMaterial color="#8b5cf6" roughness={0.98} />
        </mesh>
        <mesh position={[0.78, 0.66, 0.3]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.28, 0.12, 0.22]} />
          <meshStandardMaterial color="#f5d0fe" roughness={0.9} />
        </mesh>
        <mesh position={[-1.0, 0.86, -0.04]} rotation={[0, 0.25, 0.1]}>
          <boxGeometry args={[0.26, 0.26, 0.12]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.9} />
        </mesh>
      </group>

      {/* coffee table */}
      <group position={[-0.3, 0, 3.4]}>
        <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.15, 0.06, 0.62]} />
          <meshStandardMaterial color="#8a6238" roughness={0.6} />
        </mesh>
        {[[-0.46, -0.22], [0.46, -0.22], [-0.46, 0.22], [0.46, 0.22]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.17, z]}>
            <boxGeometry args={[0.05, 0.34, 0.05]} />
            <meshStandardMaterial color="#5b412a" />
          </mesh>
        ))}
        <mesh position={[-0.22, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.05, 0.1, 12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        <mesh position={[0.22, 0.41, 0.05]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.26, 0.02, 0.18]} />
          <meshStandardMaterial color="#fcd34d" />
        </mesh>
      </group>

      {/* cat basket */}
      <group position={[-1.7, 0, 6.3]}>
        <mesh position={[0, 0.16, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.32, 0.2, 20]} />
          <meshStandardMaterial color="#8a5a3b" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.32, 20]} />
          <meshStandardMaterial color="#f1c6a8" roughness={0.98} />
        </mesh>
        <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.35, 20]} />
          <meshStandardMaterial color="#c08457" roughness={0.9} />
        </mesh>
      </group>

      {/* floor lamp */}
      <group position={[1.7, 0, 5.9]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.03, 1.8, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.82, 0]}>
          <cylinderGeometry args={[0.2, 0.12, 0.25, 16, 1, true]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
        <pointLight position={[0, 1.72, 0]} intensity={2} distance={3.2} color="#fde68a" />
      </group>
    </group>
  );
}

function CorridorSofa() {
  const { x, y, w, h } = CORRIDOR_SOFA;
  return (
    <group position={[x, 0, y]}>
      <RoundedBox args={[w + 0.4, 0.04, h + 0.7]} radius={0.02} smoothness={2} position={[0, 0.012, 0.28]} receiveShadow>
        <meshStandardMaterial color="#31405a" roughness={1} />
      </RoundedBox>
      <RoundedBox args={[w, 0.22, h]} radius={0.08} smoothness={3} position={[0, 0.32, 0]} castShadow>
        <meshStandardMaterial color="#5e7488" roughness={0.82} />
      </RoundedBox>
      <RoundedBox args={[w, 0.56, 0.18]} radius={0.07} smoothness={3} position={[0, 0.56, -h / 2 + 0.08]} castShadow>
        <meshStandardMaterial color="#465b70" roughness={0.85} />
      </RoundedBox>
      {[-w / 2 + 0.1, w / 2 - 0.1].map((cx) => (
        <RoundedBox key={cx} args={[0.16, 0.48, h - 0.04]} radius={0.06} smoothness={2} position={[cx, 0.5, 0]} castShadow>
          <meshStandardMaterial color="#465b70" roughness={0.85} />
        </RoundedBox>
      ))}
      {[-0.78, 0, 0.78].map((cx, i) => (
        <RoundedBox key={cx} args={[0.72, 0.15, h - 0.22]} radius={0.06} smoothness={2} position={[cx, 0.46, 0.03]} castShadow>
          <meshStandardMaterial color={i % 2 === 0 ? "#83a7ba" : "#7397aa"} roughness={0.92} />
        </RoundedBox>
      ))}
      <pointLight position={[0, 1.3, 0.5]} intensity={3.2} distance={4.5} color="#ffd9a3" />
      {[-0.78, 0.4].map((cx, i) => (
        <RoundedBox key={`p-${cx}`} args={[0.36, 0.16, 0.46]} radius={0.06} smoothness={2} position={[cx, 0.58, -0.2]} rotation-y={i === 0 ? -0.15 : 0.15} castShadow>
          <meshStandardMaterial color={i === 0 ? "#5eead4" : "#e2e8f0"} roughness={0.95} />
        </RoundedBox>
      ))}
      <mesh position={[-w / 2 - 0.38, 0.27, 0.16]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 20]} />
        <meshStandardMaterial color="#b98552" roughness={0.7} />
      </mesh>
      <mesh position={[-w / 2 - 0.38, 0.13, 0.16]}>
        <cylinderGeometry args={[0.035, 0.05, 0.26, 10]} />
        <meshStandardMaterial color="#334155" metalness={0.5} />
      </mesh>
      <mesh position={[-w / 2 - 0.38, 0.36, 0.16]}>
        <cylinderGeometry args={[0.055, 0.045, 0.1, 12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>
      <Plant3D x={-w / 2 - 0.95} z={-0.15} scale={0.4} />
    </group>
  );
}

function Bed({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.27, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.75, 0.22, 2.25]} />
        <meshStandardMaterial color="#4b3a54" roughness={0.85} />
      </mesh>
      <RoundedBox args={[1.62, 0.2, 2.1]} radius={0.06} smoothness={2} position={[0, 0.45, 0]} castShadow>
        <meshStandardMaterial color="#f8fafc" roughness={0.95} />
      </RoundedBox>
      <mesh position={[0, 0.57, 0.28]} castShadow>
        <boxGeometry args={[1.52, 0.1, 1.45]} />
        <meshStandardMaterial color="#60a5fa" roughness={0.95} />
      </mesh>
      <mesh position={[-0.42, 0.6, -0.76]} rotation={[-0.06, 0.05, 0]} castShadow>
        <boxGeometry args={[0.62, 0.14, 0.34]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.98} />
      </mesh>
      <mesh position={[0.92, 0.64, 0.4]} rotation={[0, -0.2, 0]}>
        <boxGeometry args={[0.22, 0.12, 0.5]} />
        <meshStandardMaterial color="#fda4af" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.88, -1.12]} castShadow>
        <boxGeometry args={[1.82, 0.92, 0.08]} />
        <meshStandardMaterial color="#4c3b56" roughness={0.9} />
      </mesh>
      {[[-0.7, -0.9], [0.7, -0.9], [-0.7, 0.9], [0.7, 0.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.08, z]}>
          <boxGeometry args={[0.1, 0.16, 0.1]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      ))}
    </group>
  );
}

function SickBayRoom() {
  return (
    <group>
      {/* two recovery beds */}
      <Bed position={[8.05, 0, 3.3]} />
      <Bed position={[3.3, 0, 5.65]} />
      {/* privacy curtains */}
      <mesh position={[7.05, 1.15, 5.15]}>
        <boxGeometry args={[0.04, 1.5, 2.1]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.22} roughness={0.9} />
      </mesh>
      <mesh position={[4.45, 1.15, 5.65]}>
        <boxGeometry args={[0.04, 1.5, 2.1]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.22} roughness={0.9} />
      </mesh>
      <mesh position={[4.45, 1.92, 5.65]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.02, 0.02, 2.2, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} />
      </mesh>

      {/* bedside table + reading lamp */}
      <group position={[4.55, 0, 4.62]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[0.46, 0.7, 0.46]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.42, 10]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.98, 0]}>
          <coneGeometry args={[0.16, 0.22, 14]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={0.45} />
        </mesh>
        <pointLight position={[0, 1.0, 0]} intensity={1.6} distance={2.6} color="#fde68a" />
      </group>

      {/* medical cart + monitor */}
      <group position={[5.2, 0, 6.45]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.7, 0.9, 0.5]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.35} roughness={0.4} />
        </mesh>
        {[0.25, 0.65].map((y) => (
          <mesh key={y} position={[0.36, y, 0]}>
            <boxGeometry args={[0.02, 0.18, 0.03]} />
            <meshStandardMaterial color="#64748b" metalness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 1.02, 0]}>
          <boxGeometry args={[0.38, 0.26, 0.2]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0, 1.02, 0.11]}>
          <planeGeometry args={[0.3, 0.18]} />
          <meshStandardMaterial color="#052e16" emissive="#22c55e" emissiveIntensity={0.6} />
        </mesh>
        <pointLight position={[0, 1.1, 0.2]} intensity={1.2} distance={2} color="#22c55e" />
      </group>

      {/* framed get-well poster on the south wall */}
      <group position={[3.35, 1.55, 7.12]}>
        <mesh>
          <boxGeometry args={[0.95, 0.72, 0.05]} />
          <meshStandardMaterial color="#1f2d3d" />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <planeGeometry args={[0.82, 0.6]} />
          <meshStandardMaterial color="#f8fafc" emissive="#fda4af" emissiveIntensity={0.12} />
        </mesh>
        <mesh position={[0, 0.02, 0.045]}>
          <boxGeometry args={[0.32, 0.1, 0.005]} />
          <meshStandardMaterial color="#fb7185" />
        </mesh>
        <mesh position={[0, 0.02, 0.05]}>
          <boxGeometry args={[0.1, 0.3, 0.005]} />
          <meshStandardMaterial color="#fb7185" />
        </mesh>
      </group>
      <group position={[8.05, 0, 1.95]}>
        <mesh position={[0, 0.24, 0]} castShadow>
          <boxGeometry args={[0.55, 0.48, 0.45]} />
          <meshStandardMaterial color="#5b412a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.58, 0]}>
          <cylinderGeometry args={[0.07, 0.1, 0.18, 12]} />
          <meshStandardMaterial color="#f8fafc" emissive="#fde68a" emissiveIntensity={0.25} />
        </mesh>
        <pointLight position={[0, 0.7, 0]} intensity={1.2} distance={2.2} color="#fde68a" />
      </group>

      {/* medical cross + cabinet */}
      <mesh position={[5.9, 1.8, 7.14]}>
        <boxGeometry args={[0.9, 0.28, 0.06]} />
        <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[5.9, 1.8, 7.17]}>
        <boxGeometry args={[0.28, 0.9, 0.06]} />
        <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={0.35} />
      </mesh>
      <group position={[9.12, 0, 6.1]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[0.32, 1.5, 0.9]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.5} metalness={0.15} />
        </mesh>
        {[0.35, 0.8].map((y, i) => (
          <mesh key={i} position={[-0.18, y, 0]}>
            <boxGeometry args={[0.02, 0.03, 0.6]} />
            <meshStandardMaterial color="#64748b" metalness={0.6} />
          </mesh>
        ))}
        <mesh position={[-0.19, 1.2, 0]}>
          <boxGeometry args={[0.02, 0.2, 0.2]} />
          <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={0.4} />
        </mesh>
      </group>
      <pointLight position={[5.9, 2.2, 4.6]} intensity={2.5} distance={4.5} color="#fb7185" />

      {/* IV stand */}
      <group position={[7.0, 0, 2.0]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.86, 0]}>
          <boxGeometry args={[0.25, 0.2, 0.08]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.22, 0.24, 0.03, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function ToiletRoom() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[3.3, 0.028, 2.9]} receiveShadow>
        <planeGeometry args={[2.1, 2.3]} />
        <meshStandardMaterial color="#dce5ec" roughness={0.9} />
      </mesh>
      {[2.0, 2.9, 3.8].map((z) => (
        <mesh key={z} rotation-x={-Math.PI / 2} position={[3.3, 0.03, z]}>
          <planeGeometry args={[2.0, 0.03]} />
          <meshStandardMaterial color="#c4d0da" roughness={0.9} />
        </mesh>
      ))}

      {/* toilet against the west wall */}
      <group position={[2.45, 0, 2.2]}>
        <mesh position={[-0.08, 0.58, 0]} castShadow>
          <boxGeometry args={[0.18, 0.62, 0.52]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.25} />
        </mesh>
        <mesh position={[0.14, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.17, 0.26, 20]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
        <mesh position={[0.14, 0.45, 0]} rotation={[0, 0, 0.06]} castShadow>
          <cylinderGeometry args={[0.255, 0.24, 0.06, 20]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
        </mesh>
        <mesh position={[0.14, 0.48, 0]}>
          <torusGeometry args={[0.2, 0.018, 8, 20]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.5} />
        </mesh>
        <mesh position={[0.24, 0.57, 0]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.2} />
        </mesh>
      </group>

      {/* sink + mirror by the entrance */}
      <group position={[3.85, 0, 1.95]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.18, 0.14, 20]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.62, -0.04]}>
          <torusGeometry args={[0.06, 0.018, 8, 14]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.5, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.0, -0.17]}>
          <planeGeometry args={[0.55, 0.7]} />
          <meshStandardMaterial color="#bae6fd" emissive="#38bdf8" emissiveIntensity={0.25} metalness={0.7} roughness={0.15} />
        </mesh>
        <mesh position={[0.24, 0.55, 0.18]}>
          <boxGeometry args={[0.12, 0.03, 0.08]} />
          <meshStandardMaterial color="#5eead4" />
        </mesh>
      </group>

      {/* paper + vent */}
      <mesh position={[2.28, 0.7, 2.9]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.24, 0.24, 0.12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.8} />
      </mesh>
      <mesh position={[3.3, 1.0, 4.0]}>
        <boxGeometry args={[0.7, 0.25, 0.04]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.6} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[3.1 + i * 0.2, 1.0, 4.02]}>
          <boxGeometry args={[0.05, 0.17, 0.02]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      ))}
      <pointLight position={[3.3, 1.5, 2.9]} intensity={2.2} distance={3.2} color="#e0f2fe" />
    </group>
  );
}

function useGrassTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#41653f";
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2400; i += 1) {
        const shade = Math.random();
        ctx.fillStyle =
          shade > 0.66 ? "rgba(116,153,92,0.35)" : shade > 0.33 ? "rgba(52,91,54,0.4)" : "rgba(28,64,40,0.3)";
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 3, 2 + Math.random() * 3);
      }
      for (let i = 0; i < 380; i += 1) {
        ctx.strokeStyle = `rgba(132,170,102,${0.06 + Math.random() * 0.14})`;
        ctx.lineWidth = 1;
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1 + Math.random() * 3, y - 3 - Math.random() * 5);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(14, 11);
    texture.anisotropy = 8;
    return texture;
  }, []);
}

function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.22, 2.2, 8]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.95} />
      </mesh>
      {[
        [0, 2.5, 0, 1.1],
        [-0.6, 2.15, 0.2, 0.75],
        [0.55, 2.2, -0.15, 0.8],
        [0.1, 2.95, 0.1, 0.7],
      ].map(([lx, ly, lz, size], i) => (
        <mesh key={i} position={[lx, ly, lz]} castShadow>
          <sphereGeometry args={[size, 10, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#2c6b43" : "#3d8252"} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Car({ x, z, color, rotation = 0 }: { x: number; z: number; color: string; rotation?: number }) {
  return (
    <group position={[x, -0.3, z]} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.95, 0.48, 0.92]} radius={0.16} smoothness={3} position={[0, 0.48, 0]} castShadow>
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.35} />
      </RoundedBox>
      <RoundedBox args={[1.05, 0.42, 0.8]} radius={0.12} smoothness={3} position={[-0.15, 0.86, 0]} castShadow>
        <meshStandardMaterial color="#1e293b" metalness={0.25} roughness={0.15} transparent opacity={0.92} />
      </RoundedBox>
      <mesh position={[0.42, 0.9, 0]}><boxGeometry args={[0.42, 0.06, 0.72]} /><meshStandardMaterial color={color} metalness={0.4} roughness={0.3} /></mesh>
      {[-0.68, 0.68].map((wx) =>
        [-0.48, 0.48].map((wz) => (
          <mesh key={`${wx}-${wz}`} position={[wx, 0.3, wz]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.26, 0.16, 16]} />
            <meshStandardMaterial color="#0b1220" roughness={0.7} />
          </mesh>
        )),
      )}
      <mesh position={[0.96, 0.56, 0.28]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0.96, 0.56, -0.28]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

const TRAFFIC_COLORS = ["#38bdf8", "#f97316", "#e2e8f0", "#a855f7", "#ef4444", "#22c55e", "#facc15"];

function TrafficCar({
  axis,
  lane,
  direction,
  speed,
  offset,
  period,
  duration,
  color,
}: {
  axis: "x" | "z";
  lane: number;
  direction: 1 | -1;
  speed: number;
  offset: number;
  period: number;
  duration: number;
  color: string;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + offset;
    const cycle = ((t % period) + period) % period;
    const active = cycle < duration;
    ref.current.visible = active;
    if (!active) return;
    const range = axis === "x" ? 52 : 36;
    const travelled = Math.min(range, cycle * speed);
    const p = direction > 0 ? -range / 2 + travelled : range / 2 - travelled;
    if (axis === "x") {
      ref.current.position.set(p, 0, lane);
      ref.current.rotation.y = direction > 0 ? 0 : Math.PI;
    } else {
      ref.current.position.set(lane, 0, p);
      ref.current.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
  });
  return (
    <group ref={ref}>
      <Car x={0} z={0} color={color} />
    </group>
  );
}

function Traffic() {
  const cars = useMemo(
    () => [
      {
        axis: "z" as const,
        lane: -14.6,
        direction: 1 as const,
        speed: 3.6,
        offset: 4,
        period: 38,
        duration: 11,
        color: "#e2e8f0",
      },
      {
        axis: "x" as const,
        lane: 11.7,
        direction: -1 as const,
        speed: 4.4,
        offset: 26,
        period: 46,
        duration: 12,
        color: TRAFFIC_COLORS[1],
      },
    ],
    [],
  );
  return (
    <group>
      {cars.map((car, i) => (
        <TrafficCar key={i} {...car} />
      ))}
    </group>
  );
}

function ExitDoorPanels() {
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const near = [...agentPositions.values()].some((agent) => Math.hypot(agent.x - 9.36, agent.y) < 0.75);
    const offset = near ? 1.3 : 0.64;
    if (leftRef.current) {
      leftRef.current.position.z = THREE.MathUtils.damp(leftRef.current.position.z, -offset, 5, delta);
    }
    if (rightRef.current) {
      rightRef.current.position.z = THREE.MathUtils.damp(rightRef.current.position.z, offset, 5, delta);
    }
  });
  return (
    <>
      {[leftRef, rightRef].map((ref, index) => {
        const side = index === 0 ? -1 : 1;
        return (
          <group key={side} ref={ref} position={[0, 0, side * 0.64]}>
            <mesh position={[0.04, 1.02, 0]}>
              <boxGeometry args={[0.035, 2.0, 1.1]} />
              <meshStandardMaterial color="#bfe8ff" transparent opacity={0.34} roughness={0.08} metalness={0.2} depthWrite={false} />
            </mesh>
            <mesh position={[0.04, 1.99, 0]}>
              <boxGeometry args={[0.06, 0.05, 1.1]} />
              <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.25} />
            </mesh>
            <mesh position={[0.04, 0.06, 0]}>
              <boxGeometry args={[0.06, 0.06, 1.1]} />
              <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.25} />
            </mesh>
            <mesh position={[0.07, 0.95, side * -0.42]}>
              <boxGeometry args={[0.04, 0.42, 0.035]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function ParkingExit() {
  return (
    <group position={[9.36, 0, 0]}>
      {/* threshold + paving to the parking lot */}
      <mesh position={[0.35, 0.02, 0]} receiveShadow>
        <boxGeometry args={[1.0, 0.06, 2.6]} />
        <meshStandardMaterial color="#b7c1c9" roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[1.55, -0.28, 0]} receiveShadow>
        <planeGeometry args={[2.4, 2.5]} />
        <meshStandardMaterial color="#a8b2ba" roughness={0.95} />
      </mesh>

      {/* big double glass exit */}
      {[-1.3, 1.3].map((z) => (
        <mesh key={z} position={[0, 1.08, z]} castShadow>
          <boxGeometry args={[0.16, 2.16, 0.16]} />
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 2.18, 0]} castShadow>
        <boxGeometry args={[0.18, 0.18, 2.8]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
      </mesh>
      <ExitDoorPanels />

      {/* canopy and sign */}
      <mesh position={[0.9, 2.55, 0]} castShadow>
        <boxGeometry args={[2.0, 0.1, 3.1]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[1.7, 2.36, 0]}>
        <boxGeometry args={[0.08, 0.28, 3.0]} />
        <meshStandardMaterial color="#5eead4" emissive="#22d3ee" emissiveIntensity={0.9} />
      </mesh>
      <PortalHtml position={[0.25, 2.48, 0]} center distanceFactor={11} zIndexRange={[60, 0]}>
        <div className="pointer-events-none flex items-center gap-1.5 whitespace-nowrap rounded-md border border-emerald-300/40 bg-slate-950/90 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-200 shadow-xl">
          🅿️ Exit · Parkiran
        </div>
      </PortalHtml>
      <pointLight position={[0.8, 2.2, 0]} intensity={2.4} distance={3.4} color="#5eead4" />
    </group>
  );
}

function useLocalTime() {
  const [now, setNow] = useState(() => {
    const value = new Date();
    if (typeof window !== "undefined") {
      const forced = new URLSearchParams(window.location.search).get("hour");
      if (forced !== null && Number.isFinite(Number(forced))) value.setHours(Number(forced));
    }
    return value;
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function useSkyTexture(night: boolean) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    if (night) {
      gradient.addColorStop(0, "#04101f");
      gradient.addColorStop(0.45, "#0a2138");
      gradient.addColorStop(0.72, "#123a56");
      gradient.addColorStop(0.82, "#1f4a60");
      gradient.addColorStop(1, "#2a4a50");
    } else {
      gradient.addColorStop(0, "#2b6cb0");
      gradient.addColorStop(0.45, "#74b4dc");
      gradient.addColorStop(0.7, "#c4e3f2");
      gradient.addColorStop(0.82, "#e8f4f8");
      gradient.addColorStop(1, "#dce8d4");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [night]);
}

function SkyDome({ night }: { night: boolean }) {
  const texture = useSkyTexture(night);
  return (
    <mesh renderOrder={-10}>
      <sphereGeometry args={[180, 32, 20]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

function Clouds({ night }: { night: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.012) * 0.05;
  });
  const clouds = [
    { x: -36, y: 24, z: -54, s: 1.15 },
    { x: 4, y: 29, z: -64, s: 1.4 },
    { x: 38, y: 22, z: -44, s: 1.0 },
    { x: -52, y: 20, z: -18, s: 0.9 },
    { x: 58, y: 26, z: -22, s: 1.15 },
    { x: -12, y: 18, z: -72, s: 0.85 },
  ];
  return (
    <group ref={group}>
      {clouds.map((cloud, index) => (
        <group key={index} position={[cloud.x, cloud.y, cloud.z]} scale={cloud.s}>
          {[
            [0, 0, 0, 3.2],
            [-2.8, -0.25, 0.3, 2.2],
            [2.7, -0.35, -0.2, 2.4],
            [-0.7, 0.7, -0.4, 2.4],
            [1.4, 0.4, 0.5, 1.9],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} scale={[1.7, 0.62, 1]}>
              <sphereGeometry args={[r, 12, 8]} />
              <meshBasicMaterial
                color={night ? "#223243" : "#f7fbff"}
                transparent
                opacity={night ? 0.35 : 0.78}
                depthWrite={false}
                fog={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function StarField() {
  const positions = useMemo(() => {
    const values = new Float32Array(420 * 3);
    let seed = 17;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 420; i += 1) {
      const theta = random() * Math.PI * 2;
      const phi = 0.12 + random() * 1.1;
      const radius = 95 + random() * 45;
      values[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
      values[i * 3 + 1] = 18 + Math.cos(phi) * radius;
      values[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
    }
    return values;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#e2e8f0" size={0.32} sizeAttenuation transparent opacity={0.85} depthWrite={false} fog={false} />
    </points>
  );
}

function Celestial({ night }: { night: boolean }) {
  return (
    <group position={night ? [48, 46, -78] : [62, 58, -72]}>
      <mesh>
        <sphereGeometry args={[night ? 2.1 : 2.8, 20, 16]} />
        <meshBasicMaterial color={night ? "#dbeafe" : "#fef3c7"} fog={false} />
      </mesh>
      <mesh scale={2.1}>
        <sphereGeometry args={[night ? 2.1 : 2.8, 20, 16]} />
        <meshBasicMaterial color={night ? "#93c5fd" : "#fde68a"} transparent opacity={0.12} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

function useBuildingSign() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#07131f";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, 1000, 232);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f8fafc";
    ctx.font = "900 94px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("KANTOR ORCAI", 512, 136);
    ctx.fillStyle = "#67e8f9";
    ctx.font = "700 26px ui-monospace, monospace";
    ctx.fillText("A I   O F F I C E   O R C H E S T R A", 512, 196);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }, []);
}

function ExteriorShell({ night }: { night: boolean }) {
  const sign = useBuildingSign();
  const southWindows = Array.from({ length: 10 }).flatMap((_, col) =>
    [0, 1, 2].map((row) => ({ col, row })),
  );
  const sideWindows = Array.from({ length: 6 }).flatMap((_, col) =>
    [0, 1, 2].map((row) => ({ col, row })),
  );
  return (
    <group position={[-0.4, 0, 0]}>
      {/* plaza + steps */}
      <mesh position={[0, -0.27, 8.6]} receiveShadow>
        <boxGeometry args={[24, 0.18, 11]} />
        <meshStandardMaterial color="#b8c4ca" roughness={0.95} />
      </mesh>
      {[0, 1, 2].map((step) => (
        <mesh key={step} position={[0, -0.2 + step * 0.08, 7.95 + step * 0.32]} receiveShadow>
          <boxGeometry args={[9.4, 0.16, 0.34]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
        </mesh>
      ))}

      {/* solid core keeps the building closed at max zoom */}
      <mesh position={[0, 4.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[20.8, 9.2, 14.8]} />
        <meshStandardMaterial color="#091824" roughness={0.55} metalness={0.35} />
      </mesh>

      {/* floor slabs and roof */}
      {[3.2, 6.4].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[21.6, 0.22, 15.8]} />
          <meshStandardMaterial color="#1c2b3a" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {/* roof deck */}
      <mesh position={[0, 9.64, 0]} receiveShadow>
        <boxGeometry args={[21.2, 0.16, 15.4]} />
        <meshStandardMaterial color="#a7b3b7" roughness={0.85} />
      </mesh>
      {/* green roof strips + planters */}
      {[-6.0, 5.7].map((x) => (
        <mesh key={`green-${x}`} position={[x, 9.75, 4.9]} receiveShadow>
          <boxGeometry args={[3.0, 0.16, 1.2]} />
          <meshStandardMaterial color="#4d7a4f" roughness={1} />
        </mesh>
      ))}
      {[-7.2, -4.4, 4.0, 6.8].map((x) => (
        <group key={`roof-planter-${x}`} position={[x, 9.78, 5.2]}>
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[1.4, 0.3, 1.0]} />
            <meshStandardMaterial color="#52616a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <sphereGeometry args={[0.34, 8, 6]} />
            <meshStandardMaterial color="#3f7d4c" roughness={1} />
          </mesh>
          <mesh position={[0.36, 0.34, 0.18]}>
            <sphereGeometry args={[0.22, 8, 6]} />
            <meshStandardMaterial color="#4d9159" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* solar array */}
      {[-3.0, -0.8, 1.4, 3.6].map((x) => (
        <group key={`solar-${x}`} position={[x, 9.84, -3.6]} rotation-x={-0.28}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[1.9, 0.06, 1.15]} />
            <meshStandardMaterial color="#0b3b57" metalness={0.6} roughness={0.2} emissive="#0ea5e9" emissiveIntensity={0.18} />
          </mesh>
          <mesh position={[-0.75, 0.2, 0]}>
            <boxGeometry args={[0.07, 0.5, 0.07]} />
            <meshStandardMaterial color="#475569" metalness={0.7} />
          </mesh>
          <mesh position={[0.75, 0.2, 0]}>
            <boxGeometry args={[0.07, 0.5, 0.07]} />
            <meshStandardMaterial color="#475569" metalness={0.7} />
          </mesh>
        </group>
      ))}
      {/* parapet + railing */}
      {[
        [0, 7.72, 22, 0.5, 0.12],
        [0, -7.72, 22, 0.5, 0.12],
        [-11.0, 0, 0.12, 0.5, 15.4],
        [11.0, 0, 0.12, 0.5, 15.4],
      ].map(([x, z, sx, sy, sz], i) => (
        <mesh key={`parapet-${i}`} position={[x, 9.88, z]}>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color="#2b3d4d" metalness={0.35} roughness={0.55} />
        </mesh>
      ))}
      {[7.66, -7.66].map((z) => (
        <mesh key={`rail-${z}`} position={[0, 10.3, z]}>
          <boxGeometry args={[21.6, 0.04, 0.04]} />
          <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={night ? 0.7 : 0.25} metalness={0.5} />
        </mesh>
      ))}
      {[0, 1, 2].map((row) =>
        southWindows.map(({ col }) => {
          const lit = (col * 7 + row * 3) % 4 === 0;
          return (
            <mesh key={`s-${row}-${col}`} position={[-9.2 + col * 2.04, 1.62 + row * 3.2, 7.44]}>
              <boxGeometry args={[1.9, 2.62, 0.08]} />
              <meshStandardMaterial
                color={night ? "#0d2b3d" : "#9ecbe2"}
                emissive={lit ? "#fbbf24" : "#0ea5e9"}
                emissiveIntensity={night ? (lit ? 1.4 : 0.12) : 0.16}
                transparent
                opacity={0.78}
                metalness={0.55}
                roughness={0.18}
              />
            </mesh>
          );
        }),
      )}
      {southWindows.filter((_, i) => i % 3 === 0).map(({ col, row }) => (
        <mesh key={`m-s-${row}-${col}`} position={[-9.2 + col * 2.04 + 1.02, 1.62 + row * 3.2, 7.55]}>
          <boxGeometry args={[0.06, 3.2, 0.1]} />
          <meshStandardMaterial color="#223041" metalness={0.75} roughness={0.25} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 10.5, 0, 0]} rotation-y={side * Math.PI / 2}>
          {sideWindows.map(({ col, row }) => {
            const lit = (col * 5 + row * 7) % 5 === 0;
            return (
              <mesh key={`w-${side}-${row}-${col}`} position={[-5.4 + col * 2.16, 1.62 + row * 3.2, 0.02]}>
                <boxGeometry args={[1.94, 2.62, 0.06]} />
                <meshStandardMaterial
                  color={night ? "#0c2638" : "#9ecbe2"}
                  emissive={lit ? "#fbbf24" : "#0ea5e9"}
                  emissiveIntensity={night ? (lit ? 1.1 : 0.08) : 0.12}
                  transparent
                  opacity={0.72}
                  metalness={0.55}
                  roughness={0.2}
                />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* entrance atrium */}
      <mesh position={[0, 2.65, 7.95]} castShadow>
        <boxGeometry args={[8.2, 5.3, 1.3]} />
        <meshStandardMaterial color="#0b1d2b" roughness={0.4} metalness={0.4} />
      </mesh>
      {[-3.6, -1.2, 1.2, 3.6].map((x) => (
        <mesh key={x} position={[x, 2.65, 8.62]}>
          <boxGeometry args={[0.08, 5.2, 0.06]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 2.5, 8.66]}>
        <boxGeometry args={[3.4, 4.2, 0.05]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.35} emissive="#0ea5e9" emissiveIntensity={night ? 0.5 : 0.15} metalness={0.5} roughness={0.1} />
      </mesh>
      {/* warm lobby glow behind the entrance glass */}
      <mesh position={[0, 2.35, 8.75]}>
        <planeGeometry args={[4.7, 2.9]} />
        <meshStandardMaterial color="#1a2c3d" emissive="#fcd68a" emissiveIntensity={night ? 1.35 : 0.5} />
      </mesh>
      {[-1.7, 0, 1.7].map((x) => (
        <mesh key={`lobby-bar-${x}`} position={[x, 2.35, 8.755]}>
          <boxGeometry args={[0.07, 2.5, 0.03]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={night ? 1.8 : 0.8} />
        </mesh>
      ))}
      {[-1.15, 1.15].map((x) => (
        <mesh key={`lobby-mullion-${x}`} position={[x, 2.35, 8.765]}>
          <boxGeometry args={[0.055, 2.82, 0.035]} />
          <meshStandardMaterial color="#101c2c" metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 4.95, 8.8]} castShadow>
        <boxGeometry args={[9.2, 0.28, 3.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
      </mesh>
      {[-4.1, 4.1].map((x) => (
        <mesh key={`col-${x}`} position={[x, 2.4, 8.95]} castShadow>
          <cylinderGeometry args={[0.14, 0.16, 4.8, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 4.4, 8.86]}>
        <boxGeometry args={[7.2, 0.05, 0.05]} />
        <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={1.2} />
      </mesh>

      {/* rooftop sign + equipment */}
      <mesh position={[0, 10.8, 7.75]}> 
        <planeGeometry args={[10.6, 2.65]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
      <mesh position={[0, 10.8, 7.5]}>
        <boxGeometry args={[10.8, 2.85, 0.14]} />
        <meshStandardMaterial color="#0b1723" metalness={0.4} roughness={0.5} />
      </mesh>
      {[-3.4, 0, 3.4].map((x) => (
        <mesh key={`support-${x}`} position={[x, 9.72, 7.7]}>
          <boxGeometry args={[0.12, 0.5, 0.12]} />
          <meshStandardMaterial color="#475569" metalness={0.6} />
        </mesh>
      ))}
      {[[-6.5, 8.5], [-4.9, 9.0], [5.2, 8.6], [7.1, 9.2]].map(([x, z], i) => (
        <mesh key={`roof-${i}`} position={[x, 10.15, z]} castShadow>
          <boxGeometry args={[1.2, 0.8, 1.0]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 14.2, -3.5]}>
        <cylinderGeometry args={[0.08, 0.12, 9, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 5.48, 8.78]}>
        <planeGeometry args={[6.2, 1.5]} />
        <meshBasicMaterial map={sign} transparent />
      </mesh>
      <mesh position={[0, 5.48, 8.72]}>
        <boxGeometry args={[6.42, 1.72, 0.08]} />
        <meshStandardMaterial color="#0b1723" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* landscape lighting */}
      {[-7.5, -3.5, 3.5, 7.5].map((x) => (
        <group key={`lamp-${x}`} position={[x, 0, 10.4]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 1.1, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={night ? 1.7 : 0.5} />
          </mesh>
          <pointLight position={[0, 1.2, 0]} intensity={night ? 4 : 1.2} distance={5} color="#fde68a" />
        </group>
      ))}
      <pointLight position={[0, 4.2, 9.4]} intensity={night ? 8 : 3} distance={10} color="#67e8f9" />
      <pointLight position={[0, 2.7, 9.6]} intensity={night ? 9 : 4} distance={8} color="#ffe0a8" />
    </group>
  );
}

function CorridorDecor() {
  return (
    <group>
      {/* bench between musholla and pantry */}
      <group position={[-6.3, 0, 1.28]}>
        <RoundedBox args={[1.7, 0.14, 0.48]} radius={0.05} smoothness={2} position={[0, 0.44, 0]} castShadow>
          <meshStandardMaterial color="#9a6a3f" roughness={0.8} />
        </RoundedBox>
        <mesh position={[0, 0.68, 0.22]} castShadow>
          <boxGeometry args={[1.7, 0.44, 0.1]} />
          <meshStandardMaterial color="#7c5432" roughness={0.85} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 0.2, 0]}>
            <boxGeometry args={[0.08, 0.4, 0.4]} />
            <meshStandardMaterial color="#334155" metalness={0.5} />
          </mesh>
        ))}
      </group>
      {/* console + framed poster */}
      <group position={[-2.2, 0, 1.3]}>
        <RoundedBox args={[1.2, 0.08, 0.36]} radius={0.03} smoothness={2} position={[0, 0.78, 0]} castShadow>
          <meshStandardMaterial color="#b98552" roughness={0.65} />
        </RoundedBox>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.4, 0]}>
            <boxGeometry args={[0.05, 0.76, 0.3]} />
            <meshStandardMaterial color="#334155" metalness={0.4} />
          </mesh>
        ))}
        <mesh position={[-0.28, 0.87, 0]}>
          <cylinderGeometry args={[0.07, 0.05, 0.14, 12]} />
          <meshStandardMaterial color="#5eead4" emissive="#2dd4bf" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0.26, 0.84, 0]} rotation-y={0.2}>
          <boxGeometry args={[0.32, 0.04, 0.22]} />
          <meshStandardMaterial color="#e2e8f0" />
        </mesh>
      </group>
      {[-6.3, -2.2].map((x, i) => (
        <group key={`art-${x}`} position={[x, 0, 1.64]}>
          <mesh position={[0, 1.18, 0]}>
            <boxGeometry args={[i === 0 ? 1.6 : 1.0, i === 0 ? 1.0 : 0.72, 0.06]} />
            <meshStandardMaterial color="#1f2d3d" />
          </mesh>
          <mesh position={[0, 1.18, 0.04]}>
            <planeGeometry args={[i === 0 ? 1.42 : 0.86, i === 0 ? 0.82 : 0.58]} />
            <meshStandardMaterial color={i === 0 ? "#2b5c63" : "#4a3d63"} emissive={i === 0 ? "#14b8a6" : "#8b5cf6"} emissiveIntensity={0.18} />
          </mesh>
        </group>
      ))}
      {/* water cooler on the west end */}
      <group position={[-9.6, 0, -1.25]}>
        <mesh position={[0, 0.52, 0]} castShadow>
          <boxGeometry args={[0.5, 0.95, 0.45]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.5} metalness={0.1} />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <cylinderGeometry args={[0.18, 0.14, 0.3, 16]} />
          <meshStandardMaterial color="#7dd3fc" transparent opacity={0.6} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.7, 0.24]}>
          <boxGeometry args={[0.08, 0.05, 0.04]} />
          <meshStandardMaterial color="#334155" metalness={0.6} />
        </mesh>
      </group>
      {/* coat rack */}
      <group position={[1.35, 0, -1.24]}>
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.035, 0.05, 1.8, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.75, 0]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const angle = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(angle) * 0.22, 1.55, Math.sin(angle) * 0.22]} rotation-z={0.7}>
              <cylinderGeometry args={[0.02, 0.02, 0.28, 6]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
          );
        })}
        <mesh position={[0.14, 1.28, 0.05]} rotation-z={0.12}>
          <boxGeometry args={[0.34, 0.72, 0.03]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

function Outdoor() {
  const grass = useGrassTexture();
  return (
    <group>
      {/* endless lawn under every road and building */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.46, -6]} receiveShadow>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color="#52744e" emissive="#0c170d" emissiveIntensity={0.35} roughness={1} />
      </mesh>
      {/* lawn */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.4, 2]} receiveShadow>
        <planeGeometry args={[66, 52]} />
        <meshStandardMaterial map={grass} color="#7da36b" roughness={1} />
      </mesh>

      {/* sidewalk + curb along the south face */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.3, 8.85]} receiveShadow>
        <planeGeometry args={[52, 1.8]} />
        <meshStandardMaterial color="#a8b0b6" roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.3, 7.95]}>
        <boxGeometry args={[52, 0.16, 0.18]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
      </mesh>
      {Array.from({ length: 26 }).map((_, i) => (
        <mesh key={i} position={[-24 + i * 1.9, -0.29, 8.95]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.04, 1.9]} />
          <meshStandardMaterial color="#c6ccd1" roughness={1} />
        </mesh>
      ))}

      {/* road */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.31, 12.8]} receiveShadow>
        <planeGeometry args={[64, 4.6]} />
        <meshStandardMaterial color="#1d252f" roughness={0.96} />
      </mesh>
      {Array.from({ length: 13 }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-27 + i * 4.6, -0.3, 12.8]}>
          <planeGeometry args={[2.2, 0.16]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={0.18} roughness={0.8} />
        </mesh>
      ))}
      {/* zebra cross, kept clear of the sidewalk */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-2.1 + i * 0.62, -0.29, 12.8]}>
          <planeGeometry args={[0.34, 4.0]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} emissive="#e2e8f0" emissiveIntensity={0.08} />
        </mesh>
      ))}

      {/* side road on the west, visible from the office camera */}
      <mesh rotation-x={-Math.PI / 2} position={[-15.8, -0.31, -1]} receiveShadow>
        <planeGeometry args={[4.6, 36]} />
        <meshStandardMaterial color="#1d252f" roughness={0.96} />
      </mesh>
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-15.8, -0.3, -17 + i * 4]}>
          <planeGeometry args={[0.16, 2.1]} />
          <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={0.18} roughness={0.8} />
        </mesh>
      ))}
      {/* zebra cross on the west road */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-15.8, -0.29, 6.3 + i * 0.6]}>
          <planeGeometry args={[4.0, 0.34]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} emissive="#e2e8f0" emissiveIntensity={0.08} />
        </mesh>
      ))}
      <Traffic />

      {/* parking lot to the east */}
      <mesh rotation-x={-Math.PI / 2} position={[16, -0.3, 2.4]} receiveShadow>
        <planeGeometry args={[10.5, 9.2]} />
        <meshStandardMaterial color="#2a3340" roughness={0.97} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[16, -0.295, 8.4]}>
        <planeGeometry args={[10.5, 2.4]} />
        <meshStandardMaterial color="#323c49" roughness={0.95} />
      </mesh>
      {[10.4, 12.4, 14.4, 16.4, 18.4].map((x) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x, -0.293, 2.4]}>
          <planeGeometry args={[0.1, 6.6]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.8} />
        </mesh>
      ))}
      <Car x={11.4} z={2.6} color="#38bdf8" rotation={Math.PI / 2} />
      <Car x={13.4} z={2.6} color="#f97316" rotation={Math.PI / 2} />
      <Car x={15.4} z={2.6} color="#e2e8f0" rotation={Math.PI / 2} />
      <Car x={17.4} z={2.6} color="#a855f7" rotation={Math.PI / 2} />

      {/* landscaping */}
      <Tree x={-11.5} z={4.4} scale={1.05} />
      <Tree x={-11.6} z={-4.6} scale={0.85} />
      <Tree x={-18.4} z={4.0} scale={0.8} />
      <Tree x={13.2} z={-4.8} scale={1.05} />
      <Tree x={13.6} z={7.7} scale={0.8} />
      <Tree x={-6.5} z={9.4} scale={0.55} />
      <Tree x={6.4} z={9.4} scale={0.6} />
      {[-11.4, -7.4, -3.2, 3.2, 7.4, 11.4].map((x, i) => (
        <group key={x} position={[x, 0, 8.0]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[0.9, 0.4, 0.55]} />
            <meshStandardMaterial color="#8a6238" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.48, 0]} castShadow>
            <sphereGeometry args={[0.38, 8, 6]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#3f7d4c" : "#4d9159"} roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* distant tree line + soft hills so the horizon never reads as black */}
      {[
        [-27, -10, 1.7],
        [-24, 14, 1.4],
        [-14, 22, 1.2],
        [2, 24, 1.5],
        [18, 21, 1.3],
        [27, 9, 1.6],
        [26, -12, 1.4],
        [12, -21, 1.2],
        [-8, -23, 1.5],
      ].map(([x, z, s], i) => (
        <Tree key={`far-tree-${i}`} x={x} z={z} scale={s} />
      ))}
      {[
        [-44, -42, 22, 4.5, 15],
        [-8, -55, 30, 5.5, 18],
        [38, -46, 26, 4.8, 16],
        [52, 4, 22, 3.8, 14],
        [-52, 16, 24, 4.2, 15],
      ].map(([x, z, sx, sy, sz], i) => (
        <mesh key={`hill-${i}`} position={[x, -1.8, z]} scale={[sx, sy, sz]} receiveShadow>
          <sphereGeometry args={[1, 18, 10]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#33502f" : "#3c5a38"} roughness={1} />
        </mesh>
      ))}

      {/* street lights */}
      {[-10, 10].map((x) => (
        <group key={x} position={[x, 0, 10.3]}>
          <mesh position={[0, 1.8, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.08, 3.6, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 3.55, 0]}>
            <boxGeometry args={[0.55, 0.08, 0.16]} />
            <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={1.2} />
          </mesh>
          <pointLight position={[0, 3.4, 0]} intensity={5} distance={7} color="#fde68a" />
        </group>
      ))}

    </group>
  );
}

function Cat3D() {
  const root = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const stateRef = useRef({ x: -1.7, y: 6.3, target: 0, wait: 0 });
  const path = useRef([
    { x: -1.7, y: 6.3 },
    { x: -1.2, y: 5.2 },
    { x: -0.6, y: 4.8 },
    { x: 0.0, y: 2.2 },
    { x: 0.0, y: 1.3 },
    { x: 1.0, y: 0.3 },
    { x: -1.0, y: 0.3 },
    { x: -2.2, y: 1.3 },
    { x: -0.2, y: 2.2 },
    { x: -1.0, y: 4.8 },
    { x: -1.7, y: 6.3 },
  ]);

  useFrame((state, delta) => {
    const cat = stateRef.current;
    const target = path.current[cat.target];
    const dx = target.x - cat.x;
    const dz = target.y - cat.y;
    const dist = Math.hypot(dx, dz);
    if (cat.wait > 0) {
      cat.wait -= delta;
    } else if (dist < 0.12) {
      cat.wait = 1.4 + Math.random() * 2.8;
      cat.target = (cat.target + 1) % path.current.length;
    } else {
      const step = Math.min(0.7 * delta, dist);
      cat.x += (dx / dist) * step;
      cat.y += (dz / dist) * step;
      if (root.current) root.current.rotation.y = Math.atan2(-dz, dx);
    }
    if (root.current) {
      root.current.position.set(cat.x, 0, cat.y);
      root.current.position.y = cat.wait > 0 ? 0 : Math.abs(Math.sin(state.clock.elapsedTime * 8)) * 0.025;
    }
    if (tail.current) {
      tail.current.rotation.z = Math.sin(state.clock.elapsedTime * 2.6) * 0.28;
      tail.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.7) * 0.15;
    }
  });

  return (
    <group ref={root} position={[-1.7, 0, 6.3]} scale={0.9}>
      <RoundedBox args={[0.62, 0.2, 0.27]} radius={0.1} smoothness={3} position={[0, 0.18, 0]} castShadow>
        <meshStandardMaterial color="#d98e4a" roughness={0.95} />
      </RoundedBox>
      {[-0.15, 0.05, 0.22].map((x, i) => (
        <mesh key={i} position={[x, 0.225, 0]} rotation-y={0.05}>
          <boxGeometry args={[0.06, 0.02, 0.28]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.95} />
        </mesh>
      ))}
      <group position={[0.3, 0.26, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.15, 12, 10]} />
          <meshStandardMaterial color="#e3a15f" roughness={0.95} />
        </mesh>
        {[-0.075, 0.075].map((z, i) => (
          <mesh key={i} position={[0.04, 0.13, z]} rotation={[z > 0 ? 0.25 : -0.25, 0, -0.1]}>
            <coneGeometry args={[0.055, 0.12, 4]} />
            <meshStandardMaterial color="#d98e4a" roughness={0.95} />
          </mesh>
        ))}
        {[-0.055, 0.055].map((z, i) => (
          <mesh key={i} position={[0.11, 0.02, z]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color="#166534" emissive="#4ade80" emissiveIntensity={0.7} />
          </mesh>
        ))}
        <mesh position={[0.145, -0.03, 0]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>
      <group ref={tail} position={[-0.3, 0.24, 0]} rotation={[0, 0, 0.4]}>
        <mesh position={[-0.18, 0.12, 0]} rotation-z={0.9} castShadow>
          <capsuleGeometry args={[0.035, 0.34, 4, 6]} />
          <meshStandardMaterial color="#d98e4a" roughness={0.95} />
        </mesh>
      </group>
      {[-0.2, 0.2].map((x) =>
        [-0.09, 0.09].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.07, z]} castShadow>
            <capsuleGeometry args={[0.028, 0.12, 4, 6]} />
            <meshStandardMaterial color="#c07a3d" roughness={0.95} />
          </mesh>
        )),
      )}
      <PortalHtml position={[0, 0.62, 0]} center distanceFactor={7} zIndexRange={[70, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded-full border border-amber-300/40 bg-slate-950/80 px-1.5 py-[1px] text-[8px] font-bold text-amber-200">
          🐈 Mochi
        </div>
      </PortalHtml>
    </group>
  );
}

function Plant3D({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.36, 14]} />
        <meshStandardMaterial color="#b06a45" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.33, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 14]} />
        <meshStandardMaterial color="#6b4226" roughness={0.9} />
      </mesh>
      {[
        [0, 0.85, 0, 0.42],
        [-0.18, 0.68, 0.1, 0.3],
        [0.2, 0.72, -0.06, 0.32],
        [-0.08, 0.6, -0.18, 0.24],
        [0.1, 0.95, 0.14, 0.22],
      ].map(([lx, ly, lz, size], i) => (
        <mesh key={i} position={[lx, ly, lz]} rotation={[i * 0.3, i * 0.8, i * 0.2]} castShadow>
          <sphereGeometry args={[size, 10, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#2f8f5b" : "#3aa16a"} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Whiteboard() {
  return (
    <group position={[-6.6, 0, -7.08]}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[3.0, 1.15, 0.06]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.65, 1.35 - i * 0.18, 0.04]}>
          <planeGeometry args={[0.8 - i * 0.12, 0.035]} />
          <meshBasicMaterial color={["#38bdf8", "#fb7185", "#34d399"][i]} />
        </mesh>
      ))}
      {[-0.75, -0.55, -0.35].map((x, i) => (
        <mesh key={i} position={[x, 0.92, 0.04]} rotation={[0, 0, i * 0.06]}>
          <planeGeometry args={[0.14, 0.14]} />
          <meshBasicMaterial color={["#fcd34d", "#6ee7b7", "#f9a8d4"][i]} />
        </mesh>
      ))}
    </group>
  );
}

function Bookshelf() {
  const colors = ["#ef4444", "#f59e0b", "#22c55e", "#0ea5e9", "#a855f7", "#f97316"];
  return (
    <group position={[-10.06, 0, -3.4]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[1.4, 1.7, 0.32]} />
        <meshStandardMaterial color="#6d4a28" roughness={0.85} />
      </mesh>
      {[0, 1, 2].map((row) => (
        <group key={row} position={[0, 0.42 + row * 0.46, 0.17]}>
          <mesh>
            <boxGeometry args={[1.3, 0.04, 0.06]} />
            <meshStandardMaterial color="#4a3018" />
          </mesh>
          {colors.slice(0, 6).map((color, i) => (
            <mesh key={i} position={[-0.5 + i * 0.16, 0.13, 0]} castShadow>
              <boxGeometry args={[0.1, 0.24 + (i % 3) * 0.03, 0.18]} />
              <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function DigitalClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <group position={[-2.6, 1.7, -7.08]}>
      <mesh>
        <boxGeometry args={[1.05, 0.4, 0.08]} />
        <meshStandardMaterial color="#0b1220" />
      </mesh>
      <PortalHtml position={[0, 0, 0.06]} center zIndexRange={[50, 0]}>
        <div
          suppressHydrationWarning
          className="pointer-events-none flex items-center gap-1 whitespace-nowrap rounded border border-cyan-300/30 bg-slate-950/90 px-2 py-1 font-mono text-[10px] font-bold tracking-widest text-cyan-200"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {time || "--:--:--"}
        </div>
      </PortalHtml>
    </group>
  );
}

/* ---------------------------------- rooms --------------------------------- */

function RoomFloors() {
  const agents = useOffice((s) => s.agents);
  const speakers = agents.filter((agent) => agent.speech);
  return (
    <group>
      {ROOM_LIST.map((room) => (
        <group key={room.key}>
          <mesh rotation-x={-Math.PI / 2} position={[room.x + room.w / 2, 0.008, room.y + room.h / 2]}>
            <planeGeometry args={[room.w + 0.12, room.h + 0.12]} />
            <meshStandardMaterial color="#0b1220" roughness={1} />
          </mesh>
          <mesh
            rotation-x={-Math.PI / 2}
            position={[room.x + room.w / 2, room.key === "toilet" ? 0.022 : 0.014, room.y + room.h / 2]}
            receiveShadow
          >
            <planeGeometry args={[room.w, room.h]} />
            <meshStandardMaterial color={room.floor} roughness={0.94} />
          </mesh>
          {!speakers.some((agent) => Math.hypot(agent.x - room.door.x, agent.y - room.door.y) < 3.2) && (
            <PortalHtml
              position={[room.door.x, 2.12, room.door.y]}
              center
              distanceFactor={12}
              zIndexRange={[55, 0]}
            >
              <div
                className="pointer-events-none flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-[1px] text-[7px] font-black uppercase tracking-[0.12em] shadow-lg"
                style={{
                  color: room.accent,
                  borderColor: `${room.accent}55`,
                  background: "rgba(3,7,18,0.82)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span className="h-1 w-1 rounded-full" style={{ background: room.accent }} />
                {room.label}
              </div>
            </PortalHtml>
          )}
        </group>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[CORRIDOR.x + CORRIDOR.w / 2, 0.012, CORRIDOR.y + CORRIDOR.h / 2]} receiveShadow>
        <planeGeometry args={[CORRIDOR.w, CORRIDOR.h]} />
        <meshStandardMaterial color="#d9c5a6" roughness={0.95} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-0.4, 0.016, 0]}>
        <planeGeometry args={[16.4, 1.1]} />
        <meshStandardMaterial color="#b89b73" roughness={0.95} />
      </mesh>
    </group>
  );
}

function WallsAndDoors() {
  return (
    <group>
      {/* workstation */}
      <Wall from={[-10.2, -7.2]} to={[-0.2, -7.2]} height={1.65} color="#dbe7f5" />
      <Wall from={[-10.2, -7.2]} to={[-10.2, -1.7]} height={1.2} color="#c7d6e6" />
      <Wall from={[-0.2, -7.2]} to={[-0.2, -1.7]} height={1.2} color="#c7d6e6" />
      <Wall from={[-10.2, -1.7]} to={[-3.5, -1.7]} height={0.38} color="#93a5b8" />
      <Wall from={[-2.1, -1.7]} to={[-0.2, -1.7]} height={0.38} color="#93a5b8" />

      {/* meeting room glass */}
      <Wall from={[0, -7.2]} to={[9.4, -7.2]} height={1.75} color="#7dd3fc" glass />
      <Wall from={[0, -7.2]} to={[0, -1.7]} height={1.75} color="#7dd3fc" glass />
      <Wall from={[9.4, -7.2]} to={[9.4, -1.7]} height={1.75} color="#7dd3fc" glass />
      <Wall from={[0, -1.7]} to={[4.04, -1.7]} height={1.75} color="#7dd3fc" glass />
      <Wall from={[5.36, -1.7]} to={[9.4, -1.7]} height={1.75} color="#7dd3fc" glass />
      {/* glass frame accents */}
      {[-7.2, -1.7].map((z) => (
        <mesh key={`rail-${z}`} position={[4.7, 1.77, z]}>
          <boxGeometry args={[9.44, 0.05, 0.05]} />
          <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.6} metalness={0.4} roughness={0.3} />
        </mesh>
      ))}
      {[0, 9.4].map((x) => (
        <mesh key={`rail-x-${x}`} position={[x, 1.77, -4.45]}>
          <boxGeometry args={[0.05, 0.05, 5.54]} />
          <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.6} metalness={0.4} roughness={0.3} />
        </mesh>
      ))}
      {[[0, -7.2], [9.4, -7.2], [0, -1.7], [9.4, -1.7]].map(([x, z], i) => (
        <mesh key={`post-${i}`} position={[x, 0.9, z]}>
          <boxGeometry args={[0.08, 1.8, 0.08]} />
          <meshStandardMaterial color="#0891b2" metalness={0.5} roughness={0.3} />
        </mesh>
      ))}

      {/* musholla */}
      <Wall from={[-10.2, 1.7]} to={[-8.86, 1.7]} height={1.0} color="#cfe3d6" />
      <Wall from={[-7.54, 1.7]} to={[-6.3, 1.7]} height={1.0} color="#cfe3d6" />
      <Wall from={[-10.2, 1.7]} to={[-10.2, 7.2]} height={1.0} color="#cfe3d6" />
      <Wall from={[-6.3, 1.7]} to={[-6.3, 7.2]} height={1.0} color="#cfe3d6" />
      <Wall from={[-10.2, 7.2]} to={[-6.3, 7.2]} height={0.18} color="#93a5b8" />

      {/* pantry */}
      <Wall from={[-6.1, 1.7]} to={[-4.86, 1.7]} height={1.0} color="#e6d8c1" />
      <Wall from={[-3.54, 1.7]} to={[-2.4, 1.7]} height={1.0} color="#e6d8c1" />
      <Wall from={[-6.1, 1.7]} to={[-6.1, 7.2]} height={1.0} color="#e6d8c1" />
      <Wall from={[-2.4, 1.7]} to={[-2.4, 7.2]} height={1.0} color="#e6d8c1" />
      <Wall from={[-6.1, 7.2]} to={[-2.4, 7.2]} height={0.16} color="#93a5b8" />

      {/* lounge */}
      <Wall from={[-2.2, 1.7]} to={[-0.66, 1.7]} height={1.0} color="#d8cbe9" />
      <Wall from={[0.66, 1.7]} to={[2.0, 1.7]} height={1.0} color="#d8cbe9" />
      <Wall from={[-2.2, 1.7]} to={[-2.2, 7.2]} height={1.0} color="#d8cbe9" />
      <Wall from={[2.0, 1.7]} to={[2.0, 7.2]} height={1.0} color="#d8cbe9" />
      <Wall from={[-2.2, 7.2]} to={[2.0, 7.2]} height={0.16} color="#93a5b8" />

      {/* toilet tucked into the sick-bay corner */}
      <Wall from={[2.2, 1.7]} to={[2.64, 1.7]} height={1.15} color="#dbe5ee" />
      <Wall from={[3.96, 1.7]} to={[4.4, 1.7]} height={1.15} color="#dbe5ee" />
      <Wall from={[2.2, 1.7]} to={[2.2, 4.1]} height={1.15} color="#dbe5ee" />
      <Wall from={[4.4, 1.7]} to={[4.4, 4.1]} height={1.15} color="#dbe5ee" />
      <Wall from={[2.2, 4.1]} to={[4.4, 4.1]} height={1.15} color="#dbe5ee" />

      {/* sick bay */}
      <Wall from={[4.4, 1.7]} to={[5.14, 1.7]} height={1.0} color="#e5cbd2" />
      <Wall from={[6.46, 1.7]} to={[9.4, 1.7]} height={1.0} color="#e5cbd2" />
      <Wall from={[2.2, 4.1]} to={[2.2, 7.2]} height={1.0} color="#e5cbd2" />
      <Wall from={[9.4, 1.7]} to={[9.4, 7.2]} height={1.0} color="#e5cbd2" />

      {/* corridor east wall + big parking exit */}
      <Wall from={[9.4, -1.7]} to={[9.4, -1.3]} height={2.0} color="#cbd5e1" />
      <Wall from={[9.4, 1.3]} to={[9.4, 1.7]} height={2.0} color="#cbd5e1" />
      <Wall from={[2.2, 7.2]} to={[9.4, 7.2]} height={0.16} color="#93a5b8" />

      {ROOM_LIST.map((room) => (
        <Door key={room.key} room={room} />
      ))}
    </group>
  );
}

/* ---------------------------------- scene --------------------------------- */

function FitCamera({ controlsRef }: { controlsRef: MutableRefObject<any> }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const fov = THREE.MathUtils.degToRad(34);
    const widthDistance = 23.5 / (2 * Math.tan(fov / 2) * Math.max(aspect, 0.8));
    const distance = Math.max(23.2, widthDistance * 1.02);
    camera.position.set(0, distance * 0.7, distance * 0.7);
    camera.lookAt(0, 0.5, 1.6);
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0.5, 1.6);
      controlsRef.current.update();
    }
  }, [camera, size.width, size.height, controlsRef]);
  return null;
}

function Scene() {
  const agents = useOffice((s) => s.agents);
  const controlsRef = useRef<any>(null);
  const selectedAgentId = useOffice((s) => s.selectedAgentId);
  const selectAgent = useOffice((s) => s.selectAgent);
  const markArrived = useOffice((s) => s.markArrived);
  const floorTexture = useWoodTexture();
  const anySpeaking = agents.some((agent) => agent.speech);
  const anyWalking = agents.some((agent) => agent.moving);
  const now = useLocalTime();
  const hour = now.getHours();
  const night = hour < 6 || hour >= 18;
  const [exterior, setExterior] = useState(false);
  const exteriorRef = useRef(false);

  useFrame(({ camera }) => {
    const distance = camera.position.distanceTo(HOME_TARGET);
    if (!exteriorRef.current && distance > 36.8) {
      exteriorRef.current = true;
      setExterior(true);
      camera.position.set(0, 12, 36);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 4.4, 0);
        controlsRef.current.update();
      }
    } else if (exteriorRef.current && distance < 35.2) {
      exteriorRef.current = false;
      setExterior(false);
      camera.position.set(0, 16.5, 16.5);
      if (controlsRef.current) {
        controlsRef.current.target.copy(HOME_TARGET);
        controlsRef.current.update();
      }
    }
  });

  return (
    <>
      <SkyDome night={night} />
      <Clouds night={night} />
      <Celestial night={night} />
      {night && <StarField />}
      <color attach="background" args={[night ? "#0a1d31" : "#b7d8eb"]} />
      <fog attach="fog" args={[night ? "#123149" : "#c7e0ec", 60, 260]} />

      <ambientLight intensity={night ? 0.64 : 0.82} color={night ? "#9cb8d8" : "#ffffff"} />
      <hemisphereLight
        args={[night ? "#4f7295" : "#dbeafe", night ? "#162316" : "#3d5a35", night ? 0.7 : 1.0]}
      />
      <directionalLight
        position={night ? [-16, 24, -12] : [14, 26, 16]}
        intensity={night ? 0.58 : 2.05}
        color={night ? "#9bb8ff" : "#fff4dd"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={24}
        shadow-camera-bottom={-22}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
      />
      <pointLight position={[-7, 5, -2]} intensity={night ? 15 : 10} distance={16} color="#7dd3fc" />
      <pointLight position={[5.5, 5, 3]} intensity={night ? 12 : 8} distance={14} color="#c4b5fd" />
      <pointLight position={[0, 4, 6]} intensity={night ? 10 : 3} distance={12} color="#fde68a" />
      {/* practical interior lights so the corridor, meeting room and sick bay stay readable at night */}
      <pointLight position={[0, 2.8, 0.1]} intensity={night ? 7 : 3.2} distance={8} color="#ffe6b8" />
      <pointLight position={[7.2, 2.8, 0.4]} intensity={night ? 4.5 : 2.2} distance={5.5} color="#ffe6b8" />
      <pointLight position={[4.7, 2.8, -4.6]} intensity={night ? 6 : 2.6} distance={6.5} color="#d9fbff" />
      <pointLight position={[4.2, 2.75, 4.9]} intensity={night ? 4.5 : 2.2} distance={6} color="#ffd9e8" />
      <pointLight position={[3.3, 2.7, 2.9]} intensity={night ? 3 : 1.6} distance={4} color="#eaf8ff" />
      {[
        [-5.4, -4.6, 6.5],
        [4.7, -4.6, 5.5],
        [-8.1, 4.6, 4.2],
        [-4.2, 4.6, 4.2],
        [0, 4.4, 3.6],
        [6.2, 4.6, 4.6],
        [0, 0.2, 3.2],
      ].map(([x, z, intensity], i) => (
        <pointLight
          key={`room-light-${i}`}
          position={[x, 2.75, z]}
          intensity={night ? intensity : intensity * 0.55}
          distance={7}
          color={i === 4 ? "#e9d5ff" : "#ffe3b3"}
        />
      ))}

      <Outdoor />

      {!exterior && (
        <>
      {/* office base platform */}
      <mesh position={[-0.4, -0.19, 0]} receiveShadow>
        <boxGeometry args={[20.8, 0.32, 15.4]} />
        <meshStandardMaterial color="#101c2c" roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-0.4, 0, 0]} receiveShadow>
        <planeGeometry args={[19.8, 14.6]} />
        <meshStandardMaterial map={floorTexture} color="#e1cfae" roughness={0.92} />
      </mesh>

      <RoomFloors />
      <WallsAndDoors />
      <ParkingExit />

      {/* workstation furniture */}
      {DESKS.map((desk) => {
        const agent = agents.find((a) => a.deskIndex === desk.id);
        return <Desk key={desk.id} cx={desk.cx} top={desk.top} agent={agent} />;
      })}
      <Whiteboard />
      <Bookshelf />
      <DigitalClock />
      <Plant3D x={-9.7} z={-6.7} scale={0.7} />
      <Plant3D x={-0.65} z={-6.7} scale={0.55} />
      <Plant3D x={-9.7} z={-2.0} scale={0.55} />

      {/* meeting room */}
      <MeetingSet />
      <Plant3D x={0.45} z={-6.7} scale={0.6} />
      <Plant3D x={8.95} z={-6.7} scale={0.65} />

      {/* musholla */}
      <PrayerRoom />
      <Plant3D x={-9.75} z={6.75} scale={0.5} />

      {/* pantry */}
      <PantryRoom />
      <Plant3D x={-5.8} z={2.2} scale={0.5} />

      {/* lounge */}
      <LoungeRoom />
      <Plant3D x={-1.9} z={6.75} scale={0.45} />

      {/* toilet + sick bay */}
      <ToiletRoom />
      <SickBayRoom />
      <Plant3D x={2.55} z={6.7} scale={0.5} />

      {/* corridor decor */}
      <CorridorSofa />
      <Plant3D x={-9.8} z={1.15} scale={0.7} />
      <Plant3D x={9.0} z={1.15} scale={0.7} />
      <Cat3D />
        </>
      )}

      {exterior && <ExteriorShell night={night} />}

      {/* characters stay mounted so their walks keep progressing while the shell is shown */}
      {[...agents]
        .sort((a, b) => a.y - b.y)
        .map((agent) => (
          <Character3D
            key={agent.id}
            agent={agent}
            selected={selectedAgentId === agent.id}
            showLabel={!anySpeaking && !anyWalking}
            hidden={exterior}
            onSelect={selectAgent}
            onArrive={markArrived}
          />
        ))}

      <FitCamera controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0.5, 1.6]}
        enablePan={false}
        minDistance={18}
        maxDistance={40}
        minPolarAngle={0.6}
        maxPolarAngle={1.22}
        minAzimuthAngle={-0.55}
        maxAzimuthAngle={0.55}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

/* --------------------------------- wrapper -------------------------------- */

export function Office3D() {
  const agents = useOffice((s) => s.agents);
  const screenAgent = useOffice((s) => s.agents.find((a) => a.id === s.screenAgentId) ?? null);
  const focusScreen = useOffice((s) => s.focusScreen);
  const portalRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sceneRef.current;
    if (!node) return;
    const stopPageScroll = (event: WheelEvent) => event.preventDefault();
    node.addEventListener("wheel", stopPageScroll, { passive: false });
    return () => node.removeEventListener("wheel", stopPageScroll);
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-[22px] border border-white/10 bg-[#060a13] shadow-panel">
      <div ref={sceneRef} className="relative h-[60vh] min-h-[430px] w-full sm:h-[66vh] xl:h-[calc(100vh-200px)]">
        <div
          ref={portalRef}
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
        />
        <HtmlPortalProvider value={portalRef}>
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-slate-400">
              Menyiapkan kantor 3D…
            </div>
          }
        >
          <Canvas
            shadows
            dpr={[1, 1.8]}
            camera={{ position: [0, 16.5, 16.5], fov: 34, near: 0.1, far: 420 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
          >
            <Scene />
          </Canvas>
        </Suspense>
        </HtmlPortalProvider>

        {screenAgent && (
          <div className="absolute left-3 top-12 z-30 w-[310px] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-xl border border-cyan-300/30 bg-slate-950/95 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-cyan-500/15 to-transparent px-3 py-2">
              <div className="flex items-center gap-2">
                <MonitorIcon size={13} className="text-cyan-300" />
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-cyan-300/80">Layar kerja</p>
                  <p className="text-[11px] font-bold text-white">
                    {screenAgent.name} <span className="font-medium text-slate-400">· {screenAgent.role}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => focusScreen(null)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Tutup layar"
              >
                <X size={13} />
              </button>
            </div>
            <div className="space-y-2 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-[2px] text-[8px] font-bold uppercase tracking-wider text-cyan-200">
                  {screenAgent.activity === "WORKING" ? "sedang mengerjakan" : screenAgent.activity.toLowerCase()}
                </span>
                <span className={`rounded-full px-2 py-[2px] text-[8px] font-bold ${screenAgent.hasError ? "bg-rose-500/20 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
                  {screenAgent.hasError ? "API error" : "online"}
                </span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-200">
                {screenAgent.task ?? "Belum ada task. Pilih agen lalu kirim pekerjaan dari tab Task."}
              </p>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-all"
                  style={{ width: screenAgent.activity === "WORKING" ? "68%" : screenAgent.activity === "IDLE" ? "22%" : "46%" }}
                />
              </div>
              <div className="rounded-lg border border-white/5 bg-black/60 px-2 py-1.5 font-mono text-[9px] leading-relaxed">
                <p className="text-cyan-300">$ {screenAgent.activity === "WORKING" ? "npm run task" : "status --live"}</p>
                <p className="text-slate-400">{screenAgent.name.toLowerCase().replace(/\s+/g, "-")}.tsx</p>
                <p className="truncate text-emerald-300">▍ {screenAgent.statusNote ?? "standby"}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {screenAgent.skills.slice(0, 4).map((skill) => (
                  <span key={skill} className="rounded border border-white/10 px-1.5 py-[1px] text-[8px] text-slate-400">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-2 rounded-full border border-white/15 bg-slate-950/80 px-3 py-1.5 text-[10px] font-semibold text-slate-200 shadow-xl backdrop-blur">
          <span className="flex items-center gap-1 text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE 3D OFFICE
          </span>
          <span className="h-3 w-px bg-white/15" />
          <span className="flex items-center gap-1 text-slate-300">
            <Layers size={11} /> {agents.length} pegawai
          </span>
          <span className="h-3 w-px bg-white/15" />
          <span className="flex items-center gap-1 text-slate-400">
            <Move3d size={11} /> 6 ruangan + pintu
          </span>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/75 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400 backdrop-blur">
          <MousePointerClick size={10} /> drag memutar · klik karakter / layar
        </div>

        <div className="pointer-events-none absolute right-3 bottom-3 z-20 hidden items-center gap-3 rounded-full border border-white/10 bg-slate-950/75 px-3 py-1.5 text-[8px] font-semibold uppercase tracking-widest text-slate-400 backdrop-blur sm:flex">
          <span className="flex items-center gap-1"><Coffee size={9} /> pantry</span>
          <span className="flex items-center gap-1"><HeartPulse size={9} /> sick bay</span>
          <span className="flex items-center gap-1"><Layers size={9} /> glass meeting</span>
        </div>
      </div>
    </div>
  );
}
