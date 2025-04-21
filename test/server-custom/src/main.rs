// Example adapted from https://raw.githubusercontent.com/bevyengine/bevy/refs/tags/v0.15.0/examples/remote/server.rs
//! A Bevy app that you can connect to with the BRP and edit.

use bevy::{
    app::ScheduleRunnerPlugin,
    prelude::*,
    remote::{http::RemoteHttpPlugin, RemotePlugin},
};
use serde::{Deserialize, Serialize};
use std::time::Duration;

fn main() {
    App::new()
        .add_plugins(MinimalPlugins.set(ScheduleRunnerPlugin::run_loop(
            // run 60 times per second
            Duration::from_secs_f64(1.0 / 60.0),
        )))
        .add_plugins(RemotePlugin::default())
        .add_plugins(RemoteHttpPlugin::default())
        .add_systems(Startup, setup)
        .add_systems(Update, update_time)
        .register_type::<FavoriteEntity>()
        .register_type::<LovelyOne>()
        .register_type::<Description>()
        .register_type::<ExistenceTime>()
        .register_type::<Position>()
        .register_type::<Shape>()
        .run();
}

fn setup(mut commands: Commands) {
    commands
        .spawn((
            Name::from("Parent Node"),
            Shape::Circle,
            FavoriteEntity,
            Position {
                x: 0.0,
                y: 0.0,
                z: 0.0,
            },
        ))
        .with_child((
            Name::from("Child Node 1"),
            Shape::Pentagon,
            LovelyOne,
            Position {
                x: 2.0,
                y: 2.0,
                z: 2.0,
            },
        ))
        .with_child((
            Name::from("Child Node 2"),
            Shape::Square,
            Description("This node has parent".into()),
            Position {
                x: -2.0,
                y: -2.0,
                z: -2.0,
            },
        ));
}

fn update_time(mut query: Query<&mut ExistenceTime>, time: Res<Time>) {
    for mut existence in &mut query {
        existence.0 += time.delta();
    }
}

#[derive(Component, Reflect, Serialize, Deserialize)]
#[reflect(Component, Serialize, Deserialize)]
struct FavoriteEntity;

#[derive(Component, Reflect, Serialize, Deserialize)]
#[reflect(Component, Serialize, Deserialize)]
struct LovelyOne;

#[derive(Component, Reflect, Serialize, Deserialize)]
#[reflect(Component, Serialize, Deserialize)]
struct Description(String);

#[derive(Component, Reflect, Serialize, Deserialize)]
#[reflect(Component, Serialize, Deserialize)]
struct ExistenceTime(Duration);

#[derive(Component, Reflect, Serialize, Deserialize)]
#[reflect(Component, Serialize, Deserialize)]
struct Position {
    x: f32,
    y: f32,
    z: f32,
}

#[derive(Component, Reflect, Serialize, Deserialize)]
#[reflect(Component, Serialize, Deserialize)]
enum Shape {
    Circle,
    Square,
    Rectangle,
    Oval,
    Pentagon,
}
