import React from "react";
import { createRoot } from "react-dom/client";
import { Workbook } from "@lofcz/tinysheet-react";
import { sample } from "./sample";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <Workbook data={sample} theme="auto" />
);
