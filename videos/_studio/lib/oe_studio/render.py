"""Render configuration, applied the same way to every shot.

    from oe_studio import render
    render.configure(bpy.context.scene, stage='review')

A shot that sets its own samples, colour management or output format is a shot that
will not cut against its neighbours. There is one function and it takes a stage name.
"""
import bpy

from . import config


def _set_look(view):
    """Blender names looks differently across versions and view transforms.

    5.x lists them as 'AgX - Punchy'; earlier builds used 'Punchy'. Try the configured
    name, then the bare one, then leave the default rather than raising: a wrong look
    is a note in the log, a crash is a lost render.
    """
    for candidate in (config.LOOK, config.LOOK.split(' - ')[-1], 'None'):
        try:
            view.look = candidate
            return candidate
        except TypeError:
            continue
    return view.look


def configure(scene, stage='review', out_dir=None, exr=None):
    """Apply the studio's standard render settings for one stage.

    stage : 'preview' | 'review' | 'final'   (see config.STAGES)
    exr   : force multilayer EXR on/off. Default: on for 'final' only — a preview
            written as EXR costs disk and buys nothing, because nobody composites a
            preview.

    Returns the resolved settings, so a caller can log exactly what it asked for.
    """
    if stage not in config.STAGES:
        raise ValueError(f'unknown stage {stage!r}; expected one of {sorted(config.STAGES)}')
    s = config.STAGES[stage]
    r = scene.render

    r.engine = 'BLENDER_WORKBENCH' if s['engine'] == 'WORKBENCH' else s['engine']
    r.resolution_x, r.resolution_y = config.RESOLUTION
    r.resolution_percentage = s['scale']
    r.fps = config.FPS
    r.fps_base = 1.0
    r.use_motion_blur = s['motion_blur']
    r.motion_blur_shutter = 0.5
    r.use_persistent_data = True          # moved here from scene.cycles in Blender 5.x

    # Colour management is the part most often left at default and most visible when
    # two shots are cut together.
    scene.display_settings.display_device = config.DISPLAY_DEVICE
    scene.view_settings.view_transform = config.VIEW_TRANSFORM
    look = _set_look(scene.view_settings)

    if r.engine == 'CYCLES':
        c = scene.cycles
        c.device = 'CPU'                  # there is no GPU here; see config
        c.samples = s['samples']
        c.use_adaptive_sampling = True
        c.adaptive_threshold = 0.01
        c.use_denoising = s['denoise']
        if s['denoise']:
            try:
                c.denoiser = 'OPENIMAGEDENOISE'
            except TypeError:
                pass                      # build without OIDN: denoising stays on, default denoiser
        c.max_bounces = 8

    want_exr = (stage == 'final') if exr is None else exr
    img = r.image_settings
    if want_exr:
        # Blender 5.x gates the multilayer EXR behind image_settings.media_type. While
        # media_type is 'IMAGE' the file_format enum does not contain
        # 'OPEN_EXR_MULTILAYER' at all, so every pipeline script written against 4.x
        # throws here; set the media type and the format follows on its own.
        if hasattr(img, 'media_type'):
            img.media_type = 'MULTI_LAYER_IMAGE'
        else:
            img.file_format = 'OPEN_EXR_MULTILAYER'
        img.color_depth = '16'            # half float: a 1080p frame with passes, not a gigabyte
        img.exr_codec = 'DWAA'
        vl = scene.view_layers[0]
        vl.use_pass_combined = True
        vl.use_pass_z = True
        vl.use_pass_mist = True
        vl.use_pass_vector = s['motion_blur']
        vl.use_pass_cryptomatte_object = True
        vl.use_pass_cryptomatte_material = True
    else:
        if hasattr(img, 'media_type'):
            img.media_type = 'IMAGE'
        img.file_format = 'PNG'
        img.color_depth = '8'

    if out_dir:
        r.filepath = out_dir

    return dict(stage=stage, engine=r.engine, samples=getattr(scene.cycles, 'samples', None),
                percentage=r.resolution_percentage, fps=r.fps, view_transform=scene.view_settings.view_transform,
                look=look, format=img.file_format, motion_blur=r.use_motion_blur)


def estimate_seconds(stage, seconds_of_film, measured_frame_seconds=84.2):
    """What this will cost before it is started.

    `measured_frame_seconds` is this machine's measured Cycles cost for a 960x540
    64-spp frame. Scaled by pixels and samples, it is rough but honest, and a rough
    honest number before a render is worth more than an exact one afterwards.
    """
    s = config.STAGES[stage]
    if s['engine'] == 'WORKBENCH':
        per_frame = 0.4
    else:
        pixels = (config.RESOLUTION[0] * config.RESOLUTION[1] * (s['scale'] / 100) ** 2) / (960 * 540)
        per_frame = measured_frame_seconds * pixels * (s['samples'] / 64)
    frames = seconds_of_film * config.FPS
    return dict(frames=int(frames), seconds_per_frame=round(per_frame, 1),
                total_hours=round(frames * per_frame / 3600, 1))
