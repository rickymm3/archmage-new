// Countdown display that degrades precision as the wait gets longer: hours
// far out (no point showing seconds on a 3-hour wait), plain minutes once
// under an hour, then minutes+seconds for the final stretch under a minute
// where the extra precision actually matters to someone watching it tick.
export function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}
