<p align="center">
    <h1 align = "center">Bevy Inspection - VSCode Extension</h1>
</p>
<p align="center">
    Runtime Monitoring & Modification Tool for Bevy Engine in VSCode extension.
</p>

![Screenshot](https://github.com/user-attachments/assets/10db60e5-9902-47d1-a252-ef1918c50ad1)

## ⚠️ Warning

- **Not Official**: This is a community-driven project, not affiliated with the official Bevy Engine team.
- **Early Development**: Currently in alpha stage - expect bugs and missing features. Contributions welcome!

## ✨ Features

- Review hierarchy of all entities in your scene
- Rename and destroy entities
- Review and modify components of entities in real time

## 📅 Upcoming Features

### v0.1.3 - Core Functionality

Focus: Critical inspector capabilities

- Component modification
- Collection modification
- Enum modification

### v0.1.4 - UX Improvements

Focus: Quality-of-life improvements

- Collapse/expand all components with one-click toggles
- Custom UI adapters for `Transform` and `Vec3` types
- Redesign of number inputs with drag-to-adjust functionality
- Redesign of selection state
- Redesign of buttons

### v0.1.5 - Entity Management

Focus: Scene composition tools

- Visualize entity tree in **real-time**
- Spawn new entities
- Drag-and-drop reparenting of entities

## 📐 Supported Versions

| Bevy Version | Status      |
| ------------ | ------------|
| 0.16+        | Supported   |

Built on [Bevy Remote Protocol](https://docs.rs/bevy/latest/bevy/remote/index.html) via JSON-RPC 2.0 over HTTP.

## 📗 Getting Started

### Installation

- Install the extension from the official [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=foxication.bevy-inspection)
- Also available on [Open VSX](https://open-vsx.org/extension/foxication/bevy-inspection)

### Configure Bevy Project

1. Add required dependencies to your `Cargo.toml`:

```toml
[dependencies]
bevy = { version = "0.16", features = ["bevy_remote"] }
```

2. Initialize plugins in your Bevy App:

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

## 🔍 Related Documentation

- Reflection - https://docs.rs/bevy/latest/bevy/reflect/index.html
- RemoteHttpPlugin - https://docs.rs/bevy/latest/bevy/remote/http/struct.RemoteHttpPlugin.html

## ⭐ Support

As a solo developer, I'm passionate about creating tools that empower the Bevy community.
To keep pushing new features and improvements, I need your help to gauge interest and prioritize efforts.
Here's how you can contribute:

- **Star the Repository** - Show that this tool matters and help others discover this tool.
- **Share ideas & feedback** - Even simple comments in [Issues](https://github.com/foxication/bevy-inspection.vscode/issues) guide prioritization.
- **Sponsor development** - Funds development efforts, ensuring long-term updates and maintenance.

| Currency   | Address                                             |
| ---------- | ----------------------------------------------------|
| Bitcoin    | 12bECwhD8JDvc8t2K37uj69M9SucEUxWuw                  |
| Ton        | UQC4a4h6AW8MbOmS45iSHRj1gMBsYtAdd1GGmqD_tEEC3ZV8    |
| USDT TRC20 | TRDQzvcKydMUiyVicZa78doS3uZeqHQJ3b                  |

Your engagement keeps Bevy Inspection thriving. Thank you!  

## 🌐 Alternative Solutions

- [splo/bevy-inspector-vscode](https://github.com/splo/vscode-bevy-inspector) - vscode extension
- [Lommix/bevy_inspector.nvim](https://github.com/Lommix/bevy_inspector.nvim) - nvim extension
- [jakobhellermann/bevy_editor_pls](https://github.com/jakobhellermann/bevy_editor_pls) - bevy plugin
- [jakobhellermann/bevy-inspector-egui](https://github.com/jakobhellermann/bevy-inspector-egui) - bevy plugin
- [idanarye/bevy-yoleck](https://github.com/idanarye/bevy-yoleck) - development kit
- [reneeichhorn/bevy-remote-devtools](https://github.com/reneeichhorn/bevy-remote-devtools) - software (last update in 2022)
