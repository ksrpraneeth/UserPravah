import {
  IOutputGenerator,
  OutputGenerationOptions,
  GeneratedOutput,
} from "../../core/output-generator.interface.js";
import { AnalysisResult, RouteNode, FlowEdge } from "../../core/types.js";
import { digraph, toDot, attribute } from "ts-graphviz";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export class DotGenerator implements IOutputGenerator {
  getFormatName(): string {
    return "dot";
  }

  getFileExtension(): string {
    return ".dot";
  }

  getSupportedOptions(): string[] {
    return [
      "outputDirectory",
      "filename",
      "generateImage",
      "layout", // 'LR', 'TB', 'BT', 'RL'
      "theme", // 'light', 'dark'
      "rankdir",
      "splines",
      "nodesep",
      "ranksep",
    ];
  }

  validateOptions(options: OutputGenerationOptions): string[] {
    const errors: string[] = [];

    if (!options.outputDirectory) {
      errors.push("outputDirectory is required");
    } else if (!fs.existsSync(options.outputDirectory)) {
      errors.push(`outputDirectory does not exist: ${options.outputDirectory}`);
    }

    if (options.layout && !["LR", "TB", "BT", "RL"].includes(options.layout)) {
      errors.push("layout must be one of: LR, TB, BT, RL");
    }

    if (
      options.theme &&
      options.theme !== "" &&
      !["light", "dark"].includes(options.theme)
    ) {
      errors.push("theme must be one of: light, dark");
    }

    return errors;
  }

  async generate(
    analysisResult: AnalysisResult,
    options: OutputGenerationOptions
  ): Promise<GeneratedOutput> {
    console.log("🎨 Starting DOT graph generation...");

    // Set default options
    const defaultOptions = {
      filename: "user-flows",
      generateImage: true,
      layout: "LR",
      theme: "light",
      rankdir: "LR",
      splines: "polyline",
      nodesep: 1.5,
      ranksep: 2.2,
      ...options,
    };

    // Create the graph
    const graph = this.createGraph(analysisResult, defaultOptions);

    // Generate the DOT content
    const dotContent = toDot(graph);

    // Write DOT file
    const dotPath = path.join(
      defaultOptions.outputDirectory,
      `${defaultOptions.filename}.dot`
    );
    fs.writeFileSync(dotPath, dotContent);

    const result: GeneratedOutput = {
      filePath: dotPath,
      format: this.getFormatName(),
      additionalFiles: [],
    };

    // Generate image if requested
    if (defaultOptions.generateImage) {
      try {
        const imagePath = await this.generateImage(dotPath, defaultOptions);
        result.additionalFiles = [imagePath];
      } catch (error) {
        console.warn(
          "⚠️ Could not generate image (Graphviz may not be installed):",
          error
        );
      }
    }

    console.log(`✅ DOT file generated: ${dotPath}`);
    return result;
  }

  private createGraph(analysisResult: AnalysisResult, options: any): any {
    // Create the main graph with styling optimized for compact layout
    const g = digraph("AngularFlows", {
      rankdir: options.rankdir || "LR",
      splines: "ortho", // Use orthogonal lines for perfectly organized right angles
      nodesep: 0.8, // Reduced spacing between nodes
      ranksep: 1.5, // Reduced spacing between ranks
      overlap: false,
      concentrate: true, // Merge edges for cleaner layout
      compound: true,
      pack: true, // Pack components tightly
      packmode: "graph", // Pack the entire graph
    });

    // Apply theme-based styling
    this.applyTheme(g, options.theme || "light");

    // Convert analysis results to graph structure
    const { routeNodes, flowEdges } =
      this.convertAnalysisToGraphData(analysisResult);

    console.log(
      `📊 Creating graph with ${routeNodes.size} nodes and ${flowEdges.length} edges`
    );

    // Create nodes with improved styling
    for (const [routePath, node] of routeNodes.entries()) {
      const color = this.getNodeColor(
        node.category,
        node.importance,
        options.theme
      );
      const fontColor = this.getFontColor(options.theme);

      // Special styling for root node
      if (routePath === "ROOT") {
        g.createNode(node.id, {
          label: node.displayName,
          fillcolor: "#FF6B35",
          fontcolor: fontColor as any,
          style: "filled,rounded",
          penwidth: 3,
          fontsize: options.theme === "dark" ? 16 : 15, // Larger font for root node
          shape: "ellipse", // Different shape for root
        });
      } else {
        g.createNode(node.id, {
          label: `${node.displayName}\\n(${node.originalPath.replace(
            /"/g,
            '\\"'
          )})`,
          fillcolor: color,
          fontcolor: fontColor as any,
          style: "filled,rounded",
          penwidth: 2,
          fontsize: options.theme === "dark" ? 13 : 12, // Larger font for dark theme
          width: 2.0, // Fixed width for consistency
          height: 0.8, // Fixed height for consistency
        });
      }
    }

    // Create edges with improved styling
    const existingEdges = new Set<string>();
    for (const edge of flowEdges) {
      const sourceNode = routeNodes.get(edge.source);
      let targetNode = routeNodes.get(edge.target);

      // If target is not found by key, try to find by path (for redirects)
      if (!targetNode && edge.type === "redirect") {
        for (const [key, node] of routeNodes.entries()) {
          if (node.originalPath === edge.target) {
            targetNode = node;
            edge.target = key; // Update to use the key
            break;
          }
        }
      }

      // Handle parameterized routes
      if (!targetNode && edge.target) {
        for (const [key, rn] of routeNodes.entries()) {
          const patternText = rn.originalPath.replace(/:[^\\/]+/g, "[^/]+");
          const regex = new RegExp(`^${patternText}$`);
          if (regex.test(edge.target)) {
            targetNode = rn;
            edge.target = key; // Update to use the key
            break;
          }
        }
      }

      if (sourceNode && targetNode) {
        const edgeKey = `${sourceNode.id}->${targetNode.id}->${
          edge.type
        }${edge.label ? "->" + edge.label : ""}`;
        if (!existingEdges.has(edgeKey)) {
          const edgeAttrs = this.getEdgeAttributes(edge, options.theme);
          g.createEdge([sourceNode.id, targetNode.id], edgeAttrs);
          existingEdges.add(edgeKey);
        }
      }
    }

    return g;
  }

  private convertAnalysisToGraphData(analysisResult: AnalysisResult): {
    routeNodes: Map<string, RouteNode>;
    flowEdges: FlowEdge[];
  } {
    const routeNodes = new Map<string, RouteNode>();
    const flowEdges: FlowEdge[] = [];

    // Graph data structure to properly model the routing hierarchy
    class RouteGraph {
      private nodes = new Map<string, {
        route: any;
        nodeId: string;
        children: Set<string>;
        parent?: string;
        isLayoutComponent: boolean;
        isTopLevel: boolean;
      }>();

      addRoute(route: any, parentId?: string) {
        if (!route.fullPath || route.fullPath.includes("**")) return;

        const isLayoutComponent = !!(route.component && route.children && route.children.length > 0);
        const isTopLevel = !parentId && route.fullPath !== "/";
        
        // Create unique node ID
        let nodeId: string;
        if (isLayoutComponent) {
          nodeId = `layout_${route.component}_${route.fullPath}`;
        } else {
          nodeId = route.fullPath;
        }

        // Add node to graph
        this.nodes.set(nodeId, {
          route,
          nodeId,
          children: new Set(),
          parent: parentId,
          isLayoutComponent,
          isTopLevel
        });

        // Add to parent's children if parent exists
        if (parentId && this.nodes.has(parentId)) {
          this.nodes.get(parentId)!.children.add(nodeId);
        }

        // Process children recursively
        if (route.children && Array.isArray(route.children)) {
          for (const childRoute of route.children) {
            // Skip redirect-only routes as children of layout components
            if (childRoute.redirectTo && !childRoute.component && isLayoutComponent) {
              continue;
            }
            this.addRoute(childRoute, nodeId);
          }
        }

        return nodeId;
      }

      getNodes() {
        return this.nodes;
      }

      // Get the proper hierarchy edges with root connections
      getHierarchyEdges(): Array<{source: string, target: string}> {
        const edges: Array<{source: string, target: string}> = [];
        
        // Add edges from parent to children
        for (const [nodeId, node] of this.nodes) {
          if (node.parent) {
            edges.push({
              source: node.parent,
              target: nodeId
            });
          }
        }
        
        // Connect top-level routes to root
        const rootNodeId = "ROOT";
        for (const [nodeId, node] of this.nodes) {
          if (node.isTopLevel || (node.route.fullPath === "/" && node.isLayoutComponent)) {
            edges.push({
              source: rootNodeId,
              target: nodeId
            });
          }
        }
        
        return edges;
      }

      // Check if we need a root node
      needsRootNode(): boolean {
        return true; // Always create a root for better organization
      }
    }

    // Build the route graph
    const routeGraph = new RouteGraph();
    
    // Process all routes and build the graph structure
    for (const route of analysisResult.routes) {
      routeGraph.addRoute(route);
    }

    // Add root node if needed
    if (routeGraph.needsRootNode()) {
      routeNodes.set("ROOT", {
        id: "root",
        originalPath: "ROOT",
        displayName: "Root",
        pathDepth: 0,
        category: "root",
        importance: 0,
      });
    }

    // Convert graph nodes to RouteNode format
    for (const [nodeId, graphNode] of routeGraph.getNodes()) {
      const route = graphNode.route;
      const cleanPath = this.cleanRoutePath(route.fullPath);
      const pathDepth = route.fullPath.split("/").filter(Boolean).length;
      const category = this.getNodeCategory(route.fullPath);

      let displayName = "";
      let visualNodeId = cleanPath;

      if (graphNode.isLayoutComponent) {
        // Layout component
        displayName = route.component.replace(/Component$/, "");
        displayName = displayName
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
        visualNodeId = `layout_${route.component}`;
      } else if (route.fullPath === "/" && !route.component) {
        displayName = "Root";
      } else if (route.component) {
        displayName = route.component.replace(/Component$/, "");
        displayName = displayName
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
      } else {
        const lastSegment = route.fullPath.split("/").filter(Boolean).pop() || "";
        displayName = this.deriveDisplayName(lastSegment);
      }

      routeNodes.set(nodeId, {
        id: visualNodeId,
        originalPath: route.fullPath,
        displayName,
        pathDepth,
        category,
        component: route.component,
        importance: 0,
        guards: route.guards,
      });

      // Add redirects to edges
      if (route.redirectTo) {
        let targetPath = route.redirectTo;
        if (!targetPath.startsWith("/")) {
          const parentDir =
            route.fullPath.substring(0, route.fullPath.lastIndexOf("/") + 1) ||
            "/";
          targetPath = path.posix
            .resolve(parentDir, targetPath)
            .replace(/\\/g, "/");
        }

        targetPath = targetPath.replace(/\/\//g, "/");
        if (targetPath !== "/" && targetPath.endsWith("/")) {
          targetPath = targetPath.slice(0, -1);
        }

        // Find target node by path
        let targetNodeId: string | undefined;
        for (const [id, node] of routeNodes.entries()) {
          if (node.originalPath === targetPath) {
            targetNodeId = id;
            break;
          }
        }

        if (targetNodeId) {
          flowEdges.push({
            source: nodeId,
            target: targetNodeId,
            type: "redirect",
          });
        }
      }
    }

    // Add hierarchy edges from the graph structure
    const hierarchyEdges = routeGraph.getHierarchyEdges();
    for (const edge of hierarchyEdges) {
      flowEdges.push({
        source: edge.source,
        target: edge.target,
        type: "hierarchy",
      });
    }

    // Add navigation flows
    const componentToNodeId = new Map<string, string>();
    for (const [nodeId, node] of routeNodes.entries()) {
      if (node.component) {
        componentToNodeId.set(node.component, nodeId);
        const baseName = node.component.replace(/Component$/, "");
        if (baseName !== node.component) {
          componentToNodeId.set(baseName, nodeId);
        }
      }
    }

    for (const flow of analysisResult.flows) {
      if (!flow.from || !flow.to) continue;

      let sourceNodeId = componentToNodeId.get(flow.from);
      if (!sourceNodeId) {
        const baseName = flow.from.replace(/Component$/, "");
        sourceNodeId = componentToNodeId.get(baseName);
      }

      let targetPath = flow.to;
      if (!targetPath.startsWith("/")) {
        if (sourceNodeId) {
          const sourceNode = routeNodes.get(sourceNodeId);
          if (sourceNode) {
            const parentDir =
              sourceNode.originalPath.substring(0, sourceNode.originalPath.lastIndexOf("/") + 1) || "/";
            targetPath = path.posix
              .resolve(parentDir, targetPath)
              .replace(/\\/g, "/");
          }
        } else {
          targetPath = "/" + targetPath;
        }
      }

      targetPath = targetPath.replace(/\/\//g, "/");
      if (targetPath !== "/" && targetPath.endsWith("/")) {
        targetPath = targetPath.slice(0, -1);
      }

      // Find target node by path
      let targetNodeId: string | undefined;
      for (const [nodeId, node] of routeNodes.entries()) {
        if (node.originalPath === targetPath) {
          targetNodeId = nodeId;
          break;
        }
      }

      let edgeLabel: string | undefined = undefined;
      if (flow.type === "dynamic" && targetNodeId) {
        const potentialTargetNode = routeNodes.get(targetNodeId);
        if (
          potentialTargetNode?.guards &&
          potentialTargetNode.guards.length > 0
        ) {
          edgeLabel = potentialTargetNode.guards.join(", ");
        }
      }

      if (sourceNodeId && targetNodeId) {
        flowEdges.push({
          source: sourceNodeId,
          target: targetNodeId,
          type: flow.type,
          label: edgeLabel,
        });
      }
    }

    return { routeNodes, flowEdges };
  }

  private applyTheme(graph: any, theme: string): void {
    // Configure node styling
    graph.attributes.node.set(attribute.shape, "box");
    graph.attributes.node.set(attribute.style, "filled,rounded");
    graph.attributes.node.set(attribute.fontname, "Arial");
    graph.attributes.node.set(attribute.fontsize, theme === "dark" ? 13 : 12); // Larger font for dark theme
    graph.attributes.node.set(attribute.margin, "0.15,0.1");
    graph.attributes.node.set(attribute.height, 0.6);

    // Configure edge styling
    graph.attributes.edge.set(attribute.fontname, "Arial");
    graph.attributes.edge.set(attribute.fontsize, theme === "dark" ? 11 : 10); // Larger edge labels for dark theme

    // Apply theme-specific styling
    switch (theme) {
      case "dark":
        graph.attributes.graph.set(attribute.bgcolor, "#2d3748");
        // Set default edge color for dark theme
        graph.attributes.edge.set(attribute.color, "#e2e8f0");
        graph.attributes.edge.set(attribute.fontcolor, "#e2e8f0");
        break;
      case "light":
      default:
        // Light theme styling (previously colorful)
        graph.attributes.edge.set(attribute.color, "#333333");
        graph.attributes.edge.set(attribute.fontcolor, "#333333");
        break;
    }
  }

  private getNodeColor(
    category: string,
    importance: number,
    theme: string
  ): string {
    // Special color for root - this is universal
    if (category === "root") return "#FF6B35"; // Vibrant orange for root
    
    // Generate vibrant colors based on category hash - completely generic
    switch (theme) {
      case "dark":
        return this.generateVibrantColor(category, true);
      case "light":
        return this.generateVibrantColor(category, false);
      default:
        return this.generateVibrantColor(category, false);
    }
  }

  private generateVibrantColor(str: string, dark: boolean = false): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Generate more vibrant colors using HSL for better control
    const hue = Math.abs(hash) % 360;
    const saturation = dark ? 80 : 85; // High saturation for vibrancy
    const lightness = dark ? 45 : 55; // Darker background for better white text contrast

    return this.hslToHex(hue, saturation, lightness);
  }

  private hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  private getFontColor(theme: string): string {
    switch (theme) {
      case "dark":
        return "#ffffff"; // Pure white for maximum contrast on dark backgrounds
      default:
        return "#000000"; // Pure black for maximum contrast on light backgrounds
    }
  }

  private getEdgeAttributes(edge: FlowEdge, theme: string): any {
    let edgeAttrs: any = {
      label: edge.label || "",
      penwidth: 2, // Make edges thicker for better visibility
    };

    if (edge.type === "redirect") {
      edgeAttrs.style = "dashed";
      edgeAttrs.color = theme === "dark" ? "#60A5FA" : "#2563EB"; // Bright blue
      edgeAttrs.fontcolor = theme === "dark" ? "#E5E7EB" : "#374151";
      edgeAttrs.penwidth = 2.5;
    } else if (edge.type === "dynamic") {
      edgeAttrs.color = theme === "dark" ? "#34D399" : "#059669"; // Bright green
      edgeAttrs.fontcolor = theme === "dark" ? "#E5E7EB" : "#374151";
      edgeAttrs.penwidth = 2.5;
    } else if (edge.type === "static") {
      edgeAttrs.color = theme === "dark" ? "#A78BFA" : "#7C3AED"; // Bright purple
      edgeAttrs.fontcolor = theme === "dark" ? "#E5E7EB" : "#374151";
      edgeAttrs.penwidth = 2.5;
    } else if (edge.type === "hierarchy") {
      edgeAttrs.color = theme === "dark" ? "#9CA3AF" : "#6B7280"; // Subtle gray
      edgeAttrs.fontcolor = theme === "dark" ? "#E5E7EB" : "#374151";
      edgeAttrs.arrowhead = "vee";
      edgeAttrs.style = "dotted";
      edgeAttrs.penwidth = 1.5; // Thinner for hierarchy
    }

    return edgeAttrs;
  }

  private cleanRoutePath(path: string): string {
    return path.replace(/:[^\/]+/g, (match) => match.substring(1));
  }

  private getNodeCategory(path: string): string {
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return "root";
    return segments[0].toLowerCase();
  }

  private deriveDisplayName(routePathSegment: string): string {
    if (
      !routePathSegment ||
      routePathSegment === "/" ||
      routePathSegment === ""
    )
      return "Segment";
    return routePathSegment
      .replace(/^[:*]/, "") // Remove starting : or *
      .split(/[-_]/) // Split by dash or underscore
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private async generateImage(dotPath: string, options: any): Promise<string> {
    const outputDir = path.dirname(dotPath);
    const baseName = path.basename(dotPath, ".dot");
    const imagePath = path.join(outputDir, `${baseName}.png`);

    execSync(`dot -Tpng "${dotPath}" -o "${imagePath}"`);
    console.log(`🖼️ PNG image generated: ${imagePath}`);

    return imagePath;
  }
}
