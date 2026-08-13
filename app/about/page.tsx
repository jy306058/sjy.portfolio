import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <section aria-labelledby="about-heading">
      <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
        Profile
      </p>

      <h1
        id="about-heading"
        className="text-5xl font-semibold tracking-[-0.05em] sm:text-7xl"
      >
        About
      </h1>
    </section>
  );
}
