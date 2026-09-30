"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { emailOperation } from "@/lib/email-workspace-types";

export function EmailEstimateButton({ estimateId }: { estimateId: string }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const result = await emailOperation("estimate", { estimateId });
      if (result.warning) toast.warning(`Draft saved. ${result.warning}`);
      router.push(`/admin/email?draftId=${result.id}`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to create estimate email",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={open} disabled={busy}>
      <Mail data-icon="inline-start" />
      {busy ? "Preparing draft…" : "Email estimate"}
    </Button>
  );
}
