# Bevy Inspection

Monitor and modify data of Bevy game in runtime.

Communications based on [Bevy Remote Protocol](https://docs.rs/bevy/latest/bevy/remote/index.html) on JSON-RPC 2.0 on HTTP.

![Screenshot 2025-02-23 045438](https://github.com/user-attachments/assets/efa86754-9d9d-4f3a-a928-ef91d42f806b)

## Features (IN DEVELOPMENT)

- Monitor entities, components, values
- Add/remove/modify entites, components
- Review/organize hierarchy of entities

## In Future Plans

- Diagnostics of Bevy applications
- Resources (monitor + modify)
- States (monitor + modify)
- Events (catch + emmit)

## Requirements

You have to enable feature in your game project:

```toml
# cargo.toml

[dependencies]
bevy = { version = "0.15.1", features = ["bevy_remote"] }
```

Run `RemotePlugin` and `RemoteHttpPlugin`:

```rust
// main.rs

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugins(RemotePlugin::default())
        .add_plugins(RemoteHttpPlugin::default())
        .run();
}
```

## Awareness of Future Changes in Bevy

- [Issue: BRP resource methods](https://github.com/bevyengine/bevy/pull/17423)
- [Issue: OpenRPC support in Bevy Remote Protocol](https://github.com/bevyengine/bevy/issues/16744)

## Credits

Extension was inspired by [splo/vscode-bevy-inspector](https://github.com/splo/vscode-bevy-inspector)

## Support

Feel free to donate to support repository development/maintenance.

|Bitcoin|USDT|TON|
|---|---|---|
|![bitcoin-dark](https://github.com/user-attachments/assets/c0f3133a-fa21-4272-a761-d40e01ca99b0)|![usdt-dark](https://github.com/user-attachments/assets/91941c77-35b0-428c-bdb5-bca326fdd123)|![ton-dark](https://github.com/user-attachments/assets/06e48170-a5d8-4313-898c-2444126d1a8c)|
