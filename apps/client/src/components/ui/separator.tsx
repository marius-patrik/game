import { cn } from "@/lib/utils";

export function Separator({
  orientation = "horizontal",
  decorative = true,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}) {
  const vertical = orientation === "vertical";
  const classes = cn(
    "shrink-0 bg-border/50",
    vertical ? "h-full w-px self-stretch" : "h-px w-full",
    className,
  );

  return <div aria-hidden={decorative ? true : undefined} className={classes} {...props} />;
}
