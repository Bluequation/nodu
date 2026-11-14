# Ritmo 8: development protocol
- Scope: user explicitly authorized Aprender redesign. Preserve approved Meus planos and Agenda; remain in Aprender until next user authorization.
- Treat an approved visual prototype as a specification, not inspiration. Read docs/ritmo-8-planner-contract.md before modifying the planner.
- Keep the planner in src/features/plans/planner, using feature-local styles under .ritmo-planner. Do not append duplicate planner CSS to src/styles.css. Retain unrelated screen styles.
- Keep original edital nodes, text, source references, IDs and progress intact. Presentation labels and library groups must not change the source or invent topics. A new plan starts unassigned; preserve a saved plan unless the user explicitly resets its distribution.
- Keep exactly two planner regions: week and library. No duplicate topic lists, separate unassigned tray, or intermediate day inspector without explicit user approval.
- Before delivering a change, run typecheck, unit tests, build and browser regression. Obtain the screenshot artifact from GitHub Actions and compare with the approved prototype before calling the design visually validated. A successful build alone is not visual approval. Report any missing verification clearly and do not promote changes to production without approval.
- Prefer one coherent commit per change; preserve an easy rollback point and avoid unrelated refactors.
