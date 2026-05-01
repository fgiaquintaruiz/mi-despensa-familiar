import webpush from 'web-push';

/**
 * Returns a configured webpush instance.
 * Lazy init avoids throwing at module-load time during `next build`
 * when VAPID env vars are not set in the build environment.
 */
export function getWebPush(): typeof webpush {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      'VAPID env vars are not set. Add VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY to your environment.',
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}
