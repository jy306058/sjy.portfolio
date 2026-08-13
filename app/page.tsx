import type { Metadata } from "next";
import { InteractiveBackground } from "./components/InteractiveBackground";

export const metadata: Metadata = {
  title: "Home",
};

export default function Home() {
  return (
    <>
      <InteractiveBackground />

      <section
        aria-labelledby="home-heading"
        className="flex min-h-[60vh] flex-col items-center justify-center text-center"
      >
        <p className="mb-5 text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
          Product Designer
        </p>

        <h1
          id="home-heading"
          className="text-6xl font-semibold tracking-[-0.05em] sm:text-7xl lg:text-8xl"
        >
          Your Name
        </h1>
      </section>
    </>
  );
}
