import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home",
};

export default function Home() {
  return (
    <section aria-labelledby="home-heading">
      <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
        Product Designer
      </p>

      <h1
        id="home-heading"
        className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl lg:text-8xl"
      >
        Thoughtful products, designed with clarity.
      </h1>
    </section>
  );
}
