// One-off helper — generates a fresh VAPID key pair for Web Push and prints
// it ready to paste into .env. Run once per environment (dev, prod) that
// needs push notifications to actually deliver; re-running it produces a
// NEW pair, which invalidates every existing player's push subscription
// (they'll silently stop receiving pushes until they hit "Enable" again),
// so don't run this against an environment that already has working keys
// unless you mean to rotate them.
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\nVAPID keys generated. Add these three lines to your .env, then restart the server:\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:you@example.com\n`);
console.log("The startup log will print \"Push notification VAPID keys configured\" once they've taken effect.\n");
