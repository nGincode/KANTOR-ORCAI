"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { AgentRuntime } from "@/lib/types";
import { characterFacing, planPath, type Vec2 } from "@/lib/office";
import { agentPositions } from "@/lib/agentPositions";
import { SpeechBubble } from "../SpeechBubble";
import { PortalHtml } from "./HtmlPortal";

const SPEED = 2.6;
const HAIR_COLORS = ["#2b2118", "#3a2a1c", "#1f2430", "#4a3320"];

function hairColorFor(id: string) {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return HAIR_COLORS[sum % HAIR_COLORS.length];
}

function dampAngle(current: number, target: number, lambda: number, dt: number) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-lambda * dt));
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  ERROR: { text: "⚠️ API Error", color: "#fb7185" },
  PRAYING: { text: "🕌 Sholat", color: "#34d399" },
  TOILET: { text: "🚻 Ke Toilet", color: "#cbd5e1" },
  COOKING: { text: "🍜 Masak mie", color: "#fbbf24" },
  RESTING: { text: "😴 Istirahat", color: "#a5b4fc" },
  DRINKING: { text: "☕ Minum", color: "#fbbf24" },
  WORKING: { text: "💻 Fokus", color: "#38bdf8" },
  CHATTING: { text: "💬 Ngobrol", color: "#e879f9" },
  WATCHING_TV: { text: "📺 Santai", color: "#a78bfa" },
  MEETING: { text: "🗣️ Rapat", color: "#5eead4" },
};

interface Character3DProps {
  agent: AgentRuntime;
  selected: boolean;
  showLabel?: boolean;
  hidden?: boolean;
  onSelect: (id: string) => void;
  onArrive: (id: string, moveId: number) => void;
}

export function Character3D({ agent, selected, showLabel = true, hidden = false, onSelect, onArrive }: Character3DProps) {
  const rootRef = useRef<THREE.Group>(null);
  const poseRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);

  const posRef = useRef<Vec2>({ x: agent.x, y: agent.y });
  const pathRef = useRef<Vec2[]>([]);
  const walkingRef = useRef(false);
  const lastMoveId = useRef(agent.moveId);
  const arrivedMoveId = useRef(-1);
  const walkPhase = useRef(0);
  const dirRef = useRef({ x: 0, y: 1 });
  const agentRef = useRef(agent);
  agentRef.current = agent;

  const hairColor = useMemo(() => hairColorFor(agent.id), [agent.id]);

  useEffect(() => {
    if (agent.moveId === lastMoveId.current) return;
    lastMoveId.current = agent.moveId;
    pathRef.current = planPath({ x: posRef.current.x, y: posRef.current.y }, { x: agent.x, y: agent.y });
    walkingRef.current = true;
    arrivedMoveId.current = -1;
  }, [agent.moveId, agent.x, agent.y]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const current = agentRef.current;
    const root = rootRef.current;
    if (!root) return;

    let moving = walkingRef.current;
    if (moving) {
      let budget = SPEED * delta;
      while (budget > 0 && pathRef.current.length > 0) {
        const waypoint = pathRef.current[0];
        const dx = waypoint.x - posRef.current.x;
        const dz = waypoint.y - posRef.current.y;
        const distance = Math.hypot(dx, dz);
        if (distance < 1e-4) {
          pathRef.current.shift();
          continue;
        }
        if (distance <= budget) {
          posRef.current = { x: waypoint.x, y: waypoint.y };
          pathRef.current.shift();
          budget -= distance;
          dirRef.current = { x: dx / distance, y: dz / distance };
        } else {
          posRef.current.x += (dx / distance) * budget;
          posRef.current.y += (dz / distance) * budget;
          dirRef.current = { x: dx / distance, y: dz / distance };
          budget = 0;
        }
      }
      if (pathRef.current.length === 0) {
        moving = false;
        walkingRef.current = false;
        if (arrivedMoveId.current !== current.moveId) {
          arrivedMoveId.current = current.moveId;
          onArrive(current.id, current.moveId);
        }
      }
    }

    agentPositions.set(agent.id, { x: posRef.current.x, y: posRef.current.y });
    const seatedNow = current.pose === "sitting" || current.pose === "working" || current.pose === "sleeping";
    if (!seatedNow) {
      let pushX = 0;
      let pushZ = 0;        for (const [otherId, other] of agentPositions) {
        if (otherId === agent.id) continue;
        const dx = posRef.current.x - other.x;
        const dz = posRef.current.y - other.y;
        const dist = Math.hypot(dx, dz);          if (dist < 0.72) {
            const nx = dist > 0.001 ? dx / dist : 0.7;
            const nz = dist > 0.001 ? dz / dist : 0.7;
            const force = ((0.72 - Math.min(dist, 0.72)) / 0.72) * 1.15 * delta;
          pushX += nx * force;
          pushZ += nz * force;
        }
      }
      posRef.current.x += pushX;
      posRef.current.y += pushZ;
    }

    root.position.x = posRef.current.x;
    root.position.z = posRef.current.y;

    const targetRotation = moving
      ? Math.atan2(dirRef.current.x, dirRef.current.y)
      : characterFacing(current.activity, current.pose, posRef.current);
    root.rotation.y = dampAngle(root.rotation.y, targetRotation, 9, delta);

    const seated = current.pose === "sitting" || current.pose === "working";
    const sleeping = current.pose === "sleeping";
    const working = current.pose === "working";
    const drinking = current.pose === "drinking";
    const praying = current.pose === "praying";
    const speaking = current.speaking;

    if (moving) walkPhase.current += delta * 9.2;
    const phase = walkPhase.current;

    // body height: seated characters sit lower, walkers bob
    const bob = moving ? Math.abs(Math.sin(phase)) * 0.035 : Math.sin(state.clock.elapsedTime * 1.6) * 0.008;
    if (bodyRef.current) {
      bodyRef.current.position.y = THREE.MathUtils.damp(
        bodyRef.current.position.y,
        (seated ? -0.2 : 0) + bob,
        8,
        delta,
      );
      bodyRef.current.rotation.z = THREE.MathUtils.damp(
        bodyRef.current.rotation.z,
        praying ? -0.06 : 0,
        5,
        delta,
      );
    }

    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.damp(
        headRef.current.rotation.y,
        speaking ? Math.sin(state.clock.elapsedTime * 3.4) * 0.1 : 0,
        6,
        delta,
      );
      headRef.current.rotation.z = THREE.MathUtils.damp(
        headRef.current.rotation.z,
        speaking ? Math.sin(state.clock.elapsedTime * 5) * 0.045 : 0,
        6,
        delta,
      );
    }

    if (mouthRef.current) {
      mouthRef.current.scale.y = speaking ? 1 + Math.abs(Math.sin(state.clock.elapsedTime * 13)) * 1.8 : 1;
      mouthRef.current.scale.x = speaking ? 1 + Math.sin(state.clock.elapsedTime * 9) * 0.15 : 1;
    }

    // legs
    const legTarget = (side: number) => {
      if (seated) return -1.32;
      if (moving) return Math.sin(phase + side) * 0.62;
      return 0;
    };
    const kneeTarget = (side: number) => {
      if (seated) return 1.32;
      if (moving) return Math.max(0, -Math.sin(phase + side)) * 0.55;
      return 0.04;
    };
    if (legL.current) legL.current.rotation.x = THREE.MathUtils.damp(legL.current.rotation.x, legTarget(0), 12, delta);
    if (legR.current) legR.current.rotation.x = THREE.MathUtils.damp(legR.current.rotation.x, legTarget(Math.PI), 12, delta);
    if (kneeL.current) kneeL.current.rotation.x = THREE.MathUtils.damp(kneeL.current.rotation.x, kneeTarget(0), 12, delta);
    if (kneeR.current) kneeR.current.rotation.x = THREE.MathUtils.damp(kneeR.current.rotation.x, kneeTarget(Math.PI), 12, delta);

    // arms
    let armLX = 0.06;
    let armRX = -0.06;
    let armLZ = 0.06;
    let armRZ = -0.06;
    if (moving) {
      armLX = Math.sin(phase + Math.PI) * 0.55;
      armRX = Math.sin(phase) * 0.55;
    } else if (working) {
      armLX = -1.05 + Math.sin(state.clock.elapsedTime * 11) * 0.05;
      armRX = -1.05 + Math.sin(state.clock.elapsedTime * 11 + 1.6) * 0.05;
      armLZ = 0.28;
      armRZ = -0.28;
    } else if (drinking) {
      armRX = -2.35;
      armRZ = -0.3;
      armLX = -0.15;
    } else if (praying) {
      armLX = -1.15;
      armRX = -1.15;
      armLZ = 0.5;
      armRZ = -0.5;
    } else if (seated) {
      armLX = -0.3;
      armRX = -0.3;
    }
    if (armL.current) {
      armL.current.rotation.x = THREE.MathUtils.damp(armL.current.rotation.x, armLX, 10, delta);
      armL.current.rotation.z = THREE.MathUtils.damp(armL.current.rotation.z, armLZ, 10, delta);
    }
    if (armR.current) {
      armR.current.rotation.x = THREE.MathUtils.damp(armR.current.rotation.x, armRX, 10, delta);
      armR.current.rotation.z = THREE.MathUtils.damp(armR.current.rotation.z, armRZ, 10, delta);
    }

    // lying on the sofa when API errors
    if (poseRef.current) {
      poseRef.current.rotation.z = THREE.MathUtils.damp(
        poseRef.current.rotation.z,
        sleeping ? Math.PI / 2 : 0,
        6,
        delta,
      );
      poseRef.current.position.y = THREE.MathUtils.damp(
        poseRef.current.position.y,
        sleeping ? 0.56 : 0,
        6,
        delta,
      );
      poseRef.current.position.x = THREE.MathUtils.damp(
        poseRef.current.position.x,
        sleeping ? 0.86 : 0,
        6,
        delta,
      );
    }
  });

  const status = STATUS_LABEL[agent.activity];
  const bubbleHeight = agent.pose === "sleeping" ? 1.08 : agent.pose === "sitting" || agent.pose === "working" ? 1.72 : 2.1;
  const nameHeight = agent.pose === "sleeping" ? 0.3 : 0.04;

  return (
    <group ref={rootRef} position={[posRef.current.x, 0, posRef.current.y]} visible={!hidden}>
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.025}>
          <ringGeometry args={[0.38, 0.48, 40]} />
          <meshBasicMaterial color="#5eead4" transparent opacity={0.9} />
        </mesh>
      )}
      <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
        <circleGeometry args={[0.42, 32]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.18} />
      </mesh>

      <group
        ref={poseRef}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(agent.id);
        }}
      >
        <group ref={bodyRef}>
          {/* torso */}
          <RoundedBox args={[0.46, 0.52, 0.3]} radius={0.09} smoothness={3} position={[0, 1.02, 0]} castShadow>
            <meshStandardMaterial color={agent.shirtColor} roughness={0.75} />
          </RoundedBox>
          <mesh position={[0, 1.2, 0.152]}>
            <boxGeometry args={[0.2, 0.02, 0.01]} />
            <meshStandardMaterial color="#0f172a" opacity={0.2} transparent />
          </mesh>
          <mesh position={[0.1, 0.94, 0.16]}>
            <boxGeometry args={[0.09, 0.11, 0.01]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
          </mesh>
          <mesh position={[0.1, 0.94, 0.166]}>
            <boxGeometry args={[0.04, 0.06, 0.005]} />
            <meshStandardMaterial color={agent.shirtColor} />
          </mesh>

          {/* arms */}
          <group ref={armL} position={[-0.29, 1.18, 0]} rotation={[0, 0, 0.06]}>
            <mesh position={[0, -0.18, 0]} castShadow>
              <capsuleGeometry args={[0.065, 0.24, 4, 10]} />
              <meshStandardMaterial color={agent.shirtColor} roughness={0.75} />
            </mesh>
            <mesh position={[0, -0.35, 0]} castShadow>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color={agent.skinTone} roughness={0.7} />
            </mesh>
          </group>
          <group ref={armR} position={[0.29, 1.18, 0]} rotation={[0, 0, -0.06]}>
            <mesh position={[0, -0.18, 0]} castShadow>
              <capsuleGeometry args={[0.065, 0.24, 4, 10]} />
              <meshStandardMaterial color={agent.shirtColor} roughness={0.75} />
            </mesh>
            <mesh position={[0, -0.35, 0]} castShadow>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color={agent.skinTone} roughness={0.7} />
            </mesh>
            {agent.pose === "drinking" && (
              <mesh position={[0, -0.5, 0.02]}>
                <cylinderGeometry args={[0.05, 0.04, 0.11, 12]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.3} />
              </mesh>
            )}
          </group>

          {/* neck + head */}
          <mesh position={[0, 1.34, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 0.1, 10]} />
            <meshStandardMaterial color={agent.skinTone} />
          </mesh>
          <group ref={headRef} position={[0, 1.5, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.205, 20, 20]} />
              <meshStandardMaterial color={agent.skinTone} roughness={0.65} />
            </mesh>
            <mesh position={[-0.205, 0, 0]}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshStandardMaterial color={agent.skinTone} />
            </mesh>
            <mesh position={[0.205, 0, 0]}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshStandardMaterial color={agent.skinTone} />
            </mesh>
            {/* eyes */}
            <mesh position={[-0.07, 0.02, 0.185]}>
              <sphereGeometry args={[0.026, 10, 10]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
            <mesh position={[0.07, 0.02, 0.185]}>
              <sphereGeometry args={[0.026, 10, 10]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
            <mesh ref={mouthRef} position={[0, -0.075, 0.192]}>
              <boxGeometry args={[0.07, 0.022, 0.012]} />
              <meshStandardMaterial color="#9f1239" />
            </mesh>
            {/* hair */}
            {agent.hairStyle === "long" && (
              <mesh position={[0, -0.06, -0.1]} castShadow>
                <boxGeometry args={[0.4, 0.48, 0.14]} />
                <meshStandardMaterial color={hairColor} roughness={0.9} />
              </mesh>
            )}
            {agent.hairStyle === "bun" && (
              <mesh position={[0, 0.2, -0.08]}>
                <sphereGeometry args={[0.09, 12, 12]} />
                <meshStandardMaterial color={hairColor} roughness={0.9} />
              </mesh>
            )}
            {agent.hairStyle === "curly" ? (
              <group>
                {[-0.13, -0.045, 0.05, 0.14].map((x, i) => (
                  <mesh key={i} position={[x, 0.11 + (i % 2) * 0.04, 0.02]}>
                    <sphereGeometry args={[0.085, 10, 10]} />
                    <meshStandardMaterial color={hairColor} roughness={0.95} />
                  </mesh>
                ))}
              </group>
            ) : agent.hairStyle === "cap" ? (
              <group>
                <mesh position={[0, 0.1, 0]}>
                  <sphereGeometry args={[0.205, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial color={agent.shirtColor} roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.09, 0.17]}>
                  <boxGeometry args={[0.26, 0.03, 0.18]} />
                  <meshStandardMaterial color={agent.shirtColor} roughness={0.8} />
                </mesh>
              </group>
            ) : (
              <mesh position={[0, 0.075, -0.01]} scale={[1.03, 0.82, 1.03]}>
                <sphereGeometry args={[0.205, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.75]} />
                <meshStandardMaterial color={hairColor} roughness={0.95} />
              </mesh>
            )}
          </group>
        </group>

        {/* legs */}
        <group ref={legL} position={[-0.12, 0.62, 0]}>
          <mesh position={[0, -0.19, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.25, 4, 8]} />
            <meshStandardMaterial color="#2b3752" roughness={0.85} />
          </mesh>
          <group ref={kneeL} position={[0, -0.4, 0]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <capsuleGeometry args={[0.068, 0.22, 4, 8]} />
              <meshStandardMaterial color="#2b3752" roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.3, 0.055]} castShadow>
              <boxGeometry args={[0.16, 0.09, 0.27]} />
              <meshStandardMaterial color="#0f172a" roughness={0.8} />
            </mesh>
          </group>
        </group>
        <group ref={legR} position={[0.12, 0.62, 0]}>
          <mesh position={[0, -0.19, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.25, 4, 8]} />
            <meshStandardMaterial color="#222c42" roughness={0.85} />
          </mesh>
          <group ref={kneeR} position={[0, -0.4, 0]}>
            <mesh position={[0, -0.15, 0]} castShadow>
              <capsuleGeometry args={[0.068, 0.22, 4, 8]} />
              <meshStandardMaterial color="#222c42" roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.3, 0.055]} castShadow>
              <boxGeometry args={[0.16, 0.09, 0.27]} />
              <meshStandardMaterial color="#0f172a" roughness={0.8} />
            </mesh>
          </group>
        </group>
      </group>

      {!hidden && status && (agent.activity === "PRAYING" || agent.activity === "DRINKING" || agent.activity === "TOILET" || agent.activity === "COOKING" || agent.activity === "RESTING") && (
        <PortalHtml position={[0, agent.pose === "sleeping" ? 1.25 : 2.2, 0]} center zIndexRange={[80, 0]}>
          <div
            className="pointer-events-none flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[2px] text-[9px] font-bold shadow-lg"
            style={{
              borderColor: `${status.color}66`,
              background: `${status.color}22`,
              color: status.color,
              backdropFilter: "blur(4px)",
            }}
          >
            {status.text}
          </div>
        </PortalHtml>
      )}

      {!hidden && agent.activity === "ERROR" && (
        <PortalHtml position={[0, agent.pose === "sleeping" ? 1.65 : 2.65, 0]} center zIndexRange={[80, 0]}>
          <div className="pointer-events-none flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-500 px-2.5 py-[3px] text-[9px] font-black text-white shadow-[0_0_18px_rgba(251,113,133,0.7)]">
            ⚠️ API Error
          </div>
        </PortalHtml>
      )}

      {!hidden && agent.pose === "sleeping" && (
        <PortalHtml position={[0.9, 1.45, 0]} center zIndexRange={[80, 0]}>
          <div className="pointer-events-none animate-pulse text-[18px] font-black text-sky-200">Zzz...</div>
        </PortalHtml>
      )}

      {!hidden && showLabel && (
        <PortalHtml position={[0, nameHeight, 0]} center zIndexRange={[70, 0]}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(agent.id);
            }}
            className="pointer-events-auto flex items-center gap-1 whitespace-nowrap rounded-full border border-white/20 bg-slate-950/80 px-2 py-[1px] text-[8.5px] font-semibold text-white shadow-lg backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: agent.shirtColor }} />
            {agent.name}
          </button>
        </PortalHtml>
      )}

      {!hidden && agent.speech && (
        <PortalHtml position={[0, bubbleHeight, 0]} zIndexRange={[300, 100]} distanceFactor={9.2}>
          <div
            className="pointer-events-none"
            style={{
              position: "relative",
              width: 218,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="absolute -bottom-3 left-1/2 h-6 w-px -translate-x-1/2 bg-white/50" />
            <SpeechBubble
              text={agent.speech}
              color={agent.shirtColor}
              name={agent.name}
              role={agent.role}
              className="!relative !left-auto !top-auto"
            />
          </div>
        </PortalHtml>
      )}
    </group>
  );
}
