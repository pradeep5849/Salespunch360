"use client";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import type { AccountActionResult } from "@/lib/account/action-feedback";
const FeedbackContext = createContext<AccountActionResult | null>(null);
export function useAccountFieldError(name: string) {
  return useContext(FeedbackContext)?.fieldErrors?.[name];
}
export function AccountFieldError({ name, id }: { name: string; id?: string }) {
  const error = useAccountFieldError(name);
  return error ? (
    <span id={id ?? `${name}-error`} role="alert">
      {error}
    </span>
  ) : null;
}
export function ActionFeedbackForm({
  action,
  children,
  className,
  onSuccess,
}: {
  action: (form: FormData) => Promise<AccountActionResult>;
  children: React.ReactNode;
  className?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const successCallback = useRef(onSuccess);
  useEffect(() => {
    successCallback.current = onSuccess;
  }, [onSuccess]);
  const [state, formAction] = useActionState(
    async (_previous: AccountActionResult, form: FormData) => {
      try {
        return await action(form);
      } catch {
        return {
          kind: "error",
          message:
            "Connection interrupted. Your inputs were kept; try again when online.",
        } as AccountActionResult;
      }
    },
    { kind: "success", message: "" } as AccountActionResult,
  );
  useEffect(() => {
    if (state.kind === "success" && state.message) {
      if (state.redirectTo) router.push(state.redirectTo);
      else router.refresh();
      successCallback.current?.();
    }
  }, [state, router]);
  return (
    <FeedbackContext.Provider value={state}>
      <form action={formAction} className={className}>
        {state.message && (
          <p
            role={state.kind === "error" ? "alert" : "status"}
            className={`account-save-feedback ${state.kind}`}
          >
            {state.message}
          </p>
        )}
        {children}
      </form>
    </FeedbackContext.Provider>
  );
}
