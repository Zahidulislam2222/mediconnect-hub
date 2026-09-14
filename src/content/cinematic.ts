import { z } from "zod";
import source from "./cinematic.json";

const text = z.string().trim().min(1);
const localPath = z.string().regex(/^\/(?!\/)[a-zA-Z0-9/#?=._-]*$/);
const point = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const copy = z.record(text);
// Content is maintained in JSON. This boundary validates media and camera data
// before any loader, link or rendering component consumes it.
export const cinematicSchema = z.object({
  brand: text,
  navigation: z.array(z.object({ label: text, href: localPath })).length(3),
  hero: z.object({ eyebrow: text, lines: z.array(text).length(2), description: text, primary: text, secondary: text, scroll: text, caption: text, footnote: text }),
  journey: z.object({ eyebrow: text, title: text, description: text,
    stages: z.array(z.object({ id: text, number: text, label: text, title: text, body: text, detail: text, icon: z.enum(["calendar", "video", "record"]) })).length(3),
    controls: text, loading: text, fallback: text, modelLabel: text, motionOn: text, motionOff: text, rotate: text, rotation: text, technique: text }),
  workspace: z.object({ roles: z.array(text).length(3), recordItems: z.array(text).min(1) }).catchall(text),
  engineering: z.object({ eyebrow: text, title: text, body: text, items: z.array(z.object({ title: text, body: text })).length(3) }),
  closing: copy,
  auth: z.object({ roles: z.array(text).length(2), staffRoles: z.array(text).length(2) }).catchall(text),
  ui: copy,
  media: z.object({ hero: localPath, heroAlt: text, poster: localPath, model: localPath, video: localPath.nullable() }),
  motion: z.object({ maxPixelRatio: z.number().min(1).max(2), desktopBreakpoint: z.number().positive(), cameraFov: z.number().min(20).max(90), cameraNear: z.number().positive(), cameraFar: z.number().positive(), rotationLimit: z.number().positive().max(Math.PI), loadTimeoutMs: z.number().int().positive(), stages: z.array(z.object({ camera: point, target: point })).length(3), lights: z.object({ hemisphere: z.number().positive(), key: z.number().positive(), fill: z.number().positive(), skyColor: z.string().regex(/^#[0-9a-f]{6}$/i), groundColor: z.string().regex(/^#[0-9a-f]{6}$/i), keyColor: z.string().regex(/^#[0-9a-f]{6}$/i), fillColor: z.string().regex(/^#[0-9a-f]{6}$/i) }) }),
}).superRefine((value, context) => {
  if (new Set(value.journey.stages.map(stage => stage.id)).size !== value.journey.stages.length)
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Care stages must be unique" });
  if (value.motion.cameraFar <= value.motion.cameraNear)
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Camera far plane must exceed near plane" });
});

cinematicSchema.parse(source);
// JSON import retains the exact known copy keys, while the schema checks input.
export const cinematic = source;
