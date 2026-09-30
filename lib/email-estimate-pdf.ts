import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EstimateRecord } from "@/lib/pricing-shared";

export function customerEstimateFields(e: EstimateRecord) {
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);
  return [
    `PROJECT ESTIMATE | ${e.estimateNumber}`,
    `Prepared for ${e.clientName}${e.company ? ` | ${e.company}` : ""}`,
    `Project: ${e.projectName}`,
    `Issued: ${e.createdAt.slice(0, 10)} | Valid through: ${e.expirationDate || "As agreed"}`,
    e.projectOverview,
    "SCOPE OF WORK",
    `${e.platformName}: ${money(e.platformPrice)}`,
    ...e.items.map(
      (i) =>
        `${i.label} (${i.quantity}): ${i.isIncluded ? "Included" : money(Math.max(0, i.quantity * (i.manualPriceOverride ?? i.unitPrice) - i.discount))}${i.description ? `\n${i.description}` : ""}${i.clientNote ? `\n${i.clientNote}` : ""}`,
    ),
    "INVESTMENT",
    `Total project investment: ${money(e.totalPrice)}`,
    `Discount: ${money(e.discount)} | Tax: ${money(e.tax)}`,
    `Deposit: ${money(e.depositAmount)} | Remaining balance: ${money(e.remainingBalance)}`,
    ...e.recurringItems.map(
      (i) =>
        `${i.name}: ${money(i.monthlyClientPrice)} / ${i.billingFrequency}`,
    ),
    `Recurring total: ${money(e.recurringTotal)}`,
    "ASSUMPTIONS",
    e.assumptions,
    "EXCLUSIONS",
    e.exclusions,
    "TIMELINE",
    e.timeline,
    "NEXT STEPS",
    e.nextSteps,
  ].filter(Boolean);
}
export async function estimatePdf(e: EstimateRecord, contact: string) {
  return customerEstimatePdf(customerEstimateFields(e), contact);
}
export async function customerEstimatePdf(fields: string[], contact: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]),
    y = 740;
  const clean = (s: string) =>
    s
      .replace(/[–—]/g, "-")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7e\n]/g, " ");
  const lines = ["ROOSTER’S RIDGE DIGITAL", contact, ...fields];
  for (const [index, block] of lines.entries()) {
    const header = index === 0 || /^[A-Z ]+$/.test(block);
    const size = index === 0 ? 18 : header ? 12 : 10;
    for (const paragraph of clean(block).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > 508 && line) {
          draw(line);
          line = word;
        } else line = candidate;
      }
      if (line) draw(line);
    }
    y -= 9;
    function draw(text: string) {
      if (y < 55) {
        page = pdf.addPage([612, 792]);
        y = 740;
      }
      page.drawText(text, {
        x: 52,
        y,
        size,
        font: header ? bold : font,
        color: header ? rgb(0.1, 0.15, 0.25) : rgb(0.2, 0.25, 0.3),
      });
      y -= size + 5;
    }
  }
  return Buffer.from(await pdf.save());
}
