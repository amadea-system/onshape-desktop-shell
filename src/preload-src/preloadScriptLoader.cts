/* Loads the `autoSignIn.ts` script and `windowTitleUpdater.ts` preload scripts */

Promise.all([
  // Load `autoSignIn.ts` script
  import('./autoSignIn.cjs'),
  // Load `windowTitleUpdater.ts` script
  import('./windowTitleUpdater.cjs')
]).then(() => {
  console.log("All Preload scripts loaded");
}).catch((err) => {
  console.error("Failed to load preload scripts:", err);
});
