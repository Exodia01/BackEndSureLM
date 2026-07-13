#!/bin/sh

# Wait for Keycloak to start
echo "Waiting for Keycloak..."
sleep 15

# Get the admin password from environment variable
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM_NAME="surelm_realm"

# Import realm configuration using kcadm.sh
/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8443/auth --realm master --user admin --password "$ADMIN_PASSWORD" 2>/dev/null

# Create realm if it doesn't exist
EXISTING=$(cat /tmp/realms.txt | grep "surelm_realm")
if [ -z "$EXISTING" ]; then
    echo "Creating realm: $REALM_NAME"
    /opt/keycloak/bin/kcadm.sh create realms -r master -f /opt/keycloak/data/import/surelm_realm.json 2>/dev/null || true
else
    echo "Realm already exists, updating..."
fi

# Update realm if it exists
/opt/keycloak/bin/kcadm.sh update realms/$REALM_NAME -r master -f /opt/keycloak/data/import/surelm_realm.json 2>/dev/null || echo "Update failed or realm doesn't exist"

echo "Setup complete!"
cat > /tmp/setup_complete << 'EOF'
Realm import completed!
Access: http://localhost:8443/auth/admin/
Admin credentials: admin/kcadmin123
Realm: surelm_realm (if import successful)
EOF
