# Deck blueprints — carousel content arcs

Carousel Maker separates two things most tools conflate:

- **The template** (`src/lib/presets`) — how a slide *looks* (type, colour, layout).
- **The blueprint** (`src/lib/content/blueprints.ts`) — how the deck *reads*: the
  order of ideas from cover to CTA.

The Art Director picks the format; the blueprint gives that format its spine, and
`buildSystemPrompt` splices it into every writer's instructions (Claude, Groq, and
the keyless template writer alike). The arc is derived from the topic
automatically, so no plumbing is needed per request.

## Where this came from

The blueprints distil the editorial method of the "famous IG carousel" playbook:

- **The cover IS the hook.** Slide 1 makes a specific promise, not a vague one.
- **No filler.** No context slide, no transition slide. Every slide delivers value.
- **A value progression**, not a random list: what it is → the substance →
  the honest caveat / the standout → what to do next → the CTA.

**What was deliberately NOT taken:** that playbook generates its slides with an
image model (Higgsfield Nano Banana Pro). Carousel Maker's founding rule is **zero
image-generation models** — every pixel is vectors, type and canvas (see
[DESIGN.md](DESIGN.md)). So only the *editorial structure* was extracted; the image
pipeline was left out by design. The method makes the writing sharper; the app's
own renderer makes the pixels.

## The arcs

| Format | Blueprint | The body progression |
|---|---|---|
| how-to | How-to spine | setup → steps in order → the ruinous mistake → how you'll know it worked |
| list | Value spine | what it is → the items (best first) → the standout → how to use them |
| comparison | Versus spine | the two options → head to head → when each wins → the verdict |
| data | Number spine | the surprising number → the sourced figures → what it does NOT say → what to do |
| myth-bust | Myth spine | state the belief → the turn → the evidence → what to do instead |
| story | Story spine | the before → the turn → the concrete lesson → the takeaway |
| quote | Quote spine | the reframing line → what it means → an example → apply it today |
| deep-dive | Explainer spine | the core idea → layer by layer → the missed nuance → why it matters |

Each is guidance, not a rigid schema: the writer stretches or combines beats to fit
the chosen slide count, but keeps the order and the value-every-slide shape.

## Also extracted: caption discipline

The writer prompt now asks captions to open with a hook line, follow with 2–3
concrete value lines, end on one clear CTA, and avoid em dashes and filler openers.
