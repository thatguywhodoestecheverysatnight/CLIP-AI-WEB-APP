import { Component, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { console.warn('[3D] scene disabled:', e.message); }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

/** Canvas wrapper: pauses rendering when offscreen or tab hidden, degrades gracefully without WebGL. */
export default function Scene3D({ children, camera, className, style, fallback = null, dpr = [1, 1.75], ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(true);
  const [ok] = useState(webglOk);
  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(ref.current);
    const vis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);
  const fb = fallback ?? <div className="fallback-3d">3D view unavailable on this device</div>;
  return (
    <div ref={ref} className={className} style={{ position: 'absolute', inset: 0, ...style }}>
      {ok ? (
        <Boundary fallback={fb}>
          <Canvas frameloop={visible ? 'always' : 'never'} dpr={dpr} camera={camera} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} {...rest}>
            <Suspense fallback={null}>{children}</Suspense>
          </Canvas>
        </Boundary>
      ) : fb}
    </div>
  );
}
