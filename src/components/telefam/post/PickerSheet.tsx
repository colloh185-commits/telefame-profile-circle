import { useEffect, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

export function PickerSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="mx-auto h-[85dvh] max-h-[85dvh] w-full max-w-lg rounded-t-3xl">
        <DrawerTitle className="px-4 pb-2 pt-3 text-base font-extrabold">{title}</DrawerTitle>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer && <div className="border-t p-3 pb-safe">{footer}</div>}
      </DrawerContent>
    </Drawer>
  );
}

/** Search box that reports a debounced value. */
export function SheetSearch({
  placeholder,
  onSearch,
  maxLength = 40,
  prefix,
}: {
  placeholder: string;
  onSearch: (q: string) => void;
  maxLength?: number;
  prefix?: string;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    const t = setTimeout(() => onSearch(text.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <div className="px-4 pb-2">
      <label className="flex h-10 items-center gap-2.5 rounded-full bg-muted px-3.5 text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-4 shrink-0" />
        {prefix && <span className="-mr-2 text-sm font-bold text-foreground">{prefix}</span>}
        <input
          autoFocus
          type="search"
          value={text}
          maxLength={maxLength}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button type="button" onClick={() => setText("")} aria-label="Clear search" className="text-muted-foreground">
            <X className="size-4" />
          </button>
        )}
      </label>
    </div>
  );
}

export function SheetMessage({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary [&_svg]:size-5">
        {icon}
      </span>
      {text}
    </div>
  );
}
