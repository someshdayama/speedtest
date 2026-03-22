---
name: security-review
description: Perform a security review of the project
---

# Security Review

Perform a comprehensive security audit of the project:

## Steps

1. **Dependency Audit**: Run `npm audit` and report any vulnerabilities
2. **API Key Exposure**: Check that no API keys, tokens, or secrets are hardcoded in source files
3. **Environment Variables**: Verify `.env` files are gitignored
4. **Input Validation**: Check for unvalidated user inputs
5. **XSS Prevention**: Ensure `dangerouslySetInnerHTML` is not used without sanitization
6. **Dependencies**: Flag any outdated dependencies with known CVEs

## Output

Provide a report with:
- **Critical**: Must fix immediately
- **Warning**: Should fix soon
- **Info**: Best practice recommendations
