import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: {
        default: "Life Admin",
        template: "%s · Life Admin",
    },
    description: "A little less to remember. Keep your responsibilities, documents, and next steps together.",
    manifest: "/manifest.webmanifest",
    applicationName: "Life Admin",
    icons: {
        icon: [
            { url: "/favicon.svg", type: "image/svg+xml" },
            { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
        shortcut: "/favicon.svg",
        apple: "/icon-192.png",
    },
    appleWebApp: {
        capable: true,
        title: "Life Admin",
        statusBarStyle: "default",
    },
    formatDetection: {
        telephone: false,
    },
};

export const viewport: Viewport = {
    themeColor: "#19645c",
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
};

export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="en">
      <body className="antialiased">{children}</body>
    </html>);
}
