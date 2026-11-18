import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ourem Gen 2 - Operasional & Reimbursement",
  description: "Sistem Manajemen Reimbursement & Operasional Ourem",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="color-scheme" content="dark light" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function applyDeviceTheme() {
                  try {
                    var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var root = document.documentElement;
                    if (isDark) {
                      root.classList.add('dark');
                      root.classList.remove('light');
                      root.style.colorScheme = 'dark';
                    } else {
                      root.classList.add('light');
                      root.classList.remove('dark');
                      root.style.colorScheme = 'light';
                    }
                  } catch (e) {}
                }
                applyDeviceTheme();
                try {
                  var media = window.matchMedia('(prefers-color-scheme: dark)');
                  if (media.addEventListener) {
                    media.addEventListener('change', applyDeviceTheme);
                  } else if (media.addListener) {
                    media.addListener(applyDeviceTheme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
