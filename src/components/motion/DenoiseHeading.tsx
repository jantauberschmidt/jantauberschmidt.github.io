import type { ElementType } from "react";

type Props = {
  text: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
};

export default function DenoiseHeading({ text, as = "h2", className = "" }: Props) {
  const Tag = as as ElementType;

  return (
    <Tag className={`denoise-heading is-settled ${className}`} data-text={text}>
      {text}
    </Tag>
  );
}
