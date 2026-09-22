# Workspace Guidelines & Feature Specifications Compliance

## Dynamic Feature Specification Alignment
All feature developments, UI/UX enhancements, bug fixes, and refactoring tasks in this repository MUST strictly align with **ALL feature specification documents located in [`features/`](file:///c:/ash-projects/Badminton-Session-Manager-Web/features)**.

> [!IMPORTANT]
> The specification suite inside [`features/`](file:///c:/ash-projects/Badminton-Session-Manager-Web/features) is dynamic and will expand as new feature documents are added over time. You MUST dynamically inspect all existing and newly added `.md` specification files inside `features/` whenever evaluating code changes.

## Workflow & Contradiction Resolution Protocol

1. **Dynamic Review**: Before proposing or modifying code, inspect all relevant feature specification files in [`features/`](file:///c:/ash-projects/Badminton-Session-Manager-Web/features).
2. **Complement & Extend**: Build additions that complement and extend existing user journeys without regressing baseline capabilities or established workflows.
3. **Detect & Resolve Contradictions**:
   - If a proposed change or user request conflicts with **any** specification document in [`features/`](file:///c:/ash-projects/Badminton-Session-Manager-Web/features):
     - Immediately report the contradiction to the user and cite the specific feature document(s) causing the conflict.
     - Present clear, actionable options and solution trade-offs (e.g., Option A: Update feature spec, Option B: Alternative compliant flow, Option C: Configurable setting/toggle).
     - Wait for user decision and explicit approval before modifying code.
