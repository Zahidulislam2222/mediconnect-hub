import { z } from "zod";
import raw from "./continuity.json";

const text = z.string().min(1);
const path = z.string().regex(/^\/media\/continuity\/[a-z0-9-]+\.(webp|mp4)$/);
const requiredTextFields = (template: object, exclude: string[] = []) =>
  z.object(
    Object.fromEntries(
      Object.keys(template)
        .filter((key) => !exclude.includes(key))
        .map((key) => [key, text]),
    ),
  );
export const roleSchema = z.enum(["patient", "clinician", "staff"]);
export type CareRole = z.infer<typeof roleSchema>;
const schema = z
  .object({
    brand: text,
    notice: text,
    noScript: text,
    navigation: z.object({
      journey: text,
      workspace: text,
      login: text,
      home: text,
      skip: text,
    }),
    hero: z.object({
      eyebrow: text,
      title: text,
      emphasis: text,
      description: text,
      primary: text,
      secondary: text,
      footnote: text,
      caption: text,
      mediaLabel: text,
      scroll: text,
      appointmentLabel: text,
    }),
    sample: z.object({
      patient: text,
      patientInitials: text,
      clinician: text,
      clinicianInitials: text,
      specialty: text,
      appointmentId: text,
      date: text,
      shortDate: text,
      timezone: text,
      duration: text,
      slots: z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).min(2),
      initialSlot: text,
      needsConfirmation: text,
      ready: text,
      initialStatus: z.enum(["needs-confirmation", "ready"]),
      visitType: text,
      reason: text,
      patientNote: text,
      recordTitle: text,
      recordNote: text,
      recordItems: z.array(text).min(1),
      queue: z
        .array(
          z.object({ initials: text, name: text, time: text, status: text }),
        )
        .length(2),
    }),
    journey: z.object({
      eyebrow: text,
      title: text,
      emphasis: text,
      description: text,
      sampleLabel: text,
      anchorLabel: text,
      readMore: text,
      motionOn: text,
      motionOff: text,
      stages: z
        .array(
          z.object({
            id: text,
            number: text,
            label: text,
            title: text,
            body: text,
            panelTitle: text,
            panelLabel: text,
          }),
        )
        .length(4),
    }),
    workspace: z
      .object({
        roles: z
          .array(
            z.object({
              id: roleSchema,
              name: text,
              title: text,
              body: text,
              action: text,
              greeting: text,
              subtitle: text,
            }),
          )
          .length(3),
      })
      .and(requiredTextFields(raw.workspace, ["roles"])),
    auth: requiredTextFields(raw.auth),
    footer: requiredTextFields(raw.footer),
    authValidation: z.object({
      nameMax: z.number().int().positive(),
      emailMax: z.number().int().positive(),
      passwordMin: z.number().int().positive(),
      passwordMax: z.number().int().positive(),
    }),
    media: z.object({
      clinicianPoster: path,
      clinicianVideo: path,
      patientPoster: path,
      patientVideo: path,
      patientLabel: text,
      fallback: text,
      play: text,
      pause: text,
      failed: text,
    }),
    motion: z.object({
      stageStops: z.array(z.number().min(0).max(1)).length(4),
      transitionWindow: z.number().positive().max(0.2),
      foldDegrees: z.number().min(0).max(45),
      travelPixels: z.number().min(0).max(500),
      duration: z.number().positive().max(1),
      mobileQuery: text,
      compactQuery: text,
      mediaThreshold: z.number().min(0).max(1),
      seekEpsilonSeconds: z.number().positive().max(0.1),
      seekFailureMs: z.number().int().min(100).max(3000),
    }),
  })
  .superRefine((value, ctx) => {
    if (!value.sample.slots.includes(value.sample.initialSlot))
      ctx.addIssue({ code: "custom", message: "Initial slot must exist" });
    if (new Set(value.workspace.roles.map((role) => role.id)).size !== 3)
      ctx.addIssue({ code: "custom", message: "Unique roles required" });
    if (
      value.motion.stageStops.some(
        (stop, index, stops) => index > 0 && stop <= stops[index - 1],
      )
    )
      ctx.addIssue({ code: "custom", message: "Stage stops must increase" });
    if (
      value.motion.stageStops[0] !== 0 ||
      value.motion.stageStops[3] !== 1 ||
      value.motion.stageStops.some(
        (stop, index, stops) =>
          index > 0 && stop - stops[index - 1] <= value.motion.transitionWindow,
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Motion requires endpoints and nonoverlapping transition windows",
      });
    if (
      new Set(value.journey.stages.map((stage) => stage.id)).size !== 4 ||
      new Set(value.sample.slots).size !== value.sample.slots.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Stage IDs and slots must be unique",
      });
    if (value.authValidation.passwordMin > value.authValidation.passwordMax)
      ctx.addIssue({ code: "custom", message: "Invalid input limits" });
  });

schema.parse(raw);
// Inferred JSON keys keep maintained copy statically addressable; all leaf values validated above.
export const continuity = raw;
export const validateContinuity = (value: unknown) => schema.parse(value);
