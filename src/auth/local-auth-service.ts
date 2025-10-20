import  {authenticate} from '@google-cloud/local-auth';
import fs from 'fs';
import { Credentials, OAuth2Client } from "google-auth-library";
import os from 'os';
import { createRequire } from "module";
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const keys = require(`${__dirname}/keys.json`);

let storedCredentials: Credentials;

const oldCredentialsPath = `${os.homedir()}/.bkper-credentials.json`;
const configDir = `${os.homedir()}/.config/bkper`;
const storedCredentialsPath = `${configDir}/.bkper-credentials.json`;

// Migrate from old location if exists
if (!fs.existsSync(storedCredentialsPath) && fs.existsSync(oldCredentialsPath)) {
  try {
    // Ensure config directory exists
    fs.mkdirSync(configDir, { recursive: true });
    // Move credentials to new location
    const oldCredentials = fs.readFileSync(oldCredentialsPath, 'utf8');
    fs.writeFileSync(storedCredentialsPath, oldCredentials, 'utf8');
    fs.rmSync(oldCredentialsPath);
    // Credentials migrated successfully
  } catch (err) {
    // Migration failed - will fall back to old behavior
  }
}

try {
  let credentialsJson = fs.readFileSync(storedCredentialsPath, 'utf8');
  storedCredentials = JSON.parse(credentialsJson);
} catch (err) {
  // Credentials will be null if not found - no need to log during module loading
}

export async function login() {
  if (storedCredentials) {
    console.log('Bkper already logged in.');
  }
  await getOAuthToken();
}

export function logout() {
  if (fs.existsSync(storedCredentialsPath)) {
    fs.rmSync(storedCredentialsPath);
  }
  console.log('Bkper logged out.');
}

export function isLoggedIn() {
  return storedCredentials != null;
}

/**
 * @returns A promise that resolves to a valid OAuth token.
 */
export async function getOAuthToken(): Promise<string> {

    let localAuth: OAuth2Client

    if (storedCredentials) {
      localAuth = new OAuth2Client(
        keys.installed.client_id,
        keys.installed.client_secret,
        keys.installed.redirect_uris[0]
      );
      localAuth.setCredentials(storedCredentials);
    } else {
      localAuth = await authenticate({
        scopes: ['https://www.googleapis.com/auth/userinfo.email'],
        keyfilePath: `${__dirname}/keys.json`,
      });
      storeCredentials(localAuth.credentials);
    }

    localAuth.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        // store the refresh_token in my database!
        storeCredentials(tokens)
      }
    });
    
    let token = await localAuth.getAccessToken();

    return token.token || '';
    
  }

  function storeCredentials(credentials: Credentials) {
    storedCredentials = credentials;
    // Ensure config directory exists before writing
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(storedCredentialsPath, JSON.stringify(credentials, null, 4), 'utf8');
  }
