/**
 * A live, rotatable 3D view of one achievement piece: the same three.js models the cabinet art was rendered from,
 * built in the browser on demand (this file and three.js load only when someone opens a piece).
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader, type Font } from "three/addons/loaders/FontLoader.js";
import { award } from "./model/league3d.js";
import { studioEnvironment } from "./model/trophies3d.js";

let fontPromise: Promise<Font | null> | null = null;
const loadFont = () => (fontPromise ??= new FontLoader().loadAsync("/achievements-v2/font.json").catch(() => null));

export default function Viewer3D({ id, tier, onFail }: { id: string; tier: string; onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = host.current; if (!el) return;
    let disposed = false, frame = 0;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { onFail(); return; }
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h); renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement); renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene(); scene.environment = studioEnvironment(renderer);
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6); key.position.set(-3, 7, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01;
    Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1.5, near: 1, far: 20 }); scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfe3ff, 0.8); rim.position.set(4, 4, -5); scene.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.45 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.56; ground.receiveShadow = true; scene.add(ground);
    const camera = new THREE.PerspectiveCamera(24, w / h, 0.1, 100); camera.position.set(0, 2.2, 9.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.86, 0); controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 5; controls.maxDistance = 13; controls.minPolarAngle = 0.5; controls.maxPolarAngle = 1.62;
    controls.autoRotate = true; controls.autoRotateSpeed = 1.6; controls.addEventListener("start", () => { controls.autoRotate = false; }); controls.update();
    const loop = () => { if (disposed) return; controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(loop); };
    const onResize = () => { const W = el.clientWidth, H = el.clientHeight; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", onResize);
    // build after a paint so the sheet opens straight away
    void loadFont().then(font => new Promise<Font | null>(r => setTimeout(() => r(font), 30))).then(font => {
      if (disposed) return;
      try {
        const obj = award(id, tier, font);
        const fit = (obj.userData.fit as number | undefined) ?? 1;
        obj.rotation.y = (obj.userData.ry as number | undefined) ?? -0.32; obj.scale.setScalar(fit); obj.position.y = -0.56 * (1 - fit);
        scene.add(obj); setReady(true); loop();
      } catch { onFail(); }
    });
    return () => {
      disposed = true; cancelAnimationFrame(frame); window.removeEventListener("resize", onResize); controls.dispose();
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); for (const mat of ([] as THREE.Material[]).concat(m.material)) { for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose(); mat.dispose(); } } });
      scene.environment?.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [id, tier, onFail]);
  return (
    <div ref={host} className="av2-3d">
      {!ready && <div className="av2-3d-wait">Polishing the trophy…</div>}
    </div>
  );
}
