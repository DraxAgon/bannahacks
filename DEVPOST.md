# Fear Ladder

Step 1 is the word "spider" on a card. Step 9 is a tarantula on an open palm. Fear Ladder has AI draw all nine, the same spider each time and a little closer, so people with a phobia can practice on their own. Try it at https://fear-ladder-beta.vercel.app, no account needed.

## Inspiration

In [one study](https://doi.org/10.1016/j.jbtep.2014.12.003), eight stages of spider pictures online reduced fear. But only [about 11%](https://www.nimh.nih.gov/sites/default/files/documents/health/statistics/prevalence/file_12.pdf) of people with a specific phobia get minimally adequate treatment, and as few as [7% of therapists and patients](https://pmc.ncbi.nlm.nih.gov/articles/PMC9975163/) report using exposure. We wanted an image model to draw that ladder for other phobias.

## What it does

Pick a fear like spiders, dogs or needles and press "Build my ladder". Nine images appear one by one over about a minute and a half, blurred until you look. "Try the demo" opens a finished spider ladder. You can redraw any step or get a variation at the same intensity with a different animal or setting.

In a session you guess how anxious you'll feel, then press and hold to see the step. Let go and it blurs again. You rate your distress and move on when you're ready. If your distress stays high, the app draws a smaller step just below that one and slides it in. A report charts your distress per step and which settings seem to drive it. The app only takes specific phobias and never shows blood or injury. Your ratings stay in your browser.

## How we built it

A planner (gemini-3.8-flash) writes nine steps as JSON, each one eight visual settings like distance and realism plus a short scene. Nano Banana 2.1 draws one anchor image and edits it for each step with a prompt built in code from those settings. Then sharp applies exact blur and saturation, so early steps stay soft whatever the model drew. A vision critic scores identity, distress and safety, and unsafe drafts are redrawn and never shown. For the smaller step, a ridge regression on your own ratings picks settings it predicts will land halfway.

## Challenges

The hardest part was keeping one subject the same across nine steps. With the anchor, the spider ladder kept the same Chilean rose tarantula on every one. Getting the fear to climb evenly is harder. The critic's estimates landed within 10 points of target on most steps, though it rated the top steps low (spiders: 92 planned, 78 estimated).

## What's next

We'll fix that critic bias, then test snakes, birds and heights like we tested spiders, dogs and needles.

*Made with Gemini (gemini-3.8-flash, gemini-nano-banana-2.1, gemini-3.5-flash-lite) and Claude Code. Library credits are in the README. Not a medical device.*
