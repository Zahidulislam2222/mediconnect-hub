import { z } from "zod";

/** Validated tunables for the homepage care-thread scene; values live in `src/content/journey.json`. */

const colour = z.string().regex(/^#[0-9a-f]{6}$/i);
const vec3 = z.array(z.number().finite()).length(3);
const intensity = z.number().min(0).max(10);
const sceneColours = [
  "sky", "ground", "clinicFloor", "homeFloor", "wall", "wood", "chair", "sofa", "table", "plant",
  "pot", "trunk", "metal", "glass", "screen", "card", "accent", "lamp", "sun",
] as const;

export const cameraStopSchema = z.object({ position: vec3, target: vec3 }).strict();
export type CameraStop = z.infer<typeof cameraStopSchema>;

export const careThreadSceneSchema = z
  .object({
    loadTimeoutMs: z.number().int().min(1000).max(30000),
    maxPixelRatio: z.number().min(1).max(3),
    softwarePixelRatio: z.number().min(0.25).max(1),
    shadowMapSize: z.union([z.literal(512), z.literal(1024), z.literal(2048), z.literal(4096)]),
    fov: z.number().min(20).max(70),
    maxFov: z.number().min(20).max(90),
    referenceAspect: z.number().min(0.5).max(3),
    threadReveal: z
      .array(z.number().min(0).max(1))
      .length(2)
      .refine(([start, end]) => end > start),
    fog: z.object({ near: z.number().positive(), far: z.number().positive() }).strict().refine(({ near, far }) => far > near),
    lights: z.object({ hemisphere: intensity, sun: intensity, glow: intensity, glowDistance: z.number().positive().max(20), lamp: intensity }).strict(),
    opacity: z.object({ glass: z.number().min(0).max(1), halo: z.number().min(0).max(1), headHalo: z.number().min(0).max(1) }).strict(),
    palette: z
      .object({
        ...(Object.fromEntries(sceneColours.map((key) => [key, colour])) as { [K in (typeof sceneColours)[number]]: typeof colour }),
        books: z.array(colour).min(1),
      })
      .strict(),
    cameras: z.array(cameraStopSchema),
  })
  .strict()
  .refine((scene) => scene.maxFov >= scene.fov);
export type CareThreadSceneConfig = z.infer<typeof careThreadSceneSchema>;
