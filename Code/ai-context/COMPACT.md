# /compact — Compact project context

Use this workflow when the user asks to compact project context. It is model-agnostic; do not claim an exact token count unless the active model exposes one.

## Workflow

1. Follow the repository's `AGENTS.md` startup instructions. Read its designated resume file first and avoid scanning excluded folders or archives.
2. Identify the context source files and compaction script from the resume or repository instructions. Read only the relevant files and sections.
3. Update context from the current project state. Keep active requirements and TODOs, decisions, constraints, identifiers, paths, and known failure fixes. Remove only information verified as obsolete or duplicated.
4. Prefer concise, structured notes. If a model token budget is known, target it with a safety margin; otherwise use the repository's documented line/size limits as a proxy. Never silently truncate required information to meet a limit.
5. Update the state file for changed files and add one short entry at the top of the changelog, following repository rules.
6. Run the repository's compaction script when provided. Confirm its exit status and generated resume size. If the core context exceeds the limit, report which source files need careful reduction rather than discarding requirements.

## For this repository

Run from the project root:

```powershell
pwsh -File ai-context/scripts/compact.ps1
```

The script prunes old changelog entries according to its `-Keep` setting and generates `ai-context/RESUME.md`, enforcing its configured line limit.
