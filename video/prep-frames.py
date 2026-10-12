"""
Prepares inputs for video/reel.html: per-clip JPEG frames (30 fps, 600x1298), a manifest with
frame counts and timing marks, and the app's Schibsted Grotesk @font-face rules from the build.
Run after video/record-clips.ts and `npm run build`: python3 video/prep-frames.py
"""
import glob, json, os, re, shutil, subprocess

OUT = "video/out"
CLIPS = ["builder", "ladder", "hold", "halfstep", "report"]

manifest = {}
for clip in CLIPS:
    src = f"{OUT}/clips/{clip}.mp4"
    dst = f"{OUT}/frames/{clip}"
    shutil.rmtree(dst, ignore_errors=True)
    os.makedirs(dst)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-vf", "fps=30,scale=600:1298:flags=lanczos", "-q:v", "3", f"{dst}/%05d.jpg"], check=True)
    marks = json.load(open(f"{OUT}/clips/{clip}.json"))
    manifest[clip] = {"frames": len(os.listdir(dst)), "marks": marks}
    print(clip, manifest[clip])
json.dump(manifest, open(f"{OUT}/manifest.json", "w"))

rules = []
for css in glob.glob(".next/static/**/*.css", recursive=True):
    for rule in re.findall(r"@font-face\{[^}]*\}", open(css).read()):
        if "Schibsted Grotesk" in rule and rule not in rules:
            rules.append(rule.replace("url(../media/", "url(/.next/static/media/"))
assert rules, "no Schibsted Grotesk @font-face rules found; run npm run build first"
open(f"{OUT}/fonts.css", "w").write("\n".join(rules))
print("fonts", len(rules))
