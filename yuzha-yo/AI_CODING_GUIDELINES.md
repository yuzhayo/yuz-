# AI Coding Guidelines

These instructions apply to any AI agent that writes or edits project source files.

## Sectioned Layout Requirement

- Every source file must be organised into explicit sections in the following order:
  1. `IMPORT SECTION`
  2. `STYLE SECTION`
  3. `STATE SECTION`
  4. `LOGIC SECTION`
  5. `UI SECTION`
  6. `EFFECT SECTION`
  7. `EXPORT SECTION`
- Use the correct comment syntax for the language (for example, `// SECTION NAME` in TypeScript). Keep the wording uppercase and include the word `SECTION`.
- If a section does not apply, still include it with `(unused)` noted after the label so future contributors know it was considered.

## Additional Notes

- Keep styling colocated with the component inside the `STYLE SECTION` when the styles are component-specific.
- Store constants and configuration used by the UI inside the `STATE` or `LOGIC` sections instead of inlining literal strings in JSX or templates.
- Only add inline explanatory comments when the behaviour would otherwise be unclear.
- Legacy files that predate this structure should be migrated into the sectioned layout the next time they are changed.
- Configuration-only formats (such as JSON or TOML) are exempt, but any accompanying script modules must follow the sectioning convention.
- Tests may use a simplified set of sections (`IMPORT`, `SETUP`, `ASSERT`, `EXPORT`) when that improves clarity while still keeping the labelled-section pattern.
- Keep structure flat as possible, no unnessesary subfolder, use naming pattern to replace subfolder.
