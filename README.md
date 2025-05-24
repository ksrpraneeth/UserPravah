# User Pravah - User Flow Visualizer

<p align="center">
    <a href="https://www.npmjs.com/package/userpravah">
        <img src="https://img.shields.io/npm/dw/userpravah?logo=npm&label=downloads" alt="NPM Weekly Downloads"/>
    </a>
  <a href="https://www.npmjs.com/package/userpravah">
    <img src="https://img.shields.io/npm/v/userpravah?logo=npm&label=npm" alt="NPM Version"/>
  </a>
 
  <a href="https://github.com/ksrpraneeth/userpravah/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/userpravah?color=blue" alt="License"/>
  </a>
  <img src="https://img.shields.io/badge/build-passing-green.svg" alt="Build Status"/>
  <a href="https://discord.gg/HXqWcdjv">
    <img src="https://img.shields.io/badge/Discord-Join%20Chat-5865F2?logo=discord&logoColor=white" alt="Join our Discord"/>
  </a>
   <a href="https://github.com/ksrpraneeth/userpravah">
    <img src="https://img.shields.io/github/stars/ksrpraneeth/userpravah?style=social" alt="GitHub Stars"/>
  </a>
</p>

## Community & Discussion

Join our Discord server for healthy discussions, to ask questions, share ideas, or to collaborate on UserPravah!

<div><a href="https://discord.gg/HXqWcdjv">
    <img src="https://img.shields.io/badge/Discord-Join%20Chat-5865F2?logo=discord&logoColor=white" alt="Join our Discord"/>
</a></div>
## Overview
<p align="center">
  <img src="img/userpravah_logo.png" alt="UserPravah Logo" width="250"/>
</p>

UserPravah (where "Pravah" means _flow_) is a versatile command-line tool for analyzing web applications and generating visual diagrams of user navigation paths and page-to-page flows. It helps developers,tester and all stake holders understand complex application user flows, page to page navigations and document user journeys.

Here's an example of what UserPravah can generate for an Angular application:

![UserPravah Sample Output](img/user-flows.png)

This tool is invaluable for:

- Understanding complex application architectures.
- Onboarding new developers.
- Identifying dead-ends or overly complex navigation paths.
- Documenting application flow.
- Refactoring and planning new features.

Currently, UserPravah offers comprehensive support for **Angular** projects, with plans to expand to other frameworks (see Roadmap).

## 🆕 What's New in v0.1.0

### 🏗️ **Complete Architecture Overhaul**

- **Modular Plugin System**: Transformed from a monolithic 1,395-line file into a clean, extensible architecture
- **Framework Extensibility**: Easy addition of new frameworks via `IFrameworkAnalyzer` interface
- **Output Format Extensibility**: Multiple output formats via `IOutputGenerator` interface
- **Intelligent Auto-Detection**: Smart framework detection system

### 🎯 **New Capabilities**

- **React Support**: Added React Router and Next.js analysis (experimental)
- **JSON Export**: Structured data export with comprehensive metadata and statistics
- **Enhanced Themes**: DOT output with dark, colorful, and default themes
- **Programmatic API**: Full TypeScript API for library integration
- **Enhanced CLI**: New options for framework selection, output formats, themes, and layout control

### ✅ **100% Backward Compatibility**

- All existing Angular analysis features preserved
- Same CLI usage patterns continue to work seamlessly
- All original test cases pass without modification
- No breaking changes to existing output formats

### 🔧 **Developer Experience Improvements**

- **Type Safety**: Full TypeScript interfaces and contracts throughout
- **Separation of Concerns**: Core logic, framework analysis, and output generation are properly decoupled
- **Easy Testing**: Individual components can be unit tested independently
- **Clear Extension Points**: Well-documented interfaces for adding new frameworks and output formats

### 🚀 **Advanced Features**

- **Multi-Output Generation**: Generate multiple formats (DOT, JSON) in a single run
- **Custom Styling**: Theme support with dark mode and colorful variants
- **Layout Control**: Multiple layout options (LR, TB, BT, RL) for different visualization needs
- **Guard Detection**: Enhanced route guard visualization with proper labeling

## Features

- **Framework-Specific Analysis**: Deeply understands the routing and navigation mechanisms of supported frameworks.
  - **Angular (Current)**: Detects routes via `RouterModule`, `provideRouter`, standalone components (`loadComponent`), lazy-loaded modules, programmatic navigation (`router.navigate`, `router.navigateByUrl`), and template links (`[routerLink]`).
- **Clear Visual Output**: Generates a `.dot` graph file and a `.png` image using Graphviz, showing pages/routes as nodes and navigations/relationships as edges.
- **Customizable Node Appearance**: Nodes are colored and styled for better visual distinction.
- **Handles Modern Architectures**: Adapts to both traditional (e.g., NgModules) and modern (e.g., standalone components) patterns within supported frameworks.

## Prerequisites

Before you can use this tool, you need to have the following installed:

- **Node.js**: Version 16.x or higher is recommended.
- **npm** (or yarn/pnpm): Usually comes with Node.js.
- **Graphviz**: This is required to generate the PNG image from the DOT file. You can download it from [graphviz.org](https://graphviz.org/download/). Ensure the `dot` command is in your system's PATH.
  - **macOS (using Homebrew):**
    ```bash
    brew install graphviz
    ```
  - **Windows (using Chocolatey or Winget):**
    - Using Chocolatey:
      ```bash
      choco install graphviz
      ```
    - Using Winget:
      ```bash
      winget install graphviz.graphviz
      ```
    - Alternatively, download the installer from the [Graphviz downloads page](https://graphviz.org/download/). Remember to add Graphviz to your system's PATH environmental variable during or after installation.
  - **Linux (using package managers):**
    - For Debian/Ubuntu-based systems:
      ```bash
      sudo apt-get update
      sudo apt-get install graphviz -y
      ```
    - For Fedora/RHEL-based systems:
      ```bash
      sudo dnf install graphviz -y
      ```
    - For Arch Linux:
      ```bash
      sudo pacman -S graphviz
      ```

## Installation

To install UserPravah globally, run the following command:

```bash
npm install -g userpravah
```

### How to run the CLI

Once installed, you can run UserPravah from your terminal with various options:

```bash
userpravah <path_to_your_project_root> [options]
```

### CLI Options

UserPravah v0.1.0 introduces enhanced CLI options for greater control over analysis and output:

```bash
Options:
  --framework <name>     Specify framework (auto-detect if not provided)
                         Available: angular, react
  --output <formats>     Output formats (comma-separated, default: dot)
                         Available: dot, json
  --output-dir <path>    Output directory (default: current directory)
  --theme <theme>        Theme for DOT output (default, dark, colorful)
  --layout <layout>      Layout for DOT output (LR, TB, BT, RL)
                         LR=Left-Right, TB=Top-Bottom, BT=Bottom-Top, RL=Right-Left
  --no-image            Skip image generation for DOT output
  --help, -h            Show help message
```

### Example usage

**Basic usage (Auto-detect framework):**

```bash
userpravah my-angular-app
```

**Specify framework explicitly:**

```bash
userpravah my-react-app --framework react
```

**Multiple output formats:**

```bash
userpravah my-app --output dot,json
```

**Custom theme and layout:**

```bash
userpravah my-app --theme dark --layout TB
```

**Custom output directory:**

```bash
userpravah my-app --output-dir ./analysis-results
```

**Generate only DOT file (skip image):**

```bash
userpravah my-app --no-image
```

**Complex example:**

```bash
userpravah ./my-project --framework angular --output dot,json --theme colorful --layout LR --output-dir ./reports
```

### Framework Support

- **Angular**: Full support for modern Angular applications
  - RouterModule configurations
  - Standalone components with routing
  - Lazy-loaded modules
  - Route guards detection
  - Template and programmatic navigation
- **React** _(Experimental)_: Basic support for React applications
  - React Router analysis
  - Next.js file-based routing
  - Component navigation patterns

### Output Formats

1. **DOT Format** (`.dot`): Graphviz definition file

   - Default format, always generated
   - Supports themes and custom layouts
   - Can be converted to various image formats using Graphviz

2. **JSON Format** (`.json`): Structured data export
   - Comprehensive route and flow metadata
   - Analysis statistics and metrics
   - Machine-readable format for integration

### Themes

- **default**: Clean, professional appearance
- **dark**: Dark background with light text (great for presentations)
- **colorful**: Vibrant colors with enhanced visual distinction

### Layouts

- **LR** (Left-Right): Horizontal flow from left to right
- **TB** (Top-Bottom): Vertical flow from top to bottom
- **BT** (Bottom-Top): Vertical flow from bottom to top
- **RL** (Right-Left): Horizontal flow from right to left

### Output explanation

Upon completion, UserPravah will generate files in your specified output directory (or current directory by default):

- `user-flows.dot`: The graph definition file in DOT language
- `user-flows.png`: The visual graph image (unless `--no-image` is used)
- `user-flows.json`: Structured data export (when JSON format is specified)

## Interpreting the Graph

- **Nodes**: Represent pages or routes in your application.
  - The label shows a display name and the full route path.
    - **Display Name**: Derived either from the component name (e.g., `UserDashboardComponent` becomes "User Dashboard") or from the last segment of the route's path (e.g., `/admin/reports` would use "Reports"). CamelCase names are converted to Title Case.
    - **Full Route Path**: The original, complete path (e.g., `/admin/users/:id`) is shown in parentheses below the display name.
  - **Coloring**:
    - The **Root** node (`/`) is always **Orange** (`#FF8C00`).
    - Other nodes are colored based on their top-level path segment (e.g., all routes under `/settings/...` will share a similar color). This is achieved by generating a consistent color from the first segment of the path (e.g., "settings"), helping to visually group related application areas.
  - **Shape**: Nodes are rectangular boxes with rounded corners.
- **Edges (Arrows)**: Represent navigation paths or relationships.
  - **Solid Dark Green Arrows (`#006400`)**: Programmatic navigation (e.g., `router.navigate()` or `router.navigateByUrl()` in Angular TypeScript code).
    - **Label**: If the destination route is protected by route guards (e.g., `AuthGuard`), the guard names will be displayed as a label on the arrow (e.g., "CanActivateGuard, RoleGuard").
  - **Solid Steel Blue Arrows (`#4682B4`)**: Template-based navigation (e.g., `[routerLink]` in Angular HTML templates).
  - **Dashed Blue Arrows**: Route redirects (defined with `redirectTo` in route configurations).
  - **Dark Gray Arrows (`#A9A9A9`) with No Arrowhead**: Hierarchical parent-child route relationships. These illustrate the structural nesting of routes (e.g., `/products` as a parent of `/products/details`) and do not represent a direct user navigation click.

## How it Works (General Approach)

UserPravah employs a multi-stage process:

1.  **Project Loading**: Initializes an appropriate code analysis environment for the target project (e.g., using `ts-morph` for TypeScript-based projects like Angular).
2.  **Route/Page Discovery**: Parses framework-specific conventions to identify all possible pages, routes, and their configurations (e.g., routing modules, configuration files, decorators in Angular).
3.  **Navigation Extraction**: Scans source code (TypeScript, HTML templates, etc.) for navigation triggers, such as API calls that change routes or declarative links.
4.  **Graph Modeling**: Constructs an internal graph representation where pages/routes are nodes and navigations are edges.
5.  **Visualization**: Uses `ts-graphviz` and Graphviz to render the internal graph model into DOT and image (PNG) formats.

## Roadmap & Contributing

UserPravah is an evolving project, and contributions are highly welcome!

**Planned Features & Framework Support (Roadmap):**

- **Current Focus**: Refining Angular support, improving error handling, and enhancing graph clarity.
- **Next Frameworks (Potential Order):**
  - React (with React Router)
  - Vue.js (with Vue Router)
  - Svelte / SvelteKit
  - Other popular backend or full-stack frameworks if applicable for clear navigation patterns.
- **Core Enhancements:**
  - More sophisticated display name generation and node grouping.
  - Support for identifying entry points and exit points.
  - Interactive graph outputs (e.g., web-based UI, clickable nodes).
  - Plugin architecture for easier addition of new framework analyzers.
  - Configuration options (via file or CLI flags) for output, parsing depth, etc.

**How to Contribute:**

If you'd like to contribute to the development of UserPravah, here's how you can set up the project locally:

1.  **Clone the repository (or copy the `graphgeneratorts` directory):**

    ```bash
    # If you have the full project
    git clone https://github.com/[your_username]/userpravah.git # Replace with actual URL once created
    cd userpravah/graphgeneratorts
    # Or if you just have the directory, navigate into it
    # cd graphgeneratorts
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

    This will install necessary packages like `ts-morph`, `node-html-parser`, `ts-graphviz`, etc.

3.  Open an issue to discuss the change, new feature, or report a bug.
4.  Fork the repository and submit a pull request with your changes.

## Testing

UserPravah uses a test suite based on mock Angular projects to ensure the accuracy and stability of its analysis and graph generation capabilities. This approach helps verify that the tool correctly interprets various Angular routing configurations and navigation patterns. For a detailed breakdown of specific features covered and planned for future tests, please see the [`TestCoverage.md`](./tests/TestCoverage.md) file.

**Testing Procedure:**

1.  **Mock Projects:** A collection of small, self-contained mock Angular projects are located in the `graphgeneratorts/tests/mock-projects/` directory. Each mock project is designed to test a specific feature or scenario, such as:

    - Basic routing (`simple-app`)
    - Lazy-loaded modules (`lazy-load-app`)
    - (Future tests could include redirects, path parameters, programmatic navigation, etc.)

2.  **Expected Outputs:** For each mock project, there is a corresponding "expected" `.dot` graph file stored in `graphgeneratorts/tests/expected-outputs/`. This file represents the correct visual output UserPravah should generate for that specific mock project.

3.  **Test Execution:**

    - A shell script, `graphgeneratorts/run-tests.sh`, automates the testing process.
    - To run the tests, navigate to the `graphgeneratorts` directory and execute:
      ```bash
      chmod +x run-tests.sh
      ./run-tests.sh
      ```
    - The script iterates through each mock project defined within it. For each project, it:
      1.  Runs the `npm run analyze -- <path_to_mock_project>` command.
      2.  Compares the generated `user-flows.dot` file with the corresponding expected `.dot` file from the `expected-outputs` directory using `diff`.

4.  **Test Results:**
    - If the generated `.dot` file exactly matches the expected file, the test case is marked as a "SUCCESS".
    - If there are differences, the test case is marked as a "FAILURE", and the `diff` output is displayed. The script will also provide a command to help update the expected file if the changes in the generated output are intentional and correct (e.g., after improving the graph generator).

**Why This Testing Approach?**

- **Integration Testing:** This method effectively tests the integration of UserPravah's various components, from project loading and AST parsing (`ts-morph`) to route discovery, navigation extraction, and final DOT graph generation. It ensures the entire pipeline works as intended.
- **Realistic Scenarios:** Analyzing small but realistic Angular project structures provides more meaningful validation of the core logic than isolated unit tests could for the complex analysis engine.
- **Verifiable & Tangible Output:** The tests directly verify the `.dot` output, which is the primary artifact used to generate the visual diagrams. This makes it easy to confirm the correctness of the end result.
- **Regression Prevention:** Once an expected output is established, these tests act as regression tests. They help catch any unintended changes or breakages in the graph generation logic as the codebase evolves.
- **Extensibility:** New test cases for different Angular features or edge cases can be easily added by creating a new mock project and its corresponding expected `.dot` file.
- **Development Aid:** When developing new features or refactoring the analyzer, failing tests provide immediate feedback, and the `diff` output helps pinpoint discrepancies. The ability to easily update the expected output (e.g., `cp ./user-flows.dot tests/expected-outputs/my-new-app.dot`) is useful during development iterations.

While this integration-focused testing is primary for the core analysis, traditional unit tests can and should be used for any utility functions or isolated logic within the codebase that do not heavily depend on the `ts-morph` project context or file system interactions.

## Disclaimer

**Please Note:** UserPravah is currently developed and maintained by an individual developer. While every effort is made to ensure its quality and accuracy, it is provided "as-is" and is **not recommended for critical production usage** at this stage.

Bugs are inevitable in any software project, especially one in active development. If you encounter any issues or unexpected behavior, please **report them via the GitHub Issues page** for this project. Your feedback and bug reports are invaluable!

With the help of the community through contributions and bug reporting, we can make UserPravah a more robust and reliable tool for everyone.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
