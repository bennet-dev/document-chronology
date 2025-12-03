"use client";

import { useStore } from "@/lib/store";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d").then((mod) => mod.default),
  { ssr: false }
);

interface GraphNode {
  id: string;
  type: "date" | "page";
  label: string;
}

interface GraphLink {
  source: string;
  target: string;
}

export default function GraphPage() {
  const ocrResults = useStore((state) => state.ocrResults);
  console.log(ocrResults);

  const graphData = useMemo(() => {
    if (!ocrResults?.connections) {
      return { nodes: [], links: [] };
    }

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeIds = new Set<string>();

    ocrResults.connections.forEach((connection) => {
      const dateId = `date-${connection.date}`;
      const pageId = `page-${connection.pageNumber}`;

      // Add date node if not already added
      if (!nodeIds.has(dateId)) {
        nodes.push({
          id: dateId,
          type: "date",
          label: connection.date,
        });
        nodeIds.add(dateId);
      }

      // Add page node if not already added
      if (!nodeIds.has(pageId)) {
        nodes.push({
          id: pageId,
          type: "page",
          label: `Page ${connection.pageNumber}`,
        });
        nodeIds.add(pageId);
      }

      // Add link
      links.push({
        source: pageId,
        target: dateId,
      });
    });

    return { nodes, links };
  }, [ocrResults]);

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            Document Graph
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            Visual representation of page-date connections
          </p>

          {graphData.nodes.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
              <p>
                No graph data available. Process a document to see connections.
              </p>
            </div>
          ) : (
            <div className="border border-zinc-300 dark:border-zinc-600 rounded-lg overflow-hidden bg-white ">
              <ForceGraph2D
                graphData={graphData}
                width={1200}
                height={800}
                nodeLabel="label"
                nodeAutoColorBy="type"
                // ✅ keep default node + hit area, draw your custom stuff on top
                nodeCanvasObjectMode={() => "after"}
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                  const label = node.label;
                  const fontSize = 12 / globalScale;
                  ctx.font = `${fontSize}px Sans-Serif`;
                  const textWidth = ctx.measureText(label).width;
                  const bckgDimensions = [textWidth, fontSize].map(
                    (n) => n + fontSize * 0.4
                  );

                  // Draw node circle
                  ctx.fillStyle = node.type === "date" ? "#3b82f6" : "#10b981";
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI);
                  ctx.fill();

                  // Draw label background
                  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                  ctx.fillRect(
                    node.x - bckgDimensions[0] / 2,
                    node.y - bckgDimensions[1] / 2,
                    bckgDimensions[0],
                    bckgDimensions[1]
                  );

                  // Draw label text
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillStyle = "#000";
                  ctx.fillText(label, node.x, node.y);
                }}
                // ✅ explicit hit area (so dragging/hover works reliably)
                nodePointerAreaPaint={(node: any, color, ctx) => {
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI);
                  ctx.fill();
                }}
                // ✅ make sure interactions aren’t accidentally disabled
                enableNodeDrag={true}
                // enableZoomPanInteraction={true}
                linkDirectionalParticles={4}
                linkDirectionalParticleWidth={4}
                linkDirectionalParticleSpeed={0.006}
                linkDirectionalParticleColor={() => "rgba(255,255,255,0.95)"}
                linkColor={() => "rgba(5,5,5,1)"}
                linkWidth={() => 4.8}
                linkLineDash={[2, 2]}
              />
            </div>
          )}

          <div className="mt-6 flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span className="text-zinc-700 dark:text-zinc-300">
                Date Nodes
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-zinc-700 dark:text-zinc-300">
                Page Nodes
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
