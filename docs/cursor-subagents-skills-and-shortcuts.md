# Cursor: Subagents, Skills, and Searchable Shortcuts

A concise summary of how **subagents** and **skills** differ, how to install and use subagents, and how to get **slash-menu** discoverability similar to skills.

---

## 1. What are subagents and skills?

| | **Skills** | **Subagents** |
|---|------------|----------------|
| **Feels like** | A **recipe** or **playbook** you attach to the current chat | A **specialist** the main Agent can **delegate** to in a **separate run** with its own context |
| **Typical trigger** | **`/`** menu — you **search** and **pick** (discoverable) | Main Agent **routes** when it fits, **or** you **name** the subagent in plain language |
| **Context** | Same conversation; instructions shape how the assistant behaves | Delegated work can stay **isolated** and only **results** merge back (design goal) |
| **Best for** | Repeatable workflows (“always review like this,” “always use this checklist”) | Heavy exploration, parallel work, or roles where you want **separation** from the main thread |

**Skills** = user-invoked, lightweight, **searchable** via `/`.  
**Subagents** = orchestration primitives; **not** the same as the skills slash picker for custom definitions.

---

## 2. Difference in practice (scenario cheat sheet)

- **Use skills** when you want a **fixed sequence** or **named phase** you control—e.g. design → implement → review—each step described in markdown. You care about **repeatability** and **one obvious way** to invoke (slash + search).

- **Use subagents** when you want **another lane of work** (e.g. deep repo exploration, long tool-heavy side tasks) or a **specialist pass** with **cleaner** context—e.g. a **large review** after implementation.

- **Reality check:** Automatic subagent routing is **heuristic**, not guaranteed. For important work, **name the role** or use **slash commands** (below) so behavior is predictable.

---

## 3. How to install subagents

### Cursor-native location (custom subagents)

- **Project-only:** `<repo>/.cursor/agents/*.md`
- **Global (all projects):** `~/.cursor/agents/*.md`

Each file is usually **Markdown with YAML frontmatter** (e.g. `name`, `description`, instructions). Cursor is meant to **discover** files in these folders (exact schema may evolve—check current [Cursor subagents docs](https://www.cursor.com/docs/context/subagents)).

### Catalogs built for Claude Code (e.g. VoltAgent)

Collections like [awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) target **Claude Code** paths:

- **Global:** `~/.claude/agents/`
- **Project:** `<repo>/.claude/agents/`

You can **copy** chosen `.md` files into **`~/.cursor/agents/`** to try them in Cursor, but they were authored for **Claude Code**; behavior in Cursor may differ slightly.

**Create the folder if missing:** `mkdir -p ~/.cursor/agents` (or `.cursor/agents` in the repo).

---

## 4. How to use subagents

1. **Automatic (when appropriate)**  
   The **Agent** may delegate to built-in helpers (e.g. explore / terminal / browser-style flows) or match a **custom** subagent using **name + description**. This is **not** a guarantee on every message.

2. **Explicit (reliable)**  
   In **Agent** chat, **name the subagent** (same as the `.md` filename without `.md`), e.g.  
   *“Use the **code-reviewer** subagent on the files under `src/…`.”*

3. **Visibility**  
   You may or may not see a clear “subagent ran” label in the UI, depending on version. If you must **know** what ran, prefer **explicit naming** or **slash commands** (next section).

---

## 5. The “shortcut”: searchable commands (slash menu)

Subagents **do not** generally appear in the same **`/`** searchable list as **skills**. To get a **similar experience** (type `/`, search, pick):

### Use `.cursor/commands/*.md`

- **Project (recommended, shareable):** `<repo>/.cursor/commands/*.md`
- **Global (sometimes flaky):** `~/.cursor/commands/`

Each **`.md` file** becomes a **command** in the slash menu. Put **keywords in the `description`** (YAML frontmatter) so search matches “QA,” “PM,” “architecture,” etc.

**Example pattern**

- `qa-expert.md` → body says: answer as **qa-expert**, align with `~/.cursor/agents/qa-expert.md` if present.
- Optional **aliases** (e.g. `pm-product.md`) with short descriptions for extra search terms.

After adding files, **reload the window** if commands do not show up.

This repo includes examples under **`.cursor/commands/`** for several roles.

---

## 6. Quick reference

| Goal | Mechanism |
|------|-----------|
| Discoverable **`/`** + search | **`.cursor/commands/`** markdown files |
| Isolated / delegated specialist work | **Subagents** (`.cursor/agents/`) + explicit ask |
| Native VoltAgent / Claude Code workflow | **`~/.claude/agents/`** + Claude Code’s **`/agents`** (different product) |

---

*Last updated from internal learning notes; Cursor UI and docs evolve—verify behavior in your installed version.*
