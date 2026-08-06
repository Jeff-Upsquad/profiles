import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Same cost factor staff-auth uses (see staff-auth.service.ts).
const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function comparePassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

// A short, human-relayable temporary password. An admin reads this out over
// WhatsApp, so we skip visually ambiguous characters (0/O, 1/l/I).
export function generateTempPassword(length = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

// Curated list of common, unambiguous, inoffensive four-letter words. Used for
// the self-serve reset temp password (`generateWordTempPassword`): two of these
// joined by a hyphen are far easier to relay over WhatsApp and re-type into two
// boxes than a random string, while still giving ~150^2 ≈ 22k combinations per
// slot (the reset flow caps verify attempts and expires the ticket, so this is
// only ever a short-lived, rate-limited secret).
const TEMP_WORDS: readonly string[] = [
  'able', 'acid', 'aged', 'also', 'area', 'army', 'away', 'baby', 'back', 'ball',
  'band', 'bank', 'base', 'bath', 'bead', 'bean', 'bear', 'beat', 'bell', 'belt',
  'bird', 'blue', 'boat', 'body', 'bolt', 'bone', 'book', 'boot', 'boss', 'bulb',
  'cake', 'calm', 'camp', 'card', 'care', 'cart', 'case', 'cash', 'cell', 'chef',
  'city', 'clay', 'clip', 'club', 'coal', 'coat', 'code', 'coin', 'cold', 'cook',
  'cool', 'copy', 'corn', 'crew', 'crop', 'cube', 'dark', 'dash', 'data', 'date',
  'dawn', 'deer', 'desk', 'dime', 'dish', 'dock', 'door', 'dove', 'draw', 'drum',
  'duck', 'dust', 'earn', 'east', 'easy', 'edge', 'exam', 'face', 'fact', 'fair',
  'fall', 'farm', 'fast', 'fern', 'film', 'find', 'fire', 'fish', 'flag', 'flat',
  'flow', 'fold', 'font', 'food', 'foot', 'fork', 'form', 'fort', 'frog', 'fuel',
  'gain', 'game', 'gate', 'gear', 'gift', 'girl', 'glad', 'glow', 'glue', 'goal',
  'goat', 'gold', 'good', 'gray', 'grid', 'grip', 'hall', 'hand', 'hawk', 'heat',
  'herb', 'hero', 'hill', 'hint', 'home', 'hope', 'horn', 'host', 'hour', 'iron',
  'item', 'jade', 'jazz', 'join', 'jump', 'keen', 'keep', 'kind', 'king', 'kite',
  'lake', 'lamp', 'land', 'lane', 'leaf', 'lens', 'life', 'lime', 'line', 'link',
  'lion', 'list', 'load', 'lock', 'loft', 'main', 'mall', 'mane', 'many', 'mate',
  'mark', 'mask', 'mast', 'meal', 'mesh', 'mild', 'mile', 'mint', 'mode', 'moon',
  'moss', 'moth', 'name', 'navy', 'neat', 'nest', 'news', 'nice', 'node', 'note',
  'oval', 'oath', 'open', 'oven', 'pace', 'pack', 'page', 'palm', 'park', 'path',
  'peak', 'pear', 'peer', 'pine', 'pink', 'plan', 'plot', 'plum', 'poem', 'pond',
  'pool', 'port', 'post', 'pour', 'pump', 'rain', 'ramp', 'rank', 'rate', 'read',
  'reef', 'rest', 'rice', 'ride', 'ring', 'road', 'rock', 'role', 'roof', 'room',
  'root', 'rope', 'rose', 'ruby', 'rush', 'safe', 'sail', 'salt', 'sand', 'save',
  'seal', 'seat', 'seed', 'ship', 'shoe', 'shop', 'silk', 'site', 'slot', 'snow',
  'soap', 'sock', 'soft', 'soil', 'song', 'sort', 'soup', 'star', 'stem', 'step',
  'surf', 'swan', 'tank', 'tape', 'task', 'team', 'tent', 'test', 'text', 'tide',
  'time', 'tone', 'tool', 'tour', 'town', 'tree', 'trip', 'tube', 'tuna', 'twin',
  'unit', 'vase', 'vine', 'wall', 'wave', 'wind', 'wing', 'wolf', 'wood', 'wool',
  'yard', 'yarn', 'zero', 'zone',
];

/**
 * A temporary password shaped as two common four-letter words joined by a
 * hyphen (e.g. `fish-lamp`). Delivered over WhatsApp and re-typed into two
 * boxes on the reset page. The two words are always distinct.
 */
export function generateWordTempPassword(): string {
  const first = TEMP_WORDS[crypto.randomInt(TEMP_WORDS.length)]!;
  let second = first;
  while (second === first) {
    second = TEMP_WORDS[crypto.randomInt(TEMP_WORDS.length)]!;
  }
  return `${first}-${second}`;
}
