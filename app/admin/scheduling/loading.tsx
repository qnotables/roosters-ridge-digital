import { Skeleton } from "@/components/ui/skeleton";
export default function SchedulingLoading() {
  return (
    <main
      className="mx-auto flex max-w-[1400px] flex-col gap-6 p-6"
      aria-label="Loading scheduling calendar"
    >
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-[560px] w-full" />
    </main>
  );
}
