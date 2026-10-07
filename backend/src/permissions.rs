//! Zoron's own admin permission, so a role can be allowed to save the theme without being allowed to change
//! every panel setting.

use shared::{
    extensions::ExtensionPermissionsBuilder, models::user::PermissionManager,
    permissions::PermissionGroup, response::ApiResponse,
};

const GROUP: &str = "zoron-theme";
/// Saving the site theme without access to the rest of the panel settings.
pub(crate) const UPDATE: &str = "zoron-theme.update";

/// Adds the `zoron-theme` group to the admin permissions roles can grant.
pub(crate) fn register(builder: ExtensionPermissionsBuilder) -> ExtensionPermissionsBuilder {
    let mut group = PermissionGroup {
        description: "Permissions that control the ability to manage the Zoron theme without access to panel settings.",
        permissions: Default::default(),
    };
    group.add_permission(
        "update",
        "Allows saving the site theme in the Zoron theme editor without access to the rest of the panel settings.",
    );

    builder.add_admin_permission_group(GROUP, group)
}

/// Passes when `check` accepts any of `permissions`, else returns the first one's refusal, so the error names
/// the core permission as core's own routes would.
fn any_of<E>(permissions: &[&str], mut check: impl FnMut(&str) -> Result<(), E>) -> Result<(), E> {
    let mut first = None;
    for permission in permissions {
        match check(permission) {
            Ok(()) => return Ok(()),
            Err(err) if first.is_none() => first = Some(err),
            Err(_) => {}
        }
    }

    first.map_or(Ok(()), Err)
}

/// Theme saves: `settings.update` or `zoron-theme.update`.
pub(crate) fn can_update(permissions: &PermissionManager) -> Result<(), ApiResponse> {
    any_of(&["settings.update", UPDATE], |p| {
        permissions.has_admin_permission(p)
    })
}

#[cfg(test)]
mod tests {
    use super::any_of;

    fn granted<'a>(held: &'a [&'a str]) -> impl FnMut(&str) -> Result<(), String> + 'a {
        move |p| {
            if held.iter().any(|h| *h == p) {
                Ok(())
            } else {
                Err(format!("missing {p}"))
            }
        }
    }

    #[test]
    fn any_of_passes_on_either_permission() {
        let wanted = ["settings.update", "zoron-theme.update"];
        assert!(any_of(&wanted, granted(&["settings.update"])).is_ok());
        assert!(any_of(&wanted, granted(&["zoron-theme.update"])).is_ok());
        assert!(any_of(&wanted, granted(&["settings.read", "zoron-theme.update"])).is_ok());
    }

    #[test]
    fn any_of_refuses_with_the_first_permission() {
        let wanted = ["settings.update", "zoron-theme.update"];
        assert_eq!(
            any_of(&wanted, granted(&["settings.read"])),
            Err("missing settings.update".to_string())
        );
        assert_eq!(
            any_of(&wanted, granted(&[])),
            Err("missing settings.update".to_string())
        );
    }

    #[test]
    fn any_of_stops_at_the_first_match() {
        let mut asked = Vec::new();
        let result = any_of(&["a", "b", "c"], |p| {
            asked.push(p.to_string());
            if p == "b" { Ok(()) } else { Err(()) }
        });
        assert_eq!(result, Ok(()));
        assert_eq!(asked, ["a", "b"]);
    }
}
