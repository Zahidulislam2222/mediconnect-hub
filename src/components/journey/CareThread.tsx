import { useEffect, useRef, useState } from 'react';
import { useMotionValueEvent, type MotionValue } from 'framer-motion';
import { journey as c } from '@/content/journey';
import { cameraAt, fovForAspect, threadReveal } from '@/lib/care-thread-motion';

type SceneState = 'poster' | 'loading' | 'ready' | 'lost' | 'failed';
const scene = c.scene;
const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|basic render/i;

function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  // Firefox and Safari report the real renderer directly (and Firefox warns on the debug extension);
  // Chrome reports a generic "WebKit WebGL" and needs the debug extension.
  const renderer = String(gl.getParameter(gl.RENDERER));
  if (!/^webkit webgl$/i.test(renderer)) return SOFTWARE_RENDERERS.test(renderer);
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info ? SOFTWARE_RENDERERS.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))) : false;
}

/** People-free 3D hero: scroll moves the camera between rooms and grows the care thread. Draws only on change. */
export default function CareThread({ progress, enabled, poster }: {
  progress: MotionValue<number>; enabled: boolean; poster: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SceneState>('poster');
  const latest = useRef(progress.get());
  const scheduleRef = useRef<() => void>(() => {});
  useMotionValueEvent(progress, 'change', value => {
    latest.current = value;
    scheduleRef.current();
  });
  useEffect(() => {
    const element = host.current;
    if (!element || !enabled) { setState('poster'); return; }
    let disposed = false;
    let cleanup: (() => void) | undefined;
    setState('loading');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Scene load timed out')), scene.loadTimeoutMs);
    });
    void (async () => {
      const [THREE, { buildCareThreadScene, CAMERA_NEAR, CAMERA_FAR }] = await Promise.race([
        Promise.all([import('three'), import('@/lib/care-thread-scene')]),
        timeout,
      ]).finally(() => clearTimeout(timer));
      if (disposed) return;
      const built = buildCareThreadScene(THREE, scene);
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' }); }
      catch (error) { built.dispose(); throw error; }
      // CPU-rendered WebGL (no usable GPU) costs ~4x per frame at full resolution, so draw it smaller.
      const software = isSoftwareRenderer(renderer.getContext());
      const pixelRatioCap = software ? scene.softwarePixelRatio : scene.maxPixelRatio;
      element.dataset.renderQuality = software ? 'reduced' : 'full';
      const camera = new THREE.PerspectiveCamera(scene.fov, 1, CAMERA_NEAR, CAMERA_FAR);
      const ats = c.stages.map(stage => stage.at);
      let frame: number | undefined;
      let visible = true;
      let contextLost = false;
      let drawn = Number.NaN;
      let observer: IntersectionObserver | undefined;
      let sizer: ResizeObserver | undefined;
      let pixelRatioQuery: MediaQueryList | undefined;
      const draw = () => {
        frame = undefined;
        // A frame queued just before the tab hid or the scene scrolled away is dropped, not drawn.
        if (disposed || contextLost || !visible || document.hidden) return;
        const p = Math.max(0, Math.min(1, latest.current));
        const pose = cameraAt(p, ats, scene.cameras);
        camera.position.fromArray(pose.position);
        camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
        built.setReveal(threadReveal(p, scene.threadReveal));
        renderer.render(built.scene, camera);
        drawn = p;
        // Observable draw position: lets tests and diagnostics confirm idle/offscreen frames are skipped.
        element.dataset.progress = p.toFixed(3);
        setState('ready');
      };
      const schedule = (force = false) => {
        if (disposed || contextLost || !visible || document.hidden || frame !== undefined) return;
        if (!force && latest.current === drawn) return;
        frame = requestAnimationFrame(draw);
      };
      const resize = () => {
        const { width, height } = element.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.fov = fovForAspect(scene.fov, camera.aspect, scene.referenceAspect, scene.maxFov);
        camera.updateProjectionMatrix();
        schedule(true);
      };
      const visibility = () => schedule(true);
      // Moving to a screen with another pixel density changes no element size, so watch it directly.
      const pixelRatioChanged = () => { resize(); watchPixelRatio(); };
      const watchPixelRatio = () => {
        pixelRatioQuery?.removeEventListener('change', pixelRatioChanged);
        pixelRatioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        pixelRatioQuery.addEventListener('change', pixelRatioChanged);
      };
      // Three restores its GPU resources when the browser returns the context; show the poster meanwhile.
      const lost = () => { contextLost = true; setState('lost'); };
      const restored = () => {
        contextLost = false;
        renderer.shadowMap.needsUpdate = true;
        schedule(true);
      };
      // Assigned before any further setup so a later failure still releases the GPU context.
      cleanup = () => {
        cleanup = undefined;
        scheduleRef.current = () => {};
        if (frame !== undefined) cancelAnimationFrame(frame);
        observer?.disconnect();
        sizer?.disconnect();
        pixelRatioQuery?.removeEventListener('change', pixelRatioChanged);
        document.removeEventListener('visibilitychange', visibility);
        renderer.domElement.removeEventListener('webglcontextlost', lost);
        renderer.domElement.removeEventListener('webglcontextrestored', restored);
        built.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        delete element.dataset.progress;
        delete element.dataset.renderQuality;
      };
      try {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        // Nothing that casts a shadow moves, so the shadow map is drawn once instead of every frame.
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
        renderer.domElement.setAttribute('aria-hidden', 'true');
        renderer.domElement.addEventListener('webglcontextlost', lost);
        renderer.domElement.addEventListener('webglcontextrestored', restored);
        observer = new IntersectionObserver(entries => {
          visible = entries.some(entry => entry.isIntersecting);
          if (visible) schedule(true);
          else if (frame !== undefined) { cancelAnimationFrame(frame); frame = undefined; }
        });
        sizer = new ResizeObserver(resize);
        element.append(renderer.domElement);
        observer.observe(element);
        sizer.observe(element);
        document.addEventListener('visibilitychange', visibility);
        scheduleRef.current = () => schedule();
        watchPixelRatio();
        resize();
      } catch (error) {
        cleanup();
        throw error;
      }
    })().catch((error: unknown) => {
      if (disposed) return;
      // One sanitized line so a poster fallback can be told apart (timeout, WebGL creation, setup).
      console.warn('Homepage 3D scene unavailable; showing the still image:', error instanceof Error ? error.message : 'unknown error');
      setState('failed');
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [enabled]);
  return <div className="jy-film" data-media-failed={state === 'failed'} data-scene-state={state}>
    <img src={poster} alt={c.media.alt} fetchPriority="high" />
    {enabled && <div ref={host} className={`jy-scene ${state === 'ready' ? 'is-ready' : ''}`} />}
  </div>;
}
