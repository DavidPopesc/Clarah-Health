import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Clara: answers about your health, from your own data",
  description: "A health companion that explains your records and checks whether everyday choices are safe with your medicines.",
};

export const viewport: Viewport = { themeColor: "#f6f7f5" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
      <body className="font-sans">
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground shadow-sm">
          {children}
        </div>
      </body>
    </html>
  );
}
