import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Birth Weight Risk — a predictive model for low birth weight",
  description:
    "Interactive logistic-regression model trained on 95k pregnancies to identify factors that drive low birth weight.",
  openGraph: {
    title: "Birth Weight Risk",
    description:
      "Interactive logistic-regression model trained on 95k pregnancies to identify factors that drive low birth weight.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Nav />
        <main>{children}</main>
        <footer className="border-t py-8">
          <div className="container flex flex-col items-center justify-between gap-2 md:flex-row">
            <p className="text-xs text-muted-foreground">
              Research project — not medical advice. Built with Next.js and a Python-trained logistic regression.
            </p>
            <p className="text-xs text-muted-foreground">
              Dataset: US natality, n ≈ 95,000 pregnancies (after cleaning).
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
