import { z } from "zod";
import raw from "./journey.json";

const text = z.string().trim().min(1);
const path = z
  .string()
  .regex(/^\/media\/[a-zA-Z0-9/_.-]+$/)
  .refine((value) => !value.includes(".."));
const stage = z.object({
  id: text,
  at: z.number().min(0).max(1),
  label: text,
  title: text,
  emphasis: text,
  body: text,
  cardLabel: text,
  cardTitle: text,
  cardBody: text,
  cardStatus: text,
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
      "eyebrow",
      "title",
      "emphasis",
      "body",
      "primary",
      "secondary",
      "scroll",
      "skip",
      "motionOff",
      "motionOn",
      "motionStatic",
      "openDetail",
      "closeDetail",
      "chapters",
      "knowledgeLink",
      "journalLink",
      "illustration",
      "blockout",
    ]),
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
    stages: z
      .array(stage)
      .length(4)
      .refine(
        (items) =>
          items[0].at === 0 &&
          items.every(
            (item, index) => !index || item.at > items[index - 1].at + 0.1,
          ),
      ),
    motion: z.object({
      scrollHeightVh: z.number().min(200).max(900),
      mobileScrollHeightVh: z.number().min(200).max(700),
      seekToleranceSeconds: z.number().positive().max(0.2),
      seekWatchdogMs: z.number().int().min(250).max(5000),
      minimumHeight: z.number().min(400).max(900),
      cardTravelPx: z.number().min(0).max(100),
      cardTiltDegrees: z.number().min(0).max(15),
      chapterFadeFraction: z.number().min(0.01).max(0.08),
    }),
    media: z.object({
      film: z.union([path, z.literal("")]),
      poster: path,
      homePoster: path,
      finished: z.boolean(),
      alt: text,
      duration: z.number().positive().max(120),
      storyboard: z.array(path).min(2),
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
      .refine((value) => value.slots.includes(value.defaultSlot)),
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
    for (const field of ["coordinationArticleSlug", "preparationArticleSlug"] as const) {
      if (!data.articles.some(article => article.slug === data.workspace[field] && article.kind === "knowledge")) {
        ctx.addIssue({
          code: "custom",
          path: ["workspace", field],
          message: "Workspace reference must identify an existing knowledge article",
        });
      }
    }
    if (data.media.finished && !data.media.film)
      ctx.addIssue({
        code: "custom",
        path: ["media", "film"],
        message: "Finished media needs a film",
      });
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
