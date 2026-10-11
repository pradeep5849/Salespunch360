"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";

export type SaveFeedbackState = {
  kind: "idle" | "success" | "error";
  message: string;
  id: number;
};
export const INITIAL_SAVE_FEEDBACK: SaveFeedbackState = {
  kind: "idle",
  message: "",
  id: 0,
};
export const SAVE_FEEDBACK_DISMISS_MS = 2500;

export async function executeSave(
  action: (data: FormData) => Promise<unknown>,
  data: FormData,
  id = Date.now(),
  errorMessages: Record<string,string> = {},
): Promise<SaveFeedbackState> {
  try {
    const result=await action(data);
    if(result&&typeof result==="object"&&"saveError" in result){
      const code=String(result.saveError);
      return {kind:"error",message:errorMessages[code]??"Unable to save. Check the details and try again.",id};
    }
    return { kind: "success", message: "Saved successfully", id };
  } catch (error) {
    return {
      kind: "error",
      message: (error instanceof Error ? errorMessages[error.message] : undefined) ?? "Unable to save. Check the details and try again.",
      id,
    };
  }
}

export function SaveFeedbackForm({
  action,
  className,
  children,
  successMessage = "Saved successfully",
  onSuccess,
  onChange,
  errorMessages,
}: {
  action: (data: FormData) => Promise<unknown>;
  className?: string;
  children: React.ReactNode;
  successMessage?: string;
  onSuccess?: () => void;
  onChange?: React.FormEventHandler<HTMLFormElement>;
  errorMessages?: Record<string,string>;
}) {
  const [state, formAction] = useActionState(
    async (previous: SaveFeedbackState, data: FormData) => {
      const next = await executeSave(action, data, previous.id + 1, errorMessages);
      return next.kind === "success"
        ? { ...next, message: successMessage }
        : next;
    },
    INITIAL_SAVE_FEEDBACK,
  );
  const successCallback = useRef(onSuccess);
  useEffect(() => {
    successCallback.current = onSuccess;
  }, [onSuccess]);
  useEffect(() => {
    if (state.kind === "success") successCallback.current?.();
  }, [state.kind, state.id]);
  return (
    <form action={formAction} className={className} onChange={onChange} onReset={event=>event.preventDefault()}>
      <SaveFeedback state={state} />
      {children}
    </form>
  );
}

export function SaveSubmitButton({
  children,
  pendingLabel = "Saving…",
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function SaveFeedback({ state }: { state: SaveFeedbackState }) {
  const [dismissedId, setDismissedId] = useState(0);
  useEffect(() => {
    if (state.kind !== "success") return;
    const timer = window.setTimeout(
      () => setDismissedId(state.id),
      SAVE_FEEDBACK_DISMISS_MS,
    );
    return () => window.clearTimeout(timer);
  }, [state.kind, state.id]);
  const visible = state.kind !== "idle" && state.id !== dismissedId;
  if (!visible) return null;
  return (
    <p
      className={`account-save-feedback ${state.kind}`}
      role={state.kind === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

export function useSaveMutation() {
  const [pending, setPending] = useState(false),
    [feedback, setFeedback] = useState(INITIAL_SAVE_FEEDBACK),
    active = useRef(false);
  const run = useCallback(
    async (
      action: () => Promise<unknown>,
      successMessage = "Saved successfully",
    ) => {
      if (active.current) return false;
      active.current = true;
      setPending(true);
      setFeedback(INITIAL_SAVE_FEEDBACK);
      try {
        await action();
        setFeedback({
          kind: "success",
          message: successMessage,
          id: Date.now(),
        });
        return true;
      } catch {
        setFeedback({
          kind: "error",
          message: "Unable to save. Check the details and try again.",
          id: Date.now(),
        });
        return false;
      } finally {
        active.current = false;
        setPending(false);
      }
    },
    [],
  );
  return { pending, feedback, run };
}

/** Settings autosaves are serialized; a rapid second edit must not be dropped. */
export function useQueuedSettingsSave(action:(data:FormData)=>Promise<unknown>) {
  const queue=useRef<Promise<unknown>>(Promise.resolve()),generation=useRef(0);
  const [feedback,setFeedback]=useState(INITIAL_SAVE_FEEDBACK),[pending,setPending]=useState(false);
  const save=(data:FormData)=>{
    const id=++generation.current;setPending(true);
    queue.current=queue.current.catch(()=>undefined).then(async()=>{
      const result=await executeSave(action,data,id);
      if(id===generation.current){setFeedback(result);setPending(false);}
    });
    return queue.current;
  };
  return {save,feedback,pending};
}

export function SavePendingFields({children}:{children:React.ReactNode}){const {pending}=useFormStatus();return <fieldset disabled={pending} style={{display:"contents"}}>{children}</fieldset>}
