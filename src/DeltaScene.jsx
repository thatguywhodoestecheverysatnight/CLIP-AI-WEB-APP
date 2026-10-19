// Interactive low-poly Bengal delta: terrain carved by river channels, a
// village on raised ground, and live climate effects (rain, heat haze, flood
// water level, wind). Drag to orbit.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { createNoise2D, seeded } from './noise.js';

const SIZE = 40;
const SEG = 72;

function riverMask(x, z) {
  // Two meandering distributaries flowing south (towards +z).
  const r1 = Math.abs(x - (Math.sin(z * 0.18) * 4 - 5));
  const r2 = Math.abs(x - (Math.sin(z * 0.14 + 2) * 5 + 8));
  const d = Math.min(r1, r2);
  return Math.max(0, 1 - d / 2.6);
}

function heightAt(noise, x, z) {
  let h = noise(x * 0.06, z * 0.06) * 1.3 + noise(x * 0.15, z * 0.15) * 0.45 + noise(x * 0.4, z * 0.4) * 0.12;
  h += 0.9 - (z + SIZE / 2) * 0.03; // gentle slope to the sea
  h -= riverMask(x, z) * 2.2;
  const edge = Math.max(Math.abs(x), Math.abs(z)) / (SIZE / 2);
  h -= Math.max(0, edge - 0.8) * 6; // fall off at the edges
  return h;
}

function Terrain({ noise }) {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i);
      const h = heightAt(noise, x, z);
      pos.setY(i, h);
      if (h < -0.15) c.set('#c9b98a');
      else if (h < 0.25) c.set('#8fbf6a');
      else if (h < 0.9) c.set('#4f9a57');
      else c.set('#2f7a45');
      c.offsetHSL(0, 0, (noise(x * 0.9, z * 0.9)) * 0.03);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const ni = g.toNonIndexed();
    ni.computeVertexNormals();
    return ni;
  }, [noise]);
  return (
    <mesh geometry={geom} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  );
}

function Water({ flood }) {
  const ref = useRef();
  const mat = useRef();
  useFrame((s, dt) => {
    if (!ref.current) return;
    const target = -0.35 + flood * 1.15;
    ref.current.position.y += (target - ref.current.position.y) * Math.min(1, dt * 1.5);
    ref.current.position.y += Math.sin(s.clock.elapsedTime * 1.3) * 0.002;
    if (mat.current) mat.current.opacity = 0.72 + Math.sin(s.clock.elapsedTime) * 0.04;
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={-0.35}>
      <planeGeometry args={[SIZE * 1.6, SIZE * 1.6]} />
      <meshStandardMaterial ref={mat} color="#2b8fb8" transparent opacity={0.75} roughness={0.15} metalness={0.2} />
    </mesh>
  );
}

function Village({ noise, wind }) {
  const items = useMemo(() => {
    const rnd = seeded(11);
    const houses = []; const trees = [];
    let tries = 0;
    while ((houses.length < 16 || trees.length < 40) && tries++ < 4000) {
      const x = (rnd() - 0.5) * SIZE * 0.75; const z = (rnd() - 0.5) * SIZE * 0.75;
      const h = heightAt(noise, x, z);
      if (h < 0.2 || riverMask(x, z) > 0) continue;
      if (houses.length < 16 && rnd() < 0.35 && Math.abs(x) < 12 && Math.abs(z) < 12) houses.push({ x, z, h, r: rnd() * Math.PI, s: 0.7 + rnd() * 0.5, roof: rnd() < 0.5 ? '#b45309' : '#94a3b8' });
      else if (trees.length < 40) trees.push({ x, z, h, s: 0.6 + rnd() * 0.8, p: rnd() * 6 });
    }
    return { houses, trees };
  }, [noise]);
  const treeRefs = useRef([]);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    treeRefs.current.forEach((m, i) => {
      if (!m) return;
      const tr = items.trees[i];
      m.rotation.z = Math.sin(t * (1.5 + wind * 4) + tr.p) * (0.03 + wind * 0.22);
    });
  });
  return (
    <group>
      {items.houses.map((b, i) => (
        <group key={i} position={[b.x, b.h, b.z]} rotation-y={b.r} scale={b.s}>
          <mesh position-y={0.35} castShadow><boxGeometry args={[1, 0.7, 0.8]} /><meshStandardMaterial color="#f1ead8" flatShading /></mesh>
          <mesh position-y={0.92} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.85, 0.5, 4]} /><meshStandardMaterial color={b.roof} flatShading /></mesh>
        </group>
      ))}
      {items.trees.map((t, i) => (
        <group key={i} position={[t.x, t.h, t.z]} scale={t.s} ref={(el) => (treeRefs.current[i] = el)}>
          <mesh position-y={0.25}><cylinderGeometry args={[0.06, 0.08, 0.5, 5]} /><meshStandardMaterial color="#6b4f2a" /></mesh>
          <mesh position-y={0.8} castShadow><coneGeometry args={[0.38, 0.95, 6]} /><meshStandardMaterial color="#1f6f3f" flatShading /></mesh>
        </group>
      ))}
    </group>
  );
}

function Rain({ amount }) {
  const COUNT = 2200;
  const ref = useRef();
  const data = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * SIZE;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SIZE;
      vel[i] = 9 + Math.random() * 6;
    }
    return { pos, vel };
  }, []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const visible = Math.floor(COUNT * amount);
    ref.current.geometry.setDrawRange(0, visible);
    const a = ref.current.geometry.attributes.position;
    for (let i = 0; i < visible; i++) {
      a.array[i * 3 + 1] -= data.vel[i] * Math.min(dt, 0.05);
      a.array[i * 3] += 1.8 * Math.min(dt, 0.05);
      if (a.array[i * 3 + 1] < -0.5) { a.array[i * 3 + 1] = 12 + Math.random() * 3; a.array[i * 3] = (Math.random() - 0.5) * SIZE; }
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" count={COUNT} array={data.pos} itemSize={3} /></bufferGeometry>
      <pointsMaterial color="#cde9ff" size={0.09} transparent opacity={0.8} depthWrite={false} />
    </points>
  );
}

function Clouds({ rain, wind }) {
  const ref = useRef();
  const puffs = useMemo(() => {
    const rnd = seeded(5);
    return Array.from({ length: 7 }, () => ({ x: (rnd() - 0.5) * 34, z: (rnd() - 0.5) * 30, y: 9 + rnd() * 2.5, s: 1.4 + rnd() * 1.6 }));
  }, []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.children.forEach((c) => {
      c.position.x += dt * (0.4 + wind * 3);
      if (c.position.x > 22) c.position.x = -22;
    });
  });
  const color = new THREE.Color('#ffffff').lerp(new THREE.Color('#5b6b78'), Math.min(1, rain * 1.2));
  return (
    <group ref={ref}>
      {puffs.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]} scale={[p.s * 1.6, p.s * 0.6, p.s]}>
          <mesh><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={color} flatShading transparent opacity={0.25 + rain * 0.65} /></mesh>
          <mesh position={[0.9, -0.1, 0.2]} scale={0.7}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={color} flatShading transparent opacity={0.25 + rain * 0.65} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Sun({ heat }) {
  const ref = useRef();
  useFrame((s) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 2) * 0.04 * (1 + heat));
  });
  const col = new THREE.Color('#fff7cc').lerp(new THREE.Color('#ff8a3d'), heat);
  return (
    <group position={[-14, 13, -16]}>
      <mesh ref={ref}><sphereGeometry args={[1.6, 24, 24]} /><meshBasicMaterial color={col} /></mesh>
      <mesh><sphereGeometry args={[2.6 + heat * 1.6, 24, 24]} /><meshBasicMaterial color={col} transparent opacity={0.18 + heat * 0.15} depthWrite={false} /></mesh>
    </group>
  );
}

export default function DeltaScene({ rain = 0.15, heat = 0.4, flood = 0.2, wind = 0.2, autoRotate = true, interactive = true, fogColor = '#0b4a3a' }) {
  const noise = useMemo(() => createNoise2D(42), []);
  const sunColor = new THREE.Color('#ffffff').lerp(new THREE.Color('#ffb070'), heat * 0.8);
  return (
    <>
      <fog attach="fog" args={[fogColor, 26, 70]} />
      <hemisphereLight args={['#dff7ff', '#2d4a2d', 0.75 - rain * 0.25]} />
      <directionalLight position={[-12, 18, -8]} intensity={1.5 + heat * 0.8 - rain * 0.7} color={sunColor} castShadow />
      <Terrain noise={noise} />
      <Water flood={flood} />
      <Village noise={noise} wind={wind} />
      <Clouds rain={rain} wind={wind} />
      {rain < 0.6 && <Sun heat={heat} />}
      {rain > 0.02 && <Rain amount={Math.min(1, rain)} />}
      <OrbitControls enabled={interactive} enableZoom={false} enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5}
        minPolarAngle={0.55} maxPolarAngle={1.25} target={[0, 0, 0]} />
    </>
  );
}
