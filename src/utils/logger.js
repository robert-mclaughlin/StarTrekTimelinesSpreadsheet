const fs = require('fs');
const electron = require('electron');
const json2csv = require('json2csv').parse;

import STTApi from 'sttapi';
import { CONFIG } from 'sttapi';

export class LoggerClass {
    basePath;

    constructor() {
        const app = electron.app || electron.remote.app;
        this.basePath = app.getPath('userData') + '/logs/';

        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath);
        }
    }

    logGauntletEntry(data, match, consecutive_wins) {
        if (data && data.gauntlet && data.gauntlet.gauntlet_id) {
            let fileName = `${this.basePath}gauntlet_log_${data.gauntlet.gauntlet_id}.json`;

            // TODO: This can be smarter, perhaps with an in-memory cache, to avoid reading the whole thing and rewriting it with every entry
            fs.exists(fileName, (exists) => {
                if (exists) {
                    fs.readFile(fileName, (err, inFile) => {
                        if (!err) {
                            let arr = JSON.parse(inFile);
                            arr.push({
                                data: data,
                                match: match,
                                consecutive_wins: consecutive_wins,
                                time: Date.now()
                            });
                            fs.writeFile(fileName, JSON.stringify(arr), (err) => { if (err) console.error(err); });
                        }
                    });
                } else {
                    fs.writeFile(fileName, JSON.stringify([{
                        data: data,
                        match: match,
                        consecutive_wins: consecutive_wins,
                        time: Date.now()
                    }]), (err) => { if (err) console.error(err); });
                }
            });

            return fileName;
        }

        return undefined;
    }

    hasGauntletLog(gauntlet_id) {
        let fileName = `${this.basePath}gauntlet_log_${gauntlet_id}.json`;

        if (fs.existsSync(fileName)) {
            return fileName;
        }

        return undefined;
    }

    exportGauntletLog(gauntlet_id, fileName) {
        return new Promise((resolve, reject) => {
            let logPath = `${this.basePath}gauntlet_log_${gauntlet_id}.json`;

            fs.readFile(logPath, (err, inFile) => {
                if (!err) {

                    let sum = (a,c) => a + c;

                    var fields = [
                        {
                            label: 'Featured skill',
                            value: (row) => CONFIG.SKILLS[row.data.gauntlet.contest_data.featured_skill]
                        },
                        {
                            label: 'Featured traits',
                            value: (row) => row.data.gauntlet.contest_data.traits.map(trait => STTApi.getTraitName(trait)).join(', ')
                        },
                        {
                            label: 'bracket_id',
                            value: (row) => row.data.gauntlet.bracket_id
                        },
                        {
                            label: 'Consecutive Wins',
                            value: (row) => row.consecutive_wins
                        },
                        {
                            label: 'Player 1',
                            value: (row) => row.data.lastResult.player_rolls[0]
                        },
                        {
                            label: 'PCrit 1',
                            value: (row) => row.data.lastResult.player_crit_rolls[0]
                        },
                        {
                            label: 'Player 2',
                            value: (row) => row.data.lastResult.player_rolls[1]
                        },
                        {
                            label: 'PCrit 2',
                            value: (row) => row.data.lastResult.player_crit_rolls[1]
                        },
                        {
                            label: 'Player 3',
                            value: (row) => row.data.lastResult.player_rolls[2]
                        },
                        {
                            label: 'PCrit 3',
                            value: (row) => row.data.lastResult.player_crit_rolls[2]
                        },
                        {
                            label: 'Player 4',
                            value: (row) => row.data.lastResult.player_rolls[3]
                        },
                        {
                            label: 'PCrit 4',
                            value: (row) => row.data.lastResult.player_crit_rolls[3]
                        },
                        {
                            label: 'Player 5',
                            value: (row) => row.data.lastResult.player_rolls[4]
                        },
                        {
                            label: 'PCrit 5',
                            value: (row) => row.data.lastResult.player_crit_rolls[4]
                        },
                        {
                            label: 'Player 6',
                            value: (row) => row.data.lastResult.player_rolls[5]
                        },
                        {
                            label: 'PCrit 6',
                            value: (row) => row.data.lastResult.player_crit_rolls[5]
                        },
                        {
                            label: 'Opponent 1',
                            value: (row) => row.data.lastResult.opponent_rolls[0]
                        },
                        {
                            label: 'OCrit 1',
                            value: (row) => row.data.lastResult.opponent_crit_rolls[0]
                        },
                        {
                            label: 'Opponent 2',
                            value: (row) => row.data.lastResult.opponent_rolls[1]
                        },
                        {
                            label: 'OCrit 2',
                            value: (row) => row.data.lastResult.opponent_crit_rolls[1]
                        },
                        {
                            label: 'Opponent 3',
                            value: (row) => row.data.lastResult.opponent_rolls[2]
                        },
                        {
                            label: 'OCrit 3',
                            value: (row) => row.data.lastResult.opponent_crit_rolls[2]
                        },
                        {
                            label: 'Opponent 4',
                            value: (row) => row.data.lastResult.opponent_rolls[3]
                        },
                        {
                            label: 'OCrit 4',
                            value: (row) => row.data.lastResult.opponent_crit_rolls[3]
                        },
                        {
                            label: 'Opponent 5',
                            value: (row) => row.data.lastResult.opponent_rolls[4]
                        },
                        {
                            label: 'OCrit 5',
                            value: (row) => row.data.lastResult.opponent_crit_rolls[4]
                        },
                        {
                            label: 'Opponent 6',
                            value: (row) => row.data.lastResult.opponent_rolls[5]
                        },
                        {
                            label: 'OCrit 6',
                            value: (row) => row.data.lastResult.opponent_crit_rolls[5]
                        },
                        {
                            label: 'Won round',
                            value: (row) => row.data.lastResult.win ? 'Yes' : 'No'
                        },
                        {
                            label: 'loot_box_rarity',
                            value: (row) => row.data.lastResult.loot_box_rarity
                        },
                        {
                            label: 'Skill 1',
                            value: (row) => CONFIG.SKILLS[row.data.gauntlet.contest_data.primary_skill]
                        },
                        {
                            label: 'Skill 2',
                            value: (row) => CONFIG.SKILLS[row.data.gauntlet.contest_data.secondary_skill]
                        },
                        {
                            label: 'Player crew',
                            value: (row) => STTApi.getCrewAvatarBySymbol(row.match.crewOdd.archetype_symbol).name
                        },
                        {
                            label: 'Player crit chance',
                            value: 'match.crewOdd.crit_chance'
                        },
                        {
                            label: 'PSkill1 min',
                            value: (row) => row.match.crewOdd.min[0]
                        },
                        {
                            label: 'PSkill1 max',
                            value: (row) => row.match.crewOdd.max[0]
                        },
                        {
                            label: 'PSkill2 min',
                            value: (row) => row.match.crewOdd.min[1]
                        },
                        {
                            label: 'PSkill2 max',
                            value: (row) => row.match.crewOdd.max[1]
                        },
                        {
                            label: 'Crew uses',
                            value: 'match.crewOdd.used'
                        },
                        {
                            label: 'Opponent crew',
                            value: (row) => STTApi.getCrewAvatarBySymbol(row.match.opponent.archetype_symbol).name
                        },
                        {
                            label: 'Opponent crit chance',
                            value: 'match.opponent.crit_chance'
                        },
                        {
                            label: 'OSkill1 min',
                            value: (row) => row.match.opponent.min[0]
                        },
                        {
                            label: 'OSkill1 max',
                            value: (row) => row.match.opponent.max[0]
                        },
                        {
                            label: 'OSkill2 min',
                            value: (row) => row.match.opponent.min[1]
                        },
                        {
                            label: 'OSkill2 max',
                            value: (row) => row.match.opponent.max[1]
                        },
                        {
                            label: 'Estimated chance',
                            value: 'match.chance'
                        },
                        {
                            label: 'Time (epoch)',
                            value: 'time'
                        }
                    ];

                    // Format as CSV
                    let csv = json2csv(JSON.parse(inFile), { fields });

                    fs.writeFile(fileName, csv, function (err) {
                        if (err) { reject(err); }
                        else { resolve(fileName); }
                    });
                } else { reject(err); }
            });
        });
    }
}


let Logger = new LoggerClass();
export default Logger;