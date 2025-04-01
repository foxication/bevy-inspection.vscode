// Example adapted from https://raw.githubusercontent.com/bevyengine/bevy/refs/tags/v0.15.0/examples/remote/server.rs
//! A Bevy app that you can connect to with the BRP and edit.

use bevy::{
    app::ScheduleRunnerPlugin,
    platform_support::{
        collections::{HashMap, HashSet},
        hash::FixedHasher,
    },
    prelude::*,
    remote::{RemotePlugin, http::RemoteHttpPlugin},
};
use serde::{Deserialize, Serialize};
use std::{collections::VecDeque, time::Duration};

fn main() {
    App::new()
        .register_type::<Special>()
        .register_type::<SingleValue>()
        .register_type::<SingleValueSerialized>()
        .register_type::<Person>()
        .register_type::<GameState>()
        .register_type::<GameDifficulty>()
        .register_type::<WindowMode>()
        .register_type::<Collections>()
        .add_plugins(MinimalPlugins.set(
            // run 60 times per second
            ScheduleRunnerPlugin::run_loop(Duration::from_secs_f64(1.0 / 60.0)),
        ))
        .add_plugins(RemotePlugin::default())
        .add_plugins(RemoteHttpPlugin::default())
        .add_systems(Startup, setup)
        .run();
}

fn setup(mut commands: Commands) {
    let mut hash_map = HashMap::with_hasher(FixedHasher::default());
    hash_map.insert("First".to_string(), 73682 as i32);
    hash_map.insert("Second".to_string(), 5882 as i32);
    hash_map.insert("Third".to_string(), 34234 as i32);

    let mut hash_set = HashSet::with_hasher(FixedHasher::default());
    hash_set.insert(7368 as i32);
    hash_set.insert(1232 as i32);
    hash_set.insert(2324 as i32);

    commands.spawn(Name::new("Named Entity"));
    commands.spawn((
        Name::new("All Components"),
        Special,
        UnregisteredType,
        SingleValue(138.0),
        SingleValueSerialized(28.0),
        Person {
            name: String::from("David"),
            friends: 4,
            birth_date: (4, 8, 1998),
        },
        GameState::Playing,
        GameDifficulty::Hard { enemies: 4 },
        WindowMode::Window(512, 256),
        Collections {
            sequences: Sequences {
                array: [1, 2, 3, 4, 5],
                vec: vec![1, 2, 3],
                vec_deque: VecDeque::from([4, 5, 6]),
            },
            maps: Maps { hash_map: hash_map },
            sets: Sets { hash_set: hash_set },
            tuples: (
                SignedIntegers(0, -1, 2, -3, 4),
                UnsignedIntegers(0, 1, 2, 3, 4),
            ),
        },
    ));
}

#[derive(Component, Reflect)]
#[reflect(Component)]
struct Special;

#[derive(Component, Reflect)]
#[reflect(Component)]
struct UnregisteredType;

#[derive(Component, Reflect)]
#[reflect(Component)]
struct SingleValue(f32);

#[derive(Component, Reflect, Serialize, Deserialize)]
#[reflect(Component, Serialize, Deserialize)]
struct SingleValueSerialized(f32);

// #[derive(Component, Reflect)]
// #[reflect(Component, Serialize, Deserialize)]
// struct SingleValueWithSerde(f32);

// impl Serialize for SingleValueWithSerde {
//     fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
//     where
//         S: serde::Serializer,
//     {
//         serializer.serialize_str(format!("I contain value: {}", self.0).as_str())
//     }
// }

// impl<'de> Deserialize<'de> for SingleValueWithSerde {
//     fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
//     where
//         D: serde::Deserializer<'de>,
//     {
//         deserializer.deserialize_str(SingleValueWithSerde)
//     }
// }

// impl<'de> Visitor<'de> for SingleValueWithSerde {
//     type Value = &'de str;

//     fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
//         formatter.write_str("a string with sentence \"I contain value: VALUE\" where VALUE is f32")
//     }

//     fn visit_string<E>(self, v: String) -> std::result::Result<Self::Value, E>
//     where
//         E: serde::de::Error,
//     {
//         v.trim_start_matches(|c: char| {
//             c.is_alphabetic() || c.is_ascii_punctuation() || c.is_whitespace()
//         });
//         v.parse::<f32>().map(|i| (i)).map_err()
//     }
// }

#[derive(Component, Reflect)]
#[reflect(Component)]
struct Person {
    name: String,
    friends: u32,
    birth_date: (u8, u8, u32),
}

#[derive(Component, Reflect)]
#[reflect(Component)]
enum GameState {
    Playing,
    Pause,
    Loading(i32),
}

#[derive(Component, Reflect)]
#[reflect(Component)]
enum GameDifficulty {
    Easy,
    Medium,
    Hard { enemies: u32 },
}

#[derive(Component, Reflect)]
#[reflect(Component)]
enum WindowMode {
    Fullscreen,
    Window(u32, u32),
}

#[derive(Component, Reflect)]
#[reflect(Component)]
struct Collections {
    sequences: Sequences,
    maps: Maps,
    sets: Sets,
    tuples: (SignedIntegers, UnsignedIntegers),
    // binary_heap: BinaryHeap<i32>,
}

#[derive(Reflect)]
struct Sequences {
    array: [i32; 5],
    vec: Vec<i32>,
    vec_deque: VecDeque<i32>,
    // linked_list: LinkedList<i32>,
}

#[derive(Reflect)]
struct Maps {
    hash_map: HashMap<String, i32>,
    // b_tree_map: BTreeMap<String, i32>,
}

#[derive(Reflect)]
struct Sets {
    hash_set: HashSet<i32>,
    // b_tree_set: BTreeSet<i32>,
}

#[derive(Reflect)]
struct SignedIntegers(i8, i16, i32, i64, i128);

#[derive(Reflect)]
struct UnsignedIntegers(u8, u16, u32, u64, u128);
