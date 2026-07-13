FROM quay.io/keycloak/keycloak:24.0.3

# Set environment variables for realm import
ENV KEYCLOAK_ADMIN=admin
ENV KEYCLOAK_ADMIN_PASSWORD=admin
ENV KC_DB=postgres
ENV KC_DB_URL=jdbc:postgresql://localhost:5432/keycloak
ENV KC_DB_USERNAME=keycloak_admin
ENV KC_DB_PASSWORD=keycloak_password

# Copy realm import file (from imports subdirectory)
COPY imports/realm-import.json /opt/keycloak/data/import/surelm_realm.json

# Enable health checks and metrics
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

# Configure expose-headers for CORS support
EXPOSE 8443

CMD ["start-dev"]
