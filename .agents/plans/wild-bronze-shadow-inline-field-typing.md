---
date: 2026-07-13
title: Inline Field Typing
---

# Inline Field Typing (Text + Number)

## Goal

On recipient signing pages, text and number fields are edited **in place on the document** — no modal. Signature, initials, date, email, name, dropdown, checkbox, and radio stay as they are today.

This is **not** a settings feature. Inline is the default signing behaviour.

## Out of scope

- Org/team toggle or branding preference for inline vs dialog
- Inline for signature / initials / date / email / name / dropdown / checkbox / radio
- Editor and export modes
- Full `npm run build` (use targeted typecheck/lint)

## Current architecture (summary)

### V2 (primary)

- `EnvelopeSignerPageRenderer` → Konva `pointerdown` → `handleTextFieldClick` / `handleNumberFieldClick` → `SignField*Dialog.call()` → `signField()`
- Field bounds: percentage coords; HTML overlays already positioned via `EnvelopeFieldToolTip` + `ResizeObserver`
- Dialogs live in `document-signing-page-view-v2.tsx` as `.Root` mounts

### V1 (legacy)

- `DocumentSigningTextField` / `DocumentSigningNumberField` open a `Dialog` via `onPreSign` returning `false`
- Overlay already exists (`FieldContainerPortal`); input is decoupled into the modal
- Checkbox/radio already interact inline in the overlay — closest precedent

### Routes

- `sign.$token` and `d.$token` both branch on `internalVersion` (1 → V1, 2 → V2)
- Direct template (`d.$token`) uses `onSignField` / local state; do not break that path

## Commit behaviour

| Trigger | Action |
|---|---|
| **Blur** | Commit if value changed and valid; keep editing + show error if invalid |
| **Enter** | Commit if valid (text: Shift+Enter = newline when using textarea) |
| **Escape** | Cancel edit, restore previous / placeholder |
| **Re-click inserted field** | Re-enter edit mode (do **not** toggle-remove like email/name) |

- Do **not** call the sign API on every keystroke
- Read-only prefilled fields: keep existing auto-sign; not editable
- Action auth (`executeActionAuthProcedure`) still runs on commit where required

## Validation

- Reuse `validateTextField` / `validateNumberField` with `isSigningPage: true`
- Show errors inline near the field (border + short message)
- Enforce character limit client-side (V2 dialog currently only displays remaining count)
- Fix V1 number gap: validate before save (text already does)

## Phase 0 — Shared primitives

New pieces both V1 and V2 consume:

1. **`InlineFieldInput`** — styled `input` / `textarea` respecting:
   - placeholder, character limit, textAlign, overflow, fontSize
   - number: `inputMode="decimal"`, string value for format validation
2. **`useInlineFieldEditor`** (or equivalent helpers) — draft value, errors, commit/cancel, loading
3. Pure commit helpers that return `{ type, value }` payloads for TEXT / NUMBER (extract from dialog handlers)

Files (approx):

```
apps/remix/app/components/general/document-signing/inline-field-input.tsx
apps/remix/app/hooks/use-inline-field-editor.ts
apps/remix/app/utils/field-signing/commit-text-field.ts
apps/remix/app/utils/field-signing/commit-number-field.ts
```

## Phase 1 — V1 DOM signing

**Why first:** overlay already positioned; lowest risk to prove commit UX.

### Changes

1. **`document-signing-text-field.tsx`**
   - Remove Dialog / `showCustomTextModal`
   - `isEditing` state; render `InlineFieldInput` in the overlay
   - Inserted: show inserted text until click → edit
   - Preserve auto-sign, `onSignField` / `onUnsignField`, auth procedure

2. **`document-signing-number-field.tsx`**
   - Same pattern as text
   - Add pre-commit validation (parity with text)
   - Clarify assistant mode: same inline path (no silent skip)

3. **`document-signing-field-container.tsx`**
   - When `isEditing`, hide the full-overlay click-capture button so the input receives events
   - Support re-activate of inserted text/number via `onActivateSignedField` (or equivalent)

### Touch list

```
document-signing-text-field.tsx
document-signing-number-field.tsx
document-signing-field-container.tsx
inline-field-input.tsx (+ hook/helpers)
```

## Phase 2 — V2 Konva signing

**Strategy:** HTML input/textarea overlay at field bounds; bypass dialog for TEXT/NUMBER in signing only.

### Flow

```
Konva pointerdown TEXT/NUMBER
  → set activeFieldId + draft
  → render InlineFieldOverlay (z-20) over field
  → hide/disable Konva text for that field while editing
  → blur/Enter → validate → signField() + spinner
  → Escape → clear activeFieldId
```

### Changes

1. **`envelope-signer-page-renderer.tsx`**
   - State: `activeField` / draft
   - TEXT/NUMBER branches: open overlay instead of `handle*FieldClick` dialogs
   - Sibling overlay next to `.konva-container`
   - While editing: `listening(false)` on field group or hide text node

2. **`inline-field-overlay.tsx`** (new)
   - Position with same math as `EnvelopeFieldToolTip` (page-relative %, ResizeObserver)
   - Scale fontSize by viewer `scale`; match `DEFAULT_TEXT_X_PADDING`
   - Host `InlineFieldInput` + inline errors

3. **`text-field.ts` / `number-field.ts`**
   - Extract commit payload builders; stop calling dialogs from signing path
   - Leave dialog components in place until unused (optional cleanup: remove `.Root` if nothing else calls them)

4. **`document-signing-page-view-v2.tsx`**
   - Remove `SignFieldTextDialog.Root` / `SignFieldNumberDialog.Root` only after no callers

5. **Optional:** extract `useFieldOverlayCoords` from tooltip positioning (only if it reduces duplication cleanly)

### Editor / export

- Signing renderer uses `mode: 'sign'` only; editor uses a separate page renderer — no change there

### Touch list

```
envelope-signer-page-renderer.tsx
inline-field-overlay.tsx
utils/field-signing/text-field.ts
utils/field-signing/number-field.ts
document-signing-page-view-v2.tsx (dialog roots cleanup)
```

## Typography & layout notes

- Match Konva: Noto Sans, fontSize from meta (default 12), textAlign, verticalAlign, padding 6px
- Text: textarea when multi-line overflow modes need it; otherwise input is fine
- Tiny fields / mobile: rely on native focus + `inputMode`; no separate mobile dialog fallback in Phase 1–2

## Implementation order

1. Shared `InlineFieldInput` + validation/commit helpers
2. V1 text
3. V1 number
4. V2 overlay + renderer wiring
5. Remove unused dialog roots / dead dialog calls for text & number signing
6. Targeted typecheck / lint; manual test plan below

## Manual test plan

### Setup

- `/sign/:token` and `/d/:token`
- V1 and V2 envelopes

### Text

- [ ] Click empty field → caret in place, no modal
- [ ] Type visible in field
- [ ] Blur valid → signs / stamps
- [ ] Enter commits; Shift+Enter newline where textarea
- [ ] Escape cancels
- [ ] Required empty blur → inline error, no sign
- [ ] Character limit → inline error
- [ ] Read-only prefilled → auto-sign, not editable
- [ ] Placeholder, textAlign, overflow modes
- [ ] Re-click inserted → re-edit
- [ ] V2: zoom / resize / scroll keep overlay aligned

### Number

- [ ] Inline decimal input, no modal
- [ ] Invalid / min / max / format → inline error
- [ ] Blur / Enter commit
- [ ] Assistant mode consistent with inline

### Regression

- [ ] Other field types unchanged
- [ ] Direct template local persistence
- [ ] Action auth still on commit
- [ ] Embed `onFieldSigned` still fires
- [ ] Pending-field tooltip still works
- [ ] Editor placement unchanged

## Risks

| Risk | Mitigation |
|---|---|
| Konva steals clicks from HTML input | Disable listening on active group; overlay z-20 |
| Font mismatch HTML vs Konva | Shared typography constants from renderer |
| V2 dialog weaker validation | Use shared validate* helpers |
| Small fields hard to type | Acceptable for Phase 1; revisit only if needed |

## Success criteria

- Recipients type text/number directly on the document on V1 and V2 signing pages
- No dimmed modal for those types
- Existing sign mutations and validation still apply
- No new settings UI