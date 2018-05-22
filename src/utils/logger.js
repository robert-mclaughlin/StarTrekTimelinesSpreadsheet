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

    logGauntletEntry(data, match) {
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
                                time: Date.now()
                            });
                            fs.writeFile(fileName, JSON.stringify(arr), (err) => { if (err) console.error(err); });
                        }
                    });
                } else {
                    fs.writeFile(fileName, JSON.stringify([{
                        data: data,
                        match: match,
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
                            label: 'Player rolls',
                            value: (row) => row.data.lastResult.player_rolls.map((roll, index) => `${roll}${row.data.lastResult.player_crit_rolls[index] ? '*' : ''}` ).join(', ')
                        },
                        {
                            label: 'Opponent rolls',
                            value: (row) => row.data.lastResult.opponent_rolls.map((roll, index) => `${roll}${row.data.lastResult.opponent_crit_rolls[index] ? '*' : ''}` ).join(', ')
                        },
                        {
                            label: 'Won round',
                            value: (row) => row.data.lastResult.win ? 'Yes' : 'No'
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
                            label: 'Player crew stats',
                            value: (row) => `${row.match.crewOdd.min.reduce(sum, 0)} - ${row.match.crewOdd.max.reduce(sum, 0)}`
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
                            label: 'Opponent crew stats',
                            value: (row) => `${row.match.opponent.min.reduce(sum, 0)} - ${row.match.opponent.max.reduce(sum, 0)}`
                        },
                        {
                            label: 'Opponent name',
                            value: 'match.opponent.name'
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