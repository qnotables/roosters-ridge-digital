import sanitizeHtml from "sanitize-html";
import { convert } from "html-to-text";

export type Recipients = { to: string[]; cc: string[]; bcc: string[] };
export type DraftInput = {
  id?: string;
  recipients: Recipients;
  subject: string;
  html: string;
  plainText?: string;
  leadId?: string | null;
  projectName?: string;
};
export const MAX_ATTACHMENT = 3_000_000;
export const MAX_TOTAL = 9_000_000;
export const MAX_FILES = 5;
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const EMAIL =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
export function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "h2",
      "h3",
      "a",
    ],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
  });
}
export function plainHtml(html: string) {
  return convert(html, { wordwrap: false });
}
export function missingPlaceholders(text: string) {
  return [...new Set(text.match(/\{\{[^{}]+\}\}/g) || [])];
}
export function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function validateDraft(input: DraftInput, sending = false) {
  if (
    !input ||
    typeof input.subject !== "string" ||
    typeof input.html !== "string"
  )
    throw new Error("Invalid message.");
  if (input.subject.length > 200 || /[\r\n]/.test(input.subject))
    throw new Error("Subject must be a single line under 200 characters.");
  if (input.html.length > 100_000 || (input.plainText?.length || 0) > 100_000)
    throw new Error("Message is too long.");
  if (input.id && !UUID.test(input.id)) throw new Error("Invalid draft ID.");
  if (input.leadId && !UUID.test(input.leadId))
    throw new Error("Invalid lead ID.");
  const recipients: Recipients = { to: [], cc: [], bcc: [] };
  for (const kind of ["to", "cc", "bcc"] as const) {
    if (
      !Array.isArray(input.recipients?.[kind]) ||
      input.recipients[kind].some((v) => typeof v !== "string")
    )
      throw new Error("Invalid recipient list.");
    recipients[kind] = [
      ...new Set(
        input.recipients[kind]
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (recipients[kind].some((v) => v.length > 254 || !EMAIL.test(v)))
      throw new Error(`Invalid ${kind.toUpperCase()} email address.`);
  }
  if (
    recipients.to.length > 1 ||
    [...recipients.to, ...recipients.cc, ...recipients.bcc].length > 5
  )
    throw new Error(
      "Use one customer recipient and at most five addresses total. Bulk sending is not supported.",
    );
  const allAddresses = [...recipients.to, ...recipients.cc, ...recipients.bcc];
  if (new Set(allAddresses).size !== allAddresses.length)
    throw new Error(
      "An email address may appear only once across To, CC, and BCC.",
    );
  const html = cleanHtml(input.html);
  const plainText = input.plainText?.trim() || plainHtml(html);
  if (sending) {
    if (
      !recipients.to.length ||
      !input.subject.trim() ||
      !plainHtml(html).trim() ||
      !plainText
    )
      throw new Error("Recipient, subject, and message are required.");
    if (missingPlaceholders(`${input.subject} ${html} ${plainText}`).length)
      throw new Error("Resolve every {{placeholder}} before sending.");
  }
  return {
    recipients,
    subject: input.subject.trim(),
    html,
    plainText,
    leadId: input.leadId || null,
    projectName: (input.projectName || "").slice(0, 200),
  };
}
export const defaultTemplates = [
  {
    id: "introduction",
    name: "Introduction",
    subject: "An introduction from Rooster’s Ridge Digital",
    html: "<p>Hello {{customer_name}},</p><p>I would love to learn more about {{company}} and how we can help with your digital presence.</p><p>Would you be available for a short conversation?</p>",
  },
  {
    id: "follow-up",
    name: "Follow-up",
    subject: "Following up with {{company}}",
    html: "<p>Hello {{customer_name}},</p><p>I am following up on our conversation about {{project_name}}. Please let me know if you have questions or would like to discuss next steps.</p>",
  },
  {
    id: "meeting",
    name: "Meeting confirmation",
    subject: "Our meeting about {{project_name}}",
    html: "<p>Hello {{customer_name}},</p><p>Looking forward to our meeting on {{meeting_date}} at {{meeting_time}}. We will discuss {{project_name}} and your priorities.</p>",
  },
  {
    id: "project-update",
    name: "Project update",
    subject: "An update on {{project_name}}",
    html: "<p>Hello {{customer_name}},</p><p>Here is the latest update on {{project_name}}:</p><p>{{project_update}}</p><p>Please let me know if you have any questions.</p>",
  },
  {
    id: "estimate",
    name: "Estimate delivery",
    subject: "Your estimate {{estimate_number}} — {{project_name}}",
    html: "<p>Hello {{customer_name}},</p><p>Attached is your estimate {{estimate_number}} for {{project_name}}. Please review the scope and investment, and let me know if you would like to discuss anything.</p>",
  },
  {
    id: "thank-you",
    name: "Thank-you message",
    subject: "Thank you, {{customer_name}}",
    html: "<p>Hello {{customer_name}},</p><p>Thank you for trusting Rooster’s Ridge Digital with {{project_name}}. It has been a pleasure working with {{company}}.</p>",
  },
];
export function nextDeliveryState(current: string, event: string) {
  const state = (
    {
      "email.sent": "accepted",
      "email.delivered": "delivered",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.failed": "failed",
      "email.suppressed": "failed",
      "email.delivery_delayed": "accepted",
    } as Record<string, string>
  )[event];
  if (
    !state ||
    current === "complained" ||
    (current === "bounced" && state !== "complained")
  )
    return current;
  if (
    current === "delivered" &&
    ["accepted", "queued", "failed"].includes(state)
  )
    return current;
  if (current === "failed" && ["accepted", "queued"].includes(state))
    return current;
  return state;
}
