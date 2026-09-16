# Accuracy & Testing Methodology

This is what makes VistaDex trustworthy rather than just plausible-looking, and it directly reuses the same discipline the team's HCI research is built on (see the [archive](../archive/discarded-concept-claim-verification/README.md) for the H2 "verification substitution" hypothesis this thinking descends from).

### Separate hard facts from judgment calls
A company being legally dissolved is a fact and should be treated as close to certain. Whether a new idea "resembles" a past failure is a judgment call and should never be presented with the same confidence as a fact.

### Require more than one independent source before confirming anything
One article alone is a lead, not a confirmed fact. A claim is only marked "confirmed" once at least two independent sources agree — for example, a news article plus a dead website plus a registry filing.

### Test the system against outcomes that are already known
Before trusting the tool's judgment on a brand-new idea, it's run against a small, deliberately curated set of ideas whose real outcome is already known — both real failures and real successes. Both are needed: testing only against failures would hide a system that flags everything as risky, since it would look "accurate" without actually discriminating between good and bad ideas.

### Favor settled cases over recent, unresolved ones
A company that looks shaky six months in might still recover. The test set leans toward cases at least a few years old, where the outcome is genuinely no longer in question.

### Build in a step whose only job is to disagree
The **Objector** pass, described in [`04-product-architecture.md`](./04-product-architecture.md), directly counters the documented tendency of AI models to be overly agreeable, especially about something a person is excited about.

### Always show the evidence, never just a score
Every claim in a report links to exactly where it came from, so a reviewer can check it themselves in seconds rather than trusting a number.

### Log every disagreement from a real reviewer
When a human reviewer overrides the tool's judgment — "no, this isn't actually the same idea" — that disagreement is recorded and reviewed, so systematic mistakes get caught rather than repeating silently.

### Frame every output as something to check, never as a final answer
"This resembles two ideas that failed — verify this yourself" is honest. A bare percentage like "87% chance of failure" is not, because that level of statistical precision is not actually earned by the underlying evidence.

## Where sources for successes come from

Tracking companies while they're alive and doing well is the easy part — Crunchbase, PitchBook, and Tracxn already do this well, so it's a live lookup, not something VistaDex needs to own or maintain. The graveyard (failures) is the thing genuinely worth building — nobody tracks this well. A smaller, separately-curated test set mixing known failures and known successes exists purely to grade VistaDex's own accuracy before trusting it on a new idea — this doesn't need to be huge, it needs to be correct and settled.
