import type { EdgeTypes } from "reactflow";
import { DeletableEdge } from "./edges/deletable-edge";

export const edgeTypes: EdgeTypes = {
  default: DeletableEdge,
};