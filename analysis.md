## Keyclock
Authentication
Authorization
SSO (single sign on)
OIDC (OpenID Connect) - is an interoperable authentication protocol built on top of the OAuth 2.0 framework)
SAML (Security Assertion Markup Language) - Security Assertion Markup Language) is an open, XML-based standard that securely exchanges authentication and authorization data between parties. It is the foundational protocol that makes Enterprise Single Sign-On (SSO) possible, allowing you to access multiple web applications using just one set of login credentials.

## Syncope
Identity Governance
Identity Lifecycle
Provisioning
Workflows

## Notes
production environments usually replace OpenLDAP with Active Directory or Entra ID and add approval workflows, certification campaigns, and segregation-of-duties controls.

## next
Create a user via Syncope REST API.
Verify the user appears in Syncope Console.
Configure Syncope → OpenLDAP provisioning.
Verify the user appears in phpLDAPadmin.
Configure Keycloak LDAP Federation.
Verify the same user appears in Keycloak.
Login to a sample application via Keycloak.

That demonstrates the complete ILM lifecycle from API → Syncope → LDAP → Keycloak → Application.