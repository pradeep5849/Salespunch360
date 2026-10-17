"use client";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import type { AccountActionResult } from "@/lib/account/action-feedback";
const subscribeHydration=()=>()=>{};
const FeedbackContext = createContext<AccountActionResult | null>(null);
export function useAccountActionFeedback(){return useContext(FeedbackContext)}
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
  const hydrated=useSyncExternalStore(subscribeHydration,()=>true,()=>false);
  const router = useRouter(), formRef=useRef<HTMLFormElement>(null),feedbackRef=useRef<HTMLParagraphElement>(null);
  const successCallback = useRef(onSuccess);
  useEffect(() => {
    successCallback.current = onSuccess;
  }, [onSuccess]);
  const [state, formAction] = useActionState(
    async (_previous: AccountActionResult, form: FormData) => {
      try {
        const result=await action(form);
        if(result.kind==="success"&&result.message)successCallback.current?.();
        return result;
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
  useEffect(()=>{
    if(state.kind!=="error"||!state.message)return;
    const fields=Object.keys(state.fieldErrors??{}),control=Array.from(formRef.current?.elements??[]).find(element=>element instanceof HTMLElement&&fields.includes(element.getAttribute("name")??"")&&element.getAttribute("type")!=="hidden"&&!element.hasAttribute("disabled"));
    if(control instanceof HTMLElement)control.focus();else feedbackRef.current?.focus();
  },[state]);
  useEffect(() => {
    if (state.kind === "success" && state.message) {
      if (state.redirectTo) router.push(state.redirectTo);
      else router.refresh();
    }
  }, [state, router]);
  return (
    <FeedbackContext.Provider value={state}>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        onReset={(event) => event.preventDefault()}
      >
        {state.message && (
          <p
            ref={feedbackRef}
            tabIndex={-1}
            role={state.kind === "error" ? "alert" : "status"}
            className={`account-save-feedback ${state.kind}`}
          >
            {state.message}
          </p>
        )}
        <fieldset className="action-feedback-fields" disabled={!hydrated} style={{display:"contents"}}>{children}</fieldset>
      </form>
    </FeedbackContext.Provider>
  );
}
