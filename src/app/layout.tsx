import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { identity, links, mission } from "@/content/profile";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = `https://${identity.domain}`;
const description =
  "Electrical engineering researcher building autonomous robotics, digital twins and edge AI. Six papers, two research labs, three ventures. Research assistant at Pakistan's National Center of Artificial Intelligence.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${identity.fullName} — AI, Robotics & Digital Twins`,
    template: `%s — ${identity.fullName}`,
  },
  description,
  keywords: [
    "Ayaan Aatif",
    "Hafiz Ayaan Aatif",
    "robotics researcher",
    "digital twin",
    "ROS2",
    "autonomous systems",
    "edge AI",
    "computer vision",
    "FPGA",
    "NUST",
    "NCAI Pakistan",
    "AyroX Labs",
    "TwinVerse",
  ],
  authors: [{ name: identity.fullName, url: siteUrl }],
  creator: identity.fullName,
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "profile",
    url: siteUrl,
    siteName: `${identity.fullName} — Portfolio`,
    title: `${identity.fullName} — AI, Robotics & Digital Twins`,
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${identity.fullName} — AI, Robotics & Digital Twins`,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#04060b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/** Structured data so search engines resolve the person, not just the page. */
const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: identity.fullName,
  alternateName: identity.shortName,
  url: siteUrl,
  email: identity.email,
  jobTitle: "Robotics & Autonomous Systems Researcher",
  description: mission.headline,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Islamabad",
    addressCountry: "PK",
  },
  affiliation: [
    {
      "@type": "Organization",
      name: "National University of Sciences and Technology (NUST)",
    },
    {
      "@type": "Organization",
      name: "National Center of Artificial Intelligence (NCAI)",
    },
  ],
  knowsAbout: [
    "Robotics",
    "Digital Twins",
    "Computer Vision",
    "Embedded Systems",
    "Machine Learning",
  ],
  sameAs: [links.github, links.linkedin, links.scholar, links.orcid],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          // Static, build-time constant — no user input reaches this.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />
        {children}
      </body>
    </html>
  );
}
