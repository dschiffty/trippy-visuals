# CLAUDE.md

## Rendering & Visual Changes

- Any change that touches the canvas renderer, WebGL, layer compositing, or animation loop must be tested in a real browser for a minimum of 30 seconds before pushing, not just the internal preview tool
- The preview tool cannot reliably catch cumulative rendering issues, progressive blowout, or frame accumulation bugs
- Before implementing any per-pixel or per-frame computation, confirm whether it runs on CPU or GPU. Per-pixel work should always run on the GPU via WebGL shaders
- Always commit before starting any rendering change so there is a clean rollback point

## Testing Protocol for Visual Changes

- After implementing, instruct the user to open the debug overlay at `?debug=true`
- Ask the user to test in both windowed and fullscreen on their real browser
- Ask the user to screenshot the debug overlay after 30+ seconds and confirm no visual regression before pushing
- Do not push rendering changes based solely on preview tool results

## General

- Commit frequently with descriptive messages
- Mobile and desktop must both be tested for any UI or rendering change
- Never push a change the user hasn't confirmed works in their real browser
