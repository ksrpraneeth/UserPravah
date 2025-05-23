import { IFrameworkAnalyzer } from "../../core/framework-analyzer.interface.js";
import {
  ProjectAnalysisOptions,
  AnalysisResult,
  Route,
  NavigationFlow,
  MenuDefinition,
} from "../../core/types.js";
import {
  Project,
  SourceFile,
  SyntaxKind,
  Node,
  CallExpression,
  ArrayLiteralExpression,
  StringLiteral,
  ObjectLiteralExpression,
  PropertyAssignment,
  Identifier,
  ArrowFunction,
  ImportSpecifier,
} from "ts-morph";
import { parse as parseHTML } from "node-html-parser";
import * as fs from "fs";
import * as path from "path";
import glob from "fast-glob";

export class AngularAnalyzer implements IFrameworkAnalyzer {
  private project!: Project;
  private routes: Route[] = [];
  private flows: NavigationFlow[] = [];
  private menus: MenuDefinition[] = [];
  private angularProjectPath!: string;
  private processedRouteObjects = new Set<Node>();
  private processedLazyLoads = new Set<string>();

  getFrameworkName(): string {
    return "Angular";
  }

  async canAnalyze(projectPath: string): Promise<boolean> {
    // Check for Angular-specific files
    const angularFiles = ["angular.json", "package.json"];

    for (const file of angularFiles) {
      const filePath = path.join(projectPath, file);
      if (fs.existsSync(filePath)) {
        if (file === "package.json") {
          try {
            const packageJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            const deps = {
              ...packageJson.dependencies,
              ...packageJson.devDependencies,
            };
            if (deps["@angular/core"] || deps["@angular/cli"]) {
              return true;
            }
          } catch (error) {
            // Invalid package.json, continue checking other files
          }
        } else {
          return true; // angular.json exists
        }
      }
    }

    // Check for TypeScript config and Angular-specific source structure
    const tsConfigPath = path.join(projectPath, "tsconfig.json");
    const srcAppPath = path.join(projectPath, "src", "app");

    return fs.existsSync(tsConfigPath) && fs.existsSync(srcAppPath);
  }

  getSupportedExtensions(): string[] {
    return [".ts", ".html"];
  }

  getConfigFilePatterns(): string[] {
    return ["angular.json", "tsconfig.json", "package.json"];
  }

  async analyze(options: ProjectAnalysisOptions): Promise<AnalysisResult> {
    this.angularProjectPath = options.projectPath;
    this.routes = [];
    this.flows = [];
    this.menus = [];
    this.processedRouteObjects.clear();
    this.processedLazyLoads.clear();

    // Initialize ts-morph project
    this.project = new Project({
      tsConfigFilePath: path.join(this.angularProjectPath, "tsconfig.json"),
    });

    console.log("🔍 Starting Angular project analysis...");

    await this.addSourceFiles();
    console.log(
      `📁 Total TypeScript source files loaded: ${
        this.project.getSourceFiles().length
      }`
    );

    console.log("📍 Analyzing routing modules (initial pass)...");
    await this.analyzeRoutingModules("/");

    console.log("🔎 Analyzing template files and TS for navigation...");
    await this.analyzeSourceFilesForNavigation();

    return {
      routes: this.routes,
      flows: this.flows,
      menus: this.menus,
    };
  }

  // Helper to convert kebab-case to PascalCase for component names
  private kebabToPascalCase(filename: string): string {
    let name = path.basename(filename, path.extname(filename));

    name = name.replace(
      /\.(component|service|module|pipe|directive|guard|routes|page|config|store|effects|reducer|action|model|interface|enum|util|helper|constant|schema|validator|interceptor|resolver|adapter|facade|query|command|event|subscriber|listener|dto|vo|entity|repository|provider|factory|builder|handler|operator|stream|source|sink|transform|aggregator|projector|saga|orchestrator|coordinator|mediator|gateway|client|proxy|stub|mock|dummy|fake|spec|test|e2e|stories|bench)$/,
      ""
    );

    return name
      .split("-")
      .filter((part) => part.length > 0)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  private async addSourceFiles(): Promise<void> {
    const tsFiles = await glob("**/*.ts", {
      cwd: this.angularProjectPath,
      ignore: ["node_modules/**", "dist/**"],
    });

    this.project.addSourceFilesAtPaths(
      tsFiles.map((f) => path.join(this.angularProjectPath, f))
    );
  }

  private async analyzeRoutingModules(
    parentPathForThisContext: string,
    sourceFilesToSearch?: SourceFile[]
  ): Promise<void> {
    let filesToProcess: SourceFile[];

    if (sourceFilesToSearch) {
      filesToProcess = sourceFilesToSearch;
      console.log(
        `   [AnalyzeRoutes] Specific scan for ${filesToProcess.length} file(s) with parent context: '${parentPathForThisContext}'`
      );
    } else {
      console.log(
        `   [AnalyzeRoutes] Initial scan for top-level routing configuration. Parent context for this scan: '${parentPathForThisContext}' (this should be '/')`
      );

      const appConfigTs = this.project.getSourceFile((sf) =>
        /app\.config\.ts$/.test(sf.getFilePath())
      );
      const appModuleTs = this.project.getSourceFile((sf) =>
        /app\.module\.ts$/.test(sf.getFilePath())
      );
      const otherTopLevelModules = this.project
        .getSourceFiles()
        .filter(
          (sf) =>
            /src\/app\/[^\/]+\.module\.ts$/.test(sf.getFilePath()) &&
            sf !== appModuleTs
        );

      filesToProcess = [];
      if (appConfigTs) {
        console.log(`    Found app.config.ts: ${appConfigTs.getFilePath()}`);
        filesToProcess.push(appConfigTs);
      }

      if (appModuleTs && filesToProcess.length === 0) {
        console.log(`    Found app.module.ts: ${appModuleTs.getFilePath()}`);
        filesToProcess.push(appModuleTs);
      }

      if (filesToProcess.length === 0) {
        console.warn(
          "   ⚠️ No clear top-level routing configuration file found for initial route scan."
        );
      }
    }

    for (const sourceFile of filesToProcess) {
      const filePath = sourceFile.getFilePath();
      console.log(
        `   [AnalyzeRoutes] Processing file: ${filePath} using parent context: '${parentPathForThisContext}'`
      );
      this.extractRoutes(sourceFile, parentPathForThisContext);
    }
  }

  private extractRoutes(
    sourceFile: SourceFile,
    parentPathForThisFileContext: string
  ): void {
    console.log(
      `   [ExtractRoutes] SourceFile: ${sourceFile.getFilePath()}, Using ParentContextPath: '${parentPathForThisFileContext}'`
    );

    const processedArrayLiterals = new Set<ArrayLiteralExpression>();

    // Priority 1: Find calls to provideRouter, RouterModule.forRoot, RouterModule.forChild
    const routingFunctionCalls = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => {
        const exprText = call.getExpression().getText();
        return (
          exprText.endsWith("provideRouter") ||
          exprText.endsWith("RouterModule.forRoot") ||
          exprText.endsWith("RouterModule.forChild")
        );
      });

    for (const call of routingFunctionCalls) {
      if (call.getArguments().length > 0) {
        const firstArg = call.getArguments()[0];
        if (Node.isArrayLiteralExpression(firstArg)) {
          this.processRouteArrayLiteral(
            firstArg,
            parentPathForThisFileContext,
            sourceFile
          );
          processedArrayLiterals.add(firstArg);
        } else if (Node.isIdentifier(firstArg)) {
          this.resolveAndProcessIdentifier(
            firstArg,
            parentPathForThisFileContext,
            sourceFile,
            processedArrayLiterals
          );
        }
      }
    }

    // NgModule imports analysis
    if (sourceFile.getFilePath().endsWith(".module.ts")) {
      this.analyzeNgModuleImports(sourceFile, parentPathForThisFileContext);
    }

    // General scan for route arrays
    this.performGeneralRouteScan(
      sourceFile,
      parentPathForThisFileContext,
      processedArrayLiterals
    );
  }

  private resolveAndProcessIdentifier(
    identifier: Identifier,
    parentPath: string,
    sourceFile: SourceFile,
    processedArrays: Set<ArrayLiteralExpression>
  ): void {
    const identifierName = identifier.getText();
    try {
      const definitions = identifier.getDefinitionNodes();
      for (const def of definitions) {
        if (Node.isVariableDeclaration(def)) {
          const initializer = def.getInitializer();
          if (initializer && Node.isArrayLiteralExpression(initializer)) {
            this.processRouteArrayLiteral(initializer, parentPath, sourceFile);
            processedArrays.add(initializer);
          }
        } else if (
          Node.isImportSpecifier(def) ||
          Node.isExportSpecifier(def) ||
          Node.isNamespaceImport(def) ||
          Node.isExportAssignment(def)
        ) {
          const importSourceFile = def.getSourceFile();
          if (importSourceFile && importSourceFile !== sourceFile) {
            console.log(
              `        Identifier '${identifierName}' is imported from ${importSourceFile.getFilePath()}. Analyzing imported file with context '${parentPath}'.`
            );
            this.analyzeRoutingModules(parentPath, [importSourceFile]);
          }
        }
      }
    } catch (error) {
      console.error(
        `      Error resolving identifier '${identifierName}' in ${sourceFile.getFilePath()}: ${error}`
      );
    }
  }

  private analyzeNgModuleImports(
    sourceFile: SourceFile,
    parentPath: string
  ): void {
    console.log(
      `   [ExtractRoutes - NgModuleScan] File ${sourceFile.getFilePath()} is a module. Scanning @NgModule imports.`
    );
    const ngModuleDecorators = sourceFile
      .getDescendantsOfKind(SyntaxKind.Decorator)
      .filter((d) => d.getName() === "NgModule");

    for (const decorator of ngModuleDecorators) {
      const decoratorArg = decorator.getArguments()[0];
      if (decoratorArg && Node.isObjectLiteralExpression(decoratorArg)) {
        const importsProperty = decoratorArg.getProperty("imports");
        if (importsProperty && Node.isPropertyAssignment(importsProperty)) {
          const importsInitializer = importsProperty.getInitializer();
          if (
            importsInitializer &&
            Node.isArrayLiteralExpression(importsInitializer)
          ) {
            this.processNgModuleImportsArray(
              importsInitializer,
              parentPath,
              sourceFile
            );
          }
        }
      }
    }
  }

  private processNgModuleImportsArray(
    importsArray: ArrayLiteralExpression,
    parentPath: string,
    sourceFile: SourceFile
  ): void {
    for (const imp of importsArray.getElements()) {
      if (Node.isIdentifier(imp)) {
        const importName = imp.getText();
        try {
          const definitionNodes = imp.getDefinitionNodes();
          for (const defNode of definitionNodes) {
            const definitionSourceFile = defNode.getSourceFile();
            if (
              definitionSourceFile &&
              definitionSourceFile.getFilePath() !== sourceFile.getFilePath()
            ) {
              if (
                Node.isClassDeclaration(defNode) ||
                Node.isFunctionDeclaration(defNode)
              ) {
                console.log(
                  `   [NgModuleScan] '${importName}' definition found in ${definitionSourceFile.getFilePath()}. Scheduling analysis.`
                );
                this.analyzeRoutingModules(parentPath, [definitionSourceFile]);
                break;
              }
            } else if (Node.isImportSpecifier(defNode)) {
              const importDeclaration = defNode.getImportDeclaration();
              const importedSourceFile =
                importDeclaration.getModuleSpecifierSourceFile();
              if (
                importedSourceFile &&
                importedSourceFile.getFilePath() !== sourceFile.getFilePath()
              ) {
                this.analyzeRoutingModules(parentPath, [importedSourceFile]);
                break;
              }
            }
          }
        } catch (err) {
          console.warn(
            `   [NgModuleScan] Error resolving identifier ${importName}: ${err}`
          );
        }
      }
    }
  }

  private performGeneralRouteScan(
    sourceFile: SourceFile,
    parentPath: string,
    processedArrays: Set<ArrayLiteralExpression>
  ): void {
    const allArrayLiterals = sourceFile.getDescendantsOfKind(
      SyntaxKind.ArrayLiteralExpression
    );
    for (const arr of allArrayLiterals) {
      if (processedArrays.has(arr)) continue;

      const hasRouteLikeElements = arr.getElements().some((el) => {
        if (Node.isObjectLiteralExpression(el)) {
          return el
            .getProperties()
            .some(
              (prop) =>
                Node.isPropertyAssignment(prop) &&
                (prop.getName() === "path" ||
                  prop.getName() === "component" ||
                  prop.getName() === "loadChildren" ||
                  prop.getName() === "redirectTo" ||
                  prop.getName() === "children")
            );
        }
        return false;
      });

      if (hasRouteLikeElements) {
        this.processRouteArrayLiteral(arr, parentPath, sourceFile);
      }
    }
  }

  private processRouteArrayLiteral(
    routeArrayNode: ArrayLiteralExpression,
    parentRouteContextFullPath: string,
    sourceFile: SourceFile
  ) {
    console.log(
      `  [ProcessArrayLiteral] START processing array from file: ${sourceFile.getFilePath()}, ParentContext: '${parentRouteContextFullPath}', Number of elements: ${
        routeArrayNode.getElements().length
      }`
    );
    const parsedRoutes = this.parseRouteArray(
      routeArrayNode,
      parentRouteContextFullPath,
      sourceFile
    );
    console.log(
      `  [ProcessArrayLiteral] FINISHED parseRouteArray. Number of parsed routes from this array: ${parsedRoutes.length}`
    );

    for (const pr of parsedRoutes) {
      this.addRouteToCollection(pr);
    }
  }

  private addRouteToCollection(pr: Route) {
    if (
      !pr ||
      (!pr.component &&
        !pr.loadChildren &&
        !pr.redirectTo &&
        (!pr.children || pr.children.length === 0) &&
        pr.path === "")
    ) {
      return;
    }

    console.log(
      `    [AddRoute] Considering to add route: path='${pr.path}', fp='${
        pr.fullPath
      }', comp='${pr.component || "N/A"}', children#='${
        pr.children?.length || 0
      }', redirectTo='${pr.redirectTo || "N/A"}', loadChildren='${
        pr.loadChildren || "N/A"
      }'`
    );

    const existingRouteByPathIndex = this.routes.findIndex(
      (r) => r.fullPath === pr.fullPath
    );

    if (existingRouteByPathIndex !== -1) {
      const existingRoute = this.routes[existingRouteByPathIndex];
      let updateReason = "";
      if (pr.component && !existingRoute.component)
        updateReason = "new component";
      else if (pr.loadChildren && !existingRoute.loadChildren)
        updateReason = "new loadChildren";
      else if (pr.redirectTo && !existingRoute.redirectTo)
        updateReason = "new redirectTo";

      if (updateReason) {
        console.log(
          `      [AddRoute] Updating existing route at ${pr.fullPath} because of ${updateReason}.`
        );
        this.routes[existingRouteByPathIndex] = pr;
      }
      return;
    }

    const existingRouteByComponentIndex = this.routes.findIndex(
      (r) => r.component && pr.component && r.component === pr.component
    );
    if (existingRouteByComponentIndex !== -1) {
      const existingRoute = this.routes[existingRouteByComponentIndex];
      if (
        pr.fullPath.length > existingRoute.fullPath.length ||
        (existingRoute.path === "**" && (pr.component || pr.loadChildren))
      ) {
        console.log(
          `      [AddRoute] Replacing existing route for component ${pr.component} with more specific path: ${pr.fullPath}`
        );
        this.routes[existingRouteByComponentIndex] = pr;
      }
      return;
    }

    const trulyDuplicate = this.routes.find(
      (r) =>
        r.fullPath === pr.fullPath &&
        ((r.component && pr.component && r.component === pr.component) ||
          (r.loadChildren &&
            pr.loadChildren &&
            r.loadChildren === pr.loadChildren) ||
          (r.redirectTo && pr.redirectTo && r.redirectTo === pr.redirectTo) ||
          (!r.component &&
            !pr.component &&
            !r.loadChildren &&
            !pr.loadChildren &&
            !r.redirectTo &&
            !pr.redirectTo &&
            r.children &&
            r.children.length > 0 &&
            pr.children &&
            pr.children.length > 0))
    );

    if (!trulyDuplicate) {
      this.routes.push(pr);
    }
  }

  private parseRouteArray(
    node: Node,
    parentRouteContextFullPath: string,
    sourceFile: SourceFile
  ): Route[] {
    const routes: Route[] = [];
    if (Node.isArrayLiteralExpression(node)) {
      node.getElements().forEach((element) => {
        if (Node.isObjectLiteralExpression(element)) {
          if (this.processedRouteObjects.has(element)) {
            return;
          }
          const route = this.parseRouteObject(
            element,
            parentRouteContextFullPath,
            sourceFile
          );
          if (route) {
            this.processedRouteObjects.add(element);
            routes.push(route);
            if (route.loadChildren) {
              this.loadAndParseLazyModule(
                route.loadChildren,
                route.fullPath,
                sourceFile
              ).catch((err) => {
                console.warn(
                  `⚠️ Error processing lazy module ${route.loadChildren}: ${err.message}`
                );
              });
            }
          }
        }
      });
    }
    return routes;
  }

  private parseRouteObject(
    node: ObjectLiteralExpression,
    parentRouteContextFullPath: string,
    sourceFile: SourceFile
  ): Route | null {
    const props: { [key: string]: any } = {};
    let pathSegmentFromProps: string | undefined = undefined;

    node.getProperties().forEach((prop) => {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getNameNode().getText();
        const initializer = prop.getInitializer();
        if (!initializer) return;

        switch (name) {
          case "path":
            if (Node.isStringLiteral(initializer))
              pathSegmentFromProps = initializer.getLiteralValue();
            break;
          case "component":
            if (Node.isIdentifier(initializer))
              props[name] = initializer.getText();
            break;
          case "loadComponent":
            this.parseLoadComponent(initializer, props);
            break;
          case "loadChildren":
            this.parseLoadChildren(initializer, props, name);
            break;
          case "redirectTo":
            if (Node.isStringLiteral(initializer))
              props[name] = initializer.getLiteralValue();
            break;
          case "children":
            if (Node.isArrayLiteralExpression(initializer))
              props[name] = initializer;
            break;
          case "canActivate":
            if (Node.isArrayLiteralExpression(initializer))
              props[name] = initializer;
            break;
          case "data":
            if (Node.isObjectLiteralExpression(initializer))
              props[name] = initializer;
            break;
        }
      }
    });

    if (pathSegmentFromProps === undefined) {
      if (
        !props["component"] &&
        !props["children"] &&
        !props["loadChildren"] &&
        !props["redirectTo"] &&
        !props["loadComponent"]
      ) {
        return null;
      }
      pathSegmentFromProps = "";
    }

    const route: Route = { path: pathSegmentFromProps, fullPath: "" };

    // Calculate fullPath
    if (parentRouteContextFullPath === "/" && route.path === "") {
      route.fullPath = "/";
      if (!this.routes.some((r) => r.isRoot)) {
        route.isRoot = true;
      }
    } else if (parentRouteContextFullPath === "/") {
      route.fullPath = `/${route.path}`;
    } else {
      route.fullPath =
        route.path === ""
          ? parentRouteContextFullPath
          : `${parentRouteContextFullPath}/${route.path}`;
    }

    // Normalize fullPath
    route.fullPath = route.fullPath.replace(/\/\//g, "/");
    if (route.fullPath !== "/" && route.fullPath.endsWith("/")) {
      route.fullPath = route.fullPath.slice(0, -1);
    }
    if (route.fullPath === "") route.fullPath = "/";

    // Assign other properties
    if (props["component"]) route.component = props["component"] as string;
    if (props["redirectTo"]) route.redirectTo = props["redirectTo"] as string;
    if (props["loadChildren"])
      route.loadChildren = props["loadChildren"] as string;

    if (
      props["canActivate"] &&
      Node.isArrayLiteralExpression(props["canActivate"])
    ) {
      route.guards = (props["canActivate"] as ArrayLiteralExpression)
        .getElements()
        .map((el) => el.getText());
    }

    if (props["data"] && Node.isObjectLiteralExpression(props["data"])) {
      route.data = {};
      (props["data"] as ObjectLiteralExpression)
        .getProperties()
        .forEach((dataProp) => {
          if (Node.isPropertyAssignment(dataProp)) {
            const dataKey = dataProp.getNameNode().getText();
            const dataValueNode = dataProp.getInitializer();
            if (dataValueNode) {
              route.data![dataKey] = Node.isStringLiteral(dataValueNode)
                ? dataValueNode.getLiteralValue()
                : dataValueNode.getText();
            }
          }
        });
    }

    // Parse children
    if (props["children"] && Node.isArrayLiteralExpression(props["children"])) {
      const childRoutes = this.parseRouteArray(
        props["children"] as ArrayLiteralExpression,
        route.fullPath,
        sourceFile
      );
      route.children = childRoutes;
      for (const childRoute of childRoutes) {
        this.addRouteToCollection(childRoute);
      }
    }

    return route;
  }

  private parseLoadComponent(
    initializer: Node,
    props: { [key: string]: any }
  ): void {
    if (
      Node.isArrowFunction(initializer) ||
      Node.isFunctionExpression(initializer)
    ) {
      const importCall = initializer
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((call) => call.getExpression().getText() === "import");
      if (importCall && importCall.getArguments().length > 0) {
        const thenPropertyAccess = importCall.getParentWhile(
          (n) =>
            n.getKind() !== SyntaxKind.PropertyAccessExpression &&
            n !== initializer.getBody()
        );
        if (
          thenPropertyAccess &&
          Node.isPropertyAccessExpression(thenPropertyAccess)
        ) {
          const standaloneCompName = thenPropertyAccess.getNameNode().getText();
          props["component"] = standaloneCompName;
        } else {
          const importPathNode = importCall.getArguments()[0];
          if (Node.isStringLiteral(importPathNode)) {
            const importedFileName = importPathNode
              .getLiteralValue()
              .split("/")
              .pop()
              ?.split(".")[0];
            if (importedFileName) {
              const derivedCompName = this.kebabToPascalCase(importedFileName);
              props["component"] = derivedCompName;
            }
          }
        }
      }
    }
  }

  private parseLoadChildren(
    initializer: Node,
    props: { [key: string]: any },
    name: string
  ): void {
    if (
      Node.isArrowFunction(initializer) ||
      Node.isFunctionExpression(initializer)
    ) {
      const importCall = initializer
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((call) => call.getExpression().getText() === "import");
      if (importCall && importCall.getArguments().length > 0) {
        const importPathNode = importCall.getArguments()[0];
        if (Node.isStringLiteral(importPathNode)) {
          props[name] = importPathNode.getLiteralValue();
        }
      }
    } else if (Node.isStringLiteral(initializer)) {
      props[name] = initializer.getLiteralValue();
    } else if (Node.isIdentifier(initializer)) {
      this.resolveLoadChildrenIdentifier(initializer, props, name);
    }
  }

  private resolveLoadChildrenIdentifier(
    initializer: Identifier,
    props: { [key: string]: any },
    name: string
  ): void {
    try {
      const definitions = initializer.getDefinitionNodes();
      for (const def of definitions) {
        if (
          Node.isVariableDeclaration(def) ||
          Node.isFunctionDeclaration(def) ||
          Node.isPropertyAssignment(def)
        ) {
          let functionBodyNode: Node | undefined = undefined;
          if (Node.isVariableDeclaration(def))
            functionBodyNode = def.getInitializer();
          else if (Node.isFunctionDeclaration(def)) functionBodyNode = def;
          else if (Node.isPropertyAssignment(def))
            functionBodyNode = def.getInitializer();

          if (
            functionBodyNode &&
            (Node.isArrowFunction(functionBodyNode) ||
              Node.isFunctionExpression(functionBodyNode) ||
              Node.isFunctionDeclaration(functionBodyNode))
          ) {
            const importCall = functionBodyNode
              .getDescendantsOfKind(SyntaxKind.CallExpression)
              .find((call) => call.getExpression().getText() === "import");
            if (importCall && importCall.getArguments().length > 0) {
              const importPathNode = importCall.getArguments()[0];
              if (Node.isStringLiteral(importPathNode)) {
                props[name] = importPathNode.getLiteralValue();
                break;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error resolving loadChildren identifier: ${err}`);
    }
  }

  private async loadAndParseLazyModule(
    modulePathString: string,
    parentRouteFullPathForLazyModule: string,
    originatingSourceFile: SourceFile
  ): Promise<void> {
    let resolvedModulePath = modulePathString;
    let exportName: string | undefined = undefined;

    const lazyLoadSignature = `${modulePathString}#${parentRouteFullPathForLazyModule}`;
    if (this.processedLazyLoads.has(lazyLoadSignature)) {
      return;
    }

    if (resolvedModulePath.includes("#")) {
      [resolvedModulePath, exportName] = resolvedModulePath.split("#");
    }

    const baseDir = path.dirname(originatingSourceFile.getFilePath());
    let absolutePathToTry = path.resolve(baseDir, resolvedModulePath);

    const extensionsToTry = ["", ".ts", ".module.ts", ".routes.ts"];
    let foundPath: string | undefined = undefined;

    for (const ext of extensionsToTry) {
      let currentTry = absolutePathToTry + ext;
      if (fs.existsSync(currentTry) && fs.lstatSync(currentTry).isFile()) {
        foundPath = currentTry;
        break;
      }
    }

    if (
      !foundPath &&
      fs.existsSync(absolutePathToTry) &&
      fs.lstatSync(absolutePathToTry).isDirectory()
    ) {
      const defaultFiles = [
        "index.ts",
        `${path.basename(absolutePathToTry)}.routes.ts`,
        `${path.basename(absolutePathToTry)}.module.ts`,
      ];
      for (const defaultFile of defaultFiles) {
        let currentTry = path.join(absolutePathToTry, defaultFile);
        if (fs.existsSync(currentTry) && fs.lstatSync(currentTry).isFile()) {
          foundPath = currentTry;
          break;
        }
      }
    }

    if (!foundPath) {
      const fallbackBasePaths = [
        path.join(this.angularProjectPath, "src"),
        path.join(this.angularProjectPath, "src/app"),
      ];
      for (const basePath of fallbackBasePaths) {
        absolutePathToTry = path.resolve(
          basePath,
          resolvedModulePath.startsWith("./")
            ? resolvedModulePath.substring(2)
            : resolvedModulePath
        );
        for (const ext of extensionsToTry) {
          let currentTry = absolutePathToTry + ext;
          if (fs.existsSync(currentTry) && fs.lstatSync(currentTry).isFile()) {
            foundPath = currentTry;
            break;
          }
        }
        if (foundPath) break;
      }
    }

    if (!foundPath) {
      console.warn(
        `⚠️ Could not resolve lazy-loaded file path: '${modulePathString}'. Parent: ${parentRouteFullPathForLazyModule}.`
      );
      return;
    }

    const lazyLoadedSourceFile =
      this.project.addSourceFileAtPathIfExists(foundPath) ||
      this.project.getSourceFile(foundPath);

    if (lazyLoadedSourceFile) {
      this.project.resolveSourceFileDependencies();

      if (foundPath.endsWith(".module.ts")) {
        const moduleDir = path.dirname(foundPath);
        const baseModuleName = path.basename(foundPath, ".module.ts");
        const patterns = [
          `${baseModuleName}-routing.module.ts`,
          `${baseModuleName}.routing.module.ts`,
          `${baseModuleName}.routes.ts`,
        ];
        let routingFileFound = false;

        for (const pattern of patterns) {
          const routingFilePath = path.join(moduleDir, pattern);
          if (fs.existsSync(routingFilePath)) {
            const routingSourceFile =
              this.project.addSourceFileAtPathIfExists(routingFilePath) ||
              this.project.getSourceFile(routingFilePath);
            if (routingSourceFile) {
              this.project.resolveSourceFileDependencies();
              await this.analyzeRoutingModules(
                parentRouteFullPathForLazyModule,
                [routingSourceFile]
              );
              routingFileFound = true;
              break;
            }
          }
        }

        if (!routingFileFound) {
          await this.analyzeRoutingModules(parentRouteFullPathForLazyModule, [
            lazyLoadedSourceFile,
          ]);
        }
      } else {
        await this.analyzeRoutingModules(parentRouteFullPathForLazyModule, [
          lazyLoadedSourceFile,
        ]);
      }
    }

    this.processedLazyLoads.add(lazyLoadSignature);
  }

  private async analyzeSourceFilesForNavigation(): Promise<void> {
    const sourceFiles = this.project.getSourceFiles();
    for (const sourceFile of sourceFiles) {
      this.extractProgrammaticNavigation(sourceFile);

      const filePath = sourceFile.getFilePath();
      if (filePath.endsWith(".component.ts")) {
        await this.analyzeComponentNavigation(sourceFile);
      }
    }
  }

  private async analyzeComponentNavigation(
    sourceFile: SourceFile
  ): Promise<void> {
    const componentClass = sourceFile.getClasses()[0];
    if (!componentClass) return;

    const filePath = sourceFile.getFilePath();
    let templateContent: string | null = null;
    let templatePath: string | null = null;

    const decorator = componentClass.getDecorator("Component");
    if (decorator) {
      const decoratorArgs = decorator.getArguments();
      if (
        decoratorArgs.length > 0 &&
        Node.isObjectLiteralExpression(decoratorArgs[0])
      ) {
        const metadata = decoratorArgs[0] as ObjectLiteralExpression;

        // Check for templateUrl
        const templateUrlProp = metadata.getProperty("templateUrl");
        if (templateUrlProp && Node.isPropertyAssignment(templateUrlProp)) {
          const initializer = templateUrlProp.getInitializer();
          if (initializer && Node.isStringLiteral(initializer)) {
            const relativePath = initializer.getLiteralValue();
            templatePath = path.resolve(path.dirname(filePath), relativePath);
          }
        }

        // Check for inline template if no templateUrl
        if (!templatePath) {
          const templateProp = metadata.getProperty("template");
          if (templateProp && Node.isPropertyAssignment(templateProp)) {
            const initializer = templateProp.getInitializer();
            if (
              initializer &&
              (Node.isStringLiteral(initializer) ||
                Node.isNoSubstitutionTemplateLiteral(initializer))
            ) {
              templateContent = initializer.getLiteralText();
            }
          }
        }
      }
    }

    if (templatePath && fs.existsSync(templatePath)) {
      templateContent = fs.readFileSync(templatePath, "utf-8");
    }

    if (templateContent) {
      this.extractTemplateNavigation(
        templateContent,
        templatePath || filePath,
        this.kebabToPascalCase(path.basename(filePath))
      );
    }
  }

  private extractProgrammaticNavigation(sourceFile: SourceFile): void {
    const navigateCalls = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((call) => {
        const expr = call.getExpression();
        const exprText = expr.getText();
        return !!exprText.match(/router\.(navigate|navigateByUrl)/);
      });

    for (const call of navigateCalls) {
      const flow = this.parseNavigationCall(call, sourceFile.getFilePath());
      if (flow) {
        this.flows.push(flow);
      }
    }
  }

  private parseNavigationCall(
    callNode: CallExpression,
    filePath: string
  ): NavigationFlow | null {
    const expression = callNode.getExpression().getText();
    const isNavigateCall =
      expression.endsWith("router.navigate") ||
      expression.endsWith("router.navigateByUrl");
    if (!isNavigateCall) return null;

    const navArgs = callNode.getArguments();
    if (navArgs.length === 0) return null;

    const targetPathNode = navArgs[0];
    let targetPath: string | undefined;

    if (Node.isArrayLiteralExpression(targetPathNode)) {
      let segments: string[] = [];
      targetPathNode.getElements().forEach((elNode) => {
        if (Node.isStringLiteral(elNode)) {
          segments.push(elNode.getLiteralValue());
        } else {
          const elText = elNode.getText();
          if (elText.toLowerCase().includes("id")) {
            segments.push(":id");
          } else {
            segments.push(`:${elText.replace(/[^a-zA-Z0-9_]/g, "")}`);
          }
        }
      });

      if (segments.length > 0) {
        let builtPath = "";
        if (segments[0].startsWith("/")) {
          builtPath = segments[0];
          for (let i = 1; i < segments.length; i++) {
            if (!builtPath.endsWith("/")) {
              builtPath += "/";
            }
            builtPath += segments[i].startsWith("/")
              ? segments[i].substring(1)
              : segments[i];
          }
        } else {
          builtPath = segments
            .map((s) => s.replace(/^\/+|\/+$/g, ""))
            .filter((s) => s)
            .join("/");
        }
        targetPath = builtPath.replace(/\/\//g, "/");
      }
    } else if (Node.isStringLiteral(targetPathNode)) {
      targetPath = targetPathNode.getLiteralValue();
    }

    if (targetPath === undefined) return null;

    let fromContextIdentifier: string;
    const containingClass = callNode.getFirstAncestorByKind(
      SyntaxKind.ClassDeclaration
    );
    if (containingClass && containingClass.getNameNode()) {
      fromContextIdentifier = containingClass.getName()!;
    } else {
      const baseName = path.basename(filePath, path.extname(filePath));
      const strippedName = baseName.replace(/\.(component|service|guard)$/, "");
      fromContextIdentifier = this.kebabToPascalCase(strippedName);
    }

    if (!targetPath.startsWith("/")) {
      const currentRoute = this.routes.find(
        (r) => r.component === fromContextIdentifier
      );
      if (currentRoute && currentRoute.fullPath) {
        try {
          const ensuredBasePath = currentRoute.fullPath.startsWith("/")
            ? currentRoute.fullPath
            : "/" + currentRoute.fullPath;
          const baseUrlString = "http://dummy.com" + ensuredBasePath;
          const baseUrl = new URL(baseUrlString);
          targetPath = new URL(targetPath, baseUrl).pathname;
        } catch (e: any) {
          console.warn(
            `Failed to resolve relative path "${targetPath}" against base "${currentRoute.fullPath}". Error: ${e.message}`
          );
        }
      }
    }

    const from =
      containingClass && containingClass.getNameNode()
        ? containingClass.getName()!
        : fromContextIdentifier;
    return { from, to: targetPath, type: "dynamic" };
  }

  private extractTemplateNavigation(
    content: string,
    templateFilePath: string,
    fromComponentName: string
  ): void {
    const root = parseHTML(content);
    const routerLinks = root.querySelectorAll("[routerLink]");

    for (const link of routerLinks) {
      const routePath = link.getAttribute("routerLink");
      if (routePath) {
        let normalizedToPath = routePath.trim();
        if (normalizedToPath !== "/" && normalizedToPath.endsWith("/")) {
          normalizedToPath = normalizedToPath.slice(0, -1);
        }

        this.flows.push({
          from: fromComponentName,
          to: normalizedToPath,
          type: "static",
        });
      }
    }
  }
}
