/**
 * Zoom so roughly `visibleShortSidePx` world pixels fit along the shorter screen side,
 * while never zooming out past the map edges (the map always fills the viewport).
 */
export function computeCameraZoom(
  viewWidth: number,
  viewHeight: number,
  mapWidthPx: number,
  mapHeightPx: number,
  visibleShortSidePx: number,
): number {
  return Math.max(
    Math.min(viewWidth, viewHeight) / visibleShortSidePx,
    viewWidth / mapWidthPx,
    viewHeight / mapHeightPx,
  );
}
