/** Slice D R3: the fixed color-blob canvas every glass panel frosts over.
 *  Non-interactive and aria-hidden — pure decoration, transform-only motion. */
export function BackgroundScene() {
  return (
    <div className="bg-scene pointer-events-none" aria-hidden="true">
      <span className="blob blob-1" />
      <span className="blob blob-2" />
      <span className="blob blob-3" />
    </div>
  );
}
