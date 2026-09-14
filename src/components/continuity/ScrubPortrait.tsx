import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, type MotionValue } from "framer-motion";
import { continuity as c } from "@/content/continuity";
import { Portrait } from "./Primitives";

/** The story's existing progress owns this paused film; there is no second scroll/RAF loop. */
export function ScrubPortrait({ progress }: { progress: MotionValue<number> }) {
  const video = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [painted, setPainted] = useState(false);
  const latest = useRef(progress.get());
  const frame = useRef<number>();
  const pending = useRef<ReturnType<typeof setTimeout>>();
  const start = c.motion.stageStops[2];
  const end = c.motion.stageStops[3] - c.motion.transitionWindow;
  const seek = () => {
    const element = video.current;
    if (
      !element ||
      element.readyState < 2 ||
      element.seeking ||
      document.hidden ||
      !Number.isFinite(element.duration)
    )
      return;
    const phase = Math.max(
      0,
      Math.min(1, (latest.current - start) / (end - start)),
    );
    const target =
      phase * Math.max(0, element.duration - c.motion.seekEpsilonSeconds);
    if (Math.abs(element.currentTime - target) > c.motion.seekEpsilonSeconds) {
      element.currentTime = target;
      clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        setFailed(true);
        setPainted(false);
      }, c.motion.seekFailureMs);
    }
  };
  useMotionValueEvent(progress, "change", (value) => {
    latest.current = value;
    setLoaded(value >= start - c.motion.transitionWindow && value < 1);
    seek();
  });
  useEffect(() => {
    const visibility = () => {
      if (!document.hidden) seek();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      clearTimeout(pending.current);
    };
  });
  useEffect(() => {
    const element = video.current;
    if (element && loaded && !failed && "requestVideoFrameCallback" in element)
      frame.current = element.requestVideoFrameCallback(() => setPainted(true));
    if (!loaded) {
      setPainted(false);
      clearTimeout(pending.current);
    }
    return () => {
      if (element && frame.current !== undefined)
        element.cancelVideoFrameCallback(frame.current);
    };
  }, [loaded, failed]);
  return (
    <div className="ct-scrub-portrait">
      <Portrait />
      {loaded && !failed && (
        <video
          ref={video}
          src={c.media.clinicianVideo}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          data-scroll-film
          className={painted ? "is-painted" : ""}
          onLoadedData={seek}
          onSeeked={() => {
            clearTimeout(pending.current);
            seek();
          }}
          onError={() => {
            setFailed(true);
            setPainted(false);
          }}
        />
      )}
    </div>
  );
}
