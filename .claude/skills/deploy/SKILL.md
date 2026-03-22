---
name: deploy
description: Test and build the application for deployment
---

# Deploy

Run tests and build the application for production deployment.

## Steps

1. **Run tests**:
   ```bash
   npm run test
   ```

2. **Pre-flight checks**:
   - Ensure all dependencies are installed: `npm install`
   - Check for lint errors: `npm run lint`

3. **Build**:
   ```bash
   npm run build
   ```

4. **Verify build**:
   - Check that `dist/` directory was created
   - Verify `dist/index.html` exists
   - Report bundle sizes

5. **Post-build**:
   - Preview locally if needed: `npm run preview`
   - Report success or failure with details
