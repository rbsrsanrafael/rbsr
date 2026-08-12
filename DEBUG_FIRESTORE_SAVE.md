# Debug: User Saved to Browser But NOT Firestore

## Step 1: Check What Console Says

1. Go to **admin.html**
2. Open **Console** (F12 → Console tab)
3. Clear console (type `clear()`)
4. Try creating a user
5. **Copy ALL console messages** and check for these patterns:

---

## Step 2: Identify the Problem

### Pattern 1: "db available: false"
```
📥 saveUserToFirebase called with: testuser
  - db available: false  ← PROBLEM HERE
  - window.rbsrFirebase: false
⚠️ Firestore unavailable - saving user to localStorage only
```

**Fix:** Firebase module script not loading before auth.js
- Go to admin.html
- Make sure this is the order in the HTML:
  ```html
  <script type="module">
    import { initializeApp } from "..."
    // Firebase initialization
    window.rbsrFirebase = { ... }
  </script>
  <script src="auth.js"></script>  <!-- MUST be after module script -->
  ```

---

### Pattern 2: "Error code: permission-denied"
```
❌ Failed to save user to Firestore: testuser
  - Error code: permission-denied  ← PROBLEM HERE
  - Error message: Missing or insufficient permissions
  ⚠️ PERMISSION DENIED - Check Firestore security rules!
```

**Fix:** Firestore security rules are blocking writes

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Project: **rbsrwebsite-2b69e**
3. **Firestore Database** → **Rules** tab
4. Replace ALL rules with:
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
5. Click **Publish**
6. **Hard refresh browser** (Ctrl+F5)
7. Try creating user again

---

### Pattern 3: "setDoc available: false"
```
🔍 Getting Firestore API methods...
  - setDoc available: false  ← PROBLEM HERE
  - doc available: false
  - serverTimestamp available: false
```

**Fix:** Firebase SDK not loading from CDN
- Check browser Network tab (F12 → Network)
- Look for requests to `gstatic.com/firebasejs/10.12.2/`
- If they're red (failed), there's a network/CDN issue
- Try hard refresh: Ctrl+F5

---

### Pattern 4: Successful save but then error
```
✅ User saved successfully to Firestore: testuser
  - Refreshing localStorage from Firestore...
📤 loadUsersFromFirebase called
  - Querying Firestore users collection...
❌ Failed to load users from Firestore: [error]
  - Error code: permission-denied
```

**Fix:** Rules allow WRITE but not READ
- Update Firestore rules (see Pattern 2 above)
- Make sure `allow read` is also set to `if true`

---

## Step 3: Test Each Part Separately

Run these **one at a time** in the browser console to isolate the problem:

### Test 1: Check Firebase is loaded
```javascript
console.log('Firebase loaded:', !!window.rbsrFirebase);
console.log('Firebase object:', window.rbsrFirebase);
```

Expected: Shows `Firebase loaded: true` and object with `app`, `db`, `firestore`

### Test 2: Check if db is initialized
```javascript
console.log('DB available:', !!window.rbsrFirebase?.db);
console.log('DB object:', window.rbsrFirebase?.db);
```

Expected: Shows `DB available: true`

### Test 3: Check Firestore methods
```javascript
console.log('setDoc:', !!window.rbsrFirebase?.firestore?.setDoc);
console.log('doc:', !!window.rbsrFirebase?.firestore?.doc);
console.log('getDocs:', !!window.rbsrFirebase?.firestore?.getDocs);
```

Expected: All show `true`

### Test 4: Try direct Firestore write
```javascript
const db = window.rbsrFirebase.db;
const firestoreApi = window.rbsrFirebase.firestore;
const testDoc = firestoreApi.doc(db, 'users', 'directtest');

firestoreApi.setDoc(testDoc, {
  role: 'test',
  permissions: ['test'],
  password: 'test',
  createdAt: new Date()
}).then(() => {
  console.log('✅ Direct write successful!');
}).catch(error => {
  console.error('❌ Direct write failed:', error.code, error.message);
});
```

Expected: Shows `✅ Direct write successful!`

If this fails with `permission-denied`, **the problem is Firestore security rules**.

### Test 5: Try reading from Firestore
```javascript
const db = window.rbsrFirebase.db;
const firestoreApi = window.rbsrFirebase.firestore;
const usersRef = firestoreApi.collection(db, 'users');

firestoreApi.getDocs(usersRef).then(snapshot => {
  console.log('✅ Read successful! Found', snapshot.docs.length, 'users');
  snapshot.docs.forEach(doc => {
    console.log('User:', doc.id, doc.data());
  });
}).catch(error => {
  console.error('❌ Read failed:', error.code, error.message);
});
```

Expected: Shows users that were created

---

## Step 4: Check Firestore Console Directly

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **rbsrwebsite-2b69e**
3. **Firestore Database** → **Collections**
4. Do you see a `users` collection?
   - **YES** → Check if your test users are inside
   - **NO** → Users were never written to Firestore (permission issue)

---

## Most Likely Fix

**The problem is probably Firestore security rules.**

Apply these rules and it should work:

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

1. Firebase Console → Firestore → Rules
2. Replace everything with the above
3. **Publish**
4. **Hard refresh browser** (Ctrl+F5)
5. Try creating a user again

---

## Quick Checklist

Before you respond, check these:

- [ ] Ran Test 1 in console - Firebase loaded: **true** or **false**?
- [ ] Ran Test 4 in console - Did direct write work or show **permission-denied**?
- [ ] Checked Firestore rules in Firebase Console?
- [ ] Applied permissive rules and published?
- [ ] Reloaded page with Ctrl+F5?

**Tell me which test failed and what error you got!** 🔍
