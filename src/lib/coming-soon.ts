import { toast } from "sonner";

export function comingSoon(feature: string) {
  toast(`${feature} — coming soon`, {
    id: `soon-${feature}`,
    description: "We're still building this. Stay tuned!",
  });
}
