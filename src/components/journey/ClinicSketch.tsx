import { CalendarDays, Check, ClipboardCheck, Video } from "lucide-react";
import { journey as c } from "@/content/journey";
import "@/styles/hero-thread.css";
import "@/styles/clinic-sketch.css";

const preview = c.clinicPreview;
/** Shape of the heartbeat on the thread that leads into the schedule. */
const PULSE = "M0 22h10q5-9 10 0h6l4 6 6-30 7 42 5-18h6q6-11 12 0h10";

/**
 * Clinician-side illustration for the homepage: the day's schedule, a connected video visit and
 * shared notes on one thread. Decorative and people-free; initials stand in for people.
 */
export default function ClinicSketch() {
  return (
    <div className="jy-home-clinician-image jy-clinic-sketch" aria-hidden="true">
      <div className="jy-clinic-sketch-art">
        <div className="jy-clinic-sketch-pulse">
          <i />
          <svg viewBox="0 0 76 44" focusable="false">
            <path d={PULSE} />
          </svg>
          <i />
        </div>
        <div className="jy-hero-tile jy-clinic-sketch-schedule">
          <span className="jy-hero-kicker">
            <CalendarDays />
            {preview.schedule.kicker}
            <span className="jy-hero-aside">
              {c.sample.slots.length} {preview.schedule.unit}
            </span>
          </span>
          {preview.schedule.rows.map((row, index) => {
            const slot = c.sample.slots[index];
            const now = slot === c.sample.defaultSlot;
            return (
              <span className="jy-clinic-sketch-row" data-now={now} key={slot}>
                <span className="jy-hero-time">{slot}</span>
                <span className="jy-clinic-sketch-label">
                  {row.label}
                  {now && <em>{preview.schedule.now}</em>}
                </span>
                <span className="jy-clinic-sketch-initials">{row.initials}</span>
              </span>
            );
          })}
        </div>
        <div className="jy-clinic-sketch-call">
          <Video />
          {preview.call.kicker}
          <span className="jy-hero-aside jy-hero-live">
            <i />
            {preview.call.status}
          </span>
        </div>
        <div className="jy-hero-tile jy-clinic-sketch-notes">
          <span className="jy-hero-kicker">
            <ClipboardCheck />
            {preview.notes.kicker}
          </span>
          <span className="jy-clinic-sketch-lines">
            <i />
            <i />
            <i />
          </span>
          <span className="jy-hero-status">
            <Check />
            {preview.notes.status}
          </span>
        </div>
        <p className="jy-clinic-sketch-note">{preview.note}</p>
      </div>
    </div>
  );
}
