# TASK: Disable or repurpose the unused "Encryption Key Settings" page

Context:
- The encryption system now automatically manages private keys using libsodium and app secrets.
- Manual key setup (Settings → Key) is redundant.
- Console shows decrypt warnings because incoming messages contain placeholder encrypted objects.

Goal:
1. Disable the old key-setting logic temporarily.
2. Replace its UI with an informational message.
3. Keep file structure intact for future use.
4. Prevent confusion or crashes due to undefined local key settings.

Steps:
- Open web/src/pages/SettingsKey.tsx (or similar settings key page).
- Comment out existing logic for manual password handling.
- Replace render body with:
  ```tsx
  <Card>
    <CardHeader>
      <CardTitle>Encryption Key Management</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Encryption keys are now generated and managed automatically for each user session.
        Manual key configuration is no longer required.
      </p>
    </CardContent>
  </Card>
````

* In crypto.ts, add safe guard in decryptMessage():

  ```ts
  if (!cipher || typeof cipher !== "string") {
    console.warn("Empty or invalid cipher, returning plain text");
    return "";
  }
  ```

Verification:

* Open Settings → Key page → shows informational message.
* No more decrypt warnings for empty messages.
* App still encrypts/decrypts normally.

Output:

* Show updated SettingsKey page and modified decryptMessage check.

```