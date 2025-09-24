// Import MSAL from CDN
import * as msal from "https://alcdn.msauth.net/browser/2.34.0/js/msal-browser.esm.min.js";

// ==== MSAL configuration ====
// Replace placeholders once company admin gives you the values
const msalConfig = {
  auth: {
    clientId: "75dc8414-89d7-4d53-9b07-e6655be4ae4c", // SPA client ID
    authority: "https://login.microsoftonline.com/13dee87d-0ca8-4cf3-8929-dfafdac1fb07", // Tenant
    redirectUri: window.location.origin + "/index.html"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

// Custom API scope (important!)
const apiScope = "api://<BACKEND_CLIENT_ID>/access_as_user"; 
// replace <BACKEND_CLIENT_ID> with MIS-Portal-API clientId once you have it

const msalInstance = new msal.PublicClientApplication(msalConfig);

// ==== Login handler ====
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("login-message");

  try {
    await msalInstance.loginRedirect({
      scopes: [apiScope, "User.Read"] // request both API and Graph
    });
  } catch (err) {
    console.error("Login failed:", err);
    msg.textContent = "Login failed. Please try again.";
  }
});

// ==== Redirect handling ====
async function handleRedirect() {
  try {
    const result = await msalInstance.handleRedirectPromise();
    let account = msalInstance.getAllAccounts()[0];

    if (result) {
      account = result.account;
      msalInstance.setActiveAccount(account);
    }
    if (!account) return; // Not logged in

    // Store user info
    localStorage.setItem("user_name", account.name);
    localStorage.setItem("user_email", account.username);

    // Acquire token for API
    const tokenRequest = { account, scopes: [apiScope] };
    let tokenResponse;

    try {
      tokenResponse = await msalInstance.acquireTokenSilent(tokenRequest);
    } catch (silentErr) {
      console.warn("Silent token acquisition failed, redirecting:", silentErr);
      return msalInstance.acquireTokenRedirect(tokenRequest);
    }

    const accessToken = tokenResponse.accessToken;
    localStorage.setItem("access_token", accessToken);

    // Call backend to resolve user + role
    const res = await fetch("/api/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      console.error("Failed to fetch /api/me:", await res.text());
      document.getElementById("login-message").textContent = 
        "Account not found in system. Contact administrator.";
      return;
    }

    const user = await res.json();
    localStorage.setItem("user_id", user.id);
    localStorage.setItem("role", user.role);

    // Redirect by role
    const roleName = (user.role || "").toLowerCase();
    if (roleName.includes("engineer")) {
      window.location.href = "engineer-dashboard.html";
    } else if (roleName.includes("project manager") || roleName.includes("pm")) {
      window.location.href = "pm-dashboard.html";
    } else if (roleName.includes("team leader") || roleName.includes("tl")) {
      window.location.href = "tl-dashboard.html";
    } else {
      alert("No dashboard defined for role: " + user.role);
    }
  } catch (err) {
    console.error("Redirect error:", err);
  }
}

// Run on load
handleRedirect();
