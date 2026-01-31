# ChronoCompass Development Guidelines

This document provides essential information for developers working on the ChronoCompass project.

## Build/Configuration Instructions

### Prerequisites
- Node.js (version specified in `.nvmrc`)
- npm (comes with Node.js)

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
To start the development server:
```bash
npm run dev
```

This will start a Vite development server with hot module replacement.

### Building for Production
To build the application for production:
```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build
To preview the production build locally:
```bash
npm run preview
```

## Testing Information

### Testing Framework
The project uses Vitest for testing, which is integrated with Vite.

### Running Tests
To run all tests:
```bash
npm test
```

To run tests in watch mode (tests will re-run when files change):
```bash
npm run test:watch
```

### Adding New Tests
1. Create test files with the naming convention `*.test.ts` or `*.spec.ts` in the `src/tests` directory
2. For component tests, place them alongside the component with the same naming convention
3. Use the Vitest API for writing tests:

```typescript
import { describe, it, expect } from 'vitest';
import { yourFunction } from '../path/to/your/module';

describe('module or function name', () => {
  it('should do something specific', () => {
    const result = yourFunction(input);
    expect(result).toBe(expectedOutput);
  });
});
```

### Test Example
Here's a simple test for the `formatCoords` function:

```typescript
import { describe, it, expect } from 'vitest';
import { formatCoords } from '../lib/format';

describe('formatCoords', () => {
  it('should format coordinates with 5 decimal places', () => {
    expect(formatCoords(51.5074, -0.1278)).toBe('51.50740, -0.12780');
    expect(formatCoords(0, 0)).toBe('0.00000, 0.00000');
    expect(formatCoords(-90, 180)).toBe('-90.00000, 180.00000');
  });
});
```

## Additional Development Information

### Project Structure
- `src/` - Source code
  - `components/` - Svelte components
  - `lib/` - Utility functions and shared code
    - `cycles/` - Code related to time cycles
    - `stores/` - Svelte stores for state management
  - `tests/` - Test files
- `public/` - Static assets that will be served as-is
- `dist/` - Production build output

### Progressive Web App (PWA)
This project is configured as a Progressive Web App using `vite-plugin-pwa`. The service worker is disabled in development by default but can be enabled for testing by setting `devOptions: { enabled: true }` in the `vite.config.ts` file.

### TypeScript Configuration
The project uses TypeScript with strict type checking. There are separate TypeScript configurations for the app and Node.js code:
- `tsconfig.app.json` - Configuration for the application code
- `tsconfig.node.json` - Configuration for Node.js code (like Vite plugins)

### Code Style
- Use TypeScript for type safety
- Follow the existing code style in the project
- Use Svelte stores for state management
- Keep components small and focused on a single responsibility
- Document complex functions and components