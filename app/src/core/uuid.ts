/** RFC4122 v4-style UUID generator with no native crypto dependency, for outbox event ids. */
export function generateUuid(): string {
  let seed = Date.now() + Math.random() * 0x100000000;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (seed + Math.random() * 16) % 16 | 0;
    seed = Math.floor(seed / 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
