"use client";

import { useEffect, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";

export function ResendCode({ email, cooldown }: { email: string | null; cooldown: number }) {
  const [seconds, setSeconds] = useState(Math.max(0, Math.ceil(cooldown)));

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  return (
    <>
      <form action="/api/auth/email/resend" method="post">
        <SubmitButton
          variant="outline"
          size="lg"
          className="w-full"
          disabled={seconds > 0 || !email}
          loadingText="Sending..."
        >
          Resend code
        </SubmitButton>
      </form>
      {seconds > 0 ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          You can send another code in {seconds} {seconds === 1 ? "second" : "seconds"}.
        </p>
      ) : null}
    </>
  );
}
