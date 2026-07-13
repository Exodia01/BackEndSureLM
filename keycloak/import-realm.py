import requests
import json

KEYCLOAK_URL = "http://localhost:8443"
REALM_NAME = "surelm_realm"

# Step 1: Get admin token from master realm
print("Step 1: Getting admin access token...")
auth_response = requests.post(
    f"{KEYCLOAK_URL}/auth/realms/master/protocol/openid-connect/token",
    data={
        "client_id": "admin-cli",
        "grant_type": "password",
        "username": "admin",
        "password": "kcadmin123"
    }
)

if auth_response.status_code != 200:
    print(f"Auth failed: {auth_response.text}")
    exit(1)

admin_token = auth_response.json()["access_token"]
headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

# Step 2: Create realm if it doesn't exist
print("Step 2: Creating realm...")
with open('surelm_realm_config.json', 'r') as f:
    realm_data = json.load(f)

create_response = requests.post(
    f"{KEYCLOAK_URL}/auth/admin/realms",
    headers=headers,
    json=realm_data
)

if create_response.status_code == 201:
    print("✓ Realm created successfully")
elif create_response.status_code == 409:
    # Realm exists, update it instead
    print("Realm already exists, updating configuration...")
    realm_id = realm_data['id']
    
    # Get existing realm data first
    get_response = requests.get(f"{KEYCLOAK_URL}/auth/admin/realms/{realm_id}", headers=headers)
    if get_response.status_code == 200:
        existing = get_response.json()
        # Update only the necessary fields from our config
        update_data = {**existing, **{k: v for k, v in realm_data.items() if v}}
        
        update_response = requests.put(
            f"{KEYCLOAK_URL}/auth/admin/realms/{realm_id}",
            headers=headers,
            json=update_data
        )
        if update_response.status_code in [200, 204]:
            print("✓ Realm configuration updated successfully")
        else:
            print(f"Update failed: {update_response.text}")
    else:
        print(f"Failed to fetch existing realm: {get_response.text}")
else:
    print(f"Realm creation failed: {create_response.text}")

print("\nDone! Access Keycloak at:", KEYCLOAK_URL)
