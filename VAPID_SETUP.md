# Web Push VAPID Setup Guide

## What is VAPID?

VAPID (Voluntary Application Server Identification) is a Web Push standard that requires:
- **Public Key**: Sent to browser for push subscription
- **Private Key**: Used by your server to send push notifications to subscribed browsers

## Generate VAPID Keys

### Option 1: Using Node.js (Quick)

```bash
node -e "
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
"
```

### Option 2: Using web-push CLI

```bash
npm install -g web-push
web-push generate-vapid-keys
```

### Option 3: Online Generator (Testing Only)

Visit: https://tools.reactpwa.com/vapid-key-generator (for testing only, never in production)

---

## Setting Up in Render

1. Go to your Render service dashboard
2. Navigate to **Environment** settings
3. Add these variables:
   ```
   VAPID_PUBLIC_KEY=<your-public-key-here>
   VAPID_PRIVATE_KEY=<your-private-key-here>
   ```
4. Redeploy the service

---

## Setting Up Locally

Create a `.env.local` file in the api-server root:

```
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
```

---

## Testing Push Notifications

Once VAPID is configured:

1. Go to your app
2. Navigate to Account → Notifications
3. Click "Enable" for push notifications
4. Your browser will ask for permission
5. Once subscribed, test by:
   - Going to Admin → Send Announcement
   - Create a test announcement
   - You should receive the push notification

---

## Troubleshooting

**Service Worker not registering?**
- Check browser console for errors
- Make sure `/service-worker.js` is publicly accessible
- Check that HTTPS is enabled (required for service workers in production)

**Push notifications not working?**
- Verify VAPID keys are set correctly
- Check browser notification permissions
- Ensure web-push library is installed: `npm install web-push`

**"VAPID not configured"?**
- VAPID_PUBLIC_KEY env variable is missing
- Redeploy after adding the variable

---

## Security Notes

- **Never commit keys** to GitHub
- **Use environment variables** only
- **Different keys for** dev/staging/production
- **Rotate keys periodically** in production

---

## Related Documentation

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Spec](https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid)
- [web-push Library](https://github.com/web-push-libs/web-push)
