# Microsoft Entra ID Log Scenarios

## Purpose

This document provides representative Microsoft Entra ID log examples grouped by category.  
It includes normal lifecycle/authentication events and abnormal or malicious scenarios useful for SOC monitoring, SIEM/Sentinel analytics, CCoE governance, and application call-flow documentation.

> Notes:
>
> - The samples are representative templates, not real tenant logs.
> - Field names and values may vary depending on Microsoft Entra diagnostic settings, Log Analytics table, licensing, workload, and export configuration.
> - Logout is usually not captured as a clean Microsoft Entra sign-out event. Application logs should explicitly capture logout, session timeout, and local session termination.
> - For production use, correlate Entra logs with application logs, endpoint telemetry, network logs, and SIEM incidents.

---

# 1. Main Microsoft Entra ID Log Sources

| Log Source | Typical Use |
|---|---|
| `AuditLogs` | User, group, role, app, policy, license, device, and tenant configuration changes |
| `SigninLogs` | Interactive user sign-ins |
| `AADNonInteractiveUserSignInLogs` | Non-interactive user sign-ins, refresh token activity, background client access |
| `AADServicePrincipalSignInLogs` | Application/service principal authentication |
| `AADManagedIdentitySignInLogs` | Managed identity authentication to Azure resources |
| `RiskyUsers` / `RiskySignIns` | Identity Protection risk detections |
| Application logs | Session creation, business actions, logout, session timeout, app-level authorization |

---

# 2. Recommended Correlation Fields

Use these fields to reconstruct a complete call flow:

```text
TimeGenerated
Category
OperationName
Result / ResultType
ResultDescription
UserPrincipalName
UserId
InitiatedBy
TargetResources
AppDisplayName
AppId
IPAddress
Location
DeviceDetail
ConditionalAccessStatus
ConditionalAccessPolicies
AuthenticationRequirement
AuthenticationDetails
RiskState
RiskLevelAggregated
CorrelationId
SessionId
```

Recommended correlation chain:

```text
CorrelationId
→ UserPrincipalName / UserId
→ AppId / AppDisplayName
→ IPAddress
→ DeviceId
→ SessionId, from application logs
```

---

# 3. Normal User Lifecycle Scenarios

## 3.1 New User Created

**Category:** User lifecycle  
**Log source:** `AuditLogs`  
**Operation:** `Add user`  
**Description:** A new Microsoft Entra user object is created.

```json
{
  "timeGenerated": "2026-07-08T08:15:22Z",
  "category": "UserManagement",
  "operationName": "Add user",
  "result": "success",
  "activityDateTime": "2026-07-08T08:15:22Z",
  "correlationId": "7d4d2d4f-3f02-4d7e-98c1-9a8f5c1e0011",
  "initiatedBy": {
    "user": {
      "id": "2a90f4c1-56ab-4b12-8f11-4d5f33a1c901",
      "userPrincipalName": "admin@contoso.com",
      "displayName": "Tenant Administrator",
      "ipAddress": "203.0.113.10"
    }
  },
  "targetResources": [
    {
      "id": "9f7d01b6-11e4-42d3-b0a7-4f40cfcd0101",
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com",
      "displayName": "John Smith",
      "modifiedProperties": [
        {
          "displayName": "UserPrincipalName",
          "newValue": "john.smith@contoso.com"
        },
        {
          "displayName": "AccountEnabled",
          "newValue": "true"
        },
        {
          "displayName": "Department",
          "newValue": "Finance"
        }
      ]
    }
  ]
}
```

---

## 3.2 User Updated

**Category:** User lifecycle  
**Log source:** `AuditLogs`  
**Operation:** `Update user`  
**Description:** User profile or account attributes are changed.

```json
{
  "timeGenerated": "2026-07-08T10:21:10Z",
  "category": "UserManagement",
  "operationName": "Update user",
  "result": "success",
  "activityDateTime": "2026-07-08T10:21:10Z",
  "correlationId": "6c4a76a0-2e7d-4db6-81fa-3f3305a90077",
  "initiatedBy": {
    "user": {
      "id": "2a90f4c1-56ab-4b12-8f11-4d5f33a1c901",
      "userPrincipalName": "admin@contoso.com",
      "displayName": "Tenant Administrator",
      "ipAddress": "203.0.113.10"
    }
  },
  "targetResources": [
    {
      "id": "9f7d01b6-11e4-42d3-b0a7-4f40cfcd0101",
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com",
      "displayName": "John Smith",
      "modifiedProperties": [
        {
          "displayName": "JobTitle",
          "oldValue": "Finance Analyst",
          "newValue": "Senior Finance Analyst"
        },
        {
          "displayName": "Department",
          "oldValue": "Finance",
          "newValue": "Corporate Finance"
        },
        {
          "displayName": "MobilePhone",
          "oldValue": "+30 210 0000000",
          "newValue": "+30 210 1111111"
        }
      ]
    }
  ]
}
```

---

## 3.3 User Deleted

**Category:** User lifecycle  
**Log source:** `AuditLogs`  
**Operation:** `Delete user`  
**Description:** A user account is deleted from Microsoft Entra ID.

```json
{
  "timeGenerated": "2026-07-08T09:05:44Z",
  "category": "UserManagement",
  "operationName": "Delete user",
  "result": "success",
  "activityDateTime": "2026-07-08T09:05:44Z",
  "correlationId": "b5f02fd8-4379-43ff-87c8-7f1a9e4f0044",
  "initiatedBy": {
    "user": {
      "id": "2a90f4c1-56ab-4b12-8f11-4d5f33a1c901",
      "userPrincipalName": "admin@contoso.com",
      "displayName": "Tenant Administrator",
      "ipAddress": "203.0.113.10"
    }
  },
  "targetResources": [
    {
      "id": "9f7d01b6-11e4-42d3-b0a7-4f40cfcd0101",
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com",
      "displayName": "John Smith"
    }
  ],
  "additionalDetails": [
    {
      "key": "DeletedObjectType",
      "value": "User"
    },
    {
      "key": "Reason",
      "value": "User offboarding"
    }
  ]
}
```

---

## 3.4 User Account Disabled

**Category:** User lifecycle  
**Log source:** `AuditLogs`  
**Operation:** `Update user`  
**Description:** The user object still exists, but authentication is disabled.

```json
{
  "timeGenerated": "2026-07-08T08:30:11Z",
  "category": "UserManagement",
  "operationName": "Update user",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "admin@contoso.com",
      "ipAddress": "203.0.113.10"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "id": "9f7d01b6-11e4-42d3-b0a7-4f40cfcd0101",
      "userPrincipalName": "john.smith@contoso.com",
      "modifiedProperties": [
        {
          "displayName": "AccountEnabled",
          "oldValue": "true",
          "newValue": "false"
        }
      ]
    }
  ],
  "correlationId": "1f9c84e3-5cc2-44de-8bb4-001001001001"
}
```

---

## 3.5 User Account Enabled

**Category:** User lifecycle  
**Log source:** `AuditLogs`  
**Operation:** `Update user`  
**Description:** A previously disabled account is enabled again.

```json
{
  "timeGenerated": "2026-07-08T09:02:18Z",
  "category": "UserManagement",
  "operationName": "Update user",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "admin@contoso.com",
      "ipAddress": "203.0.113.10"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com",
      "modifiedProperties": [
        {
          "displayName": "AccountEnabled",
          "oldValue": "false",
          "newValue": "true"
        }
      ]
    }
  ],
  "correlationId": "2d37a723-85dd-4128-b9d7-002002002002"
}
```

---

# 4. Authentication and Session Scenarios

## 4.1 Successful User Login

**Category:** Authentication  
**Log source:** `SigninLogs`  
**Operation:** `Sign-in activity`  
**Description:** User successfully authenticates to an application.

```json
{
  "timeGenerated": "2026-07-08T11:02:33Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "0",
  "resultDescription": "Success",
  "correlationId": "a3db5a18-00aa-4c63-bdf6-104fd3150012",
  "userId": "9f7d01b6-11e4-42d3-b0a7-4f40cfcd0101",
  "userPrincipalName": "john.smith@contoso.com",
  "userDisplayName": "John Smith",
  "appDisplayName": "Customer Portal",
  "appId": "11111111-2222-3333-4444-555555555555",
  "clientAppUsed": "Browser",
  "ipAddress": "198.51.100.25",
  "location": {
    "city": "Athens",
    "countryOrRegion": "GR"
  },
  "deviceDetail": {
    "operatingSystem": "Windows 11",
    "browser": "Microsoft Edge",
    "isCompliant": true,
    "isManaged": true
  },
  "conditionalAccessStatus": "success",
  "authenticationRequirement": "multiFactorAuthentication",
  "status": {
    "errorCode": 0,
    "failureReason": null
  },
  "authenticationDetails": [
    {
      "authenticationStep": "Primary authentication",
      "succeeded": true,
      "authenticationMethod": "Password"
    },
    {
      "authenticationStep": "MFA",
      "succeeded": true,
      "authenticationMethod": "Microsoft Authenticator notification"
    }
  ]
}
```

---

## 4.2 Failed Login

**Category:** Authentication  
**Log source:** `SigninLogs`  
**Operation:** `Sign-in activity`  
**Description:** Authentication attempt fails due to wrong credentials.

```json
{
  "timeGenerated": "2026-07-08T11:07:51Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "50126",
  "resultDescription": "Invalid username or password",
  "correlationId": "3d9db240-f3c7-45d9-8dc9-b0f6c4cf0025",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Customer Portal",
  "clientAppUsed": "Browser",
  "ipAddress": "203.0.113.77",
  "location": {
    "city": "Unknown",
    "countryOrRegion": "Unknown"
  },
  "conditionalAccessStatus": "notApplied",
  "status": {
    "errorCode": 50126,
    "failureReason": "Error validating credentials due to invalid username or password."
  }
}
```

---

## 4.3 Application Logout Event

**Category:** Session management  
**Log source:** Application logs  
**Description:** Logout should normally be logged by the application, not only by Entra ID.

```json
{
  "timeGenerated": "2026-07-08T12:14:09Z",
  "source": "CustomerPortal",
  "eventType": "UserLogout",
  "result": "success",
  "sessionId": "sess-8b942d3f91",
  "correlationId": "a3db5a18-00aa-4c63-bdf6-104fd3150012",
  "user": {
    "id": "9f7d01b6-11e4-42d3-b0a7-4f40cfcd0101",
    "userPrincipalName": "john.smith@contoso.com",
    "displayName": "John Smith"
  },
  "application": {
    "appId": "11111111-2222-3333-4444-555555555555",
    "displayName": "Customer Portal"
  },
  "client": {
    "ipAddress": "198.51.100.25",
    "userAgent": "Mozilla/5.0 Edge/126.0",
    "deviceId": "device-7721"
  },
  "logoutContext": {
    "logoutType": "UserInitiated",
    "sessionDurationSeconds": 4276,
    "refreshTokenRevoked": false,
    "localSessionCleared": true
  }
}
```

---

## 4.4 OIDC Logout Redirect

**Category:** Session management  
**Log source:** Application logs  
**Description:** Application redirects user to Microsoft identity platform logout endpoint.

```json
{
  "timeGenerated": "2026-07-08T12:14:08Z",
  "source": "CustomerPortal",
  "eventType": "OIDCLogoutRedirect",
  "method": "GET",
  "endpoint": "https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/logout",
  "postLogoutRedirectUri": "https://customer.contoso.com/logout-complete",
  "userPrincipalName": "john.smith@contoso.com",
  "sessionId": "sess-8b942d3f91",
  "result": "redirected"
}
```

---

## 4.5 Non-Interactive Sign-In / Refresh Token Activity

**Category:** Authentication  
**Log source:** `AADNonInteractiveUserSignInLogs`  
**Description:** User access is refreshed silently by a client application.

```json
{
  "timeGenerated": "2026-07-08T14:40:12Z",
  "category": "NonInteractiveUserSignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "0",
  "resultDescription": "Success",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Microsoft Teams",
  "clientAppUsed": "Mobile Apps and Desktop clients",
  "ipAddress": "198.51.100.25",
  "authenticationProtocol": "OAuth2",
  "incomingTokenType": "refreshToken",
  "correlationId": "0d9418cd-7e9a-42ac-94f9-026026026026"
}
```

---

## 4.6 User Session Revoked / Refresh Tokens Invalidated

**Category:** Session management  
**Log source:** `AuditLogs`  
**Description:** Existing refresh tokens are revoked, usually forcing the user to authenticate again.

```json
{
  "timeGenerated": "2026-07-08T15:05:17Z",
  "category": "UserManagement",
  "operationName": "Revoke user refresh tokens",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "security.admin@contoso.com",
      "ipAddress": "203.0.113.40"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com"
    }
  ],
  "additionalDetails": [
    {
      "key": "Reason",
      "value": "Suspected compromised account"
    }
  ],
  "correlationId": "2575d1bd-72ee-43f5-91b6-027027027027"
}
```

---

# 5. Password and MFA Scenarios

## 5.1 Password Reset by Administrator

**Category:** Password management  
**Log source:** `AuditLogs`  
**Description:** Helpdesk or administrator resets a user's password.

```json
{
  "timeGenerated": "2026-07-08T09:15:42Z",
  "category": "UserManagement",
  "operationName": "Reset user password",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "helpdesk@contoso.com",
      "displayName": "Helpdesk Operator",
      "ipAddress": "203.0.113.15"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com",
      "displayName": "John Smith"
    }
  ],
  "additionalDetails": [
    {
      "key": "ForceChangePasswordNextSignIn",
      "value": "true"
    }
  ],
  "correlationId": "41ea18c6-f785-4f59-a5aa-003003003003"
}
```

---

## 5.2 Self-Service Password Change

**Category:** Password management  
**Log source:** `AuditLogs`  
**Description:** User changes password using self-service password reset.

```json
{
  "timeGenerated": "2026-07-08T09:22:05Z",
  "category": "UserManagement",
  "operationName": "Change password (self-service)",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "john.smith@contoso.com",
      "ipAddress": "198.51.100.25"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com"
    }
  ],
  "additionalDetails": [
    {
      "key": "AuthenticationMethodsUsed",
      "value": "Microsoft Authenticator, SMS"
    }
  ],
  "correlationId": "6c0df8f0-117f-4e59-9a6b-004004004004"
}
```

---

## 5.3 MFA Registration Completed

**Category:** MFA  
**Log source:** `AuditLogs`  
**Description:** User registers an MFA/security method.

```json
{
  "timeGenerated": "2026-07-08T11:00:41Z",
  "category": "UserManagement",
  "operationName": "User registered security info",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "john.smith@contoso.com",
      "ipAddress": "198.51.100.25"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com"
    }
  ],
  "additionalDetails": [
    {
      "key": "AuthenticationMethod",
      "value": "Microsoft Authenticator"
    }
  ],
  "correlationId": "c4c8a3cc-9026-4e40-8e5f-009009009009"
}
```

---

## 5.4 MFA Challenge Succeeds

**Category:** MFA  
**Log source:** `SigninLogs`  
**Description:** User completes MFA during sign-in.

```json
{
  "timeGenerated": "2026-07-08T11:06:22Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "0",
  "resultDescription": "Success",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Microsoft Office 365",
  "ipAddress": "198.51.100.25",
  "authenticationRequirement": "multiFactorAuthentication",
  "conditionalAccessStatus": "success",
  "authenticationDetails": [
    {
      "authenticationStep": "Primary authentication",
      "succeeded": true,
      "authenticationMethod": "Password"
    },
    {
      "authenticationStep": "MFA",
      "succeeded": true,
      "authenticationMethod": "Microsoft Authenticator notification"
    }
  ],
  "correlationId": "57d85458-997b-4e7f-a924-010010010010"
}
```

---

## 5.5 MFA Challenge Denied

**Category:** MFA  
**Log source:** `SigninLogs`  
**Description:** User denies an MFA prompt.

```json
{
  "timeGenerated": "2026-07-08T11:10:19Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "500121",
  "resultDescription": "Authentication failed during strong authentication request",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Microsoft Office 365",
  "ipAddress": "203.0.113.77",
  "authenticationRequirement": "multiFactorAuthentication",
  "authenticationDetails": [
    {
      "authenticationStep": "Primary authentication",
      "succeeded": true,
      "authenticationMethod": "Password"
    },
    {
      "authenticationStep": "MFA",
      "succeeded": false,
      "authenticationMethod": "Microsoft Authenticator notification",
      "failureReason": "User denied the authentication request"
    }
  ],
  "conditionalAccessStatus": "failure",
  "correlationId": "cad8fb6a-3500-45de-bf06-011011011011"
}
```

---

## 5.6 Security Information Added

**Category:** MFA / security info  
**Log source:** `AuditLogs`  
**Description:** User adds a new authentication method.

```json
{
  "timeGenerated": "2026-07-08T17:22:13Z",
  "category": "UserManagement",
  "operationName": "User registered security info",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "john.smith@contoso.com",
      "ipAddress": "198.51.100.25"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com"
    }
  ],
  "additionalDetails": [
    {
      "key": "SecurityInfoType",
      "value": "Phone"
    },
    {
      "key": "PhoneType",
      "value": "Mobile"
    }
  ],
  "correlationId": "159a2e23-1ee3-4746-9c8e-034034034034"
}
```

---

## 5.7 Security Information Removed

**Category:** MFA / security info  
**Log source:** `AuditLogs`  
**Description:** User removes an authentication method.

```json
{
  "timeGenerated": "2026-07-08T17:35:49Z",
  "category": "UserManagement",
  "operationName": "User deleted security info",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "john.smith@contoso.com",
      "ipAddress": "198.51.100.25"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com"
    }
  ],
  "additionalDetails": [
    {
      "key": "SecurityInfoType",
      "value": "Phone"
    }
  ],
  "correlationId": "4cf6d54a-b7e0-4ae5-8d58-035035035035"
}
```

---

# 6. Group, Role, License and Access Scenarios

## 6.1 User Added to Group

**Category:** Authorization / group management  
**Log source:** `AuditLogs`  
**Description:** User is added to a security or Microsoft 365 group.

```json
{
  "timeGenerated": "2026-07-08T09:40:33Z",
  "category": "GroupManagement",
  "operationName": "Add member to group",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "group.admin@contoso.com",
      "ipAddress": "203.0.113.20"
    }
  },
  "targetResources": [
    {
      "type": "Group",
      "displayName": "Finance-App-Users",
      "id": "72b8f91e-71f9-42ab-8d4b-005005005005",
      "modifiedProperties": [
        {
          "displayName": "Members",
          "newValue": "john.smith@contoso.com"
        }
      ]
    }
  ],
  "correlationId": "3d4af540-0f7c-47a2-982b-005005005005"
}
```

---

## 6.2 User Removed from Group

**Category:** Authorization / group management  
**Log source:** `AuditLogs`  
**Description:** User is removed from a group.

```json
{
  "timeGenerated": "2026-07-08T10:05:19Z",
  "category": "GroupManagement",
  "operationName": "Remove member from group",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "group.admin@contoso.com",
      "ipAddress": "203.0.113.20"
    }
  },
  "targetResources": [
    {
      "type": "Group",
      "displayName": "Finance-App-Users",
      "modifiedProperties": [
        {
          "displayName": "Members",
          "oldValue": "john.smith@contoso.com",
          "newValue": null
        }
      ]
    }
  ],
  "correlationId": "1898e3c1-b6b6-46c5-9d31-006006006006"
}
```

---

## 6.3 User Assigned Admin Role

**Category:** Privileged access  
**Log source:** `AuditLogs`  
**Description:** User is assigned a Microsoft Entra directory role.

```json
{
  "timeGenerated": "2026-07-08T10:18:55Z",
  "category": "RoleManagement",
  "operationName": "Add member to role",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "global.admin@contoso.com",
      "ipAddress": "203.0.113.30"
    }
  },
  "targetResources": [
    {
      "type": "Role",
      "displayName": "User Administrator",
      "modifiedProperties": [
        {
          "displayName": "Member",
          "newValue": "john.smith@contoso.com"
        }
      ]
    }
  ],
  "correlationId": "805f2027-d6f4-4e47-bb24-007007007007"
}
```

---

## 6.4 Admin Role Removed from User

**Category:** Privileged access  
**Log source:** `AuditLogs`  
**Description:** Privileged directory role is removed.

```json
{
  "timeGenerated": "2026-07-08T10:45:09Z",
  "category": "RoleManagement",
  "operationName": "Remove member from role",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "global.admin@contoso.com",
      "ipAddress": "203.0.113.30"
    }
  },
  "targetResources": [
    {
      "type": "Role",
      "displayName": "User Administrator",
      "modifiedProperties": [
        {
          "displayName": "Member",
          "oldValue": "john.smith@contoso.com"
        }
      ]
    }
  ],
  "correlationId": "7d59db23-3119-490a-8582-008008008008"
}
```

---

## 6.5 License Assigned

**Category:** License management  
**Log source:** `AuditLogs`  
**Description:** User receives a Microsoft license.

```json
{
  "timeGenerated": "2026-07-08T16:20:18Z",
  "category": "UserManagement",
  "operationName": "Change user license",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "license.admin@contoso.com",
      "ipAddress": "203.0.113.35"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com",
      "modifiedProperties": [
        {
          "displayName": "AssignedLicenses",
          "oldValue": null,
          "newValue": "Microsoft 365 E5"
        }
      ]
    }
  ],
  "correlationId": "10179b25-e734-4419-ab24-031031031031"
}
```

---

## 6.6 License Removed

**Category:** License management  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T16:38:52Z",
  "category": "UserManagement",
  "operationName": "Change user license",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "license.admin@contoso.com",
      "ipAddress": "203.0.113.35"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com",
      "modifiedProperties": [
        {
          "displayName": "AssignedLicenses",
          "oldValue": "Microsoft 365 E5",
          "newValue": null
        }
      ]
    }
  ],
  "correlationId": "783cb3b3-b94f-4be8-9298-032032032032"
}
```

---

# 7. Conditional Access Scenarios

## 7.1 Conditional Access Blocks Login

**Category:** Conditional Access  
**Log source:** `SigninLogs`  
**Description:** Access is blocked by policy.

```json
{
  "timeGenerated": "2026-07-08T11:22:47Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "53003",
  "resultDescription": "Access has been blocked by Conditional Access policies",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Finance Portal",
  "ipAddress": "203.0.113.77",
  "location": {
    "city": "Unknown",
    "countryOrRegion": "Unknown"
  },
  "conditionalAccessStatus": "failure",
  "conditionalAccessPolicies": [
    {
      "displayName": "Block access from unknown countries",
      "result": "failure",
      "conditionsSatisfied": "location",
      "grantControls": "block"
    }
  ],
  "correlationId": "015e5074-57f3-4b31-8364-012012012012"
}
```

---

## 7.2 Conditional Access Requires MFA and Allows Login

**Category:** Conditional Access  
**Log source:** `SigninLogs`

```json
{
  "timeGenerated": "2026-07-08T11:28:33Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "0",
  "resultDescription": "Success",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Finance Portal",
  "ipAddress": "198.51.100.25",
  "conditionalAccessStatus": "success",
  "conditionalAccessPolicies": [
    {
      "displayName": "Require MFA for Finance Portal",
      "result": "success",
      "conditionsSatisfied": "application,userRisk",
      "grantControls": "mfa"
    }
  ],
  "authenticationRequirement": "multiFactorAuthentication",
  "correlationId": "8c7ca0b4-f20a-462b-a6c8-013013013013"
}
```

---

## 7.3 Conditional Access Policy Updated

**Category:** Conditional Access  
**Log source:** `AuditLogs`  
**Description:** Conditional Access policy is modified.

```json
{
  "timeGenerated": "2026-07-08T17:00:25Z",
  "category": "Policy",
  "operationName": "Update conditional access policy",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "ca.admin@contoso.com",
      "ipAddress": "203.0.113.45"
    }
  },
  "targetResources": [
    {
      "type": "Policy",
      "displayName": "Require MFA for Admins",
      "modifiedProperties": [
        {
          "displayName": "State",
          "oldValue": "enabledForReportingButNotEnforced",
          "newValue": "enabled"
        },
        {
          "displayName": "GrantControls",
          "oldValue": "mfa",
          "newValue": "mfa, compliantDevice"
        }
      ]
    }
  ],
  "correlationId": "eed733c1-4f36-4a72-b081-033033033033"
}
```

---

# 8. Device Scenarios

## 8.1 Device Registered

**Category:** Device management  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T14:02:19Z",
  "category": "Device",
  "operationName": "Register device",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "john.smith@contoso.com",
      "ipAddress": "198.51.100.25"
    }
  },
  "targetResources": [
    {
      "type": "Device",
      "displayName": "JOHN-LAPTOP-01",
      "id": "4e14988e-b923-4e83-965d-023023023023"
    }
  ],
  "additionalDetails": [
    {
      "key": "DeviceOSType",
      "value": "Windows"
    },
    {
      "key": "DeviceTrustType",
      "value": "AzureAdJoined"
    }
  ],
  "correlationId": "1970fb1e-f87f-43c1-9209-023023023023"
}
```

---

## 8.2 Login Allowed Because Device Is Compliant

**Category:** Device compliance  
**Log source:** `SigninLogs`

```json
{
  "timeGenerated": "2026-07-08T14:15:55Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "0",
  "resultDescription": "Success",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Finance Portal",
  "ipAddress": "198.51.100.25",
  "deviceDetail": {
    "deviceId": "4e14988e-b923-4e83-965d-023023023023",
    "displayName": "JOHN-LAPTOP-01",
    "operatingSystem": "Windows",
    "isCompliant": true,
    "isManaged": true
  },
  "conditionalAccessStatus": "success",
  "conditionalAccessPolicies": [
    {
      "displayName": "Require compliant device",
      "result": "success",
      "grantControls": "compliantDevice"
    }
  ],
  "correlationId": "75fa2da1-3097-4312-ad29-024024024024"
}
```

---

## 8.3 Login Blocked Because Device Is Not Compliant

**Category:** Device compliance  
**Log source:** `SigninLogs`

```json
{
  "timeGenerated": "2026-07-08T14:22:40Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "53003",
  "resultDescription": "Access has been blocked by Conditional Access policies",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Finance Portal",
  "ipAddress": "198.51.100.25",
  "deviceDetail": {
    "displayName": "PERSONAL-LAPTOP",
    "operatingSystem": "Windows",
    "isCompliant": false,
    "isManaged": false
  },
  "conditionalAccessStatus": "failure",
  "conditionalAccessPolicies": [
    {
      "displayName": "Require compliant device",
      "result": "failure",
      "grantControls": "compliantDevice"
    }
  ],
  "correlationId": "74678b84-6530-44d4-9e1d-025025025025"
}
```

---

# 9. Guest / B2B Scenarios

## 9.1 Guest User Invited

**Category:** Guest access  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T12:14:27Z",
  "category": "UserManagement",
  "operationName": "Invite external user",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "mary.admin@contoso.com",
      "ipAddress": "203.0.113.50"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "external.user_example.com#EXT#@contoso.onmicrosoft.com",
      "displayName": "External User"
    }
  ],
  "additionalDetails": [
    {
      "key": "InvitedUserEmailAddress",
      "value": "external.user@example.com"
    },
    {
      "key": "InviteRedirectUrl",
      "value": "https://myapps.microsoft.com"
    }
  ],
  "correlationId": "4509f45c-fbb4-4277-a0ab-016016016016"
}
```

---

## 9.2 Guest User Redeems Invitation

**Category:** Guest access  
**Log source:** `AuditLogs` / `SigninLogs`

```json
{
  "timeGenerated": "2026-07-08T12:30:02Z",
  "category": "UserManagement",
  "operationName": "Redeem external user invite",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "external.user_example.com#EXT#@contoso.onmicrosoft.com",
      "ipAddress": "198.51.100.80"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "displayName": "External User"
    }
  ],
  "correlationId": "85fb6d29-169a-48f2-b53f-017017017017"
}
```

---

# 10. Application, Service Principal and Managed Identity Scenarios

## 10.1 User/Admin Consents to Application

**Category:** Application management  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T12:45:36Z",
  "category": "ApplicationManagement",
  "operationName": "Consent to application",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "admin@contoso.com",
      "ipAddress": "203.0.113.10"
    }
  },
  "targetResources": [
    {
      "type": "ServicePrincipal",
      "displayName": "CRM Reporting App",
      "id": "5afcc7c1-1d20-49f0-9a88-018018018018"
    }
  ],
  "additionalDetails": [
    {
      "key": "Permissions",
      "value": "User.Read, Group.Read.All"
    },
    {
      "key": "ConsentType",
      "value": "AdminConsent"
    }
  ],
  "correlationId": "29c16a62-55bb-44a0-92fe-018018018018"
}
```

---

## 10.2 Application Permission Revoked

**Category:** Application management  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T13:02:11Z",
  "category": "ApplicationManagement",
  "operationName": "Remove app role assignment from service principal",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "app.admin@contoso.com",
      "ipAddress": "203.0.113.60"
    }
  },
  "targetResources": [
    {
      "type": "ServicePrincipal",
      "displayName": "CRM Reporting App"
    }
  ],
  "additionalDetails": [
    {
      "key": "RemovedPermission",
      "value": "Group.Read.All"
    }
  ],
  "correlationId": "9fbf0b6c-01e6-4da0-8f63-019019019019"
}
```

---

## 10.3 Service Principal Sign-In Succeeds

**Category:** Workload identity  
**Log source:** `AADServicePrincipalSignInLogs`

```json
{
  "timeGenerated": "2026-07-08T13:20:14Z",
  "category": "ServicePrincipalSignInLogs",
  "servicePrincipalId": "5afcc7c1-1d20-49f0-9a88-018018018018",
  "servicePrincipalName": "CRM Reporting App",
  "appId": "11111111-2222-3333-4444-555555555555",
  "resourceDisplayName": "Microsoft Graph",
  "ipAddress": "203.0.113.70",
  "resultType": "0",
  "resultDescription": "Success",
  "authenticationProtocol": "OAuth2",
  "clientCredentialType": "ClientSecret",
  "correlationId": "4a7036d6-b2b2-47f4-9029-020020020020"
}
```

---

## 10.4 Service Principal Sign-In Fails Because Secret Expired

**Category:** Workload identity  
**Log source:** `AADServicePrincipalSignInLogs`

```json
{
  "timeGenerated": "2026-07-08T13:28:51Z",
  "category": "ServicePrincipalSignInLogs",
  "servicePrincipalName": "CRM Reporting App",
  "resourceDisplayName": "Microsoft Graph",
  "ipAddress": "203.0.113.70",
  "resultType": "7000222",
  "resultDescription": "The provided client secret keys are expired",
  "status": {
    "errorCode": 7000222,
    "failureReason": "Expired client secret"
  },
  "correlationId": "0e0137c7-5d52-45f1-85ab-021021021021"
}
```

---

## 10.5 Managed Identity Sign-In Succeeds

**Category:** Workload identity  
**Log source:** `AADManagedIdentitySignInLogs`

```json
{
  "timeGenerated": "2026-07-08T13:45:00Z",
  "category": "ManagedIdentitySignInLogs",
  "identity": "aks-prod-workload-mi",
  "servicePrincipalId": "7e2a67a4-7e21-4e85-86ad-022022022022",
  "resourceDisplayName": "Azure Key Vault",
  "ipAddress": "10.30.4.12",
  "resultType": "0",
  "resultDescription": "Success",
  "correlationId": "f79e16cb-f4e6-4c65-8e1c-022022022022"
}
```

---

# 11. Abnormal / Malicious Scenarios

## 11.1 Password Spray Attack

**Category:** Credential attack  
**Log source:** `SigninLogs`  
**Description:** Same source IP attempts login against many users.

```json
{
  "timeGenerated": "2026-07-08T07:12:44Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "50126",
  "resultDescription": "Invalid username or password",
  "userPrincipalName": "maria.papadopoulos@contoso.com",
  "appDisplayName": "Microsoft Office 365",
  "clientAppUsed": "Browser",
  "ipAddress": "185.199.110.44",
  "location": {
    "countryOrRegion": "Unknown",
    "city": "Unknown"
  },
  "status": {
    "errorCode": 50126,
    "failureReason": "Invalid username or password"
  },
  "riskDetail": "none",
  "riskLevelAggregated": "none",
  "correlationId": "spray-001"
}
```

Detection idea:

```kql
SigninLogs
| where ResultType == "50126"
| summarize FailedUsers=dcount(UserPrincipalName), Attempts=count()
  by IPAddress, bin(TimeGenerated, 15m)
| where FailedUsers >= 10 and Attempts >= 20
```

---

## 11.2 Brute-Force Attack Against One Account

**Category:** Credential attack  
**Log source:** `SigninLogs`  
**Description:** Many failed logins against one user.

```json
{
  "timeGenerated": "2026-07-08T07:24:18Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "50053",
  "resultDescription": "Account is locked because the user tried to sign in too many times",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Microsoft Office 365",
  "ipAddress": "203.0.113.77",
  "status": {
    "errorCode": 50053,
    "failureReason": "Account locked due to repeated sign-in attempts"
  },
  "correlationId": "bruteforce-001"
}
```

Detection idea:

```kql
SigninLogs
| where ResultType in ("50126", "50053")
| summarize Attempts=count(), SourceIPs=dcount(IPAddress)
  by UserPrincipalName, bin(TimeGenerated, 15m)
| where Attempts >= 10
```

---

## 11.3 Successful Login After Many Failures

**Category:** Account compromise  
**Log source:** `SigninLogs`  
**Description:** Failed attempts followed by successful login.

```json
{
  "timeGenerated": "2026-07-08T07:31:02Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "0",
  "resultDescription": "Success",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Microsoft Office 365",
  "clientAppUsed": "Browser",
  "ipAddress": "203.0.113.77",
  "location": {
    "countryOrRegion": "Unknown"
  },
  "authenticationRequirement": "singleFactorAuthentication",
  "conditionalAccessStatus": "notApplied",
  "correlationId": "compromise-possible-001"
}
```

Detection idea:

```kql
let failed =
SigninLogs
| where ResultType != "0"
| summarize FailedAttempts=count() by UserPrincipalName, IPAddress, bin(TimeGenerated, 30m);
let success =
SigninLogs
| where ResultType == "0"
| project SuccessTime=TimeGenerated, UserPrincipalName, IPAddress, AppDisplayName;
failed
| join kind=inner success on UserPrincipalName, IPAddress
| where FailedAttempts >= 5
```

---

## 11.4 Impossible Travel / Atypical Travel

**Category:** Risky sign-in  
**Log source:** `RiskySignIns`

```json
{
  "timeGenerated": "2026-07-08T08:05:19Z",
  "category": "RiskySignIns",
  "userPrincipalName": "john.smith@contoso.com",
  "riskState": "atRisk",
  "riskLevelAggregated": "high",
  "riskEventTypes": [
    "impossibleTravel"
  ],
  "currentSignIn": {
    "ipAddress": "198.51.100.90",
    "countryOrRegion": "US",
    "city": "New York"
  },
  "previousSignIn": {
    "timeGenerated": "2026-07-08T07:20:03Z",
    "ipAddress": "198.51.100.25",
    "countryOrRegion": "GR",
    "city": "Athens"
  },
  "correlationId": "risk-impossible-travel-001"
}
```

---

## 11.5 Anonymous IP / TOR / VPN Login

**Category:** Risky sign-in  
**Log source:** `RiskySignIns` / `SigninLogs`

```json
{
  "timeGenerated": "2026-07-08T08:14:33Z",
  "category": "RiskySignIns",
  "operationName": "Sign-in activity",
  "resultType": "0",
  "resultDescription": "Success",
  "userPrincipalName": "finance.manager@contoso.com",
  "appDisplayName": "Exchange Online",
  "ipAddress": "185.220.101.12",
  "riskLevelAggregated": "medium",
  "riskState": "atRisk",
  "riskEventTypes": [
    "anonymousIPAddress"
  ],
  "conditionalAccessStatus": "success",
  "correlationId": "anonymous-ip-001"
}
```

---

## 11.6 MFA Fatigue / MFA Push Bombing

**Category:** MFA abuse  
**Log source:** `SigninLogs`  
**Description:** Repeated MFA prompts, usually with multiple denials or failures.

```json
{
  "timeGenerated": "2026-07-08T08:35:09Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "500121",
  "resultDescription": "Authentication failed during strong authentication request",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Microsoft Office 365",
  "ipAddress": "203.0.113.88",
  "authenticationRequirement": "multiFactorAuthentication",
  "authenticationDetails": [
    {
      "authenticationStep": "Primary authentication",
      "succeeded": true,
      "authenticationMethod": "Password"
    },
    {
      "authenticationStep": "MFA",
      "succeeded": false,
      "authenticationMethod": "Microsoft Authenticator notification",
      "failureReason": "User denied the authentication request"
    }
  ],
  "correlationId": "mfa-fatigue-001"
}
```

Detection idea:

```kql
SigninLogs
| where AuthenticationRequirement == "multiFactorAuthentication"
| where ResultType != "0"
| summarize FailedMFA=count() by UserPrincipalName, IPAddress, bin(TimeGenerated, 30m)
| where FailedMFA >= 5
```

---

## 11.7 MFA Success from Suspicious Location

**Category:** MFA abuse / account compromise  
**Log source:** `SigninLogs`

```json
{
  "timeGenerated": "2026-07-08T08:41:52Z",
  "category": "SignInLogs",
  "resultType": "0",
  "resultDescription": "Success",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Microsoft Office 365",
  "ipAddress": "203.0.113.88",
  "location": {
    "countryOrRegion": "Unknown"
  },
  "authenticationRequirement": "multiFactorAuthentication",
  "authenticationDetails": [
    {
      "authenticationStep": "MFA",
      "succeeded": true,
      "authenticationMethod": "Microsoft Authenticator notification"
    }
  ],
  "riskLevelAggregated": "medium",
  "riskEventTypes": [
    "unfamiliarFeatures"
  ],
  "correlationId": "mfa-success-suspicious-001"
}
```

---

## 11.8 Conditional Access Bypass Attempt Using Legacy Authentication

**Category:** Conditional Access bypass attempt  
**Log source:** `SigninLogs`

```json
{
  "timeGenerated": "2026-07-08T09:03:28Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "53003",
  "resultDescription": "Access has been blocked by Conditional Access policies",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Exchange Online",
  "clientAppUsed": "Other clients",
  "ipAddress": "198.51.100.140",
  "conditionalAccessStatus": "failure",
  "conditionalAccessPolicies": [
    {
      "displayName": "Block legacy authentication",
      "result": "failure",
      "grantControls": "block"
    }
  ],
  "correlationId": "legacy-auth-blocked-001"
}
```

Detection idea:

```kql
SigninLogs
| where ClientAppUsed in ("Other clients", "IMAP", "POP", "SMTP")
| summarize Attempts=count(), Users=dcount(UserPrincipalName) by IPAddress, bin(TimeGenerated, 1h)
| where Attempts >= 5
```

---

## 11.9 Login Blocked Due to Risky Sign-In

**Category:** Conditional Access / Identity Protection  
**Log source:** `SigninLogs`

```json
{
  "timeGenerated": "2026-07-08T09:18:02Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "53003",
  "resultDescription": "Access has been blocked by Conditional Access policies",
  "userPrincipalName": "finance.manager@contoso.com",
  "appDisplayName": "Azure Portal",
  "ipAddress": "203.0.113.99",
  "riskLevelAggregated": "high",
  "riskState": "atRisk",
  "conditionalAccessStatus": "failure",
  "conditionalAccessPolicies": [
    {
      "displayName": "Block high-risk sign-ins",
      "result": "failure",
      "grantControls": "block"
    }
  ],
  "correlationId": "ca-risk-block-001"
}
```

---

## 11.10 Privileged Role Assigned Outside Change Window

**Category:** Privilege escalation  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T02:11:45Z",
  "category": "RoleManagement",
  "operationName": "Add member to role",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "admin01@contoso.com",
      "ipAddress": "203.0.113.60"
    }
  },
  "targetResources": [
    {
      "type": "Role",
      "displayName": "Global Administrator",
      "modifiedProperties": [
        {
          "displayName": "Member",
          "newValue": "john.smith@contoso.com"
        }
      ]
    }
  ],
  "correlationId": "priv-role-added-001"
}
```

Detection idea:

```kql
AuditLogs
| where Category == "RoleManagement"
| where OperationName has_any ("Add member to role", "Add eligible member to role")
| extend Target=tostring(TargetResources)
| where Target has_any ("Global Administrator", "Privileged Role Administrator", "User Administrator")
```

---

## 11.11 PIM Privileged Role Activated

**Category:** Privilege escalation  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T02:18:22Z",
  "category": "RoleManagement",
  "operationName": "Add member to role completed (PIM activation)",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "john.smith@contoso.com",
      "ipAddress": "198.51.100.200"
    }
  },
  "targetResources": [
    {
      "type": "Role",
      "displayName": "Privileged Role Administrator"
    }
  ],
  "additionalDetails": [
    {
      "key": "Justification",
      "value": "Emergency troubleshooting"
    },
    {
      "key": "Duration",
      "value": "2 hours"
    }
  ],
  "correlationId": "pim-activation-suspicious-001"
}
```

---

## 11.12 User Added to High-Privilege Group

**Category:** Privilege escalation  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T10:04:56Z",
  "category": "GroupManagement",
  "operationName": "Add member to group",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "helpdesk01@contoso.com",
      "ipAddress": "203.0.113.70"
    }
  },
  "targetResources": [
    {
      "type": "Group",
      "displayName": "Azure-Production-Admins",
      "modifiedProperties": [
        {
          "displayName": "Members",
          "newValue": "external.user_example.com#EXT#@contoso.onmicrosoft.com"
        }
      ]
    }
  ],
  "correlationId": "highpriv-group-add-001"
}
```

---

## 11.13 Guest Invited and Quickly Granted Access

**Category:** Guest access abuse  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T10:11:03Z",
  "category": "UserManagement",
  "operationName": "Invite external user",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "compromised.admin@contoso.com",
      "ipAddress": "198.51.100.210"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "attacker_evil.com#EXT#@contoso.onmicrosoft.com",
      "displayName": "External Consultant"
    }
  ],
  "additionalDetails": [
    {
      "key": "InvitedUserEmailAddress",
      "value": "attacker@evil.com"
    }
  ],
  "correlationId": "guest-invite-risk-001"
}
```

Detection idea:

```kql
AuditLogs
| where OperationName has_any ("Invite external user", "Add member to group")
| project TimeGenerated, OperationName, InitiatedBy, TargetResources, CorrelationId
```

---

## 11.14 Malicious OAuth Consent Grant

**Category:** OAuth abuse  
**Log source:** `AuditLogs`  
**Description:** User grants suspicious application broad permissions.

```json
{
  "timeGenerated": "2026-07-08T10:35:27Z",
  "category": "ApplicationManagement",
  "operationName": "Consent to application",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "finance.manager@contoso.com",
      "ipAddress": "203.0.113.91"
    }
  },
  "targetResources": [
    {
      "type": "ServicePrincipal",
      "displayName": "Invoice PDF Viewer",
      "id": "7ecf3a17-7f9c-48f1-9b7f-000000000001"
    }
  ],
  "additionalDetails": [
    {
      "key": "ConsentType",
      "value": "UserConsent"
    },
    {
      "key": "Permissions",
      "value": "Mail.Read, Files.Read.All, offline_access"
    }
  ],
  "correlationId": "oauth-consent-malicious-001"
}
```

---

## 11.15 Admin Consent Granted to Suspicious Application

**Category:** OAuth abuse  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T10:42:10Z",
  "category": "ApplicationManagement",
  "operationName": "Consent to application",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "global.admin@contoso.com",
      "ipAddress": "198.51.100.210"
    }
  },
  "targetResources": [
    {
      "type": "ServicePrincipal",
      "displayName": "Secure Document Approval"
    }
  ],
  "additionalDetails": [
    {
      "key": "ConsentType",
      "value": "AdminConsent"
    },
    {
      "key": "Permissions",
      "value": "Directory.Read.All, User.Read.All, Mail.ReadWrite, offline_access"
    }
  ],
  "correlationId": "admin-consent-risk-001"
}
```

Detection idea:

```kql
AuditLogs
| where Category == "ApplicationManagement"
| where OperationName has "Consent"
| where tostring(TargetResources) has_any ("Mail.Read", "Mail.ReadWrite", "Files.Read.All", "Directory.Read.All", "offline_access")
```

---

## 11.16 New Client Secret Added to Service Principal

**Category:** Workload identity abuse  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T11:06:18Z",
  "category": "ApplicationManagement",
  "operationName": "Add service principal credentials",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "app.admin@contoso.com",
      "ipAddress": "203.0.113.92"
    }
  },
  "targetResources": [
    {
      "type": "ServicePrincipal",
      "displayName": "Payroll Integration API"
    }
  ],
  "modifiedProperties": [
    {
      "displayName": "KeyDescription",
      "newValue": "client-secret-prod-temp"
    }
  ],
  "correlationId": "sp-secret-added-001"
}
```

---

## 11.17 Service Principal Sign-In from Unusual IP After New Credential

**Category:** Workload identity abuse  
**Log source:** `AADServicePrincipalSignInLogs`

```json
{
  "timeGenerated": "2026-07-08T11:12:41Z",
  "category": "ServicePrincipalSignInLogs",
  "servicePrincipalName": "Payroll Integration API",
  "appId": "11111111-2222-3333-4444-555555555555",
  "resourceDisplayName": "Microsoft Graph",
  "ipAddress": "198.51.100.250",
  "resultType": "0",
  "resultDescription": "Success",
  "authenticationProtocol": "OAuth2",
  "clientCredentialType": "ClientSecret",
  "correlationId": "sp-suspicious-signin-001"
}
```

Detection idea:

```kql
AADServicePrincipalSignInLogs
| where ResultType == "0"
| summarize FirstSeen=min(TimeGenerated), LastSeen=max(TimeGenerated), IPs=make_set(IPAddress)
  by ServicePrincipalName, AppId
```

---

## 11.18 Password Reset Performed by Suspicious Admin

**Category:** Account takeover / insider risk  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T11:35:04Z",
  "category": "UserManagement",
  "operationName": "Reset user password",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "helpdesk01@contoso.com",
      "ipAddress": "198.51.100.88"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "cfo@contoso.com",
      "displayName": "Chief Financial Officer"
    }
  ],
  "additionalDetails": [
    {
      "key": "ForceChangePasswordNextSignIn",
      "value": "false"
    }
  ],
  "correlationId": "suspicious-password-reset-001"
}
```

---

## 11.19 Security Info Changed Before Account Takeover

**Category:** Account takeover  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T11:48:12Z",
  "category": "UserManagement",
  "operationName": "User registered security info",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "john.smith@contoso.com",
      "ipAddress": "203.0.113.95"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "john.smith@contoso.com"
    }
  ],
  "additionalDetails": [
    {
      "key": "AuthenticationMethod",
      "value": "Phone"
    },
    {
      "key": "PhoneNumberCountry",
      "value": "Unknown"
    }
  ],
  "correlationId": "security-info-change-risk-001"
}
```

Detection idea:

```kql
AuditLogs
| where OperationName has_any ("User registered security info", "User deleted security info")
| project TimeGenerated, OperationName, InitiatedBy, TargetResources, AdditionalDetails, CorrelationId
```

---

## 11.20 Suspicious Non-Interactive Sign-In / Possible Token Theft

**Category:** Token theft / session replay  
**Log source:** `AADNonInteractiveUserSignInLogs`

```json
{
  "timeGenerated": "2026-07-08T12:22:54Z",
  "category": "NonInteractiveUserSignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "0",
  "resultDescription": "Success",
  "userPrincipalName": "john.smith@contoso.com",
  "appDisplayName": "Microsoft Teams",
  "clientAppUsed": "Mobile Apps and Desktop clients",
  "ipAddress": "203.0.113.120",
  "authenticationProtocol": "OAuth2",
  "incomingTokenType": "refreshToken",
  "riskLevelAggregated": "medium",
  "correlationId": "refresh-token-suspicious-001"
}
```

---

## 11.21 Break-Glass Account Sign-In

**Category:** Emergency access / high-risk event  
**Log source:** `SigninLogs`

```json
{
  "timeGenerated": "2026-07-08T03:02:44Z",
  "category": "SignInLogs",
  "operationName": "Sign-in activity",
  "resultType": "0",
  "resultDescription": "Success",
  "userPrincipalName": "breakglass01@contoso.com",
  "appDisplayName": "Microsoft Azure Management",
  "ipAddress": "198.51.100.201",
  "authenticationRequirement": "singleFactorAuthentication",
  "conditionalAccessStatus": "notApplied",
  "correlationId": "breakglass-signin-001"
}
```

---

## 11.22 Conditional Access Policy Disabled

**Category:** Defense evasion  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T03:18:01Z",
  "category": "Policy",
  "operationName": "Update conditional access policy",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "compromised.admin@contoso.com",
      "ipAddress": "198.51.100.201"
    }
  },
  "targetResources": [
    {
      "type": "Policy",
      "displayName": "Require MFA for administrators",
      "modifiedProperties": [
        {
          "displayName": "State",
          "oldValue": "enabled",
          "newValue": "disabled"
        }
      ]
    }
  ],
  "correlationId": "ca-disabled-001"
}
```

Detection idea:

```kql
AuditLogs
| where Category == "Policy"
| where OperationName has "conditional access"
| where tostring(TargetResources) has_any ("disabled", "enabledForReportingButNotEnforced")
```

---

## 11.23 Trusted IP / Named Location Modified

**Category:** Defense evasion  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T03:25:39Z",
  "category": "Policy",
  "operationName": "Update named location",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "compromised.admin@contoso.com",
      "ipAddress": "198.51.100.201"
    }
  },
  "targetResources": [
    {
      "type": "NamedLocation",
      "displayName": "Trusted Corporate IPs",
      "modifiedProperties": [
        {
          "displayName": "IpRanges",
          "oldValue": "203.0.113.0/24",
          "newValue": "203.0.113.0/24,198.51.100.201/32"
        }
      ]
    }
  ],
  "correlationId": "trusted-ip-modified-001"
}
```

---

## 11.24 Suspicious Device Registration

**Category:** Device abuse  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T13:02:19Z",
  "category": "Device",
  "operationName": "Register device",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "john.smith@contoso.com",
      "ipAddress": "203.0.113.95"
    }
  },
  "targetResources": [
    {
      "type": "Device",
      "displayName": "WIN-UNKNOWN-4812"
    }
  ],
  "additionalDetails": [
    {
      "key": "DeviceOSType",
      "value": "Windows"
    },
    {
      "key": "DeviceTrustType",
      "value": "AzureAdRegistered"
    }
  ],
  "correlationId": "device-register-suspicious-001"
}
```

---

## 11.25 Successful Access from Unmanaged Device

**Category:** Device risk  
**Log source:** `SigninLogs`

```json
{
  "timeGenerated": "2026-07-08T13:10:45Z",
  "category": "SignInLogs",
  "resultType": "0",
  "resultDescription": "Success",
  "userPrincipalName": "finance.manager@contoso.com",
  "appDisplayName": "SharePoint Online",
  "ipAddress": "203.0.113.95",
  "deviceDetail": {
    "displayName": "WIN-UNKNOWN-4812",
    "operatingSystem": "Windows",
    "isCompliant": false,
    "isManaged": false
  },
  "conditionalAccessStatus": "notApplied",
  "correlationId": "unmanaged-device-success-001"
}
```

---

## 11.26 OAuth App Data Access After Consent

**Category:** OAuth abuse  
**Log source:** `AADServicePrincipalSignInLogs`

```json
{
  "timeGenerated": "2026-07-08T13:32:00Z",
  "category": "ServicePrincipalSignInLogs",
  "servicePrincipalName": "Invoice PDF Viewer",
  "resourceDisplayName": "Microsoft Graph",
  "ipAddress": "198.51.100.240",
  "resultType": "0",
  "resultDescription": "Success",
  "authenticationProtocol": "OAuth2",
  "clientCredentialType": "ClientSecret",
  "correlationId": "oauth-data-access-001"
}
```

---

## 11.27 User Deleted After Privilege Escalation

**Category:** Sabotage / destructive action  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T14:05:11Z",
  "category": "UserManagement",
  "operationName": "Delete user",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "john.smith@contoso.com",
      "ipAddress": "198.51.100.201"
    }
  },
  "targetResources": [
    {
      "type": "User",
      "userPrincipalName": "security.admin@contoso.com"
    }
  ],
  "correlationId": "malicious-user-delete-001"
}
```

---

## 11.28 Multiple Admin Changes from Same Suspicious IP

**Category:** Admin compromise  
**Log source:** `AuditLogs`

```json
{
  "timeGenerated": "2026-07-08T14:18:33Z",
  "category": "AuditLogs",
  "operationName": "Multiple administrative changes",
  "result": "success",
  "initiatedBy": {
    "user": {
      "userPrincipalName": "compromised.admin@contoso.com",
      "ipAddress": "198.51.100.201"
    }
  },
  "activities": [
    "Update conditional access policy",
    "Add member to role",
    "Reset user password",
    "Add member to group"
  ],
  "correlationId": "admin-burst-001"
}
```

Detection idea:

```kql
AuditLogs
| extend Actor=tostring(InitiatedBy.user.userPrincipalName),
         IP=tostring(InitiatedBy.user.ipAddress)
| summarize Operations=make_set(OperationName), Count=count()
  by Actor, IP, bin(TimeGenerated, 30m)
| where Count >= 5
```

---

## 11.29 Managed Identity Used from Unexpected Workload

**Category:** Workload identity abuse  
**Log source:** `AADManagedIdentitySignInLogs`

```json
{
  "timeGenerated": "2026-07-08T14:40:00Z",
  "category": "ManagedIdentitySignInLogs",
  "identity": "prod-aks-workload-mi",
  "servicePrincipalId": "7e2a67a4-7e21-4e85-86ad-000000000030",
  "resourceDisplayName": "Azure Key Vault",
  "ipAddress": "10.99.14.88",
  "resultType": "0",
  "resultDescription": "Success",
  "correlationId": "managed-identity-abuse-001"
}
```

---

# 12. High-Priority SOC Alert Matrix

| Priority | Scenario | Main Source |
|---:|---|---|
| Critical | Global Administrator / Privileged Role Administrator assigned | `AuditLogs` |
| Critical | Conditional Access policy disabled | `AuditLogs` |
| Critical | Break-glass account sign-in | `SigninLogs` |
| Critical | Admin consent granted to unknown app | `AuditLogs` |
| High | New service principal credential added | `AuditLogs` |
| High | Successful login from anonymous IP / impossible travel | `SigninLogs`, `RiskySignIns` |
| High | MFA fatigue followed by successful login | `SigninLogs` |
| High | Security info changed, then successful sign-in | `AuditLogs`, `SigninLogs` |
| High | Guest invited, then added to privileged group | `AuditLogs` |
| High | Refresh token activity from suspicious IP | `AADNonInteractiveUserSignInLogs` |
| Medium | Many failed logins from same IP | `SigninLogs` |
| Medium | Non-compliant device successfully accesses sensitive app | `SigninLogs` |
| Medium | Legacy authentication attempt | `SigninLogs` |

---

# 13. Generic KQL Queries

## 13.1 Created Users

```kql
AuditLogs
| where Category == "UserManagement"
| where OperationName has "Add user"
| project TimeGenerated, OperationName, Result, InitiatedBy, TargetResources, CorrelationId
```

## 13.2 Deleted Users

```kql
AuditLogs
| where Category == "UserManagement"
| where OperationName has "Delete user"
| project TimeGenerated, OperationName, Result, InitiatedBy, TargetResources, CorrelationId
```

## 13.3 Updated Users

```kql
AuditLogs
| where Category == "UserManagement"
| where OperationName has "Update user"
| project TimeGenerated, OperationName, Result, InitiatedBy, TargetResources, CorrelationId
```

## 13.4 Successful Logins

```kql
SigninLogs
| where ResultType == 0
| project TimeGenerated, UserPrincipalName, AppDisplayName, IPAddress, Location, ConditionalAccessStatus, AuthenticationRequirement, CorrelationId
```

## 13.5 Failed Logins

```kql
SigninLogs
| where ResultType != 0
| project TimeGenerated, UserPrincipalName, AppDisplayName, IPAddress, ResultType, ResultDescription, ConditionalAccessStatus, CorrelationId
```

## 13.6 Application Logout Events

```kql
AppEvents
| where EventType == "UserLogout"
| project TimeGenerated, UserPrincipalName, Application, SessionId, LogoutType, SessionDurationSeconds, CorrelationId
```

## 13.7 Privileged Role Assignments

```kql
AuditLogs
| where Category == "RoleManagement"
| where OperationName has_any ("Add member to role", "Add eligible member to role")
| extend Target=tostring(TargetResources)
| where Target has_any ("Global Administrator", "Privileged Role Administrator", "User Administrator")
```

## 13.8 Suspicious App Consent

```kql
AuditLogs
| where Category == "ApplicationManagement"
| where OperationName has "Consent"
| where tostring(TargetResources) has_any ("Mail.Read", "Mail.ReadWrite", "Files.Read.All", "Directory.Read.All", "offline_access")
```

## 13.9 Conditional Access Policy Disabled

```kql
AuditLogs
| where Category == "Policy"
| where OperationName has "conditional access"
| where tostring(TargetResources) has_any ("disabled", "enabledForReportingButNotEnforced")
```

---

# 14. Operational Recommendations

## 14.1 Logging and Monitoring

- Export Microsoft Entra logs to Log Analytics and/or Microsoft Sentinel.
- Enable collection of:
  - `AuditLogs`
  - `SigninLogs`
  - `AADNonInteractiveUserSignInLogs`
  - `AADServicePrincipalSignInLogs`
  - `AADManagedIdentitySignInLogs`
  - Risky user/sign-in events if licensed.
- Correlate identity logs with:
  - Application logs
  - Endpoint security logs
  - Firewall/proxy logs
  - Cloud control-plane logs
  - Key Vault and storage access logs

## 14.2 Retention and Cost Control

- Keep high-value audit/security logs longer than normal operational logs.
- Define separate retention by criticality:
  - Critical security logs: longer retention
  - Operational debug logs: shorter retention
  - Archived audit logs: lower-cost storage tier
- Review log volume regularly to avoid excessive Log Analytics/SIEM ingestion costs.

## 14.3 Detection Priorities

Prioritize alerts that indicate:

1. Privilege escalation
2. Conditional Access weakening or disablement
3. Break-glass account usage
4. Suspicious app consent
5. New service principal credentials
6. MFA fatigue or suspicious MFA success
7. Impossible travel or anonymous IP sign-in
8. Guest access abuse
9. Token replay or suspicious refresh token use
10. Managed identity access from unexpected workloads

## 14.4 Application Logging Gap

Microsoft Entra ID is strong for authentication and directory audit activity, but applications should explicitly log:

```text
SessionCreated
UserLogout
SessionExpired
TokenRevokedLocally
AuthorizationDenied
SensitiveBusinessAction
PrivilegeUsedInsideApplication
```

This is necessary for complete call-flow reconstruction.

---

# 15. Suggested End-to-End Call Flow Model

```text
1. User lifecycle:
   AuditLogs → Add / Update / Disable / Delete user

2. Authentication:
   SigninLogs → Login success / failure / MFA / Conditional Access

3. Authorization:
   AuditLogs → Group membership / role assignment / app assignment

4. Workload identity:
   ServicePrincipalSignInLogs / ManagedIdentitySignInLogs

5. Application behavior:
   Application logs → Session created / business actions / logout

6. Security analytics:
   Sentinel / SIEM → Correlation, detection, alerting, incident response
```

---

# 16. Summary

The most important Microsoft Entra ID monitoring areas are:

- User lifecycle events
- Authentication and MFA events
- Conditional Access outcomes and policy changes
- Privileged role and group assignments
- Guest/B2B access
- OAuth consent and application permission changes
- Service principal and managed identity sign-ins
- Risky sign-ins and Identity Protection signals
- Application session events, especially logout and session timeout

For CCoE/SOC governance, these scenarios should be converted into Sentinel analytics rules, alert severities, incident response playbooks, and retention policies aligned with business criticality and compliance requirements.

---

# 17. RECITALS Scenario 2 Dataset Profile

## 17.1 Intended use

The earlier sections are a catalog of representative Microsoft Entra events. For RECITALS Scenario 2, the operational input should instead be an **already-correlated incident bundle** produced from selected Microsoft Sentinel/Log Analytics data.

The dataset supports testing of:

- RECITALS Security Manager ingestion and normalization.
- Cyber-threat Detector classification, confidence scoring, and prioritization.
- Comparison of activity with identity and privilege baselines.
- Plain-language evidence generation by an explainer component, if used.
- CTOAR playbook selection and recommendation-only remediation proposals for PPC SOC/IAM review.
- Direct delivery of the finding, explanation and remediation recommendation to PPC SOC/IAM for review.
- True-positive, true-negative, and false-positive handling.

RECITALS is not expected to receive all Sentinel data. The synthetic pilot dataset contains only the correlated events and context relevant to the identity-security scenario.

## 17.2 Source categories

| Category | Microsoft source/table | Requirement | RECITALS value |
|---|---|---:|---|
| Identity administration | Entra `AuditLogs` | Mandatory | Role, group, account, application, credential, MFA-method, and Conditional Access changes |
| User authentication | Entra `SigninLogs` | Mandatory | Login outcome, IP/country, device, MFA, Conditional Access, and risk context |
| Background user access | `AADNonInteractiveUserSignInLogs` | Recommended | Refresh-token and non-interactive activity after compromise |
| Workload identities | `AADServicePrincipalSignInLogs`, `AADManagedIdentitySignInLogs` | Recommended | App/service-principal and managed-identity privilege abuse |
| Sentinel security context | `SecurityAlert`, `SecurityIncident`, `BehaviorAnalytics`, `IdentityInfo` where available | Recommended | Optional existing alert, incident, entity, UEBA, and investigation context |
| Identity risk | Entra Identity Protection risk events | Recommended | Risky user, risky sign-in, and risk-detection evidence |
| Endpoint evidence | Defender XDR/MDE alerts and selected device events | Conditional | Confirms compromised device, malicious process, or token abuse |
| Hybrid identity | Defender for Identity and/or AD `SecurityEvent` | Conditional | Domain group changes, privileged logons, credential abuse, and lateral movement |
| Approval/change context | PIM approval and approved change reference | Recommended | Reduces false positives and distinguishes authorized emergency work |
| Human-review context | PPC SOC/IAM review reference and decision, when available | Recommended | Proves that the recommendation was reviewed; no RECITALS remediation execution is tested |

`Defender` and on-premises `AD` data are included only for cases that need corroboration. They are not mandatory for every light-pilot payload.

## 17.3 Security scenario categories represented

| Dataset category | Example | Expected behavior |
|---|---|---|
| `benign_privileged_access` | Approved PIM activation from compliant PAW | Allow / informational |
| `direct_role_escalation` | Risky login followed by permanent Global Administrator assignment | Critical remediation recommendation |
| `credential_attack_to_privilege` | Password spray, success, then privileged group add | Critical remediation recommendation |
| `mfa_fatigue_to_pim` | MFA bombing followed by PIM activation | Critical remediation recommendation |
| `security_control_tampering` | Conditional Access disabled before role assignment | Critical remediation recommendation |
| `workload_identity_escalation` | Admin consent, new app secret, unusual service-principal login | Credential-revoke/disable recommendation |
| `guest_privilege_escalation` | Newly invited guest added to production administrators | Guest-disable/group-removal recommendation |
| `hybrid_ad_privilege_escalation` | AD Domain Admin addition and privileged logon | AD remediation recommendation |
| `endpoint_confirmed_identity_compromise` | Defender compromise evidence before Entra role change | Device-isolation and identity-remediation recommendation |
| `disabled_or_leaver_account_abuse` | Terminated user re-enabled and privileged | Reversible remediation recommendation |
| `approved_emergency_change` | Out-of-hours activation covered by valid approval | Downgrade false-positive candidate |

## 17.4 API contract

Recommended pilot endpoint:

```http
POST /api/v1/security/correlated-events/batch
Content-Type: application/json
Idempotency-Key: <batch_id>
```

Top-level payload fields:

| Field | Purpose |
|---|---|
| `schema_version` | Contract evolution and compatibility |
| `dataset_id` | Identifies the synthetic/test dataset |
| `batch_id` | Idempotent ingestion and replay protection |
| `tenant` | Pseudonymous tenant/environment context |
| `privacy` | Declares synthetic status and identifier policy |
| `correlation` | States that correlation is already represented in the synthetic bundle |
| `reference_context` | Critical roles/groups, trusted locations, and change window |
| `identity_baselines` | Normal role, device, country, and working-hour profile |
| `items[]` | Correlated scenario bundles submitted to RECITALS |

Each `items[]` record includes:

| Field | Purpose |
|---|---|
| `bundle_id` | Stable incident-bundle identifier |
| `category`, `scenario` | Scenario taxonomy and readable title |
| `event_time_start/end` | Correlation window |
| `subject`, `actor` | Affected identity and identity performing the change |
| `correlated_events[]` | Selected normalized evidence from Microsoft sources |
| `sentinel` | Existing alert/incident context and analytics rule |
| `context` | Optional employment, approval, or change information |
| `ground_truth` | Synthetic test label for evaluation |
| `expected_recitals` | Expected decision, score range, explanation codes, and response |

## 17.5 Example correlated API item

```json
{
  "bundle_id": "s2-privilege-001",
  "category": "direct_role_escalation",
  "scenario": "Risky administrator sign-in followed by direct Global Administrator assignment",
  "subject": {"id": "usr-1001", "type": "user", "upn_token": "u:usr-1001"},
  "actor": {"id": "adm-2001", "type": "user"},
  "correlated_events": [
    {
      "event_id": "evt-priv-001-a",
      "source_service": "Microsoft Entra ID",
      "source_table": "SigninLogs",
      "event_type": "interactive_sign_in",
      "timestamp": "2026-07-21T00:41:03Z",
      "outcome": "success",
      "source": {"ip": "198.51.100.44", "country": "NL", "anonymous_proxy": true},
      "device": {"id": "dev-unknown-44", "managed": false, "compliant": false},
      "authentication": {"mfa": "not_satisfied", "conditional_access": "not_applied", "risk_level": "high"},
      "microsoft": {"correlation_id": "mscorr-priv-001"}
    },
    {
      "event_id": "evt-priv-001-b",
      "source_service": "Microsoft Entra ID",
      "source_table": "AuditLogs",
      "event_type": "directory_role_assignment",
      "timestamp": "2026-07-21T00:44:32Z",
      "outcome": "success",
      "target": {"type": "directory_role", "name": "Global Administrator", "subject_id": "usr-1001"},
      "privilege": {"assignment_type": "permanent_direct", "approval_id": null, "justification_present": false},
      "microsoft": {"correlation_id": "mscorr-priv-001"}
    }
  ],
  "sentinel": {
    "alert_id": "sal-priv-001",
    "incident_id": "sinc-priv-001",
    "existing_severity": "high",
    "analytics_rule": "Risky sign-in followed by privileged role assignment",
    "status": "new"
  },
  "ground_truth": {
    "is_anomalous": true,
    "attack_type": "T1098 Account Manipulation",
    "label": "true_positive"
  },
  "expected_recitals": {
    "decision": "recommend_human_review",
    "severity": "critical",
    "score_range": [90, 100],
    "remediation_recommendation": ["revoke_sessions", "remove_newly_assigned_role"],
    "human_review_required": true,
    "automatic_execution": false,
    "explanation_codes": [
      "OUTSIDE_CHANGE_WINDOW",
      "HIGH_RISK_SIGNIN",
      "UNMANAGED_DEVICE",
      "PERMANENT_PRIVILEGE_NO_APPROVAL"
    ]
  }
}
```

## 17.6 Expected RECITALS result payload

RECITALS should return an enriched result directly to the PPC SOC/IAM review channel agreed for the pilot. Microsoft Sentinel may contribute source evidence, but it is not the output destination or approval-recording step. RECITALS must not overwrite the source evidence or execute remediation.

```json
{
  "schema_version": "1.0.0",
  "bundle_id": "s2-privilege-001",
  "recitals_finding_id": "rf-s2-privilege-001",
  "decision": "recommend_human_review",
  "severity": "critical",
  "risk_score": 97,
  "confidence": 0.96,
  "finding_type": "ANOMALOUS_PRIVILEGE_ESCALATION",
  "evidence_event_ids": ["evt-priv-001-a", "evt-priv-001-b"],
  "explanation": {
    "summary": "A permanent Global Administrator role was assigned after a high-risk sign-in from an unmanaged device outside the approved change window.",
    "reason_codes": [
      "OUTSIDE_CHANGE_WINDOW",
      "HIGH_RISK_SIGNIN",
      "UNMANAGED_DEVICE",
      "PERMANENT_PRIVILEGE_NO_APPROVAL"
    ]
  },
  "remediation_recommendation": [
    {"action": "revoke_sessions", "target_id": "adm-2001", "reversible": true},
    {"action": "remove_role", "target_id": "usr-1001", "role": "Global Administrator", "reversible": true}
  ],
  "human_review": {
    "required": true,
    "playbook": "PB-IDENTITY-PRIVILEGE-001",
    "status": "pending_ppc_soc_iam_review",
    "automatic_execution": false
  },
  "consumer": {
    "team": "PPC SOC/IAM",
    "source_incident_reference": "sinc-priv-001"
  }
}
```

## 17.7 Dataset artifact

The full valid JSON batch is provided in `recitals_scenario2_correlated_dataset.json`. It contains 11 correlated bundles covering malicious, benign, and false-positive-candidate behavior.

## 17.8 Validation rules

The RECITALS receiving interface should reject or quarantine a bundle when:

- `schema_version`, `batch_id`, `bundle_id`, or timestamps are missing.
- `event_time_end` is earlier than `event_time_start`.
- An event has neither `source_service` nor `source_table`.
- The actor or subject cannot be linked to a stable pseudonymous identifier.
- `ground_truth` is present in a production payload; this field is test-only.
- Direct identifiers or unrestricted free text violate the ingestion privacy policy.
- A duplicated `batch_id` has different content.

For production, split the contract into two profiles:

1. **Inference profile:** excludes `ground_truth` and `expected_recitals`.
2. **Test/evaluation profile:** includes labels and expected outputs for accuracy, false-positive, MTTD, and remediation testing.
