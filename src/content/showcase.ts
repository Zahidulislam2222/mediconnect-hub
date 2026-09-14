import { z } from "zod";
import source from "./showcase.json";

const text = z.string().trim().min(1);
const schema = z.object({
  brand: text, edition: text,
  navigation: z.array(z.object({ label: text, href: z.string().regex(/^#[a-z][a-z-]*$/) })).length(3),
  hero: z.object({ eyebrow: text, title: text, lines: z.array(text).length(3), description: text, primary: text, secondary: text, disclaimer: text }),
  preview: z.object({ label: text, badge: text, person: text, initials: text, personDetail: text, clinician: text, clinicianInitials: text, specialty: text, appointment: text, time: text, format: text, footnote: text,
    stages: z.array(z.object({ id: z.enum(["appointment", "consultation", "followup"]), number: text, label: text, title: text, description: text, status: text, detailLabel: text, detail: text, items: z.array(text).length(3) })).length(3) }),
  principles: z.array(z.object({ number: text, title: text, description: text })).length(3),
  workspace: z.object({ eyebrow: text, title: text, description: text, badge: text, action: text, feedback: text,
    roles: z.array(z.object({ id: z.enum(["patient", "clinician", "team"]), label: text, eyebrow: text, title: text, description: text, screenTitle: text, screenSubtitle: text, rows: z.array(z.object({ label: text, value: text, meta: text })).length(3), note: text })).length(3) }),
  engineering: z.object({ eyebrow: text, title: text, description: text, items: z.array(z.object({ number: text, title: text, body: text, status: text })).length(3), note: text }),
  faq: z.object({ eyebrow: text, title: text, items: z.array(z.object({ question: text, answer: text })).min(1) }),
  closing: z.object({ eyebrow: text, title: text, description: text, action: text }),
  footer: z.object({ description: text, status: text, note: text, back: text }),
  ui: z.object({ skip: text, openMenu: text, closeMenu: text, navLabel: text, stepsLabel: text, rolesLabel: text, previewLabel: text, noteLabel: text, detailsLabel: text, careLabel: text, reset: text }),
}).superRefine((value, context) => {
  for (const values of [value.preview.stages, value.workspace.roles]) {
    if (new Set(values.map(item => item.id)).size !== values.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Preview IDs must be unique" });
    }
  }
});

export const showcase = schema.parse(source);
