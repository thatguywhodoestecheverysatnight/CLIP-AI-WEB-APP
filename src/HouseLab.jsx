// Climate-Responsive Home Lab: a parametric house that reacts to passive
// design strategies. Sun path, breeze, flood water and heat tint are live.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;

function useJaaliTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#000';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.beginPath();
      g.arc(x * 16 + 8, y * 16 + 8, 5, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    return t;
  }, []);
}

function Smooth({ target, children, axis = 'y', speed = 4 }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) ref.current.position[axis] = lerp(ref.current.position[axis], target, Math.min(1, dt * speed));
  });
  return <group ref={ref}>{children}</group>;
}

function Breeze({ on }) {
  const COUNT = 140;
  const ref = useRef();
  const seeds = useMemo(() => Array.from({ length: COUNT }, () => ({ y: 0.9 + Math.random() * 1.2, z: (Math.random() - 0.5) * 3.2, x: -7 + Math.random() * 14, v: 2 + Math.random() * 2 })), []);
  const pos = useMemo(() => new Float32Array(COUNT * 3), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    seeds.forEach((s, i) => {
      s.x += s.v * Math.min(dt, 0.05);
      const limit = on ? 7 : -2.6; // blocked at the windward wall when no cross ventilation
      if (s.x > limit) s.x = -7 - Math.random() * 2;
      pos[i * 3] = s.x; pos[i * 3 + 1] = s.y + Math.sin(s.x * 1.5) * 0.08; pos[i * 3 + 2] = s.z;
    });
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" count={COUNT} array={pos} itemSize={3} /></bufferGeometry>
      <pointsMaterial color={on ? '#38bdf8' : '#94a3b8'} size={0.09} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

function SunArc({ cooling }) {
  const sun = useRef();
  const light = useRef();
  useFrame((s) => {
    const t = (s.clock.elapsedTime * 0.12) % 1; // east -> west
    const a = Math.PI * (0.08 + t * 0.84);
    const x = Math.cos(a) * 9; const y = Math.sin(a) * 7 + 0.5; const z = -3.5;
    if (sun.current) sun.current.position.set(x, y, z);
    if (light.current) { light.current.position.set(x, y, z); light.current.intensity = 1.2 + Math.sin(a) * 0.8; }
  });
  return (
    <>
      <directionalLight ref={light} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} color="#fff1d6" />
      <mesh ref={sun}><sphereGeometry args={[0.45, 20, 20]} /><meshBasicMaterial color={cooling > 4 ? '#fde68a' : '#fb923c'} /></mesh>
      <mesh rotation={[0, 0, 0]} position={[0, 0.5, -3.5]}>
        <torusGeometry args={[9, 0.015, 6, 80, Math.PI]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.35} />
      </mesh>
    </>
  );
}

function Window({ position, rotation = [0, 0, 0], w = 0.7, h = 0.8, overhang, jaali, jaaliTex }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position-z={0.01}><planeGeometry args={[w, h]} /><meshStandardMaterial color="#1e3a5f" roughness={0.2} metalness={0.3} /></mesh>
      {overhang && <mesh position={[0, h / 2 + 0.12, 0.35]} castShadow><boxGeometry args={[w + 0.4, 0.06, 0.7]} /><meshStandardMaterial color="#e7e5e4" /></mesh>}
      {jaali && <mesh position-z={0.06}><planeGeometry args={[w + 0.15, h + 0.1]} /><meshStandardMaterial color="#b45309" alphaMap={jaaliTex} transparent side={THREE.DoubleSide} /></mesh>}
    </group>
  );
}

function House({ cfg, heatTint, jaaliTex }) {
  const plinthH = cfg.plinth ? 0.9 : 0.2;
  const wallCol = new THREE.Color('#f5efe3').lerp(new THREE.Color('#f87171'), heatTint * 0.45);
  const roofCol = cfg.coolroof ? '#f8fafc' : '#475569';
  const L = 5; const D = 3.2; const H = 2.2;
  const wing = (key, pos, size) => (
    <mesh key={key} position={pos} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={wallCol} roughness={0.9} /></mesh>
  );
  const walls = cfg.courtyard
    ? [wing('n', [0, H / 2, -D / 2 + 0.45], [L, H, 0.9]), wing('s', [0, H / 2, D / 2 - 0.45], [L, H, 0.9]), wing('w', [-L / 2 + 0.6, H / 2, 0], [1.2, H, D]), wing('e', [L / 2 - 0.6, H / 2, 0], [1.2, H, D])]
    : [wing('main', [0, H / 2, 0], [L, H, D])];
  return (
    <group>
      <Smooth target={plinthH / 2}>
        <mesh castShadow receiveShadow><boxGeometry args={[L + 0.6, plinthH, D + 0.6]} /><meshStandardMaterial color="#a8a29e" roughness={1} /></mesh>
      </Smooth>
      <Smooth target={plinthH}>
        {walls}
        {/* roof */}
        <group position-y={H}>
          {cfg.courtyard ? (
            <>
              <mesh position={[0, 0.06, -D / 2 + 0.45]} castShadow><boxGeometry args={[L + 0.3, 0.12, 1.2]} /><meshStandardMaterial color={roofCol} /></mesh>
              <mesh position={[0, 0.06, D / 2 - 0.45]} castShadow><boxGeometry args={[L + 0.3, 0.12, 1.2]} /><meshStandardMaterial color={roofCol} /></mesh>
              <mesh position={[-L / 2 + 0.6, 0.06, 0]} castShadow><boxGeometry args={[1.5, 0.12, D]} /><meshStandardMaterial color={roofCol} /></mesh>
              <mesh position={[L / 2 - 0.6, 0.06, 0]} castShadow><boxGeometry args={[1.5, 0.12, D]} /><meshStandardMaterial color={roofCol} /></mesh>
            </>
          ) : (
            <mesh position-y={0.06} castShadow><boxGeometry args={[L + 0.3, 0.12, D + 0.3]} /><meshStandardMaterial color={roofCol} /></mesh>
          )}
          {cfg.coolroof && [...Array(14)].map((_, i) => (
            <mesh key={i} position={[-L / 2 + 0.5 + (i % 7) * 0.68, 0.25, i < 7 ? -D / 2 + 0.45 : D / 2 - 0.45]}>
              <icosahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color="#22c55e" flatShading />
            </mesh>
          ))}
        </group>
        {/* windows: south (+z) always, north (-z) only with cross ventilation */}
        {[-1.4, 0, 1.4].map((x) => (
          <Window key={`s${x}`} position={[x, 1.2, D / 2 + 0.01]} overhang={cfg.overhang} jaali={cfg.jaali} jaaliTex={jaaliTex} />
        ))}
        {cfg.crossvent && [-1.4, 0, 1.4].map((x) => (
          <Window key={`n${x}`} position={[x, 1.2, -D / 2 - 0.01]} rotation={[0, Math.PI, 0]} overhang={cfg.overhang} jaali={false} />
        ))}
        {/* west window, the hardest to shade */}
        <Window position={[-L / 2 - 0.01, 1.2, 0]} rotation={[0, -Math.PI / 2, 0]} overhang={cfg.overhang} jaali={cfg.jaali} jaaliTex={jaaliTex} />
        {/* door */}
        <mesh position={[2.0, 0.6, D / 2 + 0.02]}><planeGeometry args={[0.6, 1.2]} /><meshStandardMaterial color="#7c4a1e" /></mesh>
        {cfg.courtyard && <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.5, 24]} /><meshStandardMaterial color="#38bdf8" /></mesh>}
      </Smooth>
      {cfg.rwh && (
        <group position={[L / 2 + 1, 0, D / 2 - 0.4]}>
          <mesh position-y={0.7} castShadow><cylinderGeometry args={[0.45, 0.45, 1.4, 20]} /><meshStandardMaterial color="#0ea5e9" /></mesh>
          <mesh position={[-0.55, 1.6 + plinthH * 0.5, 0]}><cylinderGeometry args={[0.05, 0.05, 2.2 + plinthH, 8]} /><meshStandardMaterial color="#64748b" /></mesh>
        </group>
      )}
    </group>
  );
}

function Trees({ on }) {
  return (
    <group>
      {[[-4.6, 2.6], [-5.2, 0.6], [-3.6, 3.6]].map(([x, z], i) => (
        <Smooth key={i} target={on ? 0 : -3}>
          <group position={[x, 0, z]}>
            <mesh position-y={0.6} castShadow><cylinderGeometry args={[0.1, 0.14, 1.2, 6]} /><meshStandardMaterial color="#78350f" /></mesh>
            <mesh position-y={1.7} castShadow><icosahedronGeometry args={[0.9, 0]} /><meshStandardMaterial color="#15803d" flatShading /></mesh>
          </group>
        </Smooth>
      ))}
    </group>
  );
}

function Flood({ on }) {
  const ref = useRef();
  useFrame((s, dt) => {
    if (!ref.current) return;
    const target = on ? 0.6 : -0.3;
    ref.current.position.y = lerp(ref.current.position.y, target, Math.min(1, dt * 1.2)) + Math.sin(s.clock.elapsedTime * 2) * 0.003;
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={-0.3}>
      <circleGeometry args={[8, 48]} />
      <meshStandardMaterial color="#3b82f6" transparent opacity={0.55} roughness={0.1} />
    </mesh>
  );
}

export default function HouseLab({ cfg, metrics, flood }) {
  const jaaliTex = useJaaliTexture();
  const heatTint = Math.max(0, 1 - metrics.cooling / 6);
  const group = useRef();
  useFrame((_, dt) => {
    if (!group.current) return;
    const target = cfg.orientation ? 0 : Math.PI / 2;
    group.current.rotation.y = lerp(group.current.rotation.y, target, Math.min(1, dt * 3));
  });
  const floorSafe = cfg.plinth || !flood;
  return (
    <>
      <color attach="background" args={['#e8f6f0']} />
      <hemisphereLight args={['#ffffff', '#b6c2b0', 1.25]} />
      <ambientLight intensity={0.35} />
      <SunArc cooling={metrics.cooling} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow position-y={-0.01}>
        <circleGeometry args={[8, 48]} />
        <meshStandardMaterial color="#a3d9a5" />
      </mesh>
      <group ref={group}>
        <House cfg={cfg} heatTint={heatTint} jaaliTex={jaaliTex} />
      </group>
      <Trees on={cfg.trees} />
      <Breeze on={cfg.crossvent} />
      <Flood on={flood} />
      {/* compass */}
      <group position={[0, 0.02, -6.6]}>
        <mesh rotation-x={-Math.PI / 2}><coneGeometry args={[0.25, 0.6, 3]} /><meshBasicMaterial color="#0f172a" /></mesh>
        <Html center position={[0, 0.3, -0.5]} style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', pointerEvents: 'none' }}>N</Html>
      </group>
      <Html position={[0, 3.6 + (cfg.plinth ? 0.7 : 0), 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(255,255,255,.92)', borderRadius: 12, padding: '6px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.12)', color: flood && !floorSafe ? '#be123c' : '#065f46' }}>
          {flood ? (floorSafe ? 'Floor stays dry' : 'Water inside home!') : `Indoors ${metrics.cooling.toFixed(1)}°C cooler`}
        </div>
      </Html>
      <OrbitControls enablePan={false} minDistance={8} maxDistance={18} minPolarAngle={0.3} maxPolarAngle={1.35} autoRotate autoRotateSpeed={0.4} />
    </>
  );
}
