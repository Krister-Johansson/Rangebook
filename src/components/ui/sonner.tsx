import { useStore } from "@tanstack/react-store"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { uiStore } from "#/lib/ui-store"

// The theme lives in the app's own store (src/lib/ui-store.ts), not next-themes.
// On phones the toasts sit above the bottom tab bar and the home indicator.
const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useStore(uiStore, (s) => s.theme)

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      mobileOffset={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
