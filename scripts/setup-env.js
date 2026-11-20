import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
let text = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
for (const key of ['POSTGRES_PASSWORD', 'KEYCLOAK_DB_PASSWORD', 'SYNCOPE_DB_PASSWORD', 'KEYCLOAK_ADMIN_PASSWORD', 'LDAP_ADMIN_PASSWORD', 'ANONYMOUS_KEY', 'ILM_PILOT_CLIENT_SECRET']) {
  text = text.replace(new RegExp(`^${key}=(?:anonymousKey|changeme)\\r?$`, 'm'), `${key}=`);
  if (!new RegExp(`^${key}=.+$`, 'm').test(text)) {
    text = text.replace(new RegExp(`^${key}=.*(?:\\r?\\n|$)`, 'm'), '');
    text += `\n${key}=${randomBytes(32).toString('hex')}\n`;
  }
}
for (const [key, value] of Object.entries({ KEYCLOAK_ISSUER: 'http://localhost:8080/realms/ppc-pilot', ILM_AUDIENCE: 'ilm-api', ILM_PILOT_CLIENT_ID: 'ilm-pilot' })) {
  if (!new RegExp(`^${key}=.+$`, 'm').test(text)) text += `\n${key}=${value}\n`;
}
writeFileSync('.env.local', text, { mode: 0o600 });
console.log('Local secrets configured in .env.local. Existing non-empty values preserved.');
