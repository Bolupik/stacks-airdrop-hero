import type { ThreeElements } from "@react-three/fiber";

export const PALETTE = {
  cream: "#f4ead6",
  creamDeep: "#e3d0ad",
  vermillion: "#c8482f",
  gold: "#dca43e",
  ink: "#2e2318",
};

type GroupProps = ThreeElements["group"];

/** Stylized parcel: box body, crossing ribbon bands, knot-and-loops bow. */
export function GiftBox({
  size = 1,
  color = PALETTE.cream,
  ribbon = PALETTE.vermillion,
  ...rest
}: { size?: number; color?: string; ribbon?: string } & GroupProps) {
  const s = size;
  return (
    <group {...rest}>
      <mesh>
        <boxGeometry args={[s, s * 0.8, s]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh>
        <boxGeometry args={[s * 0.16, s * 0.81, s + 0.014]} />
        <meshStandardMaterial color={ribbon} roughness={0.35} />
      </mesh>
      <mesh>
        <boxGeometry args={[s + 0.014, s * 0.81, s * 0.16]} />
        <meshStandardMaterial color={ribbon} roughness={0.35} />
      </mesh>
      <group position={[0, s * 0.46, 0]}>
        <mesh>
          <sphereGeometry args={[s * 0.09, 12, 12]} />
          <meshStandardMaterial color={ribbon} roughness={0.3} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]} position={[s * 0.15, 0, 0]}>
          <torusGeometry args={[s * 0.13, s * 0.045, 8, 18]} />
          <meshStandardMaterial color={ribbon} roughness={0.3} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]} position={[-s * 0.15, 0, 0]}>
          <torusGeometry args={[s * 0.13, s * 0.045, 8, 18]} />
          <meshStandardMaterial color={ribbon} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/** Gold token coin, face toward the camera by default. */
export function Coin({ radius = 0.3, ...rest }: { radius?: number } & GroupProps) {
  return (
    <group {...rest}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, radius * 0.18, 24]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.7, radius * 0.075, 8, 24]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.25} />
      </mesh>
    </group>
  );
}

/** Low round podium used to stage the step scenes. */
export function Podium({ radius = 1.7, ...rest }: { radius?: number } & GroupProps) {
  return (
    <group {...rest}>
      <mesh>
        <cylinderGeometry args={[radius, radius * 1.04, 0.14, 40]} />
        <meshStandardMaterial color={PALETTE.creamDeep} roughness={0.65} />
      </mesh>
      <mesh position={[0, -0.09, 0]}>
        <torusGeometry args={[radius * 1.02, 0.035, 8, 48]} />
        <meshStandardMaterial color={PALETTE.gold} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Small brass key — stands in for wallet access. */
export function Key(props: GroupProps) {
  const gold = <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.3} />;
  return (
    <group {...props}>
      <mesh>
        <torusGeometry args={[0.15, 0.05, 8, 18]} />
        {gold}
      </mesh>
      <mesh position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.5, 8]} />
        {gold}
      </mesh>
      <mesh position={[0.08, -0.47, 0]}>
        <boxGeometry args={[0.13, 0.05, 0.05]} />
        {gold}
      </mesh>
      <mesh position={[0.055, -0.58, 0]}>
        <boxGeometry args={[0.09, 0.05, 0.05]} />
        {gold}
      </mesh>
    </group>
  );
}
