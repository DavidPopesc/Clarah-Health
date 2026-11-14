import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { DesktopNav } from "@/components/desktop-nav";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Clara: answers about your health, from your own data",
  description: "A health companion that explains your records and checks whether everyday choices are safe with your medicines.",
};

export const viewport: Viewport = { themeColor: "#3c5a4e" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} antialiased`}>
      <body className="font-sans">
        <DesktopNav />
        <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col app-shell">
          {children}
        </div>
      </body>
    </html>
  );
}
