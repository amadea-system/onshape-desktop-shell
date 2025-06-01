import { contextBridge, ipcRenderer } from 'electron';

let passwordToSave: { login: string; password: string } | null = null;
let oldUrl: string | null = null;

let DEFAULT_CREDENTIALS: { login: string; password: string } | null = null;

// Helper function to check if string is not empty
function isNotEmpty(str: string): boolean {
  return str != null && str.length !== 0;
}

// Load credentials via IPC to the main process
async function loadCredentials(): Promise<{ login: string; password: string } | null> {
  try {
    let credentials = await ipcRenderer.invoke('load-credentials');
    if (credentials == null && DEFAULT_CREDENTIALS != null) {
      // If no credentials found, use default credentials
      console.log("No credentials found, using default credentials");
      credentials = DEFAULT_CREDENTIALS;
    } else if (credentials == null && DEFAULT_CREDENTIALS == null) {
      console.log("No credentials found");
    }else {
      console.log("Loaded credentials via ipc from Secure Store: ", credentials.login);
    }
    return credentials;
  } catch (e) {
    console.error("Error loading credentials", e);
    ipcRenderer.send("log.error", e);
    return null;
  }
}

// Handle URL changes
function urlChanged(oldUrl: string | null, newLocation: Location): void {
  
  if (passwordToSave !== null) {
    if (newLocation.host === "cad.onshape.com" && (oldUrl === null || oldUrl.endsWith("/signin")) && newLocation.pathname !== "/signup/forgotpassword") {
      // Save credentials when navigating away from the login page
      console.log("Saving credentials to keychain: " + passwordToSave.login)
      ipcRenderer.invoke('save-credentials', passwordToSave)
        .catch((e: any) => console.error(e));
    }
    passwordToSave = null;
  } else if (document.readyState !== "loading") {
    signInIfNeeded();
  }
}

// Listen for URL changes from main process
ipcRenderer.on("maybeUrlChanged", (_event: any, newUrl: string) => {
  console.log("URL changed:", newUrl);
  console.log("Got `maybeUrlChanged` event with new URL: ", newUrl);
  if (oldUrl !== newUrl) {
    try {
      urlChanged(oldUrl, window.location);
    } finally {
      oldUrl = newUrl;
    }
  }
});

// Add a DOM content loaded listener to detect login form
window.addEventListener('DOMContentLoaded', () => {
  signInIfNeeded();
});

// Function to check if we are on the sign-in page and handle the login form
async function signInIfNeeded(): Promise<void> {
  if (window.location.host === "cad.onshape.com" && window.location.pathname === "/signin") {
    // console.log("Onshape login page detected...");
    console.log("On signin page, looking for form");

    // Set up a mutation observer to wait for the form to be loaded
    const observer = new MutationObserver((mutations, obs) => {
      const formElement = document.querySelector("form[name='osForm']");
      if (formElement) {
        // console.log("Onshape Login Form detected on the page. Attempting to fill it...");
        console.log("Form found via MutationObserver");
        handleLoginForm(formElement as HTMLFormElement);
        obs.disconnect(); // Stop observing once we find the form
      }
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Also check immediately in case the form is already there
    const formElement = document.querySelector("form[name='osForm']");
    if (formElement) {
      console.log("Form found immediately");
      handleLoginForm(formElement as HTMLFormElement);
    }
  }
}


// Handle the login form when found
async function handleLoginForm(formElement: HTMLFormElement): Promise<void> {
  try {
    console.log("Handling login form");
    const credentials = await loadCredentials();
    if (credentials && isNotEmpty(credentials.login)) {
      console.log("Credentials found, filling form");
      // Fill the email input
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
      if (emailInput) {
        emailInput.value = credentials.login;
        emailInput.dispatchEvent(new Event("change", {"bubbles": true}));
      }

      // Fill the password input if available
      if (isNotEmpty(credentials.password)) {
        const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
        if (passwordInput) {
          passwordInput.value = credentials.password;
          passwordInput.dispatchEvent(new Event("change", {"bubbles": true}));
          
          // Click the submit button
          const submitButton = document.querySelector('div.os-form-btn-container > button[type="submit"]') as HTMLButtonElement;
          if (submitButton) {
            submitButton.click();
          }
        }
      }
    }

    // Setup form submission handler to capture credentials
    console.log("Setting up form submission handler");
    const originalSubmit = formElement.onsubmit;
    formElement.onsubmit = (event) => {
      console.log("Form submitted, capturing credentials...");
      // Call the original handler if it exists
      if (typeof originalSubmit === 'function') {
        originalSubmit.call(formElement, event);
      }

      // Get the current values from the form
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
      const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
      
      if (emailInput && passwordInput) {
        const login = emailInput.value;
        const password = passwordInput.value;
        
        if (isNotEmpty(login) && isNotEmpty(password)) {
          console.log("Form submitted with credentials, saving...");
          passwordToSave = { login, password };
        }
      }
    };
  } catch (e) {
    console.error("Error in handleLoginForm:", e);
    ipcRenderer.send("log.error", e);
  }
}
