import React from "react";
import { createRoot } from "react-dom/client";
import { Workbook } from "@lofcz/tinysheet-react";
import { sample } from "./sample";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  // Uncontrolled theme: starts from the OS preference; the toolbar's theme
  // switch (Light / Dark / System) changes it.
  <Workbook data={sample} defaultTheme="auto" />
);
