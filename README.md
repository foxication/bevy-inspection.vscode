<p align="center">
    <h1 align = "center">Bevy Inspection - vscode extension</h1>
</p>
<p align="center">
    Runtime Monitoring & Modification Tool for Bevy Engine in VSCode extension.
</p>

![Screenshot](https://github.com/user-attachments/assets/8f6fd0d4-8e3b-4e2c-82e9-f85fda7e21a7)

## Warning

- **Not Official**: This is a community-driven project, not affiliated with the official Bevy Engine team.
- **Early Development**: Currently in alpha stage — expect bugs and missing features. Contributions welcome!

## Features

- Review hierarchy of all entities in your scene
- Rename and destroy entities
- Review and modify components of entities in real time

## Supported Versions

| Bevy Version | Status      |
| ------------ | ------------|
| 0.16+        | Supported   |

Built on [Bevy Remote Protocol](https://docs.rs/bevy/latest/bevy/remote/index.html) via JSON-RPC 2.0 over HTTP.

## Getting Started

### Configure Bevy Project

1. Add required dependencies to your `Cargo.toml`:

```toml
[dependencies]
bevy = { version = "0.16", features = ["bevy_remote"] }
```

2. Initialize plugins in your Bevy app:

```rust
fn main() {
    App::new()
        .add_plugins(RemotePlugin::default()) // Core remote protocol
        .add_plugins(RemoteHttpPlugin::default()) // Enable HTTP transport
        // ...other plugins
        .run();
}
```

3. Launch your game and connect from VSCode using the extension.

### Custom Components

For built-in Bevy components (with Reflect trait), inspection works automatically.
For custom components:

```rust
#[derive(Component, Reflect, Default)] // Derive `Reflect` trait:
#[reflect(Component, Default)] // 'Component' is required for recognition
struct SimpleWeapon {
    #[reflect(ignore)] // Optional: hide sensitive fields
    secret_code: String,
    damage: f32,
    charge_time: f32,
}

fn main() {
    App::new()
        // ...other plugins
        .register_type::<SimpleWeapon>() // Register type
        // ...other registrations
        .run();
}
```

### Custom Resources

Resource inspection not supported - work in progress

### Examples

Refer to the [examples](https://github.com/foxication/bevy-inspection.vscode/tree/main/examples/) directory
for fully functional Bevy applications demonstrating correct configuration.

## Documentation

- Reflection - https://docs.rs/bevy/latest/bevy/reflect/index.html
- RemoteHttpPlugin - https://docs.rs/bevy/latest/bevy/remote/http/struct.RemoteHttpPlugin.html

## Support

Feel free to donate to support repository development/maintenance.

| Currency   | Address                                             |
| ---------- | ----------------------------------------------------|
| Bitcoin    | 12bECwhD8JDvc8t2K37uj69M9SucEUxWuw                  |
| Ton        | UQC4a4h6AW8MbOmS45iSHRj1gMBsYtAdd1GGmqD_tEEC3ZV8    |
| USDT TRC20 | TRDQzvcKydMUiyVicZa78doS3uZeqHQJ3b                  |

## Alternative Solutions

- [splo/bevy-inspector-vscode](https://github.com/splo/vscode-bevy-inspector) - vscode extension
- [Lommix/bevy_inspector.nvim](https://github.com/Lommix/bevy_inspector.nvim) - nvim extension
- [jakobhellermann/bevy_editor_pls](https://github.com/jakobhellermann/bevy_editor_pls) - bevy plugin
- [jakobhellermann/bevy-inspector-egui](https://github.com/jakobhellermann/bevy-inspector-egui) - bevy plugin
- [idanarye/bevy-yoleck](https://github.com/idanarye/bevy-yoleck) - development kit
- [reneeichhorn/bevy-remote-devtools](https://github.com/reneeichhorn/bevy-remote-devtools) - software (last update in 2022)
