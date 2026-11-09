import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOL // Plan dnia",
  description: "Planowanie pracy magazynu ESTYL.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
