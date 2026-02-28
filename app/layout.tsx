import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: "Ink & Quill - Writing Project Management",
  description: "Organize your writing projects from start to finish",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="ink-and-quill-theme"
          themes={["light", "dark", "system"]}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
