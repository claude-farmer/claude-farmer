# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Claude Farmer, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **security@doribear.com**

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Scope

- Authentication flows (GitHub OAuth, session cookies)
- API endpoints (data exposure, authorization bypass)
- Redis data access (user impersonation, data tampering)
- CLI local state security (`~/.claude-farmer/`)

## Out of Scope

- Denial of service (this is a free hobby project)
- Social engineering
- Issues in third-party dependencies (report upstream)

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| Older   | Best effort |
