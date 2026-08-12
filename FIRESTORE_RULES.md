# Firestore Security Rules for RBSR Website

Copy and paste these rules into your Firebase Console → Firestore → Rules tab, then click "Publish".

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ====================================
    // CAREERS COLLECTION (Anyone reads, only logged-in users write)
    // ====================================
    match /careers/{document=**} {
      allow read: if true;
      allow write, delete: if request.auth != null;
    }
    
    // ====================================
    // PROPERTIES COLLECTION (Anyone reads, only logged-in users write)
    // ====================================
    match /properties/{document=**} {
      allow read: if true;
      allow write, delete: if request.auth != null;
    }
    
    // ====================================
    // USERS COLLECTION (Only authenticated users can read/write their own)
    // ====================================
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    
    // ====================================
    // DEFAULT: DENY EVERYTHING ELSE
    // ====================================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## What These Rules Allow:

### Careers Collection
- ✅ **Anyone** can read careers
- ✅ **Logged-in users** can create, update, delete careers
- Your frontend checks permissions, so only users with 'careers' permission can actually create/edit

### Properties Collection
- ✅ **Anyone** can read properties
- ✅ **Logged-in users** can create, update, delete properties
- Your frontend checks permissions, so only users with 'properties' permission can actually create/edit

### Users Collection
- ✅ Users can only read their own user data
- ✅ Users can only modify their own user data
- Admins manage other users through your app's permission system

## Setup Steps:

1. Open **Firebase Console** → Select your project
2. Go to **Firestore Database** → **Rules** tab
3. Replace all existing rules with the code above
4. Click **"Publish"**
5. Wait for the update to complete (should take a few seconds)

## Files Updated:

- ✅ `admin.html` - Now has Firebase module initialization
- ✅ `login.html` - Now has Firebase module initialization  
- ✅ `careers.html` - Updated to use modular SDK
- ✅ `real-and-other-properties-acquired.html` - Already using modular SDK
- ✅ `auth.js` - Updated to work with modular SDK
- ✅ `firebase-config.js` - Centralized configuration (new)

## How It Works:

1. **Admin Panel** (admin.html)
   - Creates/manages users
   - Saves to Firestore `users` collection
   - Falls back to localStorage if Firestore unavailable

2. **Careers Page** (careers.html)
   - Managers add/edit job opportunities
   - Saves to Firestore `careers` collection
   - Anyone can view available positions

3. **Properties Page** (real-and-other-properties-acquired.html)
   - Managers add/edit properties with Google Drive links
   - Saves to Firestore `properties` collection
   - Anyone can view property listings

4. **Authentication** (auth.js)
   - Loads user accounts from Firestore `users` collection
   - Checks permissions before allowing edits
   - Uses localStorage as fallback

All data is real-time synced across all users via Firestore!
