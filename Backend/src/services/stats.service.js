import { Battle, Game as GameModel, User } from '../models/index.js';

const countBy = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? 'unknown', r.count]));

// The human player's totals across all of a user's games.
export async function myStats(user) {
  const [byStatus, totals, favourites] = await Promise.all([
    GameModel.aggregate([
      { $match: { owner: user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    GameModel.aggregate([
      { $match: { owner: user._id } },
      { $unwind: '$players' },
      { $match: { 'players.isNPC': false } },
      {
        $group: {
          _id: null,
          attacksLaunched: { $sum: '$players.stats.attacksLaunched' },
          conquests: { $sum: '$players.stats.conquests' },
          soldiersLost: { $sum: '$players.stats.soldiersLost' },
          soldiersKilled: { $sum: '$players.stats.soldiersKilled' },
          averageRounds: { $avg: '$round' },
          longestGame: { $max: '$round' },
        },
      },
    ]),
    GameModel.aggregate([
      { $match: { owner: user._id } },
      { $unwind: '$players' },
      { $match: { 'players.isNPC': false } },
      {
        $group: {
          _id: '$players.homeCountry',
          games: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$winner', '$players._id'] }, 1, 0] } },
        },
      },
      { $sort: { games: -1 } },
      { $limit: 3 },
      { $lookup: { from: 'worldcountries', localField: '_id', foreignField: 'code', as: 'country' } },
      { $project: { _id: 0, code: '$_id', name: { $first: '$country.name' }, games: 1, wins: 1 } },
    ]),
  ]);

  const { _id, ...battleTotals } = totals[0] ?? {};
  return {
    profile: user.toJSON(),
    gamesByStatus: countBy(byStatus),
    totals: {
      attacksLaunched: 0,
      conquests: 0,
      soldiersLost: 0,
      soldiersKilled: 0,
      averageRounds: 0,
      longestGame: 0,
      ...battleTotals,
    },
    favouriteCountries: favourites,
  };
}

export async function leaderboard() {
  const users = await User.find({ 'stats.gamesPlayed': { $gt: 0 } })
    .sort({ 'stats.gamesWon': -1, 'stats.countriesConquered': -1, createdAt: 1 })
    .limit(10);
  return { items: users.map((u) => ({ id: String(u._id), username: u.username, stats: u.stats, winRate: u.winRate })) };
}

// Platform-wide analytics across every game ever played.
export async function platformStats() {
  const [users, games, battles, byStatus, outcomes, popularStarts, winsByProfile] = await Promise.all([
    User.estimatedDocumentCount(),
    GameModel.estimatedDocumentCount(),
    Battle.estimatedDocumentCount(),
    GameModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Battle.aggregate([{ $group: { _id: '$outcome', count: { $sum: 1 } } }]),
    GameModel.aggregate([
      { $unwind: '$players' },
      { $match: { 'players.isNPC': false } },
      {
        $group: {
          _id: '$players.homeCountry',
          games: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$winner', '$players._id'] }, 1, 0] } },
        },
      },
      { $sort: { games: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'worldcountries', localField: '_id', foreignField: 'code', as: 'country' } },
      { $project: { _id: 0, code: '$_id', name: { $first: '$country.name' }, games: 1, wins: 1 } },
    ]),
    GameModel.aggregate([
      { $match: { status: 'completed', winner: { $ne: null } } },
      { $unwind: '$players' },
      { $match: { $expr: { $eq: ['$players._id', '$winner'] } } },
      { $group: { _id: { $ifNull: ['$players.npcProfile', 'human'] }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    users,
    games,
    battles,
    gamesByStatus: countBy(byStatus),
    battleOutcomes: countBy(outcomes),
    winsByProfile: countBy(winsByProfile),
    popularStartingCountries: popularStarts,
  };
}
