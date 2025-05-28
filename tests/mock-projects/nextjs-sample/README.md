# Next.js Sample Test Project

This is a simple Next.js application using file-based routing for testing UserPravah's Next.js analysis capabilities.

## Features

- Next.js file-based routing (Pages Router)
- Dynamic routes with parameters
- Nested routing structure
- Next.js Link components for navigation

## Routes

- `/` - Home page (pages/index.tsx)
- `/about` - About page (pages/about.tsx)
- `/products` - Products listing (pages/products/index.tsx)
- `/products/[id]` - Product details with dynamic parameter (pages/products/[id].tsx)

## Running the Project

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## UserPravah Analysis

To analyze this project with UserPravah:

```bash
userpravah . --framework react
```

This will generate a flow diagram showing all routes and navigation patterns detected in the Next.js application, including file-based routing structure. 