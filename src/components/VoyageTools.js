import React, { Component } from 'react';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { Slider } from 'office-ui-fabric-react/lib/Slider';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { NormalPeoplePicker } from 'office-ui-fabric-react/lib/Pickers';

import STTApi from 'sttapi';
import { CONFIG, bestVoyageShip } from 'sttapi';

export class VoyageCrew extends React.Component {
	constructor(props) {
		super(props);

		let voyage = STTApi.playerData.character.voyage[0];
		/*if (!voyage || voyage.state == 'unstarted') {
			this.state = {
				state: 'nothingToDo'
			};
		}
		else*/ {
			this.state = {
				bestShips: bestVoyageShip(),
				includeFrozen: false,
				includeActive: false,
				state: 'calculating',
				searchDepth: 6,
                extendsTarget: 0,
                activeEvent: undefined,
                peopleList: [],
                currentSelectedItems: [],
                preselectedIgnored: [],
				selectedVoyageMethod: { key: 0, text: 'Thorough', val: true }
			};
        }
        
        // See which crew is needed in the event to give the user a chance to remove them from consideration
		if (STTApi.playerData.character.events && STTApi.playerData.character.events.length > 0) {
			let activeEvent = STTApi.playerData.character.events[0];
            this.state.activeEvent = activeEvent.name;

            let eventCrew = {};
			if (activeEvent.content) {
                if (activeEvent.content.crew_bonuses) {
                    for (var symbol in activeEvent.content.crew_bonuses) {
                        eventCrew[symbol] = activeEvent.content.crew_bonuses[symbol];
                        
                    }
                }

                if (activeEvent.content.shuttles) {
                    activeEvent.content.shuttles.forEach(shuttle => {
                        for (var symbol in shuttle.crew_bonuses) {
                            eventCrew[symbol] = shuttle.crew_bonuses[symbol];
                        }});
                }
            }

            for (var symbol in eventCrew) {
                let foundCrew = STTApi.roster.find((crew) => crew.symbol === symbol);
                if (foundCrew) {
                    this.state.preselectedIgnored.push(foundCrew.crew_id || foundCrew.id);
                }
            }
        }
        
        STTApi.roster.forEach(crew => {
            this.state.peopleList.push({
                key: crew.crew_id || crew.id,
                imageUrl: crew.iconUrl,
                primaryText: crew.name,
                secondaryText: crew.short_name
            });
        });

        this.state.currentSelectedItems = this.state.peopleList.filter(p => this.state.preselectedIgnored.indexOf(p.key) != -1);

		this._exportVoyageData = this._exportVoyageData.bind(this);
		this._generateVoyCrewRank = this._generateVoyCrewRank.bind(this);
        this._startVoyage = this._startVoyage.bind(this);
        this._onFilterChanged = this._onFilterChanged.bind(this);
        this._filterPersonasByText = this._filterPersonasByText.bind(this);
        this._onItemsChange = this._onItemsChange.bind(this);
	}

	getIndexBySlotName(slotName) {
		const crewSlots = STTApi.playerData.character.voyage_descriptions[0].crew_slots;
		for (let slotIndex = 0; slotIndex < crewSlots.length; slotIndex++) {
			const slot = crewSlots[slotIndex];
			if (slot.name == slotName) {
				return slotIndex;
			}
		}
	}

	renderBestCrew() {
		if (this.state.state === "nothingToDo") {
			return <p>Can only show voyage recommendations if you didn't begin your voyage yet!</p>;
		} else if (this.state.state === "calculating") {
			return <p>Use the button below to calculate crew. <b>WARNING</b> Calculation duration increases exponentially with the search depth</p>;
		}
		else {
			let crewSpans = [];
			this.state.crewSelection.forEach(entry => {
                if (entry.choice) {
                    let crew = <Persona
                        key={entry.choice.name}
                        imageUrl={entry.choice.iconUrl}
                        primaryText={entry.choice.name}
                        secondaryText={entry.slotName}
                        tertiaryText={entry.score.toFixed(0)}
                        size={PersonaSize.large}
                        presence={entry.hasTrait ? PersonaPresence.online : PersonaPresence.away} />

                    crewSpans[this.getIndexBySlotName(crew.props.secondaryText)] = crew;
                } else {
                    console.error(entry);
                }
			});

			return (<div>
				<h3>Best crew</h3>
				{(this.state.state === "inprogress") && (
					<Spinner size={SpinnerSize.small} label='Still calculating...' />
				)}
				<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
					{crewSpans}
				</div>
				<h3>Estimated duration: <b>{this.state.estimatedDuration.toFixed(2)} hours</b></h3>
                <br/>
			</div>);
		}
	}

	render() {
		let shipSpans = [];
		this.state.bestShips.forEach(entry => {
			shipSpans.push(<Persona
				key={entry.ship.id}
				imageUrl={entry.ship.iconUrl}
				primaryText={entry.ship.name}
				secondaryText={entry.score.toFixed(0)}
				size={PersonaSize.regular} />);
		});

		return (<div>
			<p><b>NOTE: </b>Algorithms are still a work in progress. Please provide feedback on your recommendations and voyage results!</p>
            <Dropdown
                label='Algorithm to use:'
                selectedKey={this.state.selectedVoyageMethod.key}
                onChanged={item => this.setState({ selectedVoyageMethod: item })}
                placeHolder='Select an optimization method'
                options={[ { key: 0, text: 'Thorough (best results)', val: true }, { key: 1, text: 'Fast (quick & dirty)', val: false } ]}
            />

			<h3>Best ship(s)</h3>
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
				{shipSpans}
			</div>

            {this.renderBestCrew()}

			<div className="ui grid" style={{maxWidth: '600px'}}>
                <div className="row">
                    <div className="column"><h4>Algorithm settings</h4></div>
                </div>

                <div className="two column row" style={{ display: this.state.selectedVoyageMethod.val ? 'inline-block' : 'none' }}>
                    <div className="column">
                        <SpinButton value={this.state.searchDepth} label={ 'Search depth:' } min={ 2 } max={ 30 } step={ 1 }
                            onIncrement={(value) => { this.setState({ searchDepth: +value + 1}); }}
                            onDecrement={(value) => { this.setState({ searchDepth: +value - 1}); }}
                        />
                    </div>
                    <div className="column">
                        <SpinButton value={this.state.extendsTarget} label='Extends (target):' min={ 0 } max={ 10 } step={ 1 }
                            onIncrement={(value) => { this.setState({ extendsTarget: +value + 1}); }}
                            onDecrement={(value) => { this.setState({ extendsTarget: +value - 1}); }}
                        />
                    </div>
                </div>

                <div className="two column row">
                    <div className="column">
                        <Checkbox checked={this.state.includeFrozen} label="Include frozen (vaulted) crew"
                            onChange={(e, isChecked) => { this.setState({ includeFrozen: isChecked }); }}
                        />
                    </div>
                    <div className="column">
                        <Checkbox checked={this.state.includeActive} label="Include active (on shuttles) crew"
                            onChange={(e, isChecked) => { this.setState({ includeActive: isChecked }); }}
                        />
                    </div>
                </div>

                <div className="row">
                    <div className="column">
                        <p>Crew you don't want to consider for voyage
                            {this.state.activeEvent && <span> (preselected crew which gives bonus in the event <b>{this.state.activeEvent}</b>)</span>}: </p>
                        <NormalPeoplePicker
                            onResolveSuggestions={ this._onFilterChanged }
                            selectedItems={ this.state.currentSelectedItems }
                            onChange={ this._onItemsChange }
                        />
                    </div>
                </div>
			</div>

            <br/>

            <PrimaryButton onClick={this._exportVoyageData} text='Calculate best crew selection' disabled={this.state.state === 'inprogress'} />
            <span> </span>
            <PrimaryButton onClick={this._startVoyage} text='Start voyage with selection' disabled={this.state.state !== 'done'} />
            <span> </span>
            <PrimaryButton onClick={this._generateVoyCrewRank} text='Export CSV with crew Voyage ranking...' disabled={this.state.state === 'inprogress'} />
		</div>);
    }
    
    _listContainsPersona(persona, personas) {
        if (!personas || !personas.length || personas.length === 0) {
          return false;
        }
        return personas.filter(item => item.primaryText === persona.primaryText).length > 0;
    }

    _removeDuplicates(personas, possibleDupes) {
        return personas.filter(persona => !this._listContainsPersona(persona, possibleDupes));
    }

    _filterPersonasByText(filterText) {
        return this.state.peopleList.filter(item => item.primaryText.toLowerCase().indexOf(filterText.toLowerCase()) !== -1);
    }

    _onFilterChanged(filterText, currentPersonas, limitResults) {
        if (filterText) {
          let filteredPersonas = this._filterPersonasByText(filterText);

          return this._removeDuplicates(filteredPersonas, currentPersonas);
        } else {
          return [];
        }
    }

    _onItemsChange(items) {
        this.setState({
          currentSelectedItems: items
        });
      }

	_startVoyage() {
		let selectedCrewIds = [];
		STTApi.playerData.character.voyage_descriptions[0].crew_slots.forEach(slot => {
			let entry = this.state.crewSelection.find(entry => entry.slotName == slot.name);

			selectedCrewIds.push(entry.choice.crew_id);
		});

		STTApi.startVoyage(STTApi.playerData.character.voyage_descriptions[0].symbol, this.state.bestShips[0].ship.id, "Ship Name", selectedCrewIds);
	}

	_exportVoyageData() {
		const NativeExtension = require('electron').remote.require('stt-native');

        let dataToExport = {
			crew: STTApi.roster.map(crew => new Object({
				id: crew.id,
				name: crew.name,
				frozen: crew.frozen,
				traits: crew.rawTraits,
				command_skill: crew.command_skill,
				science_skill: crew.science_skill,
				security_skill: crew.security_skill,
				engineering_skill: crew.engineering_skill,
				diplomacy_skill: crew.diplomacy_skill,
				medicine_skill: crew.medicine_skill,
				iconUrl: crew.iconUrl,
				active_id: crew.active_id ? crew.active_id : 0
			})),
			voyage_skills: STTApi.playerData.character.voyage_descriptions[0].skills,
			voyage_crew_slots: STTApi.playerData.character.voyage_descriptions[0].crew_slots,
			search_depth: this.state.searchDepth,
			extends_target: this.state.extendsTarget,
			shipAM: this.state.bestShips[0].score,
			// These values should be user-configurable to give folks a chance to tune the scoring function and provide feedback
			skillPrimaryMultiplier: 3.5,
			skillSecondaryMultiplier: 2.5,
			skillMatchingMultiplier: 1.1,
			traitScoreBoost: 200,
			includeAwayCrew: this.state.includeActive,
			includeFrozenCrew: this.state.includeFrozen
        };
        
        if (this.state.currentSelectedItems.length > 0) {
            dataToExport.crew = dataToExport.crew.filter(crew => (this.state.currentSelectedItems.find(ignored => (ignored.primaryText === crew.name)) === undefined));
        }

		function cppEntries(result) {
			let entries = [];
			for (var slotName in result.selection) {
				let entry = {
					hasTrait: false,
					slotName: slotName,
					score: 0,
					choice: STTApi.roster.find((crew) => (crew.id == result.selection[slotName]))
				};

				entries.push(entry);
			}
			return entries;
		}

		function jsEntries(result) {
			let entries = [];
			for (let i = 0; i < result.bestCrew.length; i++) {
				let entry = {
					hasTrait: false,
					slotName: dataToExport.voyage_crew_slots[i].name,
					score: 0,
					choice: result.bestCrew[i]
				};

				entries.push(entry);
			}
			return entries;
		}

		const parseResults = (result, state) => {
			return {
				crewSelection: this.state.selectedVoyageMethod.val ? cppEntries(result) : jsEntries(result),
				estimatedDuration: result.bestCrewTime || result.score || 0,
				state: state};
		}

		if (this.state.selectedVoyageMethod.val) {
			NativeExtension.calculateVoyageRecommendations(JSON.stringify(dataToExport), result => {
				this.setState(parseResults(JSON.parse(result), 'done'));
			}, progressResult => {
				this.setState(parseResults(JSON.parse(progressResult), 'inprogress'));
			});
		} else {
			if (this.state.includeFrozen === false) {
				dataToExport.crew = dataToExport.crew.filter(c => c.frozen !== 1);
			}
			if (this.state.includeActive === false) {
				dataToExport.crew = dataToExport.crew.filter(c => c.active_id === 0);
			}
			this.setState(parseResults(calculateBestVoyage(dataToExport), 'done'));
		}
	}

	_generateVoyCrewRank() {
		const NativeExtension = require('electron').remote.require('stt-native');

		let dataToExport = {
			crew: STTApi.roster.map(crew => new Object({
				id: crew.id,
				name: crew.name,
				frozen: crew.frozen,
				ff100: (crew.level == 100 && crew.rarity == crew.max_rarity) ? 1 : 0,
				max_rarity: crew.max_rarity,
				traits: crew.rawTraits,
				command_skill: crew.command_skill,
				science_skill: crew.science_skill,
				security_skill: crew.security_skill,
				engineering_skill: crew.engineering_skill,
				diplomacy_skill: crew.diplomacy_skill,
				medicine_skill: crew.medicine_skill,
				iconUrl: crew.iconUrl,
				active_id: crew.active_id ? crew.active_id : 0
			})),
			voyage_skills: STTApi.playerData.character.voyage_descriptions[0].skills, // not used
			voyage_crew_slots: STTApi.playerData.character.voyage_descriptions[0].crew_slots, // not used
			search_depth: this.state.searchDepth, // TODO: it takes too long to use default search depth for this...
			extends_target: this.state.extendsTarget, // used... for now
			shipAM: this.state.bestShips[0].score,
			// These values should be user-configurable to give folks a chance to tune the scoring function and provide feedback
			skillPrimaryMultiplier: 3.5,
			skillSecondaryMultiplier: 2.5,
			skillMatchingMultiplier: 1.1,
			traitScoreBoost: 200,
			includeAwayCrew: this.state.includeActive, // used, but user should typically enable
			includeFrozenCrew: this.state.includeFrozen // used, but user should typically enable
		};

		function cppEntries(result) {
			let entries = [];
			for (var slotName in result.selection) {
				let entry = {
					hasTrait: false,
					slotName: slotName,
					score: 0,
					choice: STTApi.roster.find((crew) => (crew.id == result.selection[slotName]))
				};

				entries.push(entry);
			}
			return entries;
		}

		const parseResults = (result, state) => {
			return {
				crewSelection: cppEntries(result),
				estimatedDuration: result.bestCrewTime || result.score || 0,
				state: state};
		}

		NativeExtension.calculateVoyageCrewRank(JSON.stringify(dataToExport), result => {
			console.log("done!");
			console.log(result);
			this.setState({state: 'calculating'});
			const fs = require('fs');

			const { dialog } = require('electron').remote;

			dialog.showSaveDialog(
				{
					filters: [{ name: 'Comma separated file (*.csv)', extensions: ['csv'] }],
					title: 'Export Star Trek Timelines voyage crew ranking',
					defaultPath: 'My Voyage Crew.csv',
					buttonLabel: 'Export'
				},
				function (fileName) {
					if (fileName === undefined)
						return;

					let promose = new Promise(function (resolve, reject) {
						fs.writeFile(fileName, result, function (err) {
							if (err) { reject(err); }
							else { resolve(fileName); }
						});
					});

					promose.then((filePath) => {
						shell.openItem(filePath);
					});
				}.bind(this));

		}, progressResult => {
			console.log("unexpected progress result!"); // not implemented yet..
		});
	}
}

export class VoyageTools extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			showDetails: false
		};
	}

	render() {
		return (
			<div className='tab-panel' data-is-scrollable='true'>
				<VoyageCrew />
			</div>
		);
	}
}


// TODO: This stuff should move out into a separate file (it's for the JavaScript-based voyage algorithm)

const calculateBestVoyage = (data) => {
	let crewState = {
		bestCrew: [ ],
		bestCrewTime: 0,
		// Array to be filled with states where there are multiple options for placing crew
		decisionPoints: [ ]
	};
	let bestCrewTime = 0, bestCrew = [];
	for (let i = 0; i < 12; i++) {
		// Fill empty slots for crew
		crewState.bestCrew.push({ traits: [] });
	}
	let tries = 0;
	do {
		crewState = calcVoyage(data, crewState);
		if (crewState.bestCrewTime > bestCrewTime) {
			bestCrewTime = crewState.bestCrewTime;
			bestCrew = crewState.bestCrew;
		}
		tries++;
	} while (crewState.decisionPoints.length > 0 && tries < 1000000)
	console.log(crewState);
	console.log(tries);
	return { bestCrewTime, bestCrew };
};

const calcVoyage = (data, state) => {
	if (state.decisionPoints.length > 0) {
		const nextPoint = state.decisionPoints[0];
		if (nextPoint.slots.length > 0) {
			state = nextPoint.state;
			state.bestCrew[nextPoint.slots[0]] = nextPoint.newCrew;
			nextPoint.slots.shift();
		} else {
			state.decisionPoints.shift();
			return state;
		}
	}
	let nextState = Object.assign({}, state);
	do {
		nextState = placeCrew(nextState, data);
	} while(isEmptySlot(nextState.bestCrew))
	return nextState;
};

const placeCrew = (state, { crew, shipAM, voyage_crew_slots, voyage_skills }) => {
	let bestTime = 0;
	let voyageCrew = [].concat(state.bestCrew);
	const { vCrew, slots, newCrew } = crew.reduce(({ vCrew, slots, newCrew }, c) => {
		const slotNums = findSlots(c, voyage_crew_slots, voyageCrew),
			slotNum = slotNums[0];
		if (slotNums.length > 0 && !alreadyVoyager(c, voyageCrew)) {
			// make a shallow copy of voyageCrew
			let tempCrew = [].concat(voyageCrew);
			tempCrew[slotNum] = c;
			const voyageTime = calculateTime({ crew: tempCrew, shipAM, voyage_crew_slots, voyage_skills });
			//console.log(voyageTime);
			if (voyageTime > bestTime) {
				bestTime = voyageTime;
				vCrew = tempCrew;
				slots = slotNums;
				newCrew = c;
				//console.log('Found better option:');
				//console.log(vCrew);
			}
		}
		return { vCrew, slots, newCrew };
	}, { vCrew: [].concat(voyageCrew), slots: [], newCrew: {} });
	//console.log(vCrew);
	if (slots.length > 1) {
		// Copy current crew & decision points to new arrays
		const dpState = {
			bestCrew: [].concat(state.bestCrew),
			bestTime: state.bestTime,
			decisionPoints: [].concat(state.decisionPoints)
		};
		// If there are more than one availble spots, add new decision point
		state.decisionPoints.unshift({ state: dpState, newCrew, slots: slots.slice(1) });
	}
	return { bestCrew: vCrew, bestCrewTime: bestTime, decisionPoints: state.decisionPoints };
};

const alreadyVoyager = (crew, voyageCrew) => {
	return voyageCrew.findIndex((c) => {
		return c.id === crew.id;
	}) > -1;
};

const findSlots = (crew, voyage_crew_slots, voyageCrew) => {
	let slotNumbers = [];
	for (let i = 0; i < voyage_crew_slots.length; i++) {
		if (!voyageCrew[i].id && crew[voyage_crew_slots[i].skill].core > 0) {
			slotNumbers.push(i);
		}
	}
	return slotNumbers;
};

const isEmptySlot = (voyageCrew) => {
	for (var i = 0; i < voyageCrew.length; i++) {
		if (!voyageCrew[i].id) {
			return true;
		}
	}
	return false;
};

const skillScore = (skill) => {
	let score = 0
	if (skill) {
		score = skill.core + (skill.min + skill.max) / 2;
	}
	return score;
}

const calculateTime = ({ crew, shipAM, voyage_crew_slots, voyage_skills }) => {
	
	const skillNames = [
		'command_skill',
		'diplomacy_skill',
		'security_skill',
		'engineering_skill',
		'science_skill',
		'medicine_skill'
	];
	// variables
	var ticksPerCycle = 28
	var secondsPerTick = 20
	var cycleSeconds = ticksPerCycle*secondsPerTick
	var cyclesPerHour = 60*60/cycleSeconds
	var hazPerCycle = 6
	var activityPerCycle = 18
	var dilemmasPerHour = 0.5
	var hazPerHour = hazPerCycle*cyclesPerHour-dilemmasPerHour
	var hazSkillPerHour = 1250
	var hazAmPass = 5
	var hazAmFail = 30
	var activityAmPerHour = activityPerCycle*cyclesPerHour
	var minPerHour = 60
	var psChance = 0.35
	var ssChance = 0.25
	var osChance = 0.1
	var skillChances = [psChance,ssChance,osChance,osChance,osChance,osChance]
	var dilPerMin = 5
	

	const crewTotalsAndProfs = crew.reduce((total, c) => {
		for (let i = 0; i < skillNames.length; i++) {
			const skillName = skillNames[i];
			total.totalSkills[skillName] = total.totalSkills[skillName] + skillScore(c[skillName]) || skillScore(c[skillName]);
			const profRange = c[skillName] ? Math.max(c[skillName].max,c[skillName].min) - c[skillName].min : 0;
			total.totalProfs[skillName] = total.totalProfs[skillName] + profRange || profRange;
		}
		return total;
	}, { totalSkills: {}, totalProfs: {}}),
		crewTotals = crewTotalsAndProfs.totalSkills,
		totalProfRange = crewTotalsAndProfs.totalProfs;
	let skillVariances = {};
	// Calculate variance for all skills
	for (var i = 0; i < skillNames.length; i++) {
		let skillName = skillNames[i];
		skillVariances[skillName] = 0;
		if (crewTotals[skillName] > 0) {
			skillVariances[skillName] = totalProfRange[skillName] / 2 / crewTotals[skillName];
		}
	}
	var ps = crewTotals[voyage_skills.primary_skill] || 0;
	var ss = crewTotals[voyage_skills.secondary_skill] || 0;
	var psv = skillVariances[voyage_skills.primary_skill] || 0;
	var ssv = skillVariances[voyage_skills.secondary_skill] || 0;
	// Remove the primary & secondary skills to add the rest to skills array
	skillNames.splice(skillNames.indexOf(voyage_skills.primary_skill), 1);
	skillNames.splice(skillNames.indexOf(voyage_skills.secondary_skill), 1);
	var skills = [ps,ss];
	let hazSkillVariances = [psv, ssv];
	for (var i = 0; i < skillNames.length; i++) {
		skills.push(crewTotals[skillNames[i]] || 0);
		hazSkillVariances.push(skillVariances[skillNames[i]] || 0);
	}

	const crewAM = crew.reduce((totalBonus, c, ind) => {
		if (c.traits.indexOf(voyage_crew_slots[ind].trait) > -1) {
			totalBonus = totalBonus + 25;
		}
		return totalBonus;
	}, 0);
	
	var startAM = shipAM + crewAM
	// Keeping this variable, not sure if it's necessary
	var currentAM = startAM
	// Keeping this as well, setting to 0 since assuming working from start
	var elapsedHours = 0
	
	var ship = currentAM
	
	var elapsedHazSkill = elapsedHours*hazSkillPerHour
	
	var maxSkill = Math.max(...skills)
	maxSkill = Math.max(0, maxSkill - elapsedHazSkill)
	var endVoySkill = maxSkill*(1+hazSkillVariances[0])
	

	var tries = 0
	while (1>0) {
		tries++
		if (tries == 100) {
			setWarning(0,"Something went wrong! Check your inputs.")
			break
		}

		//test.text += Math.floor(endVoySkill) + " "
		var am = ship;
		for (i = 0; i < skills.length; i++) {
			var skill = skills[i];
			const hazSkillVariance = hazSkillVariances[i];
			skill = Math.max(0, skill-elapsedHazSkill)
			var chance = skillChances[i]

			// skill amount for 100% pass
			var passSkill = Math.min(endVoySkill,skill*(1-hazSkillVariance))

			// skill amount for RNG pass
			// (compute passing proportion of triangular RNG area - integral of x)
			var skillRngRange = skill*hazSkillVariance*2
			var lostRngProportion = 0
			if (skillRngRange > 0) { // avoid division by 0
				lostRngProportion = Math.max(0, Math.min(1, (skill*(1+hazSkillVariance) - endVoySkill) / skillRngRange))
			}
			var skillPassRngProportion = 1 - lostRngProportion*lostRngProportion
			passSkill += skillRngRange*skillPassRngProportion/2

			//passSkill = Math.max(0, passSkill - elapsedHazSkill)
			
			//test.text += "+" + Math.floor(100*lostRngProportion)/100 + " "

			// am gained for passing hazards
			am += passSkill * chance / hazSkillPerHour * hazPerHour * hazAmPass

			// skill amount for 100% hazard fail
			var failSkill = Math.max(0, endVoySkill-skill*(1+hazSkillVariance))
			// skill amount for RNG fail
			var skillFailRngProportion = Math.pow(1-lostRngProportion, 2)
			failSkill += skillRngRange*skillFailRngProportion/2
			
			//test.text += "-" + Math.floor(100*skillFailRngProportion)/100 + " "

			// am lost for failing hazards
			am -= failSkill * chance / hazSkillPerHour * hazPerHour * hazAmFail
		}

		//test.text += Math.floor(am) + " "

		var amLeft = am - endVoySkill/hazSkillPerHour*activityAmPerHour
		var timeLeft = amLeft / (hazPerHour*hazAmFail + activityAmPerHour)

		var voyTime = endVoySkill/hazSkillPerHour + timeLeft + elapsedHours

		if (Math.abs(timeLeft) > 0.0001) {
			endVoySkill = (voyTime-elapsedHours)*hazSkillPerHour
			continue
		} else {
			break
		}
	}

	return voyTime;
	
  }
