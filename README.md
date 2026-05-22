# ppc-ilm

Keycloak:          http://localhost:8080
Syncope Core:      http://localhost:18080/syncope
Syncope Console:   http://localhost:28080/syncope-console
Syncope Enduser:   http://localhost:38080/syncope-enduser
Syncope WA:        http://localhost:48080/syncope-wa
Syncope SRA:       http://localhost:58080/syncope-sra
Mailpit:           http://localhost:8025
Adminer:           http://localhost:8081
phpLDAPadmin:      https://localhost:6443

Syncope = identity lifecycle source of truth
OpenLDAP = provisioning target / shared directory
Keycloak = authentication, SSO, OIDC/SAML, apps access
Mailpit = notification testing
Adminer = DB inspection
phpLDAPadmin = LDAP inspection

Next step: configure Syncope LDAP connector to provision users/groups into openldap, then configure Keycloak LDAP federation against ldap://openldap:389