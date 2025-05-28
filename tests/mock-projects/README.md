# UserPravah Mock Projects

This directory contains comprehensive test projects for validating UserPravah's analysis capabilities across different frameworks.

## 📁 Project Structure

```
mock-projects/
├── angular-simple/          # Basic Angular routing patterns
├── angular-lazy-loading/    # Advanced Angular with lazy loading
├── react-sample/           # Basic React Router patterns  
├── react-comprehensive/    # Advanced React routing patterns
└── nextjs-sample/          # Next.js file-based routing
```

## 🚀 Quick Start

### Angular Projects

**Angular Simple:**
```bash
cd angular-simple
npm install
npm start  # Runs on http://localhost:4200
```

**Angular Lazy Loading:**
```bash
cd angular-lazy-loading
npm install
npm start  # Runs on http://localhost:4201
```

### React Projects

**React Sample:**
```bash
cd react-sample
npm install
npm start  # Runs on http://localhost:3000
```

**React Comprehensive:**
```bash
cd react-comprehensive
npm install
npm start  # Runs on http://localhost:3000
```

**Next.js Sample:**
```bash
cd nextjs-sample
npm install
npm run build  # Build first
npm start       # Then start production server
# OR for development:
npm run dev     # Development server
```

## 🔍 UserPravah Analysis

Analyze any project with UserPravah:

```bash
# From UserPravah root directory
userpravah tests/mock-projects/angular-simple --framework angular
userpravah tests/mock-projects/angular-lazy-loading --framework angular
userpravah tests/mock-projects/react-sample --framework react
userpravah tests/mock-projects/react-comprehensive --framework react
userpravah tests/mock-projects/nextjs-sample --framework react
```

## 📊 Expected Analysis Results

### Angular Simple
- **Routes:** 7 routes including dynamic parameters
- **Navigation Flows:** 25+ programmatic and template-based flows
- **Features:** Basic routing, redirects, wildcard routes, conditional navigation

### Angular Lazy Loading  
- **Routes:** 6 routes with lazy loading boundaries
- **Navigation Flows:** 15+ flows across module boundaries
- **Features:** Lazy modules, nested routes, dynamic imports, standalone components

### React Sample
- **Routes:** 7 routes with React Router v6
- **Navigation Flows:** 34+ navigation patterns
- **Features:** Basic routing, dynamic parameters, programmatic navigation

### React Comprehensive
- **Routes:** 24+ routes with advanced patterns
- **Navigation Flows:** 45+ complex navigation flows
- **Features:** Nested routing, protected routes, lazy loading, menu structures

### Next.js Sample
- **Routes:** 4 routes with file-based routing
- **Navigation Flows:** 8+ Next.js specific patterns
- **Features:** File-based routing, dynamic routes, Next.js Link components

## 🎯 Testing Scenarios

Each project tests specific UserPravah capabilities:

### Route Detection
- ✅ Static routes
- ✅ Dynamic routes with parameters
- ✅ Nested routes
- ✅ Lazy-loaded routes
- ✅ File-based routes (Next.js)
- ✅ Redirects and wildcards

### Navigation Analysis
- ✅ Template-based navigation (routerLink, Link)
- ✅ Programmatic navigation (router.navigate, useNavigate)
- ✅ Conditional navigation patterns
- ✅ Dynamic route construction
- ✅ Cross-module navigation

### Component Mapping
- ✅ Component-to-route relationships
- ✅ Lazy-loaded component detection
- ✅ Standalone component analysis
- ✅ Menu structure extraction

### Framework-Specific Features
- ✅ Angular: RouterModule, provideRouter, lazy modules
- ✅ React: React Router, useNavigate, Link components
- ✅ Next.js: File-based routing, next/link, dynamic imports

## 🛠️ Development Notes

### Project Naming Convention
- `angular-*`: Angular framework projects
- `react-*`: React framework projects  
- `nextjs-*`: Next.js framework projects

### Port Assignments
- Angular Simple: 4200
- Angular Lazy Loading: 4201
- React projects: 3000
- Next.js: 3000 (dev) / production port varies

### Dependencies
All projects use modern versions:
- Angular 17+
- React 18+
- Next.js 14+
- TypeScript throughout

## 📈 Validation Checklist

When testing UserPravah with these projects:

- [ ] All routes are detected correctly
- [ ] Navigation flows are mapped accurately  
- [ ] Component relationships are identified
- [ ] Framework-specific patterns are recognized
- [ ] Output formats (DOT, JSON) are generated
- [ ] Visual diagrams show proper hierarchies
- [ ] No critical analysis errors occur

## 🔧 Troubleshooting

**Common Issues:**

1. **Port conflicts:** Ensure no other apps are running on the same ports
2. **Node version:** Use Node.js 16+ for compatibility
3. **Dependencies:** Run `npm install` in each project directory
4. **Build errors:** Check TypeScript compilation errors and fix syntax issues

**Angular Specific:**
- Ensure Angular CLI is installed globally: `npm install -g @angular/cli`
- Check for template syntax errors (especially @ symbols in emails)

**React Specific:**
- Ensure React scripts are available
- Check for JSX syntax errors

**Next.js Specific:**
- Build before running production: `npm run build`
- Use `npm run dev` for development mode 