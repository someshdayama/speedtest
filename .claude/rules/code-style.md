# Code Style Rules

## JavaScript / JSX
- Use functional components with hooks (no class components)
- Destructure props in function parameters
- Use `const` by default, `let` only when reassignment is needed
- Use arrow functions for component definitions and callbacks
- Prefer optional chaining (`?.`) and nullish coalescing (`??`)

## Naming
- **Components**: PascalCase (e.g., `SpeedGauge`, `ResultsDisplay`)
- **Files**: Match the component name (e.g., `SpeedGauge.jsx`)
- **Test files**: `ComponentName.test.jsx`
- **Functions/variables**: camelCase
- **CSS classes**: kebab-case or BEM
- **Constants**: UPPER_SNAKE_CASE

## CSS
- Use CSS custom properties (variables) for theming
- Component-scoped styles in separate `.css` files
- Global styles in `index.css`
- Responsive design for all components

## Imports
- Group imports: React → third-party → local components → styles
- Use relative paths for local imports
