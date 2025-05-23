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
      "theme", // 'default', 'dark', 'colorful'
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
      !["default", "dark", "colorful"].includes(options.theme)
    ) {
      errors.push("theme must be one of: default, dark, colorful");
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
      theme: "default",
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
    // Create the main graph with styling
    const g = digraph("AngularFlows", {
      rankdir: options.rankdir || "LR",
      splines: options.splines || "polyline",
      nodesep: options.nodesep || 1.5,
      ranksep: options.ranksep || 2.2,
      overlap: false,
      concentrate: false,
    });

    // Apply theme-based styling
    this.applyTheme(g, options.theme || "default");

    // Convert analysis results to graph structure
    const { routeNodes, flowEdges } =
      this.convertAnalysisToGraphData(analysisResult);

    console.log(
      `📊 Creating graph with ${routeNodes.size} nodes and ${flowEdges.length} edges`
    );

    // Create nodes
    for (const [routePath, node] of routeNodes.entries()) {
      const color = this.getNodeColor(
        node.category,
        node.importance,
        options.theme
      );
      const fontColor = this.getFontColor(options.theme);

      g.createNode(node.id, {
        label: `${node.displayName}\\n(${node.originalPath.replace(
          /"/g,
          '\\"'
        )})`,
        fillcolor: color,
        fontcolor: fontColor as any,
      });
    }

    // Create edges
    const existingEdges = new Set<string>();
    for (const edge of flowEdges) {
      const sourceNode = routeNodes.get(edge.source);
      let actualTargetNode = routeNodes.get(edge.target);

      // Handle parameterized routes
      if (!actualTargetNode && edge.target) {
        for (const [_, rn] of routeNodes.entries()) {
          const patternText = rn.originalPath.replace(/:[^\\/]+/g, "[^/]+");
          const regex = new RegExp(`^${patternText}$`);
          if (regex.test(edge.target)) {
            actualTargetNode = rn;
            break;
          }
        }
      }

      if (sourceNode && actualTargetNode) {
        const edgeKey = `${sourceNode.id}->${actualTargetNode.id}->${
          edge.type
        }${edge.label ? "->" + edge.label : ""}`;
        if (!existingEdges.has(edgeKey)) {
          const edgeAttrs = this.getEdgeAttributes(edge, options.theme);
          g.createEdge([sourceNode.id, actualTargetNode.id], edgeAttrs);
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

    // Convert routes to nodes
    for (const route of analysisResult.routes) {
      if (!route.fullPath) continue;
      if (route.fullPath.includes("**")) continue; // Skip wildcard routes

      const cleanPath = this.cleanRoutePath(route.fullPath);
      const pathDepth = route.fullPath.split("/").filter(Boolean).length;
      const category = this.getNodeCategory(route.fullPath);

      let displayName = "";
      if (route.fullPath === "/") {
        displayName = "Root";
      } else if (route.component) {
        displayName = route.component.replace(/Component$/, "");
        displayName = displayName
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase())
          .trim();
      } else {
        const lastSegment =
          route.fullPath.split("/").filter(Boolean).pop() || "";
        displayName = this.deriveDisplayName(lastSegment);
      }

      routeNodes.set(route.fullPath, {
        id: cleanPath,
        originalPath: route.fullPath,
        displayName,
        pathDepth,
        category,
        component: route.component,
        importance: 0, // Will be calculated later
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

        flowEdges.push({
          source: route.fullPath,
          target: targetPath,
          type: "redirect",
        });
      }
    }

    // Add parent-child relationships
    for (const [routePath, node] of routeNodes.entries()) {
      if (routePath === "/") continue;

      let parentPath = path.dirname(routePath);
      if (parentPath === ".") parentPath = "/";
      if (parentPath !== "/" && parentPath.endsWith("/"))
        parentPath = parentPath.slice(0, -1);
      if (parentPath === "") parentPath = "/";

      if (routeNodes.has(parentPath) && parentPath !== routePath) {
        flowEdges.push({
          source: parentPath,
          target: routePath,
          type: "hierarchy",
        });
      }
    }

    // Add navigation flows
    const componentToRoute = new Map<string, string>();
    for (const [routePath, node] of routeNodes.entries()) {
      if (node.component) {
        componentToRoute.set(node.component, routePath);
        const baseName = node.component.replace(/Component$/, "");
        if (baseName !== node.component) {
          componentToRoute.set(baseName, routePath);
        }
      }
    }

    for (const flow of analysisResult.flows) {
      if (!flow.from || !flow.to) continue;

      let sourcePath = componentToRoute.get(flow.from);
      if (!sourcePath) {
        const baseName = flow.from.replace(/Component$/, "");
        sourcePath = componentToRoute.get(baseName);
      }
      if (!sourcePath && flow.from.startsWith("/")) {
        sourcePath = flow.from;
      }

      let targetPath = flow.to;
      if (!targetPath.startsWith("/")) {
        if (sourcePath) {
          const parentDir =
            sourcePath.substring(0, sourcePath.lastIndexOf("/") + 1) || "/";
          targetPath = path.posix
            .resolve(parentDir, targetPath)
            .replace(/\\/g, "/");
        } else {
          targetPath = "/" + targetPath;
        }
      }

      targetPath = targetPath.replace(/\/\//g, "/");
      if (targetPath !== "/" && targetPath.endsWith("/")) {
        targetPath = targetPath.slice(0, -1);
      }

      let edgeLabel: string | undefined = undefined;
      if (flow.type === "dynamic") {
        const potentialTargetNode = routeNodes.get(targetPath);
        if (
          potentialTargetNode?.guards &&
          potentialTargetNode.guards.length > 0
        ) {
          edgeLabel = potentialTargetNode.guards.join(", ");
        }
      }

      if (sourcePath && routeNodes.has(sourcePath) && targetPath) {
        flowEdges.push({
          source: sourcePath,
          target: targetPath,
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
    graph.attributes.node.set(attribute.fontsize, 11);
    graph.attributes.node.set(attribute.margin, "0.15,0.1");
    graph.attributes.node.set(attribute.height, 0.6);

    // Configure edge styling
    graph.attributes.edge.set(attribute.fontname, "Arial");
    graph.attributes.edge.set(attribute.fontsize, 9);

    // Apply theme-specific styling
    switch (theme) {
      case "dark":
        graph.attributes.graph.set(attribute.bgcolor, "#2d3748");
        break;
      case "colorful":
        // Will be handled in color generation
        break;
      default:
        // Default theme styling
        break;
    }
  }

  private getNodeColor(
    category: string,
    importance: number,
    theme: string
  ): string {
    if (category === "root") return "#FF8C00"; // Root is always orange

    switch (theme) {
      case "dark":
        return this.stringToHexColor(category, true);
      case "colorful":
        return this.stringToHexColor(category, false);
      default:
        return this.stringToHexColor(category, false);
    }
  }

  private getFontColor(theme: string): string {
    switch (theme) {
      case "dark":
        return "#ffffff";
      default:
        return "#333333";
    }
  }

  private getEdgeAttributes(edge: FlowEdge, theme: string): any {
    let edgeAttrs: any = {
      label: edge.label || "",
    };

    if (edge.type === "redirect") {
      edgeAttrs.style = "dashed";
      edgeAttrs.color = theme === "dark" ? "#6b8dd6" : "blue";
    } else if (edge.type === "dynamic") {
      edgeAttrs.color = theme === "dark" ? "#48bb78" : "#006400"; // DarkGreen
    } else if (edge.type === "static") {
      edgeAttrs.color = theme === "dark" ? "#81c8e8" : "#4682B4"; // SteelBlue
    } else if (edge.type === "hierarchy") {
      edgeAttrs.color = theme === "dark" ? "#a0aec0" : "#A9A9A9"; // DarkGray
      edgeAttrs.arrowhead = "none";
    }

    return edgeAttrs;
  }

  private stringToHexColor(str: string, dark: boolean = false): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    let color = "#";
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff;
      const brightValue = dark ? Math.max(value, 80) : Math.max(value, 120);
      color += ("00" + brightValue.toString(16)).substr(-2);
    }

    return color;
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
