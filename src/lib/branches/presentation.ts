/** Presentation only: total persisted locations, including inactive branches.
 * Never derive multi-location mode from the current user's authorized subset. */
export function branchUiEnabled(totalBranches:number|undefined){return totalBranches===undefined||totalBranches>1}
