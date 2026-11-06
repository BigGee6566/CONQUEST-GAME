import { complete as groqComplete } from './groq.client.js';

const MAX_LENGTH = 400;

const SYSTEM_PROMPT = [
  'You are the war correspondent for CONQUEST, a Risk-style strategy game where nations battle with dice.',
  'Narrate the dice exchange you are given in one or two vivid, punchy sentences (at most 45 words).',
  'Use only the facts provided: never invent soldier counts, dice values or outcomes.',
  'Vary your vocabulary. No emojis, hashtags, markdown, or quotation marks.',
].join(' ');

function clean(text) {
  return text.replace(/[*_#`"]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH);
}

async function complete(prompt) {
  const result = await groqComplete({ system: SYSTEM_PROMPT, prompt });
  return result ? clean(result.text) : null;
}

const pairVerdict = (a, d) => (a > d ? 'attacker wins' : d > a ? 'defender wins' : 'tie, no loss');

// The structured battle log handed to the LLM, e.g.
// "South Africa rolled 6, 4; Namibia rolled 5, 4. Pairs: 6 vs 5 attacker wins; 4 vs 4 tie, no loss."
export function buildExchangeLog({ battle, exchange, exchangeNumber, outcome, soldiersGained }) {
  const { attacker, defender } = battle;
  const pairs = exchange.attackerDice
    .map((a, i) => `${a} vs ${exchange.defenderDice[i]} ${pairVerdict(a, exchange.defenderDice[i])}`)
    .join('; ');
  const ending = {
    conquered: `Outcome: ${attacker.countryName} conquers ${defender.countryName} and gains ${soldiersGained} soldiers.`,
    repelled: `Outcome: the attack collapses; ${attacker.countryName} is down to its last soldier and ${defender.countryName} holds.`,
  }[outcome] ?? 'Outcome: the battle continues.';

  return [
    `Battle: ${attacker.name} attacks from ${attacker.countryName} against ${defender.name} defending ${defender.countryName}.`,
    `Exchange ${exchangeNumber}. ${attacker.countryName} rolled ${exchange.attackerDice.join(', ')}; ${defender.countryName} rolled ${exchange.defenderDice.join(', ')}.`,
    `Pairs (highest vs highest): ${pairs}.`,
    `Losses: ${attacker.countryName} -${exchange.attackerLosses}, ${defender.countryName} -${exchange.defenderLosses}.`,
    `Remaining: ${attacker.countryName} ${exchange.attackerRemaining}, ${defender.countryName} ${exchange.defenderRemaining}.`,
    ending,
  ].join('\n');
}

function templateForExchange({ battle, exchange, exchangeNumber, outcome, soldiersGained }) {
  const { attacker, defender } = battle;
  const a = attacker.countryName;
  const d = defender.countryName;
  if (outcome === 'conquered') {
    return `${d} falls! ${attacker.name} plants the flag and ${soldiersGained} fresh soldiers rally to the new frontier.`;
  }
  if (outcome === 'repelled') {
    return `${d} stands firm. The assault from ${a} breaks apart, leaving a lone soldier to limp home.`;
  }
  const { attackerLosses: al, defenderLosses: dl } = exchange;
  const lines = al === 0 && dl === 0
    ? ['Stalemate on the field: every pair of dice is matched and not a soldier falls.']
    : dl > al
      ? [
        `${a} presses hard, cutting down ${dl} defender${dl === 1 ? '' : 's'}; ${d} is left with ${exchange.defenderRemaining}.`,
        `A brutal volley from ${a} tears through the lines of ${d}.`,
      ]
      : al > dl
        ? [
          `${d} throws back the charge, and ${a} loses ${al} soldier${al === 1 ? '' : 's'} in the mud.`,
          `The defenders of ${d} hold the ridge as ${a} bleeds ${al}.`,
        ]
        : [`Blood on both sides: ${a} and ${d} each lose ${al}. The war of attrition grinds on.`];
  return lines[exchangeNumber % lines.length];
}

// mode "outcomes" (fast-forward) only calls the LLM for the deciding roll, keeping playback quick.
export async function narrateExchange(context, { mode = 'full' } = {}) {
  const decisive = Boolean(context.outcome);
  if (mode === 'full' || decisive) {
    const text = await complete(buildExchangeLog(context));
    if (text) return { text, source: 'llm' };
  }
  return { text: templateForExchange(context), source: 'fallback' };
}

export async function narrateRetreat({ battle, attackerRemaining, defenderRemaining }) {
  const { attacker, defender } = battle;
  const prompt = [
    `Battle: ${attacker.name} attacked ${defender.countryName} from ${attacker.countryName}.`,
    `${attacker.name} calls off the attack with ${attackerRemaining} soldiers left; ${defender.countryName} still has ${defenderRemaining}.`,
    'Describe the retreat.',
  ].join('\n');
  const text = await complete(prompt);
  return text
    ? { text, source: 'llm' }
    : {
      text: `${attacker.name} sounds the retreat. ${attackerRemaining} soldiers fall back to ${attacker.countryName} while ${defender.countryName} counts its ${defenderRemaining} survivors.`,
      source: 'fallback',
    };
}
