import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cinch",
  description: "The accountability layer for human behavior.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
