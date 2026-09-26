# How a School Connects to the Internet — episode 00

The approved prototype (2026-09-26) and the series' regression reference. Its fault type in the system is
**Connectivity / No internet access**. It is now built by the OE explainer engine from its spec:

```bash
node videos/_engine/make.mjs how-a-school-connects
```

Spec: `videos/_episodes/how-a-school-connects.mjs`. Engine, set-up and the whole series:
`videos/_engine/README.md` and `videos/SERIES.md`. Rendered output (`renders/`) is not committed.

When it was ported onto the engine (2026-09-26), the voice came out identical to the millisecond
(every phrase cue and all five frame durations) and the frames matched the approved render, with the
addition of the series slate top-left.
