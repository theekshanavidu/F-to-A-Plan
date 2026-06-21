/**
 * F2A PLAN 2026 - Physics MCQ Tracker
 * Core App Logic: Firebase Auth, Firestore Sync, Filters, Progress Tracking
 */

// ==========================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCecLKvSyodhcvXNIP6ptR_pCW5DjB38eQ",
    authDomain: "com-track.firebaseapp.com",
    projectId: "com-track",
    storageBucket: "com-track.firebasestorage.app",
    messagingSenderId: "1067960435642",
    appId: "1:1067960435642:web:5c4f7ee8a20539ecc71383",
    measurementId: "G-01KETJQDNT"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// App States
let userProgress = {};
let currentUser = null;

// ==========================================
// DOM READY
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = document.querySelectorAll('.mcq-checkbox');
    const overallText = document.getElementById('overall-progress-text');
    const overallBar = document.getElementById('overall-progress-bar');

    // ==========================================
    // FIREBASE AUTHENTICATION & SYNC LOGIC
    // ==========================================
    const authOverlay = document.getElementById("auth-overlay");
    const headerUserBadge = document.getElementById("header-user-badge");
    const headerWelcomeText = document.getElementById("header-welcome-text");
    const logoutButton = document.getElementById("logout-button");

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            authOverlay.style.display = "none";
            headerUserBadge.classList.remove("hidden");
            logoutButton.classList.remove("hidden");

            const fullName = user.displayName || user.email.split("@")[0];
            const firstName = fullName.split(' ')[0];
            headerWelcomeText.innerHTML = `Welcome back, <strong>${firstName}</strong>! 👋`;

            await fetchCloudProgress();

            checkboxes.forEach(cb => {
                if (cb.id) {
                    cb.checked = !!userProgress[cb.id];
                    styleLabel(cb);
                }
            });
            updateProgress();
        } else {
            currentUser = null;
            userProgress = {};
            authOverlay.style.display = "";
            headerUserBadge.classList.add("hidden");
            logoutButton.classList.add("hidden");
            headerWelcomeText.innerHTML = "";

            checkboxes.forEach(cb => {
                cb.checked = false;
                styleLabel(cb);
            });
            updateProgress();
        }
    });

    setupAuthForms();

    // ==========================================
    // AUTH FORMS SETUP
    // ==========================================
    function setupAuthForms() {
        const tabSignin = document.getElementById("tab-signin");
        const tabSignup = document.getElementById("tab-signup");
        const formSignin = document.getElementById("form-signin");
        const formSignup = document.getElementById("form-signup");
        const formForgot = document.getElementById("form-forgot");
        const triggerForgot = document.getElementById("trigger-forgot");
        const triggerBack = document.getElementById("trigger-back-to-login");
        const authMsg = document.getElementById("auth-message");

        function displayAuthMessage(text, isError) {
            authMsg.innerText = text;
            authMsg.classList.remove("hidden", "error", "success");
            if (isError) {
                authMsg.classList.add("error");
            } else {
                authMsg.classList.add("success");
            }
            authMsg.classList.remove("hidden");
        }

        function clearAuthMessages() {
            authMsg.innerText = "";
            authMsg.classList.add("hidden");
            authMsg.classList.remove("error", "success");
        }

        function showForm(formToShow) {
            formSignin.classList.toggle("active", formSignin === formToShow);
            formSignup.classList.toggle("active", formSignup === formToShow);
            formForgot.classList.toggle("active", formForgot === formToShow);
            
            if (formToShow === formSignin) {
                tabSignin.classList.add("active");
                tabSignup.classList.remove("active");
            } else if (formToShow === formSignup) {
                tabSignup.classList.add("active");
                tabSignin.classList.remove("active");
            }
        }

        tabSignin.addEventListener("click", () => {
            showForm(formSignin);
            clearAuthMessages();
        });

        tabSignup.addEventListener("click", () => {
            showForm(formSignup);
            clearAuthMessages();
        });

        triggerForgot.addEventListener("click", (e) => {
            e.preventDefault();
            showForm(formForgot);
            clearAuthMessages();
        });

        triggerBack.addEventListener("click", (e) => {
            e.preventDefault();
            showForm(formSignin);
            clearAuthMessages();
        });

        // Sign In
        formSignin.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim();
            const pass = document.getElementById("login-password").value;
            clearAuthMessages();
            auth.signInWithEmailAndPassword(email, pass)
                .then(() => formSignin.reset())
                .catch(err => displayAuthMessage(getFriendlyAuthError(err.code), true));
        });

        // Sign Up
        formSignup.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("reg-name").value.trim();
            const email = document.getElementById("reg-email").value.trim();
            const pass = document.getElementById("reg-password").value;
            const confirmPass = document.getElementById("reg-confirm-password").value;

            clearAuthMessages();
            if (pass !== confirmPass) {
                displayAuthMessage("Passwords do not match! Please check.", true);
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
                await userCredential.user.updateProfile({ displayName: name });
                await db.collection('users').doc(userCredential.user.uid).set({
                    profile: { name, email, createdAt: new Date().toISOString() }
                }, { merge: true });
                formSignup.reset();
                showForm(formSignin);
                displayAuthMessage("Account created successfully! Signing in...", false);
            } catch (err) {
                displayAuthMessage(getFriendlyAuthError(err.code), true);
            }
        });

        // Forgot Password
        formForgot.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("forgot-email").value.trim();
            clearAuthMessages();
            auth.sendPasswordResetEmail(email)
                .then(() => {
                    displayAuthMessage("Password reset link sent to your email!", false);
                    formForgot.reset();
                })
                .catch(err => displayAuthMessage(getFriendlyAuthError(err.code), true));
        });

        // Google Sign-In
        function handleGoogleSignIn() {
            clearAuthMessages();
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider)
                .then((result) => {
                    if (result.additionalUserInfo && result.additionalUserInfo.isNewUser) {
                        const u = result.user;
                        db.collection('users').doc(u.uid).set({
                            profile: {
                                name: u.displayName || '',
                                email: u.email || '',
                                createdAt: new Date().toISOString()
                            }
                        }, { merge: true });
                    }
                })
                .catch(err => displayAuthMessage("Google sign-in failed: " + err.message, true));
        }

        document.getElementById("google-signin-btn").addEventListener("click", handleGoogleSignIn);
        document.getElementById("google-signup-btn").addEventListener("click", handleGoogleSignIn);
    }

    // ==========================================
    // AUTH ERROR MESSAGES
    // ==========================================
    function getFriendlyAuthError(code) {
        const errors = {
            "auth/invalid-email": "Invalid email address format.",
            "auth/user-not-found": "No registered account found with this email.",
            "auth/wrong-password": "Incorrect password. Please try again.",
            "auth/email-already-in-use": "This email is already registered by another student.",
            "auth/weak-password": "Weak password. Must be at least 6 characters.",
            "auth/network-request-failed": "Network connection issue detected. Try again."
        };
        return errors[code] || "Authentication failed. Error: " + code;
    }

    // ==========================================
    // FIRESTORE CLOUD PROGRESS
    // ==========================================
    async function fetchCloudProgress() {
        if (!currentUser) return;
        try {
            const docSnap = await db.collection('users').doc(currentUser.uid).get();
            userProgress = (docSnap.exists && docSnap.data().f2a_physics_progress)
                ? docSnap.data().f2a_physics_progress
                : {};
        } catch (e) {
            console.error("Error reading progress from Firestore: ", e);
            userProgress = {};
        }
    }

    async function saveCloudProgress() {
        if (!currentUser) return;
        const syncStatus = document.getElementById("header-sync-status");
        if (syncStatus) {
            syncStatus.innerHTML = `<span class="h-1.5 w-1.5 bg-amber-500 rounded-full animate-ping"></span> Saving...`;
            syncStatus.className = "text-[9px] font-bold text-amber-600 flex items-center gap-0.5";
        }
        try {
            await db.collection('users').doc(currentUser.uid).set(
                { f2a_physics_progress: userProgress },
                { merge: true }
            );
            if (syncStatus) {
                syncStatus.innerHTML = `<span class="h-1.5 w-1.5 bg-emerald-500 rounded-full"></span> Cloud Synced`;
                syncStatus.className = "text-[9px] font-bold text-emerald-600 flex items-center gap-0.5";
            }
        } catch (err) {
            console.error("Firestore sync failed: ", err);
            if (syncStatus) {
                syncStatus.innerHTML = `<span class="h-1.5 w-1.5 bg-red-500 rounded-full"></span> Sync Failed`;
                syncStatus.className = "text-[9px] font-bold text-red-600 flex items-center gap-0.5";
            }
        }
    }

    // Logout
    logoutButton.addEventListener("click", () => {
        auth.signOut()
            .then(() => console.log("Logged out successfully."))
            .catch(err => console.error("Logout error", err));
    });

    // ==========================================
    // CHECKBOX INTERACTION LOGIC
    // ==========================================
    checkboxes.forEach(cb => {
        if (cb.id) {
            cb.addEventListener('change', () => {
                userProgress[cb.id] = cb.checked;
                updateProgress();
                styleLabel(cb);
                saveCloudProgress();
            });
        }
    });

    function styleLabel(cb) {
        const label = cb.closest('.cb-label');
        if (!label) return;
        const span = label.querySelector('.cb-text');
        if (cb.checked) {
            label.classList.add('bg-emerald-50', 'border-emerald-200/50');
            if (span) {
                span.classList.add('line-through', 'text-emerald-600', 'font-semibold');
                span.classList.remove('text-slate-700');
            }
        } else {
            label.classList.remove('bg-emerald-50', 'border-emerald-200/50');
            if (span) {
                span.classList.remove('line-through', 'text-emerald-600', 'font-semibold');
                span.classList.add('text-slate-700');
            }
        }
    }

    // ==========================================
    // PROGRESS CALCULATION
    // ==========================================
    function updateProgress() {
        let totalChecked = 0;
        const totalCount = checkboxes.length;

        checkboxes.forEach(cb => { if (cb.checked) totalChecked++; });

        const percentage = totalCount > 0 ? Math.round((totalChecked / totalCount) * 100) : 0;
        if (overallText) overallText.textContent = `${totalChecked} / ${totalCount} (${percentage}%)`;
        if (overallBar) overallBar.style.width = `${percentage}%`;

        // Chapter badges
        document.querySelectorAll('section[id]').forEach(sec => {
            const secCheckboxes = sec.querySelectorAll('.mcq-checkbox');
            let secChecked = 0;
            secCheckboxes.forEach(cb => { if (cb.checked) secChecked++; });
            const secPct = secCheckboxes.length > 0 ? Math.round((secChecked / secCheckboxes.length) * 100) : 0;
            const badge = document.getElementById(`progress-badge-${sec.id}`);
            if (badge) badge.textContent = `${secChecked} / ${secCheckboxes.length} (${secPct}%)`;
        });

        // Sub-topic badges
        document.querySelectorAll('.topic-block').forEach(top => {
            const topId = top.getAttribute('data-topic-id');
            const topCheckboxes = top.querySelectorAll('.mcq-checkbox');
            let topChecked = 0;
            topCheckboxes.forEach(cb => { if (cb.checked) topChecked++; });
            const badge = document.getElementById(`topic-badge-${topId}`);
            if (badge) badge.textContent = `${topChecked} / ${topCheckboxes.length}`;
        });
    }

    // Initial progress render
    updateProgress();

    // ==========================================
    // YEAR & QUESTION NUMBER FILTER
    // ==========================================
    const filterYear = document.getElementById('filter-year');
    const filterQnum = document.getElementById('filter-qnum');
    const clearFiltersBtn = document.getElementById('clear-filters');

    function applyFilters() {
        const yearVal = filterYear.value.trim();
        const qnumVal = filterQnum.value.trim();

        checkboxes.forEach(cb => {
            const dataYear = cb.getAttribute('data-year'); // e.g. "2024-46"
            if (!dataYear) return;
            const [year, qnum] = dataYear.split('-');
            const matchYear = (!yearVal || year === yearVal);
            const matchQnum = (!qnumVal || qnum === qnumVal);
            const label = cb.closest('.cb-label');
            if (label) {
                label.classList.toggle('hidden', !(matchYear && matchQnum));
            }
        });

        // Hide empty level rows
        document.querySelectorAll('.level-row').forEach(row => {
            const visible = row.querySelectorAll('.cb-label:not(.hidden)').length > 0;
            row.classList.toggle('hidden', !visible);
        });

        // Hide empty topic blocks
        document.querySelectorAll('.topic-block').forEach(topic => {
            const visible = topic.querySelectorAll('.level-row:not(.hidden)').length > 0;
            topic.classList.toggle('hidden', !visible);
        });

        // Hide empty chapter sections
        document.querySelectorAll('.section-card').forEach(sec => {
            const visible = sec.querySelectorAll('.topic-block:not(.hidden)').length > 0;
            sec.classList.toggle('hidden', !visible);
        });
    }

    filterYear.addEventListener('change', applyFilters);
    filterQnum.addEventListener('input', applyFilters);
    clearFiltersBtn.addEventListener('click', () => {
        filterYear.value = "";
        filterQnum.value = "";
        applyFilters();
    });

    // ==========================================
    // RESET CONFIRMATION MODAL
    // ==========================================
    const resetBtn = document.getElementById('reset-button');
    const resetModal = document.getElementById('reset-modal');
    const resetModalContent = document.getElementById('reset-modal-content');
    const cancelReset = document.getElementById('cancel-reset');
    const confirmReset = document.getElementById('confirm-reset');

    resetBtn.addEventListener('click', () => {
        resetModal.classList.remove('hidden');
        setTimeout(() => {
            resetModalContent.classList.remove('scale-95', 'opacity-0');
            resetModalContent.classList.add('scale-100', 'opacity-100');
        }, 10);
    });

    function closeModal() {
        resetModalContent.classList.remove('scale-100', 'opacity-100');
        resetModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => resetModal.classList.add('hidden'), 150);
    }

    cancelReset.addEventListener('click', closeModal);
    resetModal.addEventListener('click', (e) => { if (e.target === resetModal) closeModal(); });

    confirmReset.addEventListener('click', async () => {
        userProgress = {};
        checkboxes.forEach(cb => {
            cb.checked = false;
            styleLabel(cb);
        });
        updateProgress();
        closeModal();
        await saveCloudProgress();
    });

    // ==========================================
    // PWA SERVICE WORKER REGISTRATION
    // ==========================================
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registered:', reg.scope))
                .catch(err => console.warn('Service Worker registration failed:', err));
        });
    }
});
