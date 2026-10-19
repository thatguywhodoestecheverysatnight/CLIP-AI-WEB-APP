import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { seeded } from './noise.js';

export const ISSUE_COLORS = { flood: '#3b82f6', waterlogging: '#06b6d4', heat: '#f97316', wind: '#a78bfa', salinity: '#e2e8f0', landslide: '#a16207', other: '#f43f5e' };

/** Community pulse: each report is a glowing pillar placed by its coordinates around the locality. */
export function PulseMap({ reports, center }) {
  const [hover, setHover] = useState(null);
  const pts = useMemo(() => {
    const rnd = seeded(3);
    return reports.map((r) => {
      const hasGeo = r.lat != null && r.lon != null && center?.lat != null;
      // ~1 unit per km, clamped to the disc
      let x = hasGeo ? (r.lon - center.lon) * 102 : (rnd() - 0.5) * 8;
      let z = hasGeo ? -(r.lat - center.lat) * 111 : (rnd() - 0.5) * 8;
      const d = Math.hypot(x, z);
      if (d > 5.5) { x = (x / d) * 5.5; z = (z / d) * 5.5; }
      if (d < 0.01) { x += (rnd() - 0.5) * 0.8; z += (rnd() - 0.5) * 0.8; }
      return { ...r, x, z, h: 1 + Math.min(3, (r.upvotes || 0) * 0.4) };
    });
  }, [reports, center]);
  const ring = useRef();
  useFrame((s) => {
    if (!ring.current) return;
    const t = (s.clock.elapsedTime % 2.5) / 2.5;
    ring.current.scale.setScalar(0.2 + t * 6);
    ring.current.material.opacity = 0.5 * (1 - t);
  });
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 6, 0]} intensity={30} color="#a7f3d0" />
      <gridHelper args={[12, 24, '#1f6f5a', '#0f4d3e']} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}><circleGeometry args={[6, 64]} /><meshStandardMaterial color="#053d30" /></mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.02}><ringGeometry args={[0.95, 1, 64]} /><meshBasicMaterial color="#34d399" transparent /></mesh>
      <mesh position-y={0.15}><sphereGeometry args={[0.15, 16, 16]} /><meshBasicMaterial color="#fde047" /></mesh>
      {pts.map((p) => (
        <group key={p.id} position={[p.x, 0, p.z]} onPointerOver={(e) => { e.stopPropagation(); setHover(p.id); }} onPointerOut={() => setHover(null)} onClick={(e) => { e.stopPropagation(); setHover(p.id); }}>
          <mesh position-y={p.h / 2}>
            <cylinderGeometry args={[0.22, 0.22, p.h, 16]} />
            <meshStandardMaterial color={ISSUE_COLORS[p.issue_type] || '#fff'} emissive={ISSUE_COLORS[p.issue_type] || '#fff'} emissiveIntensity={hover === p.id ? 1.2 : 0.45} />
          </mesh>
          {hover === p.id && (
            <Html position={[0, p.h + 0.4, 0]} center style={{ pointerEvents: 'none' }}>
              <div style={{ background: '#0f172a', color: '#fff', padding: '8px 10px', borderRadius: 10, fontSize: 12, width: 180, lineHeight: 1.35 }}>
                <b style={{ textTransform: 'capitalize', color: ISSUE_COLORS[p.issue_type] }}>{p.issue_type}</b> · {p.locality || ''}<br />{p.description.slice(0, 90)}
              </div>
            </Html>
          )}
        </group>
      ))}
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.6} minPolarAngle={0.5} maxPolarAngle={1.2} />
    </>
  );
}

const TYPE_COLORS = { user_profile: '#34d399', report: '#60a5fa', perception: '#fbbf24' };

/** Research console: PCA projection of the embedding store as an orbitable 3D point cloud. */
export function EmbeddingSpace({ points, onSelect }) {
  const mesh = useRef();
  const [hover, setHover] = useState(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    if (!mesh.current) return;
    points.forEach((p, i) => {
      dummy.position.set(p.x * 4, p.y * 4, p.z * 4);
      dummy.scale.setScalar(hover === i ? 2.2 : 1);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      mesh.current.setColorAt(i, color.set(TYPE_COLORS[p.entityType] || '#fff'));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  const hp = hover != null ? points[hover] : null;
  return (
    <>
      <ambientLight intensity={0.8} />
      <pointLight position={[5, 5, 5]} intensity={60} />
      <axesHelper args={[4.5]} />
      <instancedMesh ref={mesh} args={[null, null, Math.max(1, points.length)]}
        onPointerMove={(e) => { e.stopPropagation(); setHover(e.instanceId); }} onPointerOut={() => setHover(null)}
        onClick={(e) => { e.stopPropagation(); onSelect?.(points[e.instanceId]); }}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial roughness={0.4} />
      </instancedMesh>
      {hp && (
        <Html position={[hp.x * 4, hp.y * 4 + 0.3, hp.z * 4]} center style={{ pointerEvents: 'none' }}>
          <div style={{ background: '#020617', color: '#e2e8f0', border: '1px solid #334155', padding: '6px 8px', borderRadius: 8, fontSize: 11, width: 170, fontFamily: 'var(--mono)' }}>
            <b style={{ color: TYPE_COLORS[hp.entityType] }}>{hp.entityType}</b><br />{hp.label || hp.entityId.slice(0, 8)}
          </div>
        </Html>
      )}
      <OrbitControls autoRotate autoRotateSpeed={0.5} enablePan={false} />
    </>
  );
}

/** Dashboard gem: grows and brightens with the CLIP-AI index. */
export function IndexGem({ score = 0 }) {
  const ref = useRef();
  const wire = useRef();
  useFrame((s, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.6;
    ref.current.rotation.x = Math.sin(s.clock.elapsedTime * 0.7) * 0.25;
    wire.current.rotation.copy(ref.current.rotation);
    const target = 0.75 + (score / 100) * 0.55;
    const k = ref.current.scale.x + (target - ref.current.scale.x) * Math.min(1, dt * 2);
    ref.current.scale.setScalar(k);
    wire.current.scale.setScalar(k * 1.12);
  });
  const col = new THREE.Color('#a7f3d0').lerp(new THREE.Color('#fde047'), score / 100);
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 2]} intensity={2.2} />
      <pointLight position={[-2, -1, 2]} intensity={8} color="#34d399" />
      <mesh ref={ref}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color={col} flatShading metalness={0.3} roughness={0.25} emissive={col} emissiveIntensity={0.15} /></mesh>
      <mesh ref={wire}><icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color="#ecfdf5" wireframe transparent opacity={0.35} /></mesh>
    </>
  );
}

/** Desktop backdrop: drifting climate-data constellation with mouse parallax. */
export function Backdrop() {
  const ref = useRef();
  const { pointer } = useThree();
  const geo = useMemo(() => {
    const rnd = seeded(9);
    const n = 1800;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const r = 6 + rnd() * 14; const th = rnd() * Math.PI * 2; const ph = Math.acos(2 * rnd() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph) * 0.6; pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      c.set(rnd() < 0.15 ? '#fde047' : rnd() < 0.5 ? '#34d399' : '#a7f3d0');
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.025;
    ref.current.rotation.x += (pointer.y * 0.15 - ref.current.rotation.x) * 0.03;
    ref.current.position.x += (pointer.x * 0.8 - ref.current.position.x) * 0.03;
  });
  return (
    <group ref={ref}>
      <points geometry={geo}><pointsMaterial size={0.06} vertexColors transparent opacity={0.85} depthWrite={false} /></points>
      <mesh rotation-x={-Math.PI / 2} position-y={-4}>
        <planeGeometry args={[60, 60, 40, 40]} />
        <meshBasicMaterial color="#0f766e" wireframe transparent opacity={0.12} />
      </mesh>
    </group>
  );
}
