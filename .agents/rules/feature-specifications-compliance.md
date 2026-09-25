# Feature Specifications Compliance & Contradiction Resolution Rule

When proposing, designing, or implementing any code changes, feature additions, or UI/UX modifications for this project:

## 1. Dynamic Feature Specification Review
- **Always Scan `features/`**: Before writing code or proposing architectural/UI changes, inspect **ALL** feature specification files in the [`features/`](file:///c:/ash-projects/Badminton-Session-Manager-Web/features) directory.
- **Dynamic Scope**: As new `.md` specification files are added to `features/` over time, automatically include them in all feature compliance checks.
- Ensure full alignment with user stories, key functional specifications, data models, and RBAC permissions defined across all files in `features/`.

## 2. Complement & Preserve Established Journeys
- New code edits must seamlessly complement existing feature specifications.
- Preserve existing functionality, light/dark mode color rules, multi-tenant isolation, and Elo calculation models without unintentional regressions.

## 3. Contradiction Detection & Resolution Protocol
If a user request or proposed change **contradicts** any specification in `features/*.md`:
1. **Highlight the Conflict**: Clearly explain the contradiction to the user and cite the specific feature specification document(s).
2. **Offer Solutions**: Provide clear technical options or design trade-offs:
   - **Option A**: Update the feature specification and codebase to accommodate the new requirement.
   - **Option B**: Maintain the existing feature constraint and implement an alternative compliant flow.
   - **Option C**: Introduce a configurable setting or role-based flag.
3. **Solicit User Alignment**: Wait for the user's decision before modifying code.
