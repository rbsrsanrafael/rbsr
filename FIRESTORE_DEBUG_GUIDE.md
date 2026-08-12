# Firestore Setup Verification Guide

## Step 1: Check Browser Console for Errors

1. Open your website (admin.html, login.html, or careers.html)
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Look for any red error messages

Common issues:
- `Firebase SDK is not available` → Module script didn't load
- `Failed to save user to Firestore` → Firestore rules problem
- `Firestore unavailable - saving user to localStorage only` → Firebase timeout

## Step 2: Verify Firebase Module Script Loads

In browser console, type:
```javascript
console.log(window.rbsrFirebase)
```

If you see an object with `app`, `db`, and `firestore` properties, Firebase is loaded correctly.

If you see `undefined`, the module script failed to load.

## Step 3: Test User Creation

1. Go to admin.html (after logging in)
2. Try to create a new user
3. Open Console (F12)
4. Look for these messages:
   - ✅ "Saving user to Firestore: [username]"
   - ✅ "User saved successfully to Firestore: [username]"
   - ❌ "Firestore unavailable - saving user to localStorage only"
   - ❌ "Failed to save user to Firestore: [error]"

## Step 4: Check Firestore Console

1. Open Firebase Console → Your Project
2. Go to **Firestore Database**
3. Click on **Collections** tab
4. Look for a `users` collection
5. Expand it to see if your users were saved

If no `users` collection appears after creating a user, Firestore rules may be blocking writes.

## Step 5: Verify Firestore Rules

1. In Firebase Console, go to **Firestore Database** → **Rules** tab
2. Paste this and click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{document=**} {
      allow read: if request.auth != null && request.auth.uid == document;
      allow write: if request.auth != null && request.auth.uid == document;
    }
    match /careers/{document=**} {
      allow read: if true;
      allow write, delete: if request.auth != null;
    }
    match /properties/{document=**} {
      allow read: if true;
      allow write, delete: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Step 6: Check for Firestore Errors in Console

After applying rules, create a user again and check console for errors like:
- `"code":"permission-denied"` → Firestore rules denying access
- `"code":"not-found"` → Collection doesn't exist yet (it will be created on first write)

## Step 7: Test Data Persistence

1. Create a user in admin panel
2. Refresh the page
3. Check if the user still appears in the list
4. Check Firestore console to confirm data was saved

## Common Issues & Solutions

### Issue: Users save to localStorage but not Firestore
**Solution**: Check if Firebase module script is loading before auth.js
- Make sure each HTML file has the Firebase module script BEFORE `<script src="auth.js"></script>`

### Issue: Permission denied error
**Solution**: Update Firestore security rules (see Step 5 above)

### Issue: Users disappear after page refresh
**Solution**: 
- Check browser console for errors
- Verify Firestore rules allow reads
- Check if Firebase is actually connecting

### Issue: "Firestore unavailable - saving user to localStorage only"
**Solution**: 
- Wait longer (Firebase can take 2-3 seconds to initialize)
- Check if firebase-config.js exists and is accessible
- Check for network issues preventing CDN scripts from loading

## Test Commands in Console

```javascript
// Check if Firebase is loaded
window.rbsrFirebase

// Check if auth is available
window.rbsrAuth

// Load users from Firestore
window.rbsrAuth.loadUsers().then(users => console.log(users))

// Check current user
window.rbsrAuth.getCurrentUser()

// Check if logged in
window.rbsrAuth.isLoggedIn()
```

## Success Indicators

✅ Users are created in admin panel
✅ Users appear in the "Existing Users" list
✅ Console shows "User saved successfully to Firestore"
✅ Users appear in Firebase Firestore console → Collections → users
✅ Users persist after page refresh
✅ Users remain after closing and reopening the browser

If all of these are true, Firestore is working perfectly! 🎉
