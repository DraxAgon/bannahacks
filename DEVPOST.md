# Fear Ladder

**Exposure therapy, one rung at a time.**

Fear Ladder turns a patient's specific phobia into a personalized ladder of AI-generated images in about a minute: the same subject on every rung at gently rising intensity, from the word on a card to a close, sharp photo. It adapts as the patient climbs, drawing a half-step when they get stuck and new variations when they master a rung.

## Inspiration

9.1% of U.S. adults had a specific phobia last year ([NIMH](https://www.nimh.nih.gov/health/statistics/specific-phobia)), yet only ~11% get minimally adequate treatment ([NCS-R](https://www.nimh.nih.gov/sites/default/files/documents/health/statistics/prevalence/file_12.pdf)). Exposure works but is underused: as few as 7% of therapists and patients report it ([Kemp et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC9975163/)). Image exposure helps: an 8-stage spider-image hierarchy reduced fear ([Matthews et al.](https://doi.org/10.1016/j.jbtep.2014.12.003)). Existing tools ship one fixed stimulus set; we wanted every patient to get their own ladder.

## What it does

- **Describe → Plan.** The therapist types the fear. A planner (Gemini 3.8 Flash, JSON schema + zod) returns 8–10 evenly spaced rungs, each as eight visual dials.
- **Render → Check.**
  - An identity anchor locks the subject; Nano Banana 2.1 renders each rung as a reference-locked edit from a deterministic prompt.
  - sharp applies exact blur and saturation.
  - A vision critic scores identity, intensity and safety, auto-repairs failures and never shows unsafe images.
- **Session.** The patient predicts, looks with hold-to-view (it blurs the moment they let go), rates distress and reflects. Each feature maps to an inhibitory-learning strategy ([Craske et al.](https://doi.org/10.1016/j.brat.2014.04.006)).
- **Adapt.**
  - Distress that stays high triggers a live **half-step** that slides in between two rungs.
  - A per-patient ridge regression learns which dials drive this patient's fear (the **fear fingerprint**) and picks the half-step's dials.
- **Report.** SUDS curves, expectancy change, looking time, releases and the patient's own words.

## How we built it

- Next.js 16 + TypeScript. One model call per Node route (55 s budget, backoff on 429/5xx); the browser orchestrates with concurrency 3, so rungs develop one by one.
- **Under the hood** shows planner JSON, every exact prompt, sharp parameters, each attempt's critic JSON and latency, and target-vs-estimated intensity.
- Patient data stays in IndexedDB. Demo ladders, made by the same pipeline, work with no key.

## Challenges

- One consistent subject from a word card to a macro photo.
- Measurable intensity steps: prompts drift, so code controls blur and saturation, and a critic checks the order.
- Safety and agency first: blurred by default, hold-to-view, Pause always visible, nothing auto-advances.

## What's next

A clinician pilot, more phobias, therapist-shared ladders, and AR rungs at the top.

*Designed for use with a licensed therapist. Not a medical device. Built with Claude Code and the Gemini API (Nano Banana 2.1, Gemini 3.8 Flash, Gemini 3.5 Flash-Lite).*
