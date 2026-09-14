import { useEffect, useRef, useState } from "react";
import { cinematic as c } from "@/content/cinematic";

export default function CareWorld({ progress, rotation, enabled }: { progress: number; rotation: number; enabled: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const update = useRef<(() => void) | null>(null);
  const values = useRef({ progress, rotation });
  const [status, setStatus] = useState<"poster" | "loading" | "ready" | "failed">("poster");
  values.current = { progress, rotation };

  useEffect(() => { update.current?.(); }, [progress, rotation]);
  useEffect(() => {
    if (!enabled || !host.current) { setStatus("poster"); return; }
    const element = host.current;
    const controller = new AbortController();
    let disposed = false;
    let cleanup: (() => void) | undefined;
    setStatus("loading");
    const timeout = window.setTimeout(() => controller.abort(), c.motion.loadTimeoutMs);
    void (async () => {
      const [THREE, { GLTFLoader }] = await Promise.all([import("three"), import("three/examples/jsm/loaders/GLTFLoader.js")]);
      if (disposed) return;
      const response = await fetch(c.media.model, { signal: controller.signal });
      if (!response.ok) throw new Error("Model unavailable");
      const data = await response.arrayBuffer();
      const gltf = await new GLTFLoader().parseAsync(data, "");
      const disposeModel = () => gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
          Object.values(material).forEach(value => { if (value instanceof THREE.Texture) value.dispose(); });
          material.dispose();
        });
      });
      if (disposed) { disposeModel(); return; }
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch (error) { disposeModel(); throw error; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, c.motion.maxPixelRatio));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.domElement.setAttribute("aria-hidden", "true");
      const scene = new THREE.Scene();
      scene.add(gltf.scene);
      scene.add(new THREE.HemisphereLight(c.motion.lights.skyColor, c.motion.lights.groundColor, c.motion.lights.hemisphere));
      const key = new THREE.DirectionalLight(c.motion.lights.keyColor, c.motion.lights.key);
      key.position.set(4, 10, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(c.motion.lights.fillColor, c.motion.lights.fill);
      fill.position.set(-8, 4, 2);
      scene.add(fill);
      const camera = new THREE.PerspectiveCamera(c.motion.cameraFov, 1, c.motion.cameraNear, c.motion.cameraFar);
      const first = new THREE.Vector3(), last = new THREE.Vector3(), target = new THREE.Vector3();
      let frame = 0;
      const draw = () => {
        frame = 0;
        if (disposed || document.hidden) return;
        const p = Math.max(0, Math.min(1, values.current.progress)) * (c.motion.stages.length - 1);
        const index = Math.min(Math.floor(p), c.motion.stages.length - 2);
        const amount = p - index;
        first.fromArray(c.motion.stages[index].camera);
        last.fromArray(c.motion.stages[index + 1].camera);
        camera.position.copy(first.lerp(last, amount));
        first.fromArray(c.motion.stages[index].target);
        last.fromArray(c.motion.stages[index + 1].target);
        target.copy(first.lerp(last, amount));
        camera.lookAt(target);
        gltf.scene.rotation.y = values.current.rotation;
        renderer.render(scene, camera);
        setStatus("ready");
      };
      const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(draw); };
      const resize = () => {
        const { width, height } = element.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        schedule();
      };
      const lost = (event: Event) => { event.preventDefault(); setStatus("failed"); };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      element.append(renderer.domElement);
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      document.addEventListener("visibilitychange", schedule);
      update.current = schedule;
      resize();
      cleanup = () => {
        update.current = null;
        cancelAnimationFrame(frame);
        observer.disconnect();
        document.removeEventListener("visibilitychange", schedule);
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        disposeModel();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => { if (!disposed) setStatus("failed"); }).finally(() => window.clearTimeout(timeout));
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timeout);
      cleanup?.();
    };
  }, [enabled]);

  return <div className="cin-world" role="img" aria-label={c.journey.modelLabel} data-render-state={status}>
    <img src={c.media.poster} alt="" className={status === "ready" ? "cin-world-poster is-hidden" : "cin-world-poster"} loading="lazy" />
    <div ref={host} className={`cin-world-canvas ${status === "ready" ? "is-ready" : ""}`} />
    {status === "loading" && <span className="cin-world-status" role="status">{c.journey.loading}</span>}
    {status === "failed" && <span className="cin-world-status" role="status">{c.journey.fallback}</span>}
  </div>;
}
