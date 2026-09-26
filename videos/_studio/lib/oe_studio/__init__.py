"""OE studio automation for Blender 5.x.

    import sys; sys.path.append('videos/_studio/lib')
    from oe_studio import config, render, validate

Everything here is meant to run headless. See videos/_studio/README.md.
"""
from . import config, render, validate   # noqa: F401

__all__ = ['config', 'render', 'validate']
