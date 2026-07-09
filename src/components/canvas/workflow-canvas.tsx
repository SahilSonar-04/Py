"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ReactFlowProvider,
  useReactFlow,
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
import { MinimapToggle } from "./minimap-toggle";
import { BottomLeftControls, useAutoArrange } from "./bottom-left-controls";
import { KeyboardShortcutsModal } from "./keyboard-shortcuts-modal";
import { NodePicker } from "./node-picker";
import { nanoid } from "nanoid";
import type {
  NodeExecutionView,
  PyEdge,
  PyNode,
  ResponseData,
  ResponseSlot,
  WorkflowRunView,
} from "@/types/workflow";

const LOCKED_NODE_IDS = new Set(["request-inputs", "response"]);

type ConnectingInfo = {
  nodeId: string;
  handleId: string | null;
  handleType: "source" | "target";
};

function applyRunExecutionsToStore(nodeExecutions: NodeExecutionView[]) {
  const { setNodeStatus, updateNodeData } = useCanvasStore.getState();

  for (const exec of nodeExecutions) {
    const status =
      exec.status === "RUNNING"
        ? "running"
        : exec.status === "SUCCESS"
        ? "success"
        : exec.status === "FAILED"
        ? "failed"
        : exec.status === "SKIPPED"
        ? "skipped"
        : "idle";
    setNodeStatus(exec.nodeId, status);

    if (exec.status === "SUCCESS" && exec.output && typeof exec.output === "object") {
      const output = exec.output as Record<string, unknown>;

      if (exec.nodeType === "crop_image" && typeof output.output_image === "string") {
        updateNodeData(exec.nodeId, { outputImageUrl: output.output_image, error: undefined });
      } else if (exec.nodeType === "gemini" && typeof output.response === "string") {
        updateNodeData(exec.nodeId, { response: output.response, error: undefined });
      } else if (exec.nodeType === "response") {

        const currentNode = useCanvasStore.getState().nodes.find((n) => n.id === exec.nodeId);
        const currentSlots: ResponseSlot[] =
          currentNode && currentNode.type === "response"
            ? (currentNode.data as ResponseData).slots ?? []
            : [];

        const nextSlots: ResponseSlot[] = [...currentSlots];
        for (const [edgeId, entry] of Object.entries(output)) {
          const { label, value } = (entry ?? {}) as { label?: string; value?: unknown };
          const stringValue =
            typeof value === "string" ? value : value != null ? JSON.stringify(value) : "";
          const existingIndex = nextSlots.findIndex((s) => s.id === edgeId);
          if (existingIndex >= 0) {
            nextSlots[existingIndex] = {
              ...nextSlots[existingIndex],
              label: label ?? nextSlots[existingIndex].label,
              value: stringValue,
            };
          } else {
            nextSlots.push({ id: edgeId, label: label ?? edgeId, value: stringValue });
          }
        }

        updateNodeData(exec.nodeId, { slots: nextSlots });
      }
    }

    if (exec.status === "FAILED" && exec.error) {
      updateNodeData(exec.nodeId, { error: exec.error });
    }
  }
}

function isTerminalRunStatus(status: WorkflowRunView["status"]) {
  return status !== "RUNNING" && status !== "PENDING";
}

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
  } = useCanvasStore();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [connectionInvalid, setConnectionInvalid] = useState(false);
  const [contextPicker, setContextPicker] = useState<{
    anchor: { x: number; y: number };
    spawnAt: { x: number; y: number };
  } | null>(null);
  const initialized = useRef(false);
  const connectingRef = useRef<ConnectingInfo | null>(null);
  const clipboardRef = useRef<PyNode[]>([]);
  const { zoomIn, zoomOut, fitView, screenToFlowPosition } = useReactFlow();
  const handleAutoArrange = useAutoArrange();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setWorkflow(workflowId, initialName, initialNodes, initialEdges);
  }, [workflowId, initialName, initialNodes, initialEdges, setWorkflow]);

  useEffect(() => {
    let cancelled = false;

    async function reconcile() {
      try {
        const res = await fetch(`/api/runs?workflowId=${workflowId}`);
        if (!res.ok) return;
        const json = await res.json();
        const latestRun: WorkflowRunView | undefined = json.runs?.[0];
        if (!latestRun || cancelled) return;

        applyRunExecutionsToStore(latestRun.nodeExecutions);


        if (!isTerminalRunStatus(latestRun.status)) {
          setRunning(true);
        }
      } catch {
        // Transient network/API hiccup - just try again on the next tick
      }
    }

    reconcile();
    return () => {
      cancelled = true;
    };
  }, [workflowId, setRunning]);

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
      if (shortcutsOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShortcutsOpen(false);
        }
        return;
      }

      if (isTyping) return;

      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((meta && e.key.toLowerCase() === "z" && e.shiftKey) || (meta && e.key.toLowerCase() === "y")) {
        e.preventDefault();
        redo();
        return;
      }

      if (meta && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const { nodes: currentNodes, setNodes: setNodesStore } = useCanvasStore.getState();
        setNodesStore(currentNodes.map((n) => ({ ...n, selected: true })));
        setSelectedNodeIds(currentNodes.map((n) => n.id));
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        useCanvasStore.getState().clearSelection();
        return;
      }

      if (meta && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const { nodes: currentNodes, selectedNodeIds: selected } = useCanvasStore.getState();
        clipboardRef.current = currentNodes
          .filter((n) => selected.includes(n.id) && !LOCKED_NODE_IDS.has(n.id))
          .map((n) => ({ ...n, data: { ...n.data } }));
        return;
      }

      if (meta && e.key.toLowerCase() === "v") {
        e.preventDefault();
        if (clipboardRef.current.length === 0) return;
        const { nodes: currentNodes, setNodes: setNodesStore, pushHistory } = useCanvasStore.getState();
        const pasted: PyNode[] = clipboardRef.current.map((n) => ({
          ...n,
          id: `${n.type}_${nanoid(8)}`,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
          selected: true,
          data: { ...n.data, status: "idle", error: undefined } as PyNode["data"],
        }));
        pushHistory();
        setNodesStore([...currentNodes.map((n) => ({ ...n, selected: false })), ...pasted]);
        setSelectedNodeIds(pasted.map((n) => n.id));
        return;
      }

      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const { selectedNodeIds: selected, duplicateNode } = useCanvasStore.getState();
        selected.forEach((id) => {
          if (!LOCKED_NODE_IDS.has(id)) duplicateNode(id, e.shiftKey);
        });
        return;
      }

      if (!meta && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        zoomIn({ duration: 200 });
        return;
      }
      if (!meta && e.key === "-") {
        e.preventDefault();
        zoomOut({ duration: 200 });
        return;
      }
      if (!meta && !e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        fitView({ padding: 0.2, duration: 300 });
        return;
      }
      if (!meta && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setSelectMode((v) => !v);
        return;
      }
      if (!meta && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleAutoArrange();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedNodeIds: selected } = useCanvasStore.getState();
        selected.forEach((id) => {
          if (!LOCKED_NODE_IDS.has(id)) removeNode(id);
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, removeNode, setSelectedNodeIds, zoomIn, zoomOut, fitView, handleAutoArrange, shortcutsOpen]);

  const onSelectionChange = useCallback(
    ({ nodes: selected }: OnSelectionChangeParams) => {
      setSelectedNodeIds(selected.map((n) => n.id));
    },
    [setSelectedNodeIds]
  );

  function isTextEditable(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
  }

  const onWorkspaceContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (isTextEditable(event.target)) return;
      event.preventDefault();
      const anchor = { x: event.clientX, y: event.clientY };
      const spawnAt = screenToFlowPosition(anchor);
      setContextPicker({ anchor, spawnAt });
    },
    [screenToFlowPosition]
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

  // --- Live polling while a run is actively in progress ---
  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/runs?workflowId=${workflowId}`);
        if (!res.ok) return;
        const json = await res.json();
        const latestRun: WorkflowRunView | undefined = json.runs?.[0];
        if (!latestRun || cancelled) return;

        applyRunExecutionsToStore(latestRun.nodeExecutions);

        if (isTerminalRunStatus(latestRun.status)) {
          setRunning(false);
        }
      } catch {
        // Transient network/API hiccup - just try again on the next tick
        // rather than letting an unhandled rejection silently kill polling.
      }
    }

    const interval = setInterval(poll, 1500);
    poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isRunning, workflowId, setRunning]);

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
        onPaneContextMenu={onWorkspaceContextMenu}
        onNodeContextMenu={onWorkspaceContextMenu}
        onEdgeContextMenu={onWorkspaceContextMenu}
        onSelectionContextMenu={onWorkspaceContextMenu}
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
        panOnDrag={!selectMode}
        selectionOnDrag={selectMode}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>

      <WorkflowHeader workflowId={workflowId} />
      <TopRightControls
        workflowId={workflowId}
        onToggleHistory={() => setHistoryOpen((v) => !v)}
        historyOpen={historyOpen}
      />
      <BottomToolbar historyOpen={historyOpen} />
      <div className="pointer-events-none absolute bottom-4 left-4 z-20">
        <BottomLeftControls
          selectMode={selectMode}
          onToggleSelectMode={() => setSelectMode((v) => !v)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />
      </div>
      <MinimapToggle historyOpen={historyOpen} />
      <HistoryPanel workflowId={workflowId} open={historyOpen} onClose={() => setHistoryOpen(false)} />
      {shortcutsOpen && <KeyboardShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      {contextPicker && (
        <NodePicker
          anchor={contextPicker.anchor}
          spawnAt={contextPicker.spawnAt}
          onClose={() => setContextPicker(null)}
        />
      )}
    </div>
  );
}