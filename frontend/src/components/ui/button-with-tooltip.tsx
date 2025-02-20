import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ButtonWithTooltipProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltipContent?: React.ReactNode;
  showTooltip?: boolean;
  className?: string;
}

export const ButtonWithTooltip = ({
  tooltipContent,
  showTooltip = true,
  className,
  children,
  ...props
}: ButtonWithTooltipProps) => {
  if (!tooltipContent || !showTooltip) {
    return (
      <Button className={className} {...props}>
        {children}
      </Button>
    );
  }
  console.log(tooltipContent, showTooltip);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block w-full">
            <Button className={cn(className)} {...props}>
              {children}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ButtonWithTooltip;
