import { BevyVersion } from './types';

export type CommonTypePath = 'ChildOf' | 'Children' | 'Name';
export function commonTypePaths(version: BevyVersion, short: CommonTypePath): string {
  switch (version) {
    case '0.15':
      switch (short) {
        case 'ChildOf':
          return 'bevy_ecs::hierarchy::ChildOf';
        case 'Children':
          return 'bevy_hierarchy::components::children::Children';
        case 'Name':
          return 'bevy_core::name::Name';
      }
      break;

    case '0.16':
    case 'future':
      switch (short) {
        case 'ChildOf':
          return 'bevy_ecs::hierarchy::ChildOf';
        case 'Children':
          return 'bevy_ecs::hierarchy::Children';
        case 'Name':
          return 'bevy_ecs::name::Name';
      }
      break;
  }
}
