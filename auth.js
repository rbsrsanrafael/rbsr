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
            return Promise.resolve(firestoreDb);
        }

        if (firebaseReady && window.rbsrFirebase && window.rbsrFirebase.db) {
            firestoreDb = window.rbsrFirebase.db;
            return Promise.resolve(firestoreDb);
        }

        return new Promise(function (resolve) {
            if (firebaseReady) {
                resolve(firestoreDb);
                return;
            }

            pendingInitializers.push(resolve);

            // Check every 100ms if Firebase is ready
            const checkInterval = setInterval(function () {
                if (window.rbsrFirebase && window.rbsrFirebase.db) {
                    clearInterval(checkInterval);
                    firestoreDb = window.rbsrFirebase.db;
                    firebaseReady = true;
                    pendingInitializers.forEach(function (callback) {
                        callback(firestoreDb);
                    });
                    pendingInitializers = [];
                }
            }, 100);

            // Timeout after 5 seconds
            setTimeout(function () {
                clearInterval(checkInterval);
                firebaseReady = true;
                pendingInitializers.forEach(function (callback) {
                    callback(null);
                });
                pendingInitializers = [];
            }, 5000);
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
        const db = await initializeFirebase();
        if (!db) {
            return getUsersFromLocalStorage();
        }

        try {
            const firestoreApi = window.rbsrFirebase.firestore;
            const usersRef = firestoreApi.collection(db, 'users');
            const snapshot = await firestoreApi.getDocs(usersRef);
            
            const users = snapshot.docs.map(function (docSnap) {
                const data = docSnap.data() || {};
                return {
                    username: docSnap.id,
                    role: data.role || 'custom',
                    permissions: Array.isArray(data.permissions) ? data.permissions : [],
                    password: data.password || ''
                };
            });
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            return users;
        } catch (error) {
            console.error('Failed to load users from Firestore:', error);
            return getUsersFromLocalStorage();
        }
    }

    async function saveUserToFirebase(userData) {
        const db = await initializeFirebase();
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
            const firestoreApi = window.rbsrFirebase.firestore;
            const payload = {
                role: userData.role || 'custom',
                permissions: Array.isArray(userData.permissions) ? userData.permissions : [],
                password: userData.password || '',
                updatedAt: firestoreApi.serverTimestamp()
            };

            if (!userData.createdAt) {
                payload.createdAt = firestoreApi.serverTimestamp();
            }

            await firestoreApi.setDoc(firestoreApi.doc(db, 'users', userData.username), payload);
            localStorage.setItem(USERS_KEY, JSON.stringify(await loadUsersFromFirebase()));
            return true;
        } catch (error) {
            console.error('Failed to save user to Firestore:', error);
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
        const normalizedUsername = String(username || '').trim();
        const normalizedPassword = String(password || '');

        return users.find(function (item) {
            return String(item.username || '').trim() === normalizedUsername && String(item.password || '') === normalizedPassword;
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
