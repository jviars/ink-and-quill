"use client"

import { useTheme } from "next-themes"

interface QuillLogoProps {
  className?: string
}

export function InkAndQuillLogo({ className = "" }: QuillLogoProps) {
  const { resolvedTheme } = useTheme()

  // Get the appropriate color based on theme
  const getColor = () => {
    if (resolvedTheme === "dark") {
      return "#FFFFFF" // White for dark theme
    } else {
      return "#000000" // Black for light theme
    }
  }

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M19.82 4.73C19.82 4.73 17.33 3.75 14.13 6.42C10.93 9.09 9.33 15.63 9.33 15.63L11.17 14.63C11.17 14.63 11.22 13.16 11.53 12.36C11.83 11.55 12.22 11.14 12.22 11.14C12.22 11.14 12.09 12.33 12.31 13.14C12.53 13.95 12.97 14.89 12.97 14.89L14.92 13.88C14.92 13.88 15.18 12.22 15.59 11.23C16 10.23 16.71 9.33 16.71 9.33C16.71 9.33 16.4 10.69 16.45 11.7C16.5 12.71 16.81 13.63 16.81 13.63L18.97 12.53C18.97 12.53 19.82 8.48 19.82 6.73C19.82 4.98 19.82 4.73 19.82 4.73Z"
        stroke={getColor()}
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.17 14.63L8.5 16.17L7.5 18.17L9.17 19.83L11.17 18.83L12.97 14.89"
        stroke={getColor()}
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.81 13.63L14.92 13.88L12.97 14.89"
        stroke={getColor()}
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
