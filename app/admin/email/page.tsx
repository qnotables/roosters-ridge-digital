import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasDashboardAccess } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmailWorkspace } from "@/components/admin/email-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Email workspace | RRD Admin",
  description:
    "Protected customer email drafts, sending, and delivery history.",
  robots: { index: false, follow: false },
};
export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ draftId?: string; leadId?: string }>;
}) {
  if (!(await hasDashboardAccess())) redirect("/admin/sign-in");
  const { draftId, leadId } = await searchParams;
  return (
    <AdminShell>
      <EmailWorkspace draftId={draftId} leadId={leadId} />
    </AdminShell>
  );
}
