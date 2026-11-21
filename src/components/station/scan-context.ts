"use client";
import { createContext, useContext } from "react";

export const ScanContext = createContext<{
  openScanner: (purpose?: "lookup" | "register") => void;
  openKeypad: (purpose?: "lookup" | "register") => void;
  readOnly: boolean;
}>({ openScanner: () => {}, openKeypad: () => {}, readOnly: false });

export const useScan = () => useContext(ScanContext);
