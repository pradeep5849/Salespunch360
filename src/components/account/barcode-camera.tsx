"use client";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import styles from "./barcode-camera.module.css";

export function BarcodeCamera({onDetected,onClose}:{onDetected:(value:string)=>void;onClose:()=>void}){
 const video=useRef<HTMLVideoElement>(null),panel=useRef<HTMLElement>(null),[error,setError]=useState("");
 useEffect(()=>{
  const previous=document.activeElement;
  panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  function trap(event:KeyboardEvent){if(event.key!=="Tab")return;const buttons=panel.current?.querySelectorAll<HTMLButtonElement>("button");if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
  document.addEventListener("keydown",trap);
  return()=>{document.removeEventListener("keydown",trap);if(previous instanceof HTMLElement&&previous.isConnected)previous.focus()};
 },[]);
 useEffect(()=>{
  let cancelled=false,controls:IScannerControls|undefined,ownedStream:MediaStream|undefined;
  const element=video.current;
  function stop(){controls?.stop();ownedStream?.getTracks().forEach(track=>track.stop());const stream=element?.srcObject;if(typeof MediaStream!=="undefined"&&stream instanceof MediaStream)stream.getTracks().forEach(track=>track.stop());if(element)element.srcObject=null}
  function escape(event:KeyboardEvent){if(event.key==="Escape")onClose()}
  document.addEventListener("keydown",escape);
  void (async()=>{
   try{
    if(!navigator.mediaDevices?.getUserMedia||!element)throw new Error("CAMERA_UNAVAILABLE");
    const {BrowserMultiFormatReader}=await import("@zxing/browser");
    if(cancelled)return;
    const reader=new BrowserMultiFormatReader();
    ownedStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
    if(cancelled){stop();return}
    controls=await reader.decodeFromStream(ownedStream,element,(result,_error,scanner)=>{
     if(result&&!cancelled){cancelled=true;scanner.stop();stop();onDetected(result.getText())}
    });
    if(cancelled)stop();
   }catch(cause){
    stop();if(cancelled)return;
    const name=cause instanceof Error?cause.name:"";
    setError(name==="NotAllowedError"?"Camera access was denied. Allow camera access or enter the barcode manually.":name==="NotFoundError"?"No camera was found. Enter the barcode manually.":"The camera could not start. Check camera access or enter the barcode manually.");
   }
  })();
  return()=>{cancelled=true;document.removeEventListener("keydown",escape);stop()};
 },[onDetected,onClose]);
 return <div className={styles.overlay}><section ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="barcode-camera-title"><header><h2 id="barcode-camera-title">Scan item barcode</h2><button type="button" onClick={onClose} aria-label="Close camera">×</button></header>{error?<p role="alert">{error}</p>:<><video ref={video} autoPlay muted playsInline aria-label="Barcode camera preview"/><p>Point the camera at the item barcode.</p></>}<button type="button" onClick={onClose}>Use manual entry</button></section></div>;
}
