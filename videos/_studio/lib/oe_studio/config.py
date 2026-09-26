"""Studio constants. One place, so a shot cannot quietly disagree with the series.

Every value here is either measured on this machine or inherited from a decision
record. Where the Master Production Blueprint and a measurement disagree, the
measurement wins and the difference is named in the comment — a studio standard that
is wrong on the hardware it runs on is worse than no standard.
"""

# ── delivery (D41) ────────────────────────────────────────────────────────────
# The binding constraint is megabytes at the point of use, not pixels. Measured on
# episode 00: the 1080p60 master was 39.9 MB for 72.5 s (33.1 MB a minute) and the
# same frames quality-targeted at 30 fps came out at 14.5 MB with no visible loss.
FPS = 30                     # not 60: the camera decelerates to rest, so half the bits were waste
RESOLUTION = (1920, 1080)
DELIVERY_MB_PER_MINUTE_MAX = 14.0
DELIVERY_CRF = 21            # quality target, never a fixed bitrate

# ── sound ─────────────────────────────────────────────────────────────────────
# The blueprint says -14 LUFS. The series is already mastered at -16 (D36), and the
# Resource Library holds films at -16 today. Changing the target means re-mastering
# every existing film, so -16 stands until someone decides to do that deliberately.
LOUDNESS_LUFS = -16.0
TRUE_PEAK_DBTP = -1.5

# ── colour ────────────────────────────────────────────────────────────────────
# AgX with a Punchy look, per the blueprint — it holds a bright window and dark skin
# in the same frame, which Filmic does not.
#
# The three.js runtime must be set to THREE.AgXToneMapping to match. It is currently
# NeutralToneMapping (videos/_engine/three/src/index.js), so until that changes a
# Blender shot and a runtime shot will not cut together. Recorded in D41.
VIEW_TRANSFORM = 'AgX'
LOOK = 'AgX - Punchy'
DISPLAY_DEVICE = 'sRGB'

# ── render stages ─────────────────────────────────────────────────────────────
# Measured here (Blender 5.2.2, i5-7200U, no GPU of any kind — Cycles reports zero
# compute devices): Cycles 960x540 / 64 spp = 84.2 s a frame; EEVEE, same frame,
# 91.1 s. EEVEE is SLOWER than Cycles headless on this machine, so the blueprint's
# "Eevee Next, 30 fps realtime review" is not available here. The cheap preview is
# the OpenGL viewport render, which is why PREVIEW uses it.
STAGES = {
    'preview': dict(engine='WORKBENCH', scale=25, samples=8,  motion_blur=False, denoise=False),
    'review':  dict(engine='CYCLES',    scale=50, samples=64, motion_blur=True,  denoise=True),
    'final':   dict(engine='CYCLES',    scale=100, samples=256, motion_blur=True, denoise=True),
}

# A 'final' frame costs roughly 20 minutes on this machine at 1080p. 60 s of film is
# 1,800 frames at 30 fps: about 25 days. Final is a rented-GPU stage, not a local one.
FINAL_IS_LOCAL = False

# ── asset acceptance (Premium 3D Asset Standard v1) ───────────────────────────
UNIT_SCALE = 1.0             # metres
TRI_BUDGET = {'hero': 150_000, 'midground': 40_000, 'background': 8_000}
TEXTURE_MAX = 2048           # 4K only for a hero surface that fills the frame; never 8K
BEVEL_MIN_M = 0.0001         # 0.1 mm — an edge with no bevel catches no light
