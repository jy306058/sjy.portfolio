import type { Metadata } from "next";
import { InteractiveBackground } from "./components/InteractiveBackground";

export const metadata: Metadata = {
  title: "Home",
};

export default function Home() {
  return (
    <>
      <InteractiveBackground />

      {/* 화면에는 달과 윤슬만 남기고 비워 둔다. 제목은 스크린 리더와 검색엔진을
          위해 남겨 두되 시각적으로는 감춘다. */}
      <section
        aria-labelledby="home-heading"
        className="min-h-[60vh]"
      >
        <h1 id="home-heading" className="sr-only">
          Your Name — Product Designer
        </h1>
      </section>
    </>
  );
}
