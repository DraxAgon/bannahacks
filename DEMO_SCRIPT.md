# Fear Ladder demo script

Runs about 2:56. Talk slower than feels natural. Each beat has one idea, so give the images time on screen.

## Before you record

- `GEMINI_API_KEY` is set on Vercel, and https://fear-ladder-beta.vercel.app/api/health shows `live: true`.
- The demo spider ladder is open in a second tab, and you've already rated at least three steps on it. The smaller step and the radar both need three ratings to learn from.
- Browser zoom is at 100% and notifications are off.
- Read the Say column out loud once with a timer. If you finish before 2:30, you're rushing.

If live drawing stalls or errors out, do every beat on the demo ladder and cut in a screen recording of an earlier live build and smaller step.

## Script

| On screen | Say |
|---|---|
| **0:00 to 0:20.** Home page. Let the headline sit for a second, then hover slowly along the row of spider images. The blurred ones sharpen as the cursor passes. | "This is Fear Ladder. About nine percent of U.S. adults had a specific phobia in the past year. Exposure means facing the fear a little at a time, and this app uses image AI to draw all those small steps for you." |
| **0:20 to 0:40.** Click **Build your own**. Pick **Spiders**. Type *Big hairy ones, worst when they walk toward me.* Click **Build my ladder** and stay a few seconds while it starts. | "I'll build one live. I pick spiders and type one line about what scares me. Nano Banana draws the nine steps, and they show up one by one. That takes about a minute and a half, so I'll let it run." |
| **0:40 to 1:02.** Switch to the second tab with the demo spider ladder. Let the clear first row sit for a second, then tap step 5 and step 9, the tarantula on an open palm. Give each one about three seconds. | "Here's one I made earlier. The gentle steps show right away, and the scarier ones stay blurred until you tap them. Step one is the word on a card, and step nine is a tarantula on an open palm. They're all edits of one starting image, so it's the same spider the whole way up." |
| **1:02 to 1:28.** Click **How it was made**. Show the planner JSON for three seconds, then one step's exact prompt, then its critic scores. End on step 9's critic score. | "Gemini plans the nine steps as JSON, eight settings each, like distance and motion. Code turns those settings into this exact prompt. Then Gemini checks every image for safety and guesses how scary it is. On most steps that guess is within 10 points of the plan, but it rated the top step 78 instead of 92." |
| **1:28 to 1:54.** Start a session and press **Begin**. Drag the guess about two thirds of the way up and press **Look**. Hold Space and the image sharpens. Let go after two seconds and it blurs at once. Hold again for about five quiet seconds. Drag the rating a little below the guess, press **Done**, tap **Easier**, then **Next step**. | "Now a session. First I guess how anxious I'll feel. I hold to look, and the moment I let go it blurs again. *(stay quiet while holding)* Then I rate how I feel. It was easier than I guessed, so I tap Easier and move up a step." |
| **1:54 to 2:18.** On the next step, press **Look**, hold, and drag the rating near the top. Press **Done**, tap **Worse**, then press the smaller step button. Wait while it draws (trim the wait in editing if it runs long). Watch the new step slide into the ladder. | "This one is too much, and my rating stays near the top. So I ask for a smaller step. A small model trained on my own ratings picks settings it thinks will land halfway, and the app draws that step live. *(wait)* It slides in between the two." |
| **2:18 to 2:32.** Finish the session and open the report. Pause on the peak vs end chart, then scroll down and stop on the **What drives the fear** radar. | "The report shows peak and end distress for each step. This radar comes from that same model, and it shows which settings drive my fear the most." |
| **2:32 to 2:56.** Switch back to the first tab. The live ladder shows all nine steps. Stay on it to the end. | "Back in the first tab, my ladder is done. It only works for specific phobias, and it never draws blood or injury. Nothing moves on until you choose to. There are no accounts, so everything stays in your browser. You can try it at fear-ladder-beta.vercel.app." |
