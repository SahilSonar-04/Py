"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ConnectionLineType,
  MiniMap,
  ReactFlowProvider,
  type Connection,
  type OnSelectionChangeParams,
} from "reactflow";
import "reactflow/dist/style.css";
import { useCanvasStore, isConnectionValid } from "@/store/canvas-store";
import { nodeTypes } from "./node-types";
import { edgeTypes } from "./edge-types";
import { BottomToolbar } from "./bottom-toolbar";
import { TopRightControls } from "./top-right-controls";
import { WorkflowHeader } from "./workflow-header";
import { HistoryPanel } from "./history-panel";
import type { PyEdge, PyNode } from "@/types/workflow";

const LOCKED_NODE_IDS = new Set(["request-inputs", "response"]);

type ConnectingInfo = {
  nodeId: string;
  handleId: string | null;
  handleType: "source" | "target";
};

export function WorkflowCanvas({
  workflowId,
  initialName,
  initialNodes,
  initialEdges,
}: {
  workflowId: string;
  initialName: string;
  initialNodes: PyNode[];
  initialEdges: PyEdge[];
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner
        workflowId={workflowId}
        initialName={initialName}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  workflowId,
  initialName,
  initialNodes,
  initialEdges,
}: {
  workflowId: string;
  initialName: string;
  initialNodes: PyNode[];
  initialEdges: PyEdge[];
}) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setWorkflow,
    setSelectedNodeIds,
    setHoveredEdgeId,
    removeNode,
    undo,
    redo,
    isDirty,
    markSaved,
    isRunning,
    setRunning,
    setNodeStatus,
  } = useCanvasStore();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [connectionInvalid, setConnectionInvalid] = useState(false);
  const initialized = useRef(false);
  const connectingRef = useRef<ConnectingInfo | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setWorkflow(workflowId, initialName, initialNodes, initialEdges);
  }, [workflowId, initialName, initialNodes, initialEdges, setWorkflow]);

  useEffect(() => {
    if (!isDirty) return;
    const timeout = setTimeout(async () => {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph: { nodes, edges } }),
      });
      markSaved();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [nodes, edges, isDirty, workflowId, markSaved]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isTyping = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName);
      if (isTyping) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && e.shiftKey) ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedNodeIds } = useCanvasStore.getState();
        selectedNodeIds.forEach((id) => {
          if (!LOCKED_NODE_IDS.has(id)) removeNode(id);
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, removeNode]);

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      setSelectedNodeIds(selected.map((n) => n.id));
    },
    [setSelectedNodeIds]
  );

  // --- Edge hover (for the delete × button) ---
  const onEdgeMouseEnter = useCallback(
    (_: unknown, edge: PyEdge) => setHoveredEdgeId(edge.id),
    [setHoveredEdgeId]
  );
  const onEdgeMouseLeave = useCallback(
    () => setHoveredEdgeId(null),
    [setHoveredEdgeId]
  );

  // --- Live invalid-connection feedback (red dashed line while dragging) ---
  const onConnectStart = useCallback(
    (
      _: unknown,
      params: { nodeId: string | null; handleId: string | null; handleType: string | null }
    ) => {
      if (!params.nodeId) return;
      connectingRef.current = {
        nodeId: params.nodeId,
        handleId: params.handleId,
        handleType: (params.handleType as "source" | "target") ?? "source",
      };
      setConnectionInvalid(false);
    },
    []
  );

  const onConnectEnd = useCallback(() => {
    connectingRef.current = null;
    setConnectionInvalid(false);
  }, []);

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const connecting = connectingRef.current;
      if (!connecting) return;

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const handleEl = el?.closest(".react-flow__handle") as HTMLElement | null;

      if (!handleEl) {
        setConnectionInvalid(false);
        return;
      }

      const targetNodeId = handleEl.getAttribute("data-nodeid");
      const targetHandleId = handleEl.getAttribute("data-handleid");
      const targetHandleType: "source" | "target" = handleEl.classList.contains("source")
        ? "source"
        : "target";

      if (!targetNodeId) {
        setConnectionInvalid(false);
        return;
      }

      const { nodes: currentNodes } = useCanvasStore.getState();
      const valid = isConnectionValid(
        currentNodes,
        connecting.nodeId,
        connecting.handleId,
        connecting.handleType,
        targetNodeId,
        targetHandleId,
        targetHandleType
      );
      setConnectionInvalid(!valid);
    }

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  const isValidConnectionFn = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return false;
      return isConnectionValid(
        nodes,
        connection.source,
        connection.sourceHandle ?? null,
        "source",
        connection.target,
        connection.targetHandle ?? null,
        "target"
      );
    },
    [nodes]
  );

  const connectionLineStyle = connectionInvalid
    ? { stroke: "#ef4444", strokeWidth: 2.5, strokeDasharray: "6 4" }
    : { stroke: "#6366f1", strokeWidth: 2.5 };

  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;

    async function poll() {
      const res = await fetch(`/api/runs?workflowId=${workflowId}`);
      const json = await res.json();
      const latestRun = json.runs?.[0];
      if (!latestRun || cancelled) return;

      for (const exec of latestRun.nodeExecutions) {
        const status =
          exec.status === "RUNNING"
            ? "running"
            : exec.status === "SUCCESS"
            ? "success"
            : exec.status === "FAILED"
            ? "failed"
            : "idle";
        setNodeStatus(exec.nodeId, status);
      }

      if (latestRun.status !== "RUNNING" && latestRun.status !== "PENDING") {
        setRunning(false);
      }
    }

    const interval = setInterval(poll, 1500);
    poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isRunning, workflowId, setNodeStatus, setRunning]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#fafafa]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        isValidConnection={isValidConnectionFn}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={connectionLineStyle}
        nodesDraggable
        deleteKeyCode={null}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap position="bottom-right" pannable zoomable className="!bg-white" />
      </ReactFlow>

      <WorkflowHeader workflowId={workflowId} />
      <TopRightControls workflowId={workflowId} onToggleHistory={() => setHistoryOpen((v) => !v)} />
      <BottomToolbar />
      <HistoryPanel workflowId={workflowId} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}