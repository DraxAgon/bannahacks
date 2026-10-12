# Fear Ladder

## Inspiration
In [one study](https://doi.org/10.1016/j.jbtep.2014.12.003), an online program that showed eight stages of spider pictures reduced fear of spiders. Most people with a phobia never get help like that, though. Only [about 11%](https://www.nimh.nih.gov/sites/default/files/documents/health/statistics/prevalence/file_12.pdf) get minimally adequate treatment. We wanted an image model to draw those stages for any common phobia.

## What it does
Pick a fear like spiders, dogs or needles, and Fear Ladder draws it nine ways, from the word on a card to the real thing. The gentle steps show right away, and the scary ones stay blurred until you choose to look. In a session you hold to see a step, let go to blur it, then rate how you feel. If a step is too much, the app draws a smaller one in between, live. A short report shows what drives your fear most, like closeness or realism.

## How we built it
It's a Next.js app on Vercel with one Gemini API key behind it. Gemini 3.8 Flash plans the nine steps as JSON, each with eight visual settings like distance and realism. Nano Banana 2.1 draws one anchor image and edits it for every step, so it's the same spider all the way up. Sharp then sets the exact blur for each step, and a vision critic checks every image for safety and likeness before anyone sees it. The smaller step comes from a tiny regression model trained on your own ratings, right in the browser.

## Challenges we ran into
Keeping the subject identical across nine images was the hardest part. Editing one anchor image, instead of generating each step from scratch, fixed it. Getting the fear to climb evenly is still tricky: the critic landed within 10 points of the plan on most steps but rated the top step 78 when we planned 92. Our first version also had too many screens, so we cut it down to look, rate, next.

## Accomplishments that we're proud of
The same Chilean rose tarantula shows up on all nine spider steps, and the ladder can grow a new step mid-session in about half a minute. Every image in the demos came straight from the same pipeline the live app uses. There are no accounts, and your ratings never leave your browser.

## What we learned
Image models hold onto a subject much better when they edit one picture than when they draw from scratch each time. They also drift on intensity, so we stopped trusting the model for blur and set it in code. Structured output only fills required fields, which we found out when the planner kept sending back ladders with no steps.

## What's next for Fear Ladder
We want to fix the critic's low scores at the top of the ladder, then test snakes, birds and heights the way we tested spiders, dogs and needles. After that, we'd like to put it in front of a therapist and see if they'd use it with clients.

*Try it at https://fear-ladder-beta.vercel.app. Made with Gemini, Nano Banana, Gemini TTS, Lyria and Claude Code. Not a medical device.*
