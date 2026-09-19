# Workspace Memory & Project Guidelines: Game for Indian Couples (Mobile)

## 1. Project Context & Brief
- **Target Audience:** Indian couples (dating, live-in, engaged, newlyweds, long-term).
- **Form Factor:** Mobile-first web application / game.
- **Tone & Feeling:** Warm, playful, intimate, relatable, grounded in authentic Indian couple dynamics and shared everyday rituals (e.g. deciding what to eat, tea/chai debates, family dynamics, late-night conversations, travel styles, inside jokes, love languages).
- **Quality Mandate:** Distinctive, bespoke design that feels handcrafted by an opinionated design lead. Zero generic template feel.

---

## 2. Core Frontend Design Rules

### Grounding in Subject Matter
- Avoid both generic Western tropes AND cheap Indian caricatures (no cheesy mandalas slapped onto generic cards, no garish wedding-card gold/red unless specifically intentional).
- Draw aesthetic inspiration from authentic textures, contemporary Indian art, warm tactile interactions, and intimate two-player ergonomics.

### Avoid Standard AI Design Tells
1. **No Anthropic/Claude default:** Do not use warm cream (`#F4F1EA`) with high-contrast serif display and terracotta/warm clay accent (`#D97757`).
2. **No dark-mode dev default:** Do not use near-black with bright acid-green or generic vermilion.
3. **No broadsheet/newspaper layout:** Avoid hairline rules, zero border-radius dense newspaper columns.
4. **No SaaS-card kit:** Avoid chopping content into identical rounded cards with uniform border-radius, soft grey shadows (`rgba(0,0,0,.1)`), and decorative gradient washes.
5. **No template chrome:**
   - No tracked-out ALL-CAPS eyebrow labels above headlines.
   - No meta strings joined with middle dots (`A · B · C`).
   - No `WORD — fragment` with spaced em dashes.
   - No monospace type for random labels.
   - No automatic `→` appended to links and buttons.
   - No highlighting or accenting just a single word in a headline.

### Typography & Structure
- Pick deliberate, characterful typefaces (1 or 2 distinct families).
- Intentional type scale following *The Elements of Typographic Style*.
- Line lengths under 80 characters.
- Visual structure must encode real information, not act as decorative padding (e.g., no `01 / 02 / 03` unless content is strictly sequential).

### Interaction, Motion & Restraint
- **Spend boldness in one place:** Let one hero element or interaction be unforgettable; keep the rest quiet, disciplined, and functional.
- Motion should answer user actions (reveals, selections, confirms, playful haptics/toggles) rather than unsolicited continuous animations or generic fade-up entrances.
- Mobile ergonomics: thumb-zone friendly, bottom-sheet patterns, tactile touch feedback.

### Copywriting & Voice
- Written from the user's perspective in sentence case.
- Active voice for actions ("Pick for both of you", not "Submit").
- Natural conversational tone with genuine cultural resonance, zero filler, zero corporate speak.
- Failure/empty states are clear, guiding invitations to act.

---

## 3. Workflow Execution
1. **Pass 1:** Establish the design plan (4–6 hex palette, typefaces, mobile layout concept, guiding principle).
2. **Pass 2:** Self-critique against the 5 generic tells. Revise any cliché before writing code.
3. **Build:** Write clean, modular CSS with intentional specificity and robust mobile responsiveness.
