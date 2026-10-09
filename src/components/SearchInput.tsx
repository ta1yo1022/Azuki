import { useEffect, useRef, useState, type ComponentProps } from "react";

type Props = Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "onCompositionStart" | "onCompositionEnd"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** Keep IME composition local: URL navigation must wait for committed text. */
export function SearchInput({ value, onValueChange, ...props }: Props) {
  const [draft, setDraft] = useState(value);
  const composing = useRef(false);
  useEffect(() => {
    if (!composing.current) setDraft(value);
  }, [value]);
  return <input {...props} value={draft}
    onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={event => {
      composing.current = false;
      const next = event.currentTarget.value;
      setDraft(next);
      if (next !== value) onValueChange(next);
    }}
    onChange={event => {
      const next = event.currentTarget.value;
      setDraft(next);
      if (!composing.current && !(event.nativeEvent as InputEvent).isComposing && next !== value) onValueChange(next);
    }}
  />;
}
