
// ==========================================
// VEYRA AI - SUPABASE CONNECTION
// ==========================================

const SUPABASE_URL = "https://xexkimflnlnzhzknuhfg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jOTZRfTDI-9l3Rk9CrlZTQ_JbLCf8ma";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


// ==========================================
// 1. AUTHENTICATION FUNCTIONS
// ==========================================

async function registerUser(email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) throw error;
  return data;
}

async function loginUser(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

async function logoutUser() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) throw error;
}

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error) throw error;
  return data.user;
}


// ==========================================
// 2. USER PROFILE
// ==========================================

async function getUserProfile() {
  const user = await getCurrentUser();

  if (!user) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, role, created_at")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data;
}


// ==========================================
// 3. VERIFICATION SESSIONS
// ==========================================

async function saveVerificationSession(session) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Please log in before saving a session.");
  }

  const { data, error } = await supabaseClient
    .from("verification_sessions")
    .insert({
      user_id: user.id,
      topic: session.topic || "",
      answer: session.answer || "",
      claims: session.claims || []
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function loadVerificationHistory() {
  const { data, error } = await supabaseClient
    .from("verification_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function deleteVerificationSession(sessionId) {
  const { error } = await supabaseClient
    .from("verification_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;
}

async function deleteMyVerificationHistory() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Please log in first.");
  }

  const { error } = await supabaseClient
    .from("verification_sessions")
    .delete()
    .eq("user_id", user.id);

  if (error) throw error;
}


// ==========================================
// 4. ADMIN FUNCTION
// ==========================================

async function loadAdminProfiles() {
  const profile = await getUserProfile();

  if (!profile || profile.role !== "admin") {
    throw new Error("Administrator access required.");
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}


// ==========================================
// 5. MAKE FUNCTIONS AVAILABLE TO SCRIPT.JS
// ==========================================

window.veyraAuth = {
  client: supabaseClient,
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  getUserProfile,
  saveVerificationSession,
  loadVerificationHistory,
  deleteVerificationSession,
  deleteMyVerificationHistory,
  loadAdminProfiles
};


// ==========================================
// 6. AUTHENTICATION INTERFACE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

  const getElement = (id) => document.getElementById(id);

  const authSection = getElement("auth-section");
  const authForms = getElement("auth-forms");
  const accountPanel = getElement("account-panel");
  const authMessage = getElement("auth-message");

  const loginForm = getElement("auth-login-form");
  const registerForm = getElement("auth-register-form");
  const googleLoginButton = getElement("google-login-button");
  const oldLogoutButton = getElement("logout-button");

  const profileMenu = getElement("profileMenu");
  const profileTrigger = getElement("profileTrigger");
  const profileDropdown = getElement("profileDropdown");

  const viewProfileButton = getElement("view-profile-btn");
  const membershipButton = getElement("membership-btn");
  const menuLogoutButton = getElement("menu-logout-btn");

  const profileOverview = getElement("profile-overview");
  const backToWorkspaceButton = getElement("back-to-workspace");

  const workspaceSections = [
  "topbar",
  "welcome-strip",
  "search-section",
  "dashboard",
  "workspace",
  "app-footer"
];

  function showMessage(message, isError = false) {
    if (!authMessage) return;

    authMessage.textContent = message;
    authMessage.style.color = isError ? "#ff6b6b" : "#72d6a0";
  }

  function getInitial(email) {
    return email ? email.trim().charAt(0).toUpperCase() : "U";
  }

  function setWorkspaceVisibility(visible) {
    workspaceSections.forEach((className) => {
      const element = document.querySelector("." + className);

      if (element) {
        element.hidden = !visible;
      }
    });
  }

  function closeProfileDropdown() {
    if (!profileDropdown || !profileTrigger) return;

    profileDropdown.classList.add("hidden");
    profileTrigger.setAttribute("aria-expanded", "false");
  }

  function openProfileDropdown() {
    if (!profileDropdown || !profileTrigger) return;

    profileDropdown.classList.remove("hidden");
    profileTrigger.setAttribute("aria-expanded", "true");
  }

  // ========================================
  // 7. PROFILE INFORMATION
  // ========================================

  function displayProfile(user, profile) {
    const email = profile?.email || user.email || "";
    const role = profile?.role || "user";
    const initial = getInitial(email);

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      (email ? email.split("@")[0] : "My Account");

    const formattedRole =
      role.charAt(0).toUpperCase() + role.slice(1);

    const avatar = getElement("profileAvatar");
    const largeAvatar = getElement("profileLargeAvatar");

    if (avatar) avatar.textContent = initial;
    if (largeAvatar) largeAvatar.textContent = initial;

    const menuEmail = getElement("menu-user-email");
    const menuRole = getElement("menu-user-role");

    if (menuEmail) menuEmail.textContent = email;
    if (menuRole) menuRole.textContent = formattedRole;

    const profileName = getElement("profile-name");
    const profileEmail = getElement("profile-email");
    const profileRole = getElement("profile-member-role");
    const detailEmail = getElement("profile-detail-email");

    if (profileName) profileName.textContent = displayName;
    if (profileEmail) profileEmail.textContent = email;
    if (profileRole) profileRole.textContent = formattedRole;
    if (detailEmail) detailEmail.textContent = email;

    const createdDate = getElement("profile-created-date");

    if (createdDate) {
      const date = profile?.created_at || user.created_at;

      createdDate.textContent = date
        ? new Date(date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric"
          })
        : "Not available";
    }
  }


  // ========================================
  // 8. PROFILE ACTIVITY STATISTICS
  // ========================================

  async function updateProfileStatistics() {
    const sessions = await loadVerificationHistory();

    let totalClaims = 0;
    let verifiedClaims = 0;
    let pendingClaims = 0;
    let conflictingClaims = 0;

    sessions.forEach((session) => {
      const claims = Array.isArray(session.claims)
        ? session.claims
        : [];

      claims.forEach((claim) => {
        totalClaims++;

        const status = String(
          claim.status ||
          claim.verificationStatus ||
          claim.verification_status ||
          "pending"
        ).toLowerCase();

        if (status === "verified") {
          verifiedClaims++;
        } else if (
          status === "conflicting" ||
          status === "disputed"
        ) {
          conflictingClaims++;
        } else {
          pendingClaims++;
        }
      });
    });

    const statistics = {
      // Search count currently represents saved sessions.
      "profile-search-count": sessions.length,
      "profile-session-count": sessions.length,
      "profile-claims-count": totalClaims,
      "profile-verified-count": verifiedClaims,
      "profile-pending-count": pendingClaims,
      "profile-conflict-count": conflictingClaims
    };

    Object.entries(statistics).forEach(([id, value]) => {
      const element = getElement(id);
      if (element) element.textContent = value;
    });
  }


  // ========================================
  // 9. SHOW PROFILE OR WORKSPACE
  // ========================================

  function showProfilePage() {
    closeProfileDropdown();

    setWorkspaceVisibility(false);

    if (profileOverview) {
      profileOverview.classList.remove("hidden");
    }

    updateProfileStatistics().catch((error) => {
      console.error("Profile statistics error:", error);
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function showWorkspacePage() {
    if (profileOverview) {
      profileOverview.classList.add("hidden");
    }

    setWorkspaceVisibility(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }


  // ========================================
  // 10. UPDATE LOGIN INTERFACE
  // ========================================

  let updatingInterface = false;

  async function updateAuthInterface() {
    if (updatingInterface) return;

    updatingInterface = true;

    try {
      const user = await getCurrentUser();

      // USER IS LOGGED OUT
      if (!user) {
        if (authSection) authSection.hidden = false;
        if (authForms) authForms.hidden = false;
        if (accountPanel) accountPanel.hidden = true;

        if (profileMenu) profileMenu.hidden = true;

        if (profileOverview) {
          profileOverview.classList.add("hidden");
        }

        setWorkspaceVisibility(false);
        closeProfileDropdown();

        return;
      }

      // USER IS LOGGED IN
      const profile = await getUserProfile();

      if (authSection) authSection.hidden = true;
      if (accountPanel) accountPanel.hidden = true;
      if (profileMenu) profileMenu.hidden = false;

      setWorkspaceVisibility(true);

      if (profileOverview) {
        profileOverview.classList.add("hidden");
      }

      displayProfile(user, profile);

      try {
        await updateProfileStatistics();
      } catch (historyError) {
        console.error("Could not load profile statistics:", historyError);
      }

    } catch (error) {
      console.error("Authentication interface error:", error);
      showMessage(error.message, true);
    } finally {
      updatingInterface = false;
    }
  }


  // ========================================
  // 11. LOGIN
  // ========================================

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = getElement("login-email").value.trim();
      const password = getElement("login-password").value;

      try {
        showMessage("Logging in...");

        await loginUser(email, password);

        await updateAuthInterface();

        loginForm.reset();

        showMessage("Welcome back!");
      } catch (error) {
        showMessage(error.message, true);
      }
    });
  }


  // ========================================
  // 12. REGISTER
  // ========================================

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = getElement("register-email").value.trim();
      const password = getElement("register-password").value;

      try {
        showMessage("Creating your account...");

        const result = await registerUser(email, password);

        if (result.session) {
          await updateAuthInterface();
          showMessage("Your account was created successfully!");
        } else {
          showMessage(
            "Account created! Please check your email to confirm your account."
          );
        }

        registerForm.reset();

      } catch (error) {
        showMessage(error.message, true);
      }
    });
  }


  // ========================================
  // 13. GOOGLE LOGIN
  // ========================================

  if (googleLoginButton) {
    googleLoginButton.addEventListener("click", async () => {
      try {
        showMessage("Connecting to Google...");

        const { error } = await supabaseClient.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo:
              window.location.origin + window.location.pathname
          }
        });

        if (error) throw error;

      } catch (error) {
        showMessage(error.message, true);
      }
    });
  }


  // ========================================
  // 14. PROFILE DROPDOWN
  // ========================================

  if (profileTrigger) {
    profileTrigger.addEventListener("click", (event) => {
      event.stopPropagation();

      const isOpen =
        profileDropdown &&
        !profileDropdown.classList.contains("hidden");

      if (isOpen) {
        closeProfileDropdown();
      } else {
        openProfileDropdown();
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (
      profileMenu &&
      !profileMenu.contains(event.target)
    ) {
      closeProfileDropdown();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeProfileDropdown();
    }
  });


  // ========================================
  // 15. VIEW PROFILE BUTTON
  // ========================================

  if (viewProfileButton) {
    viewProfileButton.addEventListener("click", showProfilePage);
  }

  if (backToWorkspaceButton) {
    backToWorkspaceButton.addEventListener("click", showWorkspacePage);
  }


  // ========================================
  // 16. MEMBERSHIP BUTTON
  // ========================================

  if (membershipButton) {
    membershipButton.addEventListener("click", () => {
      closeProfileDropdown();

      alert(
        "Membership options are coming soon! This feature is not available yet."
      );
    });
  }


  // ========================================
  // 17. LOG OUT BUTTONS
  // ========================================

  async function handleLogout(event) {
    event.preventDefault();
    event.stopPropagation();

    try {
      if (menuLogoutButton) {
        menuLogoutButton.disabled = true;
        menuLogoutButton.textContent = "Logging out...";
      }

      await logoutUser();

      // Reload after successful logout so the login
      // screen and authentication state refresh.
      window.location.reload();

    } catch (error) {
      console.error("Logout error:", error);
      alert("Unable to log out: " + error.message);

      if (menuLogoutButton) {
        menuLogoutButton.disabled = false;
        menuLogoutButton.innerHTML = "<span>↪</span> Log Out";
      }
    }
  }

  if (menuLogoutButton) {
    menuLogoutButton.addEventListener("click", handleLogout);
  }

  if (oldLogoutButton) {
    oldLogoutButton.addEventListener("click", handleLogout);
  }


  // ========================================
  // 18. LISTEN FOR LOGIN / LOGOUT CHANGES
  // ========================================

  window.addEventListener("veyra-auth-changed", () => {
    updateAuthInterface();
  });


  // ========================================
  // 19. CHECK EXISTING LOGIN SESSION
  // ========================================

  updateAuthInterface();

});
