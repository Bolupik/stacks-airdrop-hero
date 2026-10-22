import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { Coin, GiftBox, PALETTE } from "./gift-kit";
import { useInView } from "./use-in-view";

type GiftSpec = {
  pos: [number, number, number];
  size: number;
  color: string;
  ribbon: string;
  spin: number;
  phase: number;
};

const GIFTS: GiftSpec[] = [
  { pos: [-3.0, 1.3, -1.0], size: 1.3, color: PALETTE.cream, ribbon: PALETTE.vermillion, spin: 0.25, phase: 0.4 },
  { pos: [3.2, 0.4, -1.4], size: 1.1, color: PALETTE.vermillion, ribbon: PALETTE.gold, spin: -0.3, phase: 2.1 },
  { pos: [-1.6, -1.5, 0.8], size: 0.85, color: PALETTE.gold, ribbon: PALETTE.cream, spin: 0.35, phase: 1.2 },
  { pos: [1.8, -1.2, 1.2], size: 0.7, color: PALETTE.cream, ribbon: PALETTE.vermillion, spin: -0.4, phase: 3.3 },
  { pos: [0.3, 2.3, -2.2], size: 0.78, color: PALETTE.creamDeep, ribbon: PALETTE.vermillion, spin: 0.2, phase: 4.6 },
  { pos: [-4.5, -0.6, -2.6], size: 0.62, color: PALETTE.vermillion, ribbon: PALETTE.gold, spin: -0.25, phase: 5.1 },
  { pos: [4.6, 1.9, -2.4], size: 0.66, color: PALETTE.cream, ribbon: PALETTE.vermillion, spin: 0.3, phase: 2.8 },
];

const COIN_COUNT = 24;

function FloatingGift({ spec }: { spec: GiftSpec }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!ref.current) return;
    ref.current.rotation.y = t * spec.spin + spec.phase;
    ref.current.position.y = spec.pos[1] + Math.sin(t * 0.6 + spec.phase) * 0.22;
  });
  return (
    <group ref={ref} position={spec.pos}>
      <GiftBox size={spec.size} color={spec.color} ribbon={spec.ribbon} />
    </group>
  );
}

/** Deterministically seeded coin rain (no Math.random — keeps runs stable). */
function CoinRain() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: COIN_COUNT }, (_, i) => ({
        x: -4.2 + (((i * 7.13) % 85) / 10),
        z: -2.6 + (((i * 3.71) % 40) / 10),
        speed: 0.35 + (((i * 2.9) % 40) / 40) * 0.5,
        phase: (i * 1.37) % 6.283,
        spin: 0.6 + (i % 5) * 0.2,
      })),
    [],
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    seeds.forEach((s, i) => {
      const y = 4.6 - ((t * s.speed + s.phase) % 9.2);
      dummy.position.set(s.x, y, s.z);
      dummy.rotation.set(t * s.spin + s.phase, t * s.spin * 0.7, 0);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COIN_COUNT]}>
      <cylinderGeometry args={[0.2, 0.2, 0.05, 20]} />
      <meshStandardMaterial color={PALETTE.gold} metalness={0.55} roughness={0.3} />
    </instancedMesh>
  );
}

/** Gentle pointer parallax for the whole arrangement. */
function Rig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ pointer }, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, pointer.x * 0.12, 3, delta);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, -pointer.y * 0.08, 3, delta);
  });
  return <group ref={ref}>{children}</group>;
}

export default function HeroCanvas() {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="h-full w-full">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.4, 8.6], fov: 42 }}
        frameloop={inView ? "always" : "never"}
        gl={{ alpha: true, antialias: true }}
      >
        <hemisphereLight args={["#fff6e4", "#c79a6b", 0.75]} />
        <directionalLight position={[4, 7, 5]} intensity={1.5} color="#ffe7c4" />
        <directionalLight position={[-6, 2, -3]} intensity={0.4} color="#f3d0b0" />
        <Environment resolution={64}>
          <Lightformer intensity={2.2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1.1} color="#ffd9a8" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
          <Lightformer intensity={0.9} color="#e8b06a" position={[5, -1, 0]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} />
        </Environment>
        <Rig>
          {GIFTS.map((spec, i) => (
            <FloatingGift key={i} spec={spec} />
          ))}
          <CoinRain />
        </Rig>
        <Coin radius={0.42} position={[0, -2.6, 0.6]} rotation={[0.2, 0, 0.15]} />
      </Canvas>
    </div>
  );
}
