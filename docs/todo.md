# Todo

Later work that is agreed but not started.

- Accessibility: meet WCAG 2.2 level AA as far as we can. Audit every screen for contrast (text and chart marks), keyboard use and visible focus, focus order in sheets and dialogs, target size (24 by 24 px minimum), labels and names for icon buttons and charts, text alternatives for charts (a table or summary), reduced motion, zoom to 400% without loss, and status messages announced to screen readers. Use the better-accessibility and better-colors skills in .claude/skills for the audit.
- In-app chat with OpenRouter, from the chat mockup in Claude Design. Chat history sits in the sidebar for the person being viewed; there is no person switch in the chat. Tests: a mocked suite that runs by default and a live suite against OpenRouter that only runs on demand (`pnpm test:live`), so normal runs spend no credits. The vitest skill in .claude/skills covers test projects and tags for that split.
