# Angular Lazy Loading Test Project

This is an Angular application demonstrating lazy loading patterns for testing UserPravah's Angular analysis capabilities with advanced routing features.

## Features

- Angular 17 with standalone components
- Lazy-loaded feature modules
- Nested routing within lazy modules
- Route guards and resolvers
- Dynamic imports and code splitting
- Template and programmatic navigation

## Routes Structure

### Main Routes
- `/` - Home page
- `/about` - About page
- `/contact` - Contact page

### Lazy-Loaded Feature Module (`/lazy-feature`)
- `/lazy-feature` - Lazy feature home page
- `/lazy-feature/child-route` - Nested route within lazy module

### Standalone Lazy Component
- `/standalone-detail/:id` - Dynamically loaded standalone component

## Lazy Loading Patterns

1. **Feature Module Lazy Loading**: The `lazy-feature` module is loaded only when accessed
2. **Standalone Component Lazy Loading**: Individual components loaded on demand
3. **Nested Routes**: Child routes within lazy-loaded modules
4. **Dynamic Imports**: Uses `loadChildren` and `loadComponent` for code splitting

## Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm start
# OR
ng serve --port 4201
```

The app will be available at `http://localhost:4201`.

## UserPravah Analysis

To analyze this project with UserPravah:

```bash
userpravah . --framework angular
```

This will generate a comprehensive flow diagram showing:
- Main application routes
- Lazy-loaded module boundaries
- Nested route hierarchies within lazy modules
- Dynamic component loading patterns
- Navigation flows between lazy and eager routes
- Route guard implementations

## Expected Analysis Results

UserPravah should detect:
- **Lazy loading boundaries** and module separation
- **Nested routing structures** within feature modules
- **Dynamic imports** for code splitting
- **Route relationships** across module boundaries
- **Navigation patterns** between lazy and eager components 