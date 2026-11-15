import { z } from "zod";
import raw from "./journey.json";
// Relative, not "@/": the release and preview Vite configs import this file before aliases exist.
import { heroMotionSchema } from "../lib/hero-thread";

const text = z.string().trim().min(1);
const path = z
  .string()
  .regex(/^\/media\/[a-zA-Z0-9/_.-]+$/)
  .refine((value) => !value.includes(".."));
/** Order is structural: each id is drawn by its own illustration in the hero. */
export const MOMENT_IDS = ["book", "visit", "plan", "follow"] as const;
const moment = z.object({
  id: z.enum(MOMENT_IDS),
  label: text,
  title: text,
  body: text,
});
const copy = <const T extends readonly string[]>(keys: T) =>
  z.object(
    Object.fromEntries(keys.map((key) => [key, text])) as {
      [K in T[number]]: typeof text;
    },
  );
export const journeySchema = z
  .object({
    brand: text,
    tagline: text,
    notice: text,
    publicLinks: z.object({ privacy: z.string().regex(/^\/[a-z-]+$/), terms: z.string().regex(/^\/[a-z-]+$/), security: z.string().regex(/^\/[a-z-]+$/) }).strict(),
    labels: copy([
      "loading",
      "mainNavigation",
      "workspace",
      "loginRole",
      "categories",
      "minutesRead",
      "minutes",
      "guides",
      "stories",
      "clinicComposition",
      "homeComposition",
      "noScript",
    ]),
    navigation: copy([
      "skip",
      "journey",
      "knowledge",
      "blog",
      "login",
      "menu",
      "close",
      "home",
      "explore",
    ]),
    hero: copy([
      // eyebrow and illustration are shown by the native clients, which read this same file.
      "eyebrow",
      "illustration",
      "title",
      "emphasis",
      "body",
      "primary",
      "secondary",
      "momentsLabel",
      "illustrationNote",
      "knowledgeLink",
      "journalLink",
    ]),
    heroMotion: heroMotionSchema(MOMENT_IDS.length),
    moments: z
      .array(moment)
      .length(MOMENT_IDS.length)
      .refine((items) => items.every((item, index) => item.id === MOMENT_IDS[index]), {
        message: "Moments must follow the care journey order",
      }),
    /** Read by the native clients (native/android, native/ios); the web hero draws `moments` instead. */
    stages: z
      .array(copy(["id", "label", "title", "emphasis", "body"]))
      .min(2)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
        message: "Stage ids must be unique",
      }),
    heroPreview: z.object({
      book: copy(["kicker", "title", "mode", "status"]),
      visit: copy(["kicker", "status", "elapsed"]),
      plan: z.object({
        kicker: text,
        items: z
          .array(z.object({ label: text, done: z.boolean() }))
          .min(2)
          .max(4),
      }),
      follow: copy(["kicker", "when", "message"]),
    }),
    /** Clinician-side sketch on the homepage; one schedule row per sample slot, initials only. */
    clinicPreview: z.object({
      schedule: copy(["kicker", "unit", "now"]).extend({
        // The panel is drawn for two or three rows; more would not fit its fixed desktop height.
        rows: z.array(z.object({ label: text, initials: z.string().regex(/^[A-Z]{2}$/) })).min(2).max(3),
      }),
      call: copy(["kicker", "status"]),
      notes: copy(["kicker", "status"]),
      note: text,
    }),
    library: copy([
      "title",
      "body",
      "eyebrow",
      "search",
      "placeholder",
      "all",
      "empty",
      "clear",
      "back",
      "read",
      "disclaimer",
    ]),
    journal: copy(["eyebrow", "title", "body", "back", "read", "disclaimer"]),
    footer: copy([
      "title",
      "body",
      "credit",
      "notFound",
      "return",
      "storyboard",
      "storyboardTitle",
      "storyboardBody",
    ]),
    media: z.object({
      poster: path,
      homePoster: path,
      alt: text,
    }),
    explore: z.object({
      eyebrow: text,
      title: text,
      body: text,
      roles: z
        .array(
          z.object({
            id: z.enum(["patient", "doctor", "staff"]),
            label: text,
            title: text,
            body: text,
            action: text,
            number: text,
          }),
        )
        .length(3)
        .refine((items) => new Set(items.map((item) => item.id)).size === 3),
    }),
    articles: z
      .array(
        z.object({
          slug: z.string().regex(/^[a-z0-9-]+$/),
          kind: z.enum(["knowledge", "blog"]),
          category: text,
          audience: text,
          title: text,
          summary: text,
          minutes: z.number().int().positive(),
          sections: z.array(z.object({ heading: text, body: text })).min(1),
        }),
      )
      .min(2)
      .refine(
        (items) =>
          new Set(items.map((item) => item.slug)).size === items.length,
      ),
    sample: z
      .object({
        patient: text,
        patientInitials: text,
        doctorInitials: text,
        doctor: text,
        date: text,
        year: text,
        timezone: text,
        appointment: text,
        slots: z.array(text).min(2),
        defaultSlot: text,
        note: text,
      })
      .refine((value) => value.slots.includes(value.defaultSlot))
      .refine((value) => new Set(value.slots).size === value.slots.length, { message: "Sample slots must be unique" }),
    workspace: copy([
      "coordinationArticleSlug",
      "preparationArticleSlug",
      "eyebrow",
      "greeting",
      "notice",
      "appointment",
      "choose",
      "notes",
      "noteHint",
      "save",
      "saved",
      "ready",
      "pending",
      "toggle",
      "reset",
      "consult",
      "close",
      "callTitle",
      "callNotice",
      "micOn",
      "micOff",
      "camOn",
      "camOff",
      "followup",
      "followupBody",
      "queue",
      "staff",
      "doctor",
      "patient",
      "details",
    ]).extend({ noteMaxLength: z.number().int().min(1).max(2000) }),
    auth: copy([
      "eyebrow",
      "title",
      "body",
      "notice",
      "email",
      "password",
      "emailPlaceholder",
      "passwordPlaceholder",
      "submit",
      "result",
      "show",
      "hide",
      "forgot",
      "resetNotice",
      "signup",
      "signupAction",
      "invite",
      "error",
    ]).extend({ minimumPasswordLength: z.number().int().min(8).max(64) }),
  })
  .superRefine((data, ctx) => {
    if (data.clinicPreview.schedule.rows.length !== data.sample.slots.length)
      ctx.addIssue({
        code: "custom",
        path: ["clinicPreview", "schedule", "rows"],
        message: "The clinician schedule needs one row for each sample slot",
      });
    for (const field of ["coordinationArticleSlug", "preparationArticleSlug"] as const) {
      if (!data.articles.some(article => article.slug === data.workspace[field] && article.kind === "knowledge")) {
        ctx.addIssue({
          code: "custom",
          path: ["workspace", field],
          message: "Workspace reference must identify an existing knowledge article",
        });
      }
    }
    for (const kind of ["knowledge", "blog"])
      if (!data.articles.some((item) => item.kind === kind))
        ctx.addIssue({
          code: "custom",
          path: ["articles"],
          message: "Both public destinations need content",
        });
  });
export const journey = journeySchema.parse(raw);
export type JourneyRole = "patient" | "doctor" | "staff";
