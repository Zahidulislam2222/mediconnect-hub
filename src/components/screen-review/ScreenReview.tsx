import { useEffect, useRef, useState } from "react";
import { ArrowLeft, HeartPulse, Pause, Play, RotateCcw } from "lucide-react";
import { journey } from "@/content/journey";
import { screenReview as c } from "@/content/screen-review";

export default function ScreenReview() {
  const before = useRef<HTMLVideoElement>(null);
  const after = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(c.initialTime);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState({ before: false, after: false });
  const [failed, setFailed] = useState(false);
  const available = ready.before && ready.after && !failed;
  const stop = () => {
    before.current?.pause();
    after.current?.pause();
    setPlaying(false);
  };
  const seek = (next: number) => {
    stop();
    setTime(next);
    for (const video of [before.current, after.current])
      if (video && video.readyState >= 1)
        video.currentTime = Math.min(next, video.duration - c.endTolerance);
  };
  const toggle = async () => {
    if (playing) {
      stop();
      return;
    }
    if (!available) return;
    if (time >= c.duration - c.endTolerance) seek(c.entranceTime);
    try {
      await Promise.all([before.current?.play(), after.current?.play()]);
      setPlaying(true);
    } catch {
      stop();
      setFailed(true);
    }
  };
  useEffect(() => {
    const first = before.current,
      second = after.current;
    return () => {
      first?.pause();
      second?.pause();
    };
  }, []);
  const load = (side: "before" | "after", video: HTMLVideoElement) => {
    video.currentTime = c.initialTime;
    setReady((value) => ({ ...value, [side]: true }));
  };
  const update = () => {
    const first = before.current,
      second = after.current;
    if (!first || first.paused) return;
    setTime(first.currentTime);
    if (
      second &&
      Math.abs(first.currentTime - second.currentTime) >
        c.synchronizationTolerance
    )
      second.currentTime = first.currentTime;
  };
  return (
    <div className="sr-review jy-app">
      <header className="sr-header">
        <a href="/" className="sr-brand">
          <HeartPulse aria-hidden="true" />
          {journey.brand}
        </a>
        <a href="/">
          <ArrowLeft size={18} />
          {c.back}
        </a>
      </header>
      <main id="main">
        <div className="sr-heading">
          <p className="sr-eyebrow">{c.eyebrow}</p>
          <h1>{c.title}</h1>
          <p>{c.description}</p>
        </div>
        <section className="sr-comparison" aria-label={c.scrub}>
          <figure>
            <figcaption>
              <span>01</span>
              {c.originalLabel}
            </figcaption>
            <video
              ref={before}
              src={c.original}
              poster={c.poster}
              muted
              playsInline
              preload="auto"
              aria-label={c.originalLabel}
              onLoadedData={(event) => load("before", event.currentTarget)}
              onTimeUpdate={update}
              onEnded={() => {
                stop();
                seek(c.duration - c.endTolerance);
              }}
              onError={() => {
                stop();
                setFailed(true);
              }}
            />
          </figure>
          <figure>
            <figcaption>
              <span>02</span>
              {c.compositeLabel}
            </figcaption>
            <video
              ref={after}
              src={c.composite}
              poster={c.compositePoster}
              muted
              playsInline
              preload="auto"
              aria-label={c.compositeLabel}
              onLoadedData={(event) => load("after", event.currentTarget)}
              onError={() => {
                stop();
                setFailed(true);
              }}
            />
          </figure>
        </section>
        <div className="sr-controls">
          <button onClick={toggle} disabled={!available}>
            {playing ? <Pause size={19} /> : <Play size={19} />}{" "}
            {playing ? c.pause : c.play}
          </button>
          <button
            className="sr-secondary"
            onClick={() => seek(c.entranceTime)}
            disabled={!available}
          >
            <RotateCcw size={19} />
            {c.replay}
          </button>
          <output>
            {time.toFixed(2)} / {c.duration.toFixed(2)} s
          </output>
          <label className="sr-range">
            <span>{c.scrub}</span>
            <input
              type="range"
              min={0}
              max={c.duration - c.endTolerance}
              step={c.seekStep}
              value={time}
              disabled={!available}
              onChange={(event) => seek(Number(event.target.value))}
            />
          </label>
        </div>
        <p className="sr-status" role="status">
          {failed ? c.error : !available ? c.loading : ""}
        </p>
        <p className="sr-notice">{c.notice}</p>
        <section className="sr-details">
          <h2>{c.detailsTitle}</h2>
          <ul>
            {c.details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
