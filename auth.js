(function () {
    const AUTH_KEY = 'rbsrAuth';
    const USER_KEY = 'rbsrUser';
    const USER_DATA_KEY = 'rbsrUserData';
    const USERS_KEY = 'rbsrUsers';
    const firebaseConfig = {
        apiKey: "AIzaSyAR5SxlCcOtytd9rzM6MwHnMAYzXXMZp5w",
        authDomain: "rbsrwebsite-581e1.firebaseapp.com",
        projectId: "rbsrwebsite-581e1",
        storageBucket: "rbsrwebsite-581e1.firebasestorage.app",
        messagingSenderId: "687230586943",
        appId: "1:687230586943:web:aad94ada68a03ad105a88a",
        measurementId: "G-LDDTRMFJ7B"
    };
    let firestoreDb = null;

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
            return firestoreDb;
        }

        if (!window.firebase) {
            return null;
        }

        if (!window.firebase.apps || !window.firebase.apps.length) {
            if (window.firebase.initializeApp) {
                window.firebase.initializeApp(firebaseConfig);
            }
        }

        if (!window.firebase.firestore) {
            return null;
        }

        firestoreDb = window.firebase.firestore();
        return firestoreDb;
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
        const db = initializeFirebase();
        if (!db) {
            return getUsersFromLocalStorage();
        }

        try {
            const snapshot = await db.collection('users').get();
            const users = snapshot.docs.map(function (doc) {
                const data = doc.data() || {};
                return {
                    username: doc.id,
                    role: data.role || 'custom',
                    permissions: Array.isArray(data.permissions) ? data.permissions : [],
                    password: data.password || ''
                };
            });
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            return users;
        } catch (error) {
            return getUsersFromLocalStorage();
        }
    }

    async function saveUserToFirebase(userData) {
        const db = initializeFirebase();
        if (!db) {
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
            return true;
        }

        try {
            const payload = {
                role: userData.role || 'custom',
                permissions: Array.isArray(userData.permissions) ? userData.permissions : [],
                password: userData.password || '',
                updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            };

            if (!userData.createdAt) {
                payload.createdAt = window.firebase.firestore.FieldValue.serverTimestamp();
            }

            await db.collection('users').doc(userData.username).set(payload);
            localStorage.setItem(USERS_KEY, JSON.stringify(await loadUsersFromFirebase()));
            return true;
        } catch (error) {
            return false;
        }
    }

    async function deleteUserFromFirebase(username) {
        const db = initializeFirebase();
        if (!db) {
            const users = getUsersFromLocalStorage().filter(function (item) {
                return item.username !== username;
            });
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            return true;
        }

        try {
            await db.collection('users').doc(username).delete();
            const users = await loadUsersFromFirebase();
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            return true;
        } catch (error) {
            return false;
        }
    }

    async function authenticateUser(username, password) {
        const adminUsername = 'administrator';
        const adminPassword = 'Password123!@#';

        if (username === adminUsername && password === adminPassword) {
            return {
                username: adminUsername,
                role: 'admin',
                permissions: ['admin', 'careers', 'properties']
            };
        }

        const users = await loadUsersFromFirebase();
        return users.find(function (item) {
            return item.username === username && item.password === password;
        }) || null;
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
        authenticateUser: authenticateUser
    };
})();
