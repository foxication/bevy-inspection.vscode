# Bevy Inspection

Monitor and modify data of Bevy game in runtime.

Communications based on [Bevy Remote Protocol](https://docs.rs/bevy/latest/bevy/remote/index.html) on JSON-RPC 2.0 on HTTP.

## Features

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

And run `RemotePlugin` with `RemoteHttpPlugin`:

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

## Credits

Made by [Foxication](https://github.com/foxication)

Extension was inspired by [splo/vscode-bevy-inspector](https://github.com/splo/vscode-bevy-inspector)

## Support

Donate to support maintenance of open source repository.

Some links to crypto wallets here...
