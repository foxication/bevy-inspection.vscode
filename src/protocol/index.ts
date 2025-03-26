import { TypePath } from './types';

export * from './protocol';
export * from './types';
export function short(typePath: TypePath) {
  return (/[^::]*$/.exec(typePath.split('<')[0]) ?? '???')[0];
}
