use shared::{
    State,
    extensions::{
        Extension, ExtensionPermissionsBuilder, ExtensionRouteBuilder, ExtensionUpdateInfo,
    },
};
use std::sync::Arc;

mod permissions;
mod routes;
pub mod settings;
mod updates;

#[derive(Default)]
pub struct ExtensionStruct;

#[async_trait::async_trait]
impl Extension for ExtensionStruct {
    async fn initialize(&mut self, _state: State) {
        tracing::info!("zoron theme loaded");
    }

    async fn initialize_router(
        &mut self,
        state: State,
        builder: ExtensionRouteBuilder,
    ) -> ExtensionRouteBuilder {
        builder
            // public on purpose: the login page is themed too
            .add_global_router(|routes| routes.nest("/zoron", routes::public(&state)))
            .add_admin_api_router(|routes| {
                routes.nest("/extensions/dev.caloptreyx.zoron", routes::admin(&state))
            })
    }

    /// `zoron-theme.update`: saving the theme without the panel wide `settings.update`.
    async fn initialize_permissions(
        &mut self,
        _state: State,
        builder: ExtensionPermissionsBuilder,
    ) -> ExtensionPermissionsBuilder {
        permissions::register(builder)
    }

    async fn settings_deserializer(
        &self,
        _state: State,
    ) -> shared::extensions::settings::ExtensionSettingsDeserializer {
        Arc::new(settings::ExtensionSettingsDataDeserializer)
    }

    /// Offers the newest GitHub release on Admin → Updates, with every newer release's notes.
    async fn check_for_updates(
        &self,
        state: State,
        current_version: &semver::Version,
    ) -> Result<Option<ExtensionUpdateInfo>, anyhow::Error> {
        updates::check(&state, current_version).await
    }
}
