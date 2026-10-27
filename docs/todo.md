# Todo

Later work that is agreed but not started.

- Accessibility: meet WCAG 2.2 level AA as far as we can. Audit every screen for contrast (text and chart marks), keyboard use and visible focus, focus order in sheets and dialogs, target size (24 by 24 px minimum), labels and names for icon buttons and charts, text alternatives for charts (a table or summary), reduced motion, zoom to 400% without loss, and status messages announced to screen readers. Use the better-accessibility and better-colors skills in .claude/skills for the audit.
- In-app chat: built (src/server/chat, src/components/chat, /ask, /more/chat). Still to do: try it with real data and a real OpenRouter key, and decide whether to require zero-data-retention providers (OpenRouter's `zdr`), which may limit the models.
