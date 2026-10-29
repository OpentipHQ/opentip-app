"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = ComponentProps<typeof Button> & {
  loadingText?: React.ReactNode;
};

export function SubmitButton({ loadingText, children, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} loadingText={loadingText} {...props}>
      {children}
    </Button>
  );
}
