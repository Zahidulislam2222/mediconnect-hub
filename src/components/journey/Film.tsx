import { useEffect, useRef, useState } from 'react';
import { useMotionValueEvent, type MotionValue } from 'framer-motion';
import { journey as c } from '@/content/journey';

/** Scroll supplies the latest target; one bounded scheduler serves visible frames. */
export default function Film({ progress, enabled, poster }: {
  progress: MotionValue<number>; enabled: boolean; poster: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [painted, setPainted] = useState(false);
  const latest = useRef(progress.get());
  const scheduleRef = useRef<() => void>(() => {});
  useMotionValueEvent(progress, 'change', value => {
    latest.current = value;
    scheduleRef.current();
  });
  useEffect(() => {
    const element = video.current;
    if (!element || !enabled || failed) return;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let presentedFrame: number | undefined;
    let pendingFrame: number | undefined;
    let lastSeek = -Infinity;
    let visible = true;
    let disposed = false;
    const schedule = () => {
      if (disposed || !visible || document.hidden || pendingFrame !== undefined) return;
      pendingFrame = requestAnimationFrame(seek);
    };
    const seek = (now: number) => {
      pendingFrame = undefined;
      if (disposed || !visible || document.hidden || element.seeking || element.readyState < 2 || !Number.isFinite(element.duration)) return;
      const target = Math.max(0, Math.min(1, latest.current)) * Math.max(0, element.duration - c.motion.seekToleranceSeconds);
      if (Math.abs(element.currentTime - target) <= c.motion.seekToleranceSeconds) return;
      if (now - lastSeek < c.motion.seekMinimumIntervalMs) { schedule(); return; }
      lastSeek = now;
      element.currentTime = target;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        if (!disposed && visible && !document.hidden) { setFailed(true); setPainted(false); }
      }, c.motion.seekWatchdogMs);
    };
    const presented = () => {
      if (disposed) return;
      setPainted(true);
      presentedFrame = element.requestVideoFrameCallback(presented);
    };
    const ready = () => {
      if (!('requestVideoFrameCallback' in element)) setPainted(true);
      schedule();
    };
    const seeked = () => { clearTimeout(watchdog); schedule(); };
    const visibility = () => {
      if (document.hidden) {
        clearTimeout(watchdog);
        if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame);
        pendingFrame = undefined;
      } else schedule();
    };
    const error = () => { setFailed(true); setPainted(false); };
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) schedule();
      else {
        clearTimeout(watchdog);
        if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame);
        pendingFrame = undefined;
      }
    });
    observer.observe(element);
    scheduleRef.current = schedule;
    element.addEventListener('loadeddata', ready);
    element.addEventListener('seeked', seeked);
    element.addEventListener('error', error);
    document.addEventListener('visibilitychange', visibility);
    if ('requestVideoFrameCallback' in element) presentedFrame = element.requestVideoFrameCallback(presented);
    if (element.readyState >= 2) ready();
    return () => {
      disposed = true;
      scheduleRef.current = () => {};
      clearTimeout(watchdog);
      if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame);
      if (presentedFrame !== undefined) element.cancelVideoFrameCallback(presentedFrame);
      observer.disconnect();
      element.removeEventListener('loadeddata', ready);
      element.removeEventListener('seeked', seeked);
      element.removeEventListener('error', error);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled, failed]);
  return <div className="jy-film" data-media-failed={failed}>
    <img src={enabled && !failed ? c.media.poster : poster} alt={c.media.alt} fetchPriority="high" />
    {enabled && c.media.film && !failed && <video ref={video} src={c.media.film} muted playsInline preload="auto" aria-hidden="true" data-scroll-film className={painted ? 'is-painted' : ''} />}
  </div>;
}
