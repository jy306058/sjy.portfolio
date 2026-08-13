import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Footer } from "./components/footer";
import { Header } from "./components/header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Portfolio",
    template: "%s | Portfolio",
  },
  description: "Product designer portfolio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} antialiased`}>
        <div className="flex min-h-dvh flex-col bg-white text-black">
          <Header />

          <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
            {children}
          </main>

          <Footer />
        </div>
      </body>
    </html>
  );
}
