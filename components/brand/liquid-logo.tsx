import Image from "next/image";
import { cn } from "@/lib/utils";

export function LiquidLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/liquid-logo.png"
      alt="Liquid Intelligent Technologies"
      width={786}
      height={250}
      priority={priority}
      className={cn("h-auto w-full object-contain", className)}
    />
  );
}
