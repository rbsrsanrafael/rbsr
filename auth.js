(function () {
    const AUTH_KEY = 'rbsrAuth';
    const USER_KEY = 'rbsrUser';
    const USER_DATA_KEY = 'rbsrUserData';
    const USERS_KEY = 'rbsrUsers';
    let firestoreDb = null;
    let firebaseReady = false;
    let pendingInitializers = [];

    function getSessionValue(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function setSessionValue(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (error) {
            // Ignore storage access errors.
        }
    }

    function removeSessionValue(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (error) {
            // Ignore storage access errors.
        }
    }

    function clearLegacyAuthStorage() {
        try {
            localStorage.removeItem(AUTH_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(USER_DATA_KEY);
        } catch (error) {
            // Ignore storage access errors.
        }
    }

    function getStoredUserData() {
        try {
            const stored = getSessionValue(USER_DATA_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            return null;
        }
    }

    function isLoggedIn() {
        return getSessionValue(AUTH_KEY) === 'true';
    }

    function normalizeUser(user) {
        const normalizedRole = user && user.role ? user.role : 'custom';
        const permissions = Array.isArray(user && user.permissions) ? user.permissions : [];

        if (normalizedRole === 'admin') {
            return {
                ...user,
                role: 'admin',
                permissions: Array.from(new Set([...permissions, 'admin', 'careers', 'properties']))
            };
        }

        if (normalizedRole === 'careers') {
            return {
                ...user,
                role: 'careers',
                permissions: Array.from(new Set([...permissions, 'careers']))
            };
        }

        if (normalizedRole === 'properties') {
            return {
                ...user,
                role: 'properties',
                permissions: Array.from(new Set([...permissions, 'properties']))
            };
        }

        return {
            ...user,
            role: 'custom',
            permissions: permissions
        };
    }

    function initializeFirebase() {
        if (firestoreDb) {
            console.log('✓ Firebase already initialized, db available');
            return Promise.resolve(firestoreDb);
        }

        if (firebaseReady && window.rbsrFirebase && window.rbsrFirebase.db) {
            firestoreDb = window.rbsrFirebase.db;
            console.log('✓ Firebase ready from module script, using db');
            return Promise.resolve(firestoreDb);
        }

        return new Promise(function (resolve) {
            if (firebaseReady) {
                console.log('⚠️ Firebase initialization already completed (timeout)');
                resolve(firestoreDb);
                return;
            }

            console.log('🔄 Waiting for Firebase module script to initialize...');
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds with 100ms checks

            const checkInterval = setInterval(function () {
                attempts++;
                if (window.rbsrFirebase && window.rbsrFirebase.db) {
                    clearInterval(checkInterval);
                    firestoreDb = window.rbsrFirebase.db;
                    firebaseReady = true;
                    console.log('✓ Firebase initialized after', attempts * 100, 'ms');
                    console.log('  - db object available:', Boolean(firestoreDb));
                    console.log('  - firestore methods available:', Boolean(window.rbsrFirebase.firestore));
                    resolve(firestoreDb);
                    return;
                }

                if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    firebaseReady = true;
                    console.warn('❌ Firebase SDK initialization timed out after 5 seconds');
                    console.warn('  - window.rbsrFirebase:', window.rbsrFirebase);
                    console.warn('  - Using localStorage fallback only');
                    resolve(null);
                }
            }, 100);
        });
    }

    function getUsersFromLocalStorage() {
        try {
            const saved = localStorage.getItem(USERS_KEY);
            const parsed = saved ? JSON.parse(saved) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    async function loadUsersFromFirebase() {
        console.log('📤 loadUsersFromFirebase called');
        const db = await initializeFirebase();
        if (!db) {
            console.log('  - db unavailable, using localStorage');
            return getUsersFromLocalStorage();
        }

        try {
            console.log('  - Querying Firestore users collection...');
            const firestoreApi = window.rbsrFirebase.firestore;
            const usersRef = firestoreApi.collection(db, 'users');
            const snapshot = await firestoreApi.getDocs(usersRef);
            
            console.log('  - Firestore returned', snapshot.docs.length, 'documents');
            
            const users = snapshot.docs.map(function (docSnap) {
                const data = docSnap.data() || {};
                return {
                    username: docSnap.id,
                    role: data.role || 'custom',
                    permissions: Array.isArray(data.permissions) ? data.permissions : [],
                    password: data.password || ''
                };
            });
            
            console.log('  - Mapped to', users.length, 'user objects');
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            console.log('✓ Users loaded from Firestore and cached in localStorage');
            return users;
        } catch (error) {
            console.error('❌ Failed to load users from Firestore:', error);
            console.error('  - Error code:', error.code);
            console.error('  - Error message:', error.message);
            console.log('  - Falling back to localStorage');
            return getUsersFromLocalStorage();
        }
    }

    async function saveUserToFirebase(userData) {
        console.log('📥 saveUserToFirebase called with:', userData.username);
        
        const db = await initializeFirebase();
        console.log('  - db available:', Boolean(db));
        console.log('  - window.rbsrFirebase:', Boolean(window.rbsrFirebase));
        
        if (!db) {
            console.warn('⚠️ Firestore unavailable - saving user to localStorage only');
            const users = getUsersFromLocalStorage();
            const index = users.findIndex(function (item) {
                return item.username === userData.username;
            });
            if (index >= 0) {
                users[index] = userData;
            } else {
                users.push(userData);
            }
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            console.log('✓ User saved to localStorage (Firestore unavailable)');
            return true;
        }

        try {
            console.log('🔍 Getting Firestore API methods...');
            const firestoreApi = window.rbsrFirebase.firestore;
            console.log('  - setDoc available:', Boolean(firestoreApi.setDoc));
            console.log('  - doc available:', Boolean(firestoreApi.doc));
            console.log('  - serverTimestamp available:', Boolean(firestoreApi.serverTimestamp));
            
            const payload = {
                role: userData.role || 'custom',
                permissions: Array.isArray(userData.permissions) ? userData.permissions : [],
                password: userData.password || '',
                updatedAt: firestoreApi.serverTimestamp()
            };

            if (!userData.createdAt) {
                payload.createdAt = firestoreApi.serverTimestamp();
            }

            console.log('📝 Saving user to Firestore:', userData.username);
            console.log('  - Payload:', payload);
            console.log('  - Collection: users');
            console.log('  - Document ID:', userData.username);
            
            const docRef = firestoreApi.doc(db, 'users', userData.username);
            console.log('  - Doc reference created:', Boolean(docRef));
            
            await firestoreApi.setDoc(docRef, payload);
            
            console.log('✅ User saved successfully to Firestore:', userData.username);
            console.log('  - Refreshing localStorage from Firestore...');
            
            const updatedUsers = await loadUsersFromFirebase();
            console.log('  - Users reloaded from Firestore:', updatedUsers.length, 'users');
            
            return true;
        } catch (error) {
            console.error('❌ Failed to save user to Firestore:', userData.username);
            console.error('  - Error code:', error.code);
            console.error('  - Error message:', error.message);
            console.error('  - Full error:', error);
            
            if (error.code === 'permission-denied') {
                console.error('  ⚠️ PERMISSION DENIED - Check Firestore security rules!');
                console.error('  - Go to Firebase Console → Firestore → Rules');
                console.error('  - Make sure rules allow writing to "users" collection');
            }
            
            return false;
        }
    }

    async function deleteUserFromFirebase(username) {
        const db = await initializeFirebase();
        if (!db) {
            const users = getUsersFromLocalStorage().filter(function (item) {
                return item.username !== username;
            });
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            return true;
        }

        try {
            const firestoreApi = window.rbsrFirebase.firestore;
            await firestoreApi.deleteDoc(firestoreApi.doc(db, 'users', username));
            const users = await loadUsersFromFirebase();
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            return true;
        } catch (error) {
            console.error('Failed to delete user from Firestore:', error);
            return false;
        }
    }

    const ADMIN_USERNAME = 'administrator';
    const ADMIN_DEFAULT_PASSWORD = 'Password123!@#';

    function getAdminUserRecord() {
        return {
            username: ADMIN_USERNAME,
            role: 'admin',
            permissions: ['admin', 'careers', 'properties']
        };
    }

    async function authenticateUser(username, password) {
        const users = await loadUsersFromFirebase();
        const normalizedUsername = String(username || '').trim();
        const normalizedPassword = String(password || '');

        if (normalizedUsername === ADMIN_USERNAME) {
            const adminInFirestore = users.find(function (item) {
                return String(item.username || '').trim() === ADMIN_USERNAME;
            });

            if (adminInFirestore) {
                if (String(adminInFirestore.password || '') === normalizedPassword) {
                    return getAdminUserRecord();
                }
                return null;
            }

            if (normalizedPassword === ADMIN_DEFAULT_PASSWORD) {
                return getAdminUserRecord();
            }
            return null;
        }

        return users.find(function (item) {
            return String(item.username || '').trim() === normalizedUsername && String(item.password || '') === normalizedPassword;
        }) || null;
    }

    async function changePassword(currentPassword, newPassword) {
        if (!isLoggedIn()) {
            return { success: false, message: 'You must be signed in to change your password.' };
        }

        const currentUser = getCurrentUser();
        const username = String(currentUser.username || '').trim();
        const current = String(currentPassword || '');
        const next = String(newPassword || '');

        if (!username) {
            return { success: false, message: 'Unable to identify the current user.' };
        }

        if (!current) {
            return { success: false, message: 'Enter your current password.' };
        }

        if (!next) {
            return { success: false, message: 'Enter a new password.' };
        }

        if (next.length < 8) {
            return { success: false, message: 'New password must be at least 8 characters.' };
        }

        if (current === next) {
            return { success: false, message: 'New password must be different from your current password.' };
        }

        const users = await loadUsersFromFirebase();
        const existingUser = users.find(function (item) {
            return String(item.username || '').trim() === username;
        });

        let validCurrent = false;
        if (existingUser) {
            validCurrent = String(existingUser.password || '') === current;
        } else if (username === ADMIN_USERNAME) {
            validCurrent = current === ADMIN_DEFAULT_PASSWORD;
        }

        if (!validCurrent) {
            return { success: false, message: 'Current password is incorrect.' };
        }

        const userPayload = existingUser
            ? {
                username: existingUser.username,
                role: existingUser.role || currentUser.role || 'custom',
                permissions: Array.isArray(existingUser.permissions) ? existingUser.permissions : (currentUser.permissions || []),
                password: next
            }
            : {
                username: username,
                role: currentUser.role || 'custom',
                permissions: Array.isArray(currentUser.permissions) ? currentUser.permissions : [],
                password: next
            };

        const saved = await saveUserToFirebase(userPayload);
        if (!saved) {
            return { success: false, message: 'Could not save your new password. Please try again.' };
        }

        return { success: true, message: 'Password updated successfully.' };
    }

    function getCurrentUser() {
        const stored = getStoredUserData();
        const fallbackUser = { username: getSessionValue(USER_KEY) || 'User', role: 'custom', permissions: [] };
        return normalizeUser(stored || fallbackUser);
    }

    function hasPermission(permission) {
        const user = getCurrentUser();
        const permissions = Array.isArray(user.permissions) ? user.permissions : [];
        return user.role === 'admin' || permissions.includes(permission) || user.role === 'careers' && permission === 'careers' || user.role === 'properties' && permission === 'properties';
    }

    function isAdmin() {
        const user = getCurrentUser();
        return user.role === 'admin' || (Array.isArray(user.permissions) && user.permissions.includes('admin'));
    }

    function logout() {
        removeSessionValue(AUTH_KEY);
        removeSessionValue(USER_KEY);
        removeSessionValue(USER_DATA_KEY);
        clearLegacyAuthStorage();
        window.location.href = 'index.html';
    }

    function updateChangePasswordLinks() {
        document.querySelectorAll('[data-change-password-link]').forEach(function (link) {
            link.remove();
        });

        if (!isLoggedIn()) {
            return;
        }

        document.querySelectorAll('[data-auth-link]').forEach(function (link) {
            const parent = link.parentElement;
            if (!parent || parent.querySelector('[data-change-password-link]')) {
                return;
            }

            const changePasswordLink = document.createElement('a');
            changePasswordLink.href = 'change-password.html';
            changePasswordLink.textContent = 'Change Password';
            changePasswordLink.setAttribute('data-change-password-link', '');
            changePasswordLink.className = link.className;
            parent.insertBefore(changePasswordLink, link);
        });
    }

    function updateAuthLinks() {
        const links = document.querySelectorAll('[data-auth-link]');
        const currentUser = getCurrentUser();

        links.forEach(function (link) {
            if (isLoggedIn()) {
                link.textContent = 'Logout';
                link.href = '#';
                link.setAttribute('data-auth-action', 'logout');
            } else {
                link.textContent = 'Login';
                link.href = 'login.html';
                link.setAttribute('data-auth-action', 'login');
            }
        });

        updateChangePasswordLinks();

        const status = document.getElementById('auth-status');
        if (status) {
            status.textContent = isLoggedIn()
                ? 'Signed in as ' + (currentUser.username || 'User')
                : 'Guest';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        clearLegacyAuthStorage();
        updateAuthLinks();

        document.body.addEventListener('click', function (event) {
            const link = event.target.closest('[data-auth-link]');
            if (!link) return;

            if (link.getAttribute('data-auth-action') === 'logout') {
                event.preventDefault();
                logout();
            }
        });
    });

    window.rbsrAuth = {
        isLoggedIn: isLoggedIn,
        getCurrentUser: getCurrentUser,
        hasPermission: hasPermission,
        isAdmin: isAdmin,
        logout: logout,
        updateAuthLinks: updateAuthLinks,
        loadUsers: loadUsersFromFirebase,
        saveUser: saveUserToFirebase,
        deleteUser: deleteUserFromFirebase,
        authenticateUser: authenticateUser,
        changePassword: changePassword
    };
})();
