/**
 * Brand marks and per-provider presentation for task sources.
 *
 * Mirrors `calendar-provider-icons.tsx`: adding a provider is a single
 * entry here plus its backend implementation.
 */
import * as React from "react";

export function ClickUpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 18.44 5.69 15.6c1.96 2.56 4.04 3.74 6.36 3.74 2.3 0 4.33-1.17 6.2-3.71L22 18.4C19.3 22.07 15.94 24 12.05 24 8.17 24 4.78 22.08 2 18.44Z"
        fill="#FF02F0"
      />
      <path
        d="M12.04 5.42 5.47 11.1 2.5 7.65 12.05 0l9.47 7.66-2.99 3.43-6.49-5.67Z"
        fill="#00F0C3"
      />
    </svg>
  );
}

export interface IntegrationProviderConfig {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind classes for the source chip shown on task cards. */
  chipColor: string;
  /** What the user should expect after connecting. */
  blurb: string;
}

export const INTEGRATION_PROVIDER_CONFIG: Record<
  string,
  IntegrationProviderConfig
> = {
  clickup: {
    name: "ClickUp",
    icon: ClickUpIcon,
    chipColor: "#7B68EE",
    blurb:
      "Import tasks assigned to you. They land in your backlog — nothing is ever written back to ClickUp.",
  },
};

export function getIntegrationProviderConfig(
  provider: string
): IntegrationProviderConfig {
  return (
    INTEGRATION_PROVIDER_CONFIG[provider] ?? {
      name: provider,
      icon: ClickUpIcon,
      chipColor: "#6366F1",
      blurb: "",
    }
  );
}
