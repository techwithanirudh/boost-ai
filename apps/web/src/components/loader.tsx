import { Shimmer } from "@/components/ai-elements/shimmer";

export default function Loader() {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-2">
        <Shimmer className="size-10 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Shimmer className="h-4 w-28 rounded-md" />
          <Shimmer className="h-3 w-40 rounded-md" />
        </div>
      </div>
      <Shimmer className="h-40 rounded-xl" />
      <div className="flex flex-col gap-3">
        <Shimmer className="h-4 w-32 rounded-md" />
        <Shimmer className="h-px w-full rounded-md" />
        <Shimmer className="h-16 rounded-xl" />
        <Shimmer className="h-16 rounded-xl" />
        <Shimmer className="h-16 rounded-xl" />
      </div>
    </div>
  );
}
