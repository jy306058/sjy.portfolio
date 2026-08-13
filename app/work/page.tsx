import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Work",
};

export default function WorkPage() {
  return (
    <section aria-labelledby="work-heading">
      <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
        Selected projects
      </p>

      <h1
        id="work-heading"
        className="text-5xl font-semibold tracking-[-0.05em] sm:text-7xl"
      >
        Work
      </h1>
    </section>
  );
}
