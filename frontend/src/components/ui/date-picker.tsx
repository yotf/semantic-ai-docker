/* eslint-disable react/jsx-boolean-value */
/* eslint-disable react/jsx-curly-brace-presence */
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

export default function DatePicker({
  onSelect,
  value,
  placeholder,
}: {
  onSelect: (date: Date) => void;
  value?: Date;
  placeholder?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[200px] justify-start text-left font-normal py-1 dark:bg-blue-grey-500",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 " />
          {value ? (
            format(value, "PPP")
          ) : (
            <span className="text-gray-400">
              {placeholder ?? "Pick a Date"}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onSelect}
          autoFocus
          required={true}
        />
      </PopoverContent>
    </Popover>
  );
}
