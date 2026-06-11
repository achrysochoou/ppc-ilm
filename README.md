# ppc-ilm

## Components
### Syncope = identity lifecycle source of truth
### penLDAP = provisioning target / shared directory
### Keycloak = authentication, SSO, OIDC/SAML, apps access
### Mailpit = notification testing
### Adminer = DB inspection
### phpLDAPadmin = LDAP inspection

## Componets localhost URLs
**Keycloak: http://localhost:8080**
**Syncope Core: http://localhost:18080/syncope**
**Syncope Console: http://localhost:28080/syncope-console (admin/password to login)**
**Syncope Enduser: http://localhost:38080/syncope-enduser**
**Syncope WA: http://localhost:48080/syncope-wa**
**Syncope SRA: http://localhost:58080/syncope-sra**
**Mailpit: http://localhost:8025**
**Adminer: http://localhost:8081**
**phpLDAPadmin: https://localhost:6443**


## Next steps: 
1. configure Syncope LDAP connector to provision users/groups into openldap, 
2. then configure Keycloak LDAP federation against ldap://openldap:389
3. Discuss integrationb with other services

### Create user with curl 
```
curl -i -X POST 'http://localhost:18080/syncope/rest/users' \
  -u admin:password \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'Prefer: return-content' \
  -H 'X-Syncope-Domain: Master' \
  -d '{
    "_class": "org.apache.syncope.common.lib.request.UserCR",
    "realm": "/",
    "username": "testuser",
    "password": "Password123!",
    "storePassword": true,
    "plainAttrs": [
      {
        "schema": "email",
        "values": ["testuser@example.com"]
      }
    ],
    "resources": []
  }'
```