# Firestore Security Rules - Permissive (Development/Testing)

## ⚠️ WARNING: NOT SECURE FOR PRODUCTION

These rules allow **ANY** operations without authentication. Use only for:
- Local development
- Testing
- Demo/prototype environments

**NEVER** use in production with real user data!

---

## Rule 1: Allow Everything (Maximum Permissiveness)

Copy this and paste into Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**This allows:**
- ✅ Anyone to read any document
- ✅ Anyone to create any document
- ✅ Anyone to update any document
- ✅ Anyone to delete any document
- ✅ No authentication required

---

## Rule 2: Allow All by Collection (More Organized)

If you want to allow everything but keep it organized by collection:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{document=**} {
      allow read, write: if true;
    }
    match /careers/{document=**} {
      allow read, write: if true;
    }
    match /properties/{document=**} {
      allow read, write: if true;
    }
  }
}
```

---

## How to Apply Rules

### In Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **rbsrwebsite-2b69e**
3. Left sidebar → **Firestore Database**
4. Click **Rules** tab at the top
5. Replace all existing rules with one of the above options
6. Click **Publish**
7. Wait for "Rules published successfully" message

### CLI (if installed):

```bash
firebase deploy --only firestore:rules
```

---

## Testing Your Rules

After applying, test with this in browser console:

```javascript
// Create a user (should work without login)
window.rbsrAuth.saveUser({
  username: 'testuser',
  role: 'careers',
  permissions: ['careers'],
  password: 'test123'
}).then(() => console.log('✓ User created')).catch(e => console.error('✗ Failed:', e))

// Read all users (should work)
window.rbsrAuth.loadUsers().then(users => console.log('✓ Users loaded:', users.length))
```

---

## Verification

After publishing:
1. Create a test user in admin.html
2. Console should show: `✓ User saved successfully to Firestore: [username]`
3. Go to Firebase Console → Firestore → Collections → verify `users` collection exists with your user

---

## When Ready for Production

Switch to restrictive rules that require authentication:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{document=**} {
      allow read: if request.auth != null && request.auth.uid == resource.id;
      allow write: if request.auth != null && request.auth.uid == resource.id;
    }
    match /careers/{document=**} {
      allow read: if true;
      allow write, delete: if request.auth != null;
    }
    match /properties/{document=**} {
      allow read: if true;
      allow write, delete: if request.auth != null;
    }
  }
}
```

---

## Need Help?

1. Rules won't apply?
   - Check you're editing the correct database
   - Make sure you published (don't just close the tab)
   - Wait 30 seconds for changes to propagate

2. Still getting "permission-denied"?
   - Hard refresh page (Ctrl+F5 or Cmd+Shift+R)
   - Clear browser cache
   - Try in private/incognito window

3. Data not saving?
   - Open browser console
   - Create user and watch for "User saved successfully to Firestore"
   - Check Firebase console directly for the data
