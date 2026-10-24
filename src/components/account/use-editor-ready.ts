"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
/** Stateful financial controls must not accept edits before their handlers are attached. */
export function useEditorReady() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
