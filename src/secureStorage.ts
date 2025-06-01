import { ipcMain, safeStorage } from 'electron';
import Store from 'electron-store';
import { log } from './util';

const CREDENTIALS_KEY = 'encryptedCredentials';

// Create a store for saving encrypted data
const secureStore = new Store({
  name: 'secure-storage',
  // No need to encrypt the store itself, since we're encrypting the sensitive data with safeStorage
  encryptionKey: undefined
});

export function setupCredentialsHandlers(): void {
  // Check if safe storage is available
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  log('Safe storage encryption available:', encryptionAvailable);
  
  if (!encryptionAvailable) {
    log('WARNING: Safe storage encryption is not available on this device');
  }

  log('Setting up credential handlers');

  // Handle saving credentials
  ipcMain.handle('save-credentials', async (_event, credentials: { login: string; password: string }) => {
    try {
      log(`Saving credentials for ${credentials.login}`);
      
      // Convert credentials to JSON string
      const credentialsJson = JSON.stringify(credentials);
      
      // Encrypt the data
      const encryptedData = safeStorage.encryptString(credentialsJson);
      
      // Convert Buffer to storable format
      const serializedData = encryptedData.toString('base64');
      
      // Save serialized data
      secureStore.set(CREDENTIALS_KEY, serializedData);
      log('Credentials saved successfully');
      
      return true;
    } catch (error) {
      log('Error saving credentials:', error);
      throw error;
    }
  });

  // Handle loading credentials
  ipcMain.handle('load-credentials', async () => {
    try {
      log('Loading credentials');
      // Get the serialized data
      const serializedData = secureStore.get(CREDENTIALS_KEY) as string | undefined;
      
      if (!serializedData) {
        log('No stored credentials found');
        return null;
      }
      
      try {
        // Convert serialized data back to Buffer
        const encryptedData = Buffer.from(serializedData, 'base64');
        
        // Decrypt the data
        const decryptedData = safeStorage.decryptString(encryptedData);
        
        // Parse the JSON
        const credentials = JSON.parse(decryptedData);
        log(`Loaded credentials for ${credentials.login}`);
        
        return credentials;
      } catch (e) {
        // If there's an error with the stored format, try to clear it
        log('Error with stored credential format, trying to clear:', e);
        secureStore.clear();
        return null;
      }
    } catch (error) {
      log('Error loading credentials:', error);
      secureStore.clear();
      return null;
    }
  });

  // // Add handler to clear credential storage (for debugging)
  // ipcMain.handle('clear-credentials-storage', async () => {
  //   try {
  //     log('Clearing credential storage via IPC');
  //     secureStore.clear();
  //     return true;
  //   } catch (error) {
  //     log('Error clearing credentials:', error);
  //     return false;
  //   }
  // });

  // Handle clearing credentials
  ipcMain.handle('clear-credentials', async () => {
    try {
      log('Clearing credentials via IPC');
      secureStore.delete(CREDENTIALS_KEY);
      log('Credentials cleared successfully');
      return true;
    } catch (error) {
      log('Error clearing credentials:', error);
      return false;
    }
  });

  log('Credential handlers setup complete');
}

// Get stored credentials - used by menu system
export async function getStoredCredentials(): Promise<{ login: string; password: string } | null> {
  try {
    log('Getting stored credentials for menu');
    // Get the serialized data
    const serializedData = secureStore.get(CREDENTIALS_KEY) as string | undefined;
    
    if (!serializedData) {
      log('No stored credentials found');
      return null;
    }
    
    try {
      // Convert serialized data back to Buffer
      const encryptedData = Buffer.from(serializedData, 'base64');
      
      // Decrypt the data
      const decryptedData = safeStorage.decryptString(encryptedData);
      
      // Parse the JSON
      const credentials = JSON.parse(decryptedData);
      log(`Found credentials for ${credentials.login}`);
      
      return credentials;
    } catch (e) {
      log('Error decrypting credentials:', e);
      return null;
    }
  } catch (error) {
    log('Error getting stored credentials:', error);
    return null;
  }
}


export function clearCredentials(): boolean {
  try {
    log('Clearing credentials via menu');
    secureStore.delete(CREDENTIALS_KEY);
    log('Credentials cleared successfully');
    return true;
  } catch (error) {
    log('Error clearing credentials via menu:', error);
    return false;
  }
}

// Clean up handlers when app is about to quit
export function cleanupCredentialsHandlers(): void {
  log('Cleaning up credential handlers');
  ipcMain.removeHandler('save-credentials');
  ipcMain.removeHandler('load-credentials');
  // ipcMain.removeHandler('clear-credentials-storage');
  ipcMain.removeHandler('clear-credentials');
}