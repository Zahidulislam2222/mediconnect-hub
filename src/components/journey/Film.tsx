import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, type MotionValue } from "framer-motion";
import { journey as c } from "@/content/journey";

/** A paused film follows the one native-scroll clock. No autonomous RAF or playback. */
export default function Film({
  progress,
  enabled,
  poster,
}: {
  progress: MotionValue<number>;
  enabled: boolean;
  poster: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [painted, setPainted] = useState(false);
  const latest = useRef(progress.get());
  const seekRef = useRef<() => void>(() => {});
  useMotionValueEvent(progress, "change", (value) => {
    latest.current = value;
    seekRef.current();
  });
  useEffect(() => {
    const element = video.current;
    if (!element || !enabled || failed) return;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let frame: number | undefined;
    let disposed = false;
    const seek = () => {
      if (
        disposed ||
        document.hidden ||
        element.seeking ||
        element.readyState < 2 ||
        !Number.isFinite(element.duration)
      )
        return;
      const target =
        Math.max(0, Math.min(1, latest.current)) *
        Math.max(0, element.duration - c.motion.seekToleranceSeconds);
      if (
        Math.abs(element.currentTime - target) > c.motion.seekToleranceSeconds
      ) {
        element.currentTime = target;
        clearTimeout(watchdog);
        watchdog = setTimeout(() => {
          setFailed(true);
          setPainted(false);
        }, c.motion.seekWatchdogMs);
      }
    };
    const presented = () => {
      if (disposed) return;
      setPainted(true);
      frame = element.requestVideoFrameCallback(presented);
    };
    const ready = () => {
      if (!("requestVideoFrameCallback" in element)) setPainted(true);
      seek();
    };
    const seeked = () => {
      clearTimeout(watchdog);
      seek();
    };
    const error = () => {
      setFailed(true);
      setPainted(false);
    };
    seekRef.current = seek;
    element.addEventListener("loadeddata", ready);
    element.addEventListener("seeked", seeked);
    element.addEventListener("error", error);
    document.addEventListener("visibilitychange", seeked);
    if ("requestVideoFrameCallback" in element)
      frame = element.requestVideoFrameCallback(presented);
    if (element.readyState >= 2) ready();
    return () => {
      disposed = true;
      seekRef.current = () => {};
      clearTimeout(watchdog);
      if (frame !== undefined) element.cancelVideoFrameCallback(frame);
      element.removeEventListener("loadeddata", ready);
      element.removeEventListener("seeked", seeked);
      element.removeEventListener("error", error);
      document.removeEventListener("visibilitychange", seeked);
    };
  }, [enabled, failed]);
  return (
    <div className="jy-film" data-media-failed={failed}>
      <img
        src={enabled && !failed ? c.media.poster : poster}
        alt={c.media.alt}
        fetchPriority="high"
      />
      {enabled && c.media.film && !failed && (
        <video
          ref={video}
          src={c.media.film}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          data-scroll-film
          className={painted ? "is-painted" : ""}
        />
      )}
    </div>
  );
}
