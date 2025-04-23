use bevy::{
    math::ops::sin,
    prelude::*,
    remote::{RemotePlugin, http::RemoteHttpPlugin},
};

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugins(RemotePlugin::default())
        .add_plugins(RemoteHttpPlugin::default())
        .add_systems(Startup, setup)
        .add_systems(Update, animate)
        .register_type::<AnimatedOnPlace>()
        .run();
}

/// Set up a simple 3D scene
fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    commands
        .spawn((
            Name::new("Scene Root"),
            Transform::default(),
            Visibility::default(),
        ))
        .with_children(|cmd| {
            cmd.spawn((
                Name::new("Plane"),
                Mesh3d(meshes.add(Plane3d::default().mesh().size(5.0, 5.0))),
                MeshMaterial3d(materials.add(Color::srgb(1.0, 1.0, 1.0))),
            ));

            cmd.spawn((
                Name::new("Cube"),
                Mesh3d(meshes.add(Cuboid::default())),
                MeshMaterial3d(materials.add(Color::srgb(1.0, 0.5, 0.5))),
                Transform::from_xyz(1.0, 1.0, 0.0),
            ));

            cmd.spawn((
                Name::new("Cube [Animated]"),
                Mesh3d(meshes.add(Cuboid::default())),
                MeshMaterial3d(materials.add(Color::srgb(0.5, 1.0, 0.5))),
                Transform::from_xyz(-1.0, 1.0, 0.0),
                AnimatedOnPlace::new(1.0, 2.0, 0.4375),
            ));

            cmd.spawn((
                Name::new("Light Source"),
                PointLight {
                    shadows_enabled: true,
                    ..default()
                },
                Transform::from_xyz(4.0, 8.0, 4.0),
            ));
            cmd.spawn((
                Name::new("Camera"),
                Camera3d::default(),
                Camera::default(),
                Transform::from_xyz(-2.0, 2.5, 5.0).looking_at(Vec3::Y, Vec3::Y),
            ));
        });

    commands.spawn((
        Name::from("Text"),
        Text::new("Hello, Bevy!"),
        TextFont::default().with_font_size(30.0),
        Node {
            position_type: PositionType::Absolute,
            top: Val::Px(16.0),
            justify_self: JustifySelf::Center,
            ..default()
        },
    ));
}

#[derive(Component, Reflect)]
#[reflect(Component)]
struct AnimatedOnPlace {
    rotation_speed: f32,
    oscillation_speed: f32,
    oscillation_range: f32,
    oscillation_anchor: Option<f32>,
}

impl AnimatedOnPlace {
    fn new(rotation_speed: f32, oscillation_speed: f32, oscillation_range: f32) -> Self {
        AnimatedOnPlace {
            rotation_speed,
            oscillation_speed,
            oscillation_range,
            oscillation_anchor: None,
        }
    }
}

fn animate(
    mut movable: Query<(&mut Transform, &mut AnimatedOnPlace), With<AnimatedOnPlace>>,
    time: Res<Time>,
) {
    for (mut transform, mut properties) in movable.iter_mut() {
        transform.rotate_local_y(time.delta_secs() * properties.rotation_speed);
        transform.translation.y = *properties
            .oscillation_anchor
            .get_or_insert(transform.translation.y)
            + sin(time.elapsed_secs() * properties.oscillation_speed)
                * properties.oscillation_range
                / 2.0;
    }
}
