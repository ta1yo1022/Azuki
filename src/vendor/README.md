# StPageFlip

`page-flip.js` is the ESM distribution of StPageFlip **2.0.7** from the npm `page-flip` package.
Upstream: https://github.com/Nodlik/StPageFlip (MIT; license in `page-flip.LICENSE`).

Local lifecycle patch: the renderer retains its requestAnimationFrame ID, provides `stop()`,
and `PageFlip.destroy()` stops the renderer. Upstream 2.0.7 otherwise leaves its loop running
when an animation overlay is disposed. The adapter uses the pinned internal
`animateFlippingTo` method to finish a drag from its current folded position.

No page content is fetched by the library. The adapter uses local DOM snapshots of adjacent
pages; React owns the readable/interactive content. Update the adapter and tests together
if changing the vendored version.
