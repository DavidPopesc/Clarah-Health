export default function Loading() {
  return (
    <div className="flex grow items-center justify-center gap-2 text-sm text-subtle" role="status">
      <span className="size-2 animate-pulse rounded-full bg-teal" />
      Loading your health data…
    </div>
  );
}
