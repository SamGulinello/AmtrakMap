/**
 * Non-blocking status notice shown over the map when the user is offline or the
 * provider reported an error. It never hides the data being displayed; it only
 * states plainly what that data is.
 */
export function DataNotice({ offline, error }: { offline: boolean; error?: string }) {
  if (!offline && !error) return null;
  return (
    <div className="data-notice" role="status" data-testid="data-notice">
      <span className="data-notice-icon" aria-hidden="true">
        {offline ? '⚠' : '!'}
      </span>
      <span>
        {offline ? (
          <>
            <strong>Offline.</strong> Showing the last data received. Positions and
            times will not update until the connection returns.
          </>
        ) : (
          <>
            <strong>Data source problem.</strong> {error}
          </>
        )}
      </span>
    </div>
  );
}
