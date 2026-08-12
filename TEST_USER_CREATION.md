# User Creation Testing Guide

## Step 1: Open Admin Panel
1. Go to `admin.html`
2. You should be automatically redirected to login if not authenticated
3. **Login with:**
   - Username: `administrator`
   - Password: `Password123!@#`

## Step 2: Check Browser Console
1. Press **F12** to open Developer Tools
2. Go to **Console** tab
3. You should see startup messages like:
   ```
   🚀 Admin page loaded
   ✓ Firebase available: true
   ✓ Auth available: true
   ```

If you don't see these messages, **Firebase isn't loading properly** - check that the module script is before auth.js in the HTML.

## Step 3: Create a Test User

In the admin panel form, fill in:
- **Username:** `testuser01`
- **Password:** `Test123456!`
- **Role:** `careers`
- **Permissions:** Check `careers`

Then click **"Add User"**

## Step 4: Check Console for Success Messages

After clicking "Add User", watch the console for:

### ✅ Success Indicators:
```
📝 Creating user: testuser01
Saving user to Firestore: testuser01
User saved successfully to Firestore: testuser01
✓ User created and saved successfully
```

### ❌ Failure Indicators:
```
Failed to save user to Firestore: [error details]
Error code: permission-denied
Error message: Missing or insufficient permissions
```

## Step 5: Verify in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `rbsrwebsite-2b69e`
3. Go to **Firestore Database**
4. Click **Collections**
5. You should see a `users` collection
6. Inside, find document with ID: `testuser01`
7. It should contain:
   ```json
   {
     "role": "careers",
     "permissions": ["careers"],
     "password": "Test123456!",
     "createdAt": [timestamp],
     "updatedAt": [timestamp]
   }
   ```

## Step 6: Test Login with New User

1. Go to `login.html`
2. Try logging in with:
   - Username: `testuser01`
   - Password: `Test123456!`
3. Should redirect to `careers.html` (because user has careers permission)

## Step 7: Test Form Visibility on Careers Page

After logging in with `testuser01`:
1. Go to `careers.html`
2. Open Console (F12)
3. Look for:
   ```
   📊 Render careers - Logged in: true Can manage: true
   ✓ Showing form - user has permission
   ```
4. The **"Add a Career Opportunity"** form should be visible

## Step 8: Verify Data Persistence

1. Refresh the admin.html page (F5)
2. The newly created user should still appear in the "Existing Users" list
3. If it disappears, it means Firestore isn't persisting the data

## Console Debugging Commands

Run these in the browser console to debug:

```javascript
// Check if Firebase is loaded
window.rbsrFirebase
// Result should show: {app, analytics, db, firestore, ...}

// Check if auth is available
window.rbsrAuth
// Result should show object with methods

// Get current login status
sessionStorage.getItem('rbsrAuth')
// Result should be: "true"

// Get current user data
JSON.parse(sessionStorage.getItem('rbsrUserData'))
// Result should show the user object

// Get all users from Firestore
window.rbsrAuth.loadUsers().then(users => console.table(users))
// Shows all users in a table

// Get specific user from Firestore
window.rbsrAuth.authenticateUser('testuser01', 'Test123456!').then(user => console.log(user))
// Shows if login would work
```

## Troubleshooting

### "Form not showing" on careers.html
- [ ] Check that user has `careers` role or permission
- [ ] Check that `window.rbsrAuth.isLoggedIn()` returns `true`
- [ ] Check console for: `✗ Hiding form - Logged in: false`

### "User not saving to Firestore"
- [ ] Check console for error messages
- [ ] Check Firestore security rules are correct
- [ ] Verify `users` collection exists in Firestore
- [ ] Check that module script loads before auth.js

### "User saved but doesn't appear in admin list"
- [ ] Refresh the page (F5)
- [ ] Check browser's localStorage: `rbsrUsers` key
- [ ] Check Firestore console directly

### "Can login but form doesn't show"
- [ ] User might not have the right permission
- [ ] Create a user with role: `admin` to test
- [ ] Admin should have access to all forms

## Expected Results

### ✅ Working System:
1. User created in admin.html ✓
2. Appears in "Existing Users" list ✓
3. Can be edited and deleted ✓
4. Saved to Firestore (visible in Firebase console) ✓
5. Can login with that username/password ✓
6. Gets redirected to correct page based on role ✓
7. Form appears on careers/properties pages ✓
8. Can add careers/properties with new user ✓
9. Data persists across page refreshes ✓

### ❌ Broken System:
- User created but doesn't appear in list after refresh
- Console shows "Firestore unavailable" messages
- User can't login even with correct credentials
- Form hidden despite user having correct permissions
- No "Saving user to Firestore" message in console

## Next Steps

1. **Create test user** following steps 1-4
2. **Check console output** - what do you see?
3. **Check Firebase console** - is data there?
4. **Try login** - does it work?
5. **Test form visibility** - can they manage careers/properties?

Share the console messages with me if something isn't working! 🚀
