import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export function Why() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 prose prose-invert prose-headings:font-mono prose-headings:tracking-tight prose-p:text-muted-foreground prose-strong:text-foreground max-w-none">
      <div className="text-[11px] font-mono uppercase tracking-widest text-primary/80 not-prose">
        Why this exists
      </div>
      <h1 className="mt-3 text-4xl">Recruiting is organizational reasoning.</h1>

      <p className="lead text-lg">
        Hiring decisions are uncertain, evidence is contradictory, and the
        cost of being wrong is asymmetric. Most recruiting software treats
        this like a database problem. We treat it like a reasoning problem.
      </p>

      <h2>The flatten problem</h2>
      <p>
        The current generation of AI hiring tools collapses uncertainty into
        a single score, hides disagreement behind a ranking, and gives every
        candidate a confidence number that nobody can audit. When the
        decision is wrong, there is no replay. When the model drifts, there
        is no alarm. When the agent is overconfident, there is no critic.
      </p>

      <h2>What we built instead</h2>
      <p>
        A framework where the unit of work is a <strong>trace</strong>, not a
        score. Every reasoning step is captured with its inputs, its outputs,
        its producer, and its confidence. Agents disagree in public.
        Escalations are explicit. Calibration is a first-class engine that
        critiques the system&rsquo;s own confidence and flags the bands where
        claimed confidence systematically overstates observed outcomes.
      </p>

      <h2>What this is not</h2>
      <ul>
        <li>
          <strong>Not an ATS.</strong> No pipelines, no stages, no kanban,
          no candidate workflows in the recruiting-software sense.
        </li>
        <li>
          <strong>Not a matcher.</strong> The framework does not produce a
          fit-percentage. It produces a calibrated recommendation with
          provenance and unresolved questions.
        </li>
        <li>
          <strong>Not autonomous hiring.</strong> Humans remain
          first-class. The framework refuses to advance cases it cannot
          justify and routes them to explicit reviewers with rationale and
          confidence impact.
        </li>
      </ul>

      <h2>The four pillars</h2>
      <p>
        <strong>Deterministic by design.</strong> A trace is a function of
        its inputs. Replays are byte-stable. The replay signature is a
        sha256 hash anyone can verify.
      </p>
      <p>
        <strong>Provenance is data.</strong> The provenance graph is a
        public artefact, not a logging side-effect. Every node points back
        to who produced it.
      </p>
      <p>
        <strong>Disagreement preserved.</strong> When two agents read the
        same dossier in incompatible ways, the framework surfaces both
        readings rather than averaging them.
      </p>
      <p>
        <strong>Calibration-aware.</strong> The system tells you which
        confidence bands it does not trust about itself.
      </p>

      <h2>Who this serves</h2>
      <p>
        Founders building hiring discipline. Governance teams that need
        auditable decisions. Infrastructure engineers who treat reasoning
        as a system. People who would rather see uncertainty in plain text
        than have it laundered into a number.
      </p>

      <div className="mt-12 flex flex-wrap gap-3 not-prose">
        <Link
          href="/demo"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          See the replay <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/architecture"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:border-primary/50"
        >
          Architecture
        </Link>
      </div>
    </div>
  );
}

export default Why;
