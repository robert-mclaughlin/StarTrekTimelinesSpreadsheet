import React, { Component } from 'react';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { Slider } from 'office-ui-fabric-react/lib/Slider';

import { CrewList } from './CrewList.js';
import { CollapsibleSection } from './CollapsibleSection.js';

import STTApi from 'sttapi';
import { CONFIG, bestVoyageShip } from 'sttapi';

export class GuaranteedSuccess extends React.Component {
	render() {
		return (<CollapsibleSection title={this.props.title}>
			{STTApi.missionSuccess.map(function (recommendation) {
				if (recommendation.cadet != this.props.cadet) {
					return <span key={recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name} />;
				}

				if (recommendation.crew.length == 0) {
					return (<div key={recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}>
						<h3>{recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}</h3>
						<span style={{ color: 'red' }}>No crew can complete this challenge!</span><br />
						<span className='quest-mastery'>You need a crew with the <Image src={CONFIG.SPRITES['icon_' + recommendation.skill].url} height={18} /> {CONFIG.SKILLS[recommendation.skill]} skill of at least {recommendation.roll}
							{(recommendation.lockedTraits.length > 0) &&
								(<span>&nbsp;and one of these skills: {recommendation.lockedTraits.map(function (trait) { return (<span key={trait}>{STTApi.getTraitName(trait)}</span>); }.bind(this)).reduce((prev, curr) => [prev, ', ', curr])}
								</span>)}.</span>
					</div>);
				}

				if (recommendation.crew.filter(function (crew) { return crew.success > 99.9; }).length == 0) {
					return (<div key={recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}>
						<h3>{recommendation.mission.episode_title + ' - ' + recommendation.quest.name + ' - ' + recommendation.challenge.name}</h3>
						<span>Your best bet is {recommendation.crew[0].crew.name} with a {recommendation.crew[0].success.toFixed(2)}% success chance.</span><br />
						<span className='quest-mastery'>You need a crew with the <Image src={CONFIG.SPRITES['icon_' + recommendation.skill].url} height={18} /> {CONFIG.SKILLS[recommendation.skill]} skill of at least {recommendation.roll}
							{(recommendation.lockedTraits.length > 0) &&
								(<span>&nbsp;and one of these skills: {recommendation.lockedTraits.map(function (trait) { return (<span key={trait}>{STTApi.getTraitName(trait)}</span>); }.bind(this)).reduce((prev, curr) => [prev, ', ', curr])}
								</span>)}.</span>
					</div>);
				}
			}.bind(this))
			}</CollapsibleSection>);
	}
}

export class CrewDuplicates extends React.Component {
	constructor(props) {
		super(props);

		var uniq = STTApi.roster.map((crew) => { return { count: 1, crewId: crew.id }; })
			.reduce((a, b) => {
				a[b.crewId] = (a[b.crewId] || 0) + b.count;
				return a;
			}, {});

		var duplicateIds = Object.keys(uniq).filter((a) => uniq[a] > 1);

		this.state = {
			duplicates: STTApi.roster.filter(function (crew) { return duplicateIds.includes(crew.id.toString()); })
		};
	}

	render() {
		if (this.state.duplicates.length > 0) {
			return (<CollapsibleSection title={this.props.title}>
				<CrewList data={this.state.duplicates} grouped={false} sortColumn='name' overrideClassName='embedded-crew-grid' />
			</CollapsibleSection>);
		}
		else {
			return <span />;
		}
	}
}

export class MinimalComplement extends React.Component {
	constructor(props) {
		super(props);

		if (!STTApi.minimalComplement) {
			// The thread (worker) didn't finish loading yet
			this.state = {
				dataLoaded: false
			};
		}
		else {
			this.state = {
				dataLoaded: true,
				removableCrew: STTApi.roster.filter(function (crew) { return STTApi.minimalComplement.unneededCrew.includes(crew.id) && (crew.frozen == 0); }),
				unfreezeCrew: STTApi.roster.filter(function (crew) { return STTApi.minimalComplement.neededCrew.includes(crew.id) && (crew.frozen > 0); })
			};
		}
	}

	render() {
		if (this.state.dataLoaded) {
			return (<CollapsibleSection title={this.props.title}>
				<div>
					<p><b>Note:</b> These recommendations do not take into account the needs for gauntlets, shuttle adventures, voyages or any ship battle missions. They also don't account for quest paths, only considering the needs of individual nodes. Manually review each one before making decisions.</p>

					<h3>Crew which could be frozen or airlocked</h3>
					<CrewList data={this.state.removableCrew} grouped={false} overrideClassName='embedded-crew-grid' />
					<h3>Crew which needs to be unfrozen</h3>
					<CrewList data={this.state.unfreezeCrew} grouped={false} overrideClassName='embedded-crew-grid' />
				</div>
			</CollapsibleSection>);
		}
		else {
			return <p>Minimal crew calculation not done yet. Reload this tab in a bit.</p>
		}
	}
}

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
				selectedVoyageMethod: { key: 0, text: 'Thorough', val: true }
			};
		}

		this._exportVoyageData = this._exportVoyageData.bind(this);
		this._startVoyage = this._startVoyage.bind(this);
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
				crewSpans.push(<Persona
					key={entry.choice.name}
					imageUrl={entry.choice.iconUrl}
					primaryText={entry.choice.name}
					secondaryText={entry.slotName}
					tertiaryText={entry.score.toFixed(0)}
					size={PersonaSize.large}
					presence={entry.hasTrait ? PersonaPresence.online : PersonaPresence.away} />);
			});

			return (<div>
				<p>Crew</p>
				{(this.state.state === "inprogress") && (
					<Spinner size={SpinnerSize.small} label='Still calculating...' />
				)}
				<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
					{crewSpans}
				</div>
				<p>Estimated duration: <b>{this.state.estimatedDuration.toFixed(2)} hours</b></p>
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

		return (<CollapsibleSection title='Recommendations for next voyage'>
			<p><b>NOTE: </b>Algorithms are still a work in progress. Please provide feedback on your recommendations and voyage results!</p>
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' }}>
				<Dropdown
					style={{ minWidth: '150px' }}
					selectedKey={this.state.selectedVoyageMethod.key}
					onChanged={item => this.setState({ selectedVoyageMethod: item })}
					placeHolder='Select an optimization method'
					options={[ { key: 0, text: 'Thorough', val: true }, { key: 1, text: 'Fast', val: false } ]}
				/>
			</div>
			<p>Best ship(s)</p>
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
				{shipSpans}
			</div>
			{this.renderBestCrew()}
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' }}>
				<div style={{ display: this.state.selectedVoyageMethod.val ? 'inline-block' : 'none' }}>
					<SpinButton className='autoWidth' value={this.state.searchDepth} label={ 'Search depth:' } min={ 2 } max={ 30 } step={ 1 }
						onIncrement={(value) => { this.setState({ searchDepth: +value + 1}); }}
						onDecrement={(value) => { this.setState({ searchDepth: +value - 1}); }}
					/>
				</div>
				<div style={{ display: this.state.selectedVoyageMethod.val ? 'inline-block' : 'none' }}>
					<Slider label='Extends (target):' min={ 0 } max={ 10 } step={ 1 } defaultValue={ 0 } showValue={ true }
						onChange={ (value) => this.setState({extendsTarget: value}) }
					/>
				</div>
				<Checkbox checked={this.state.includeFrozen} label="Include frozen?"
					onChange={(e, isChecked) => { this.setState({ includeFrozen: isChecked }); }}
				/>
				<Checkbox checked={this.state.includeActive} label="Include active on shuttles?"
					onChange={(e, isChecked) => { this.setState({ includeActive: isChecked }); }}
				/>
				<PrimaryButton onClick={this._exportVoyageData} text='Calculate best crew selection' disabled={this.state.state === 'inprogress'} />
				<PrimaryButton onClick={this._startVoyage} text='Start voyage with selection' disabled={this.state.state !== 'done'} />
			</div>
		</CollapsibleSection>);
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
		// See which crew is needed in the event to give the user a chance to remove them from consideration
		if (STTApi.playerData.character.events && STTApi.playerData.character.events.length > 0) {
			let activeEvent = STTApi.playerData.character.events[0];
			console.log(activeEvent.name);
			if (activeEvent.content && activeEvent.content.crew_bonuses) {
				let eventCrew = [];
				for (var symbol in activeEvent.content.crew_bonuses) {
					let foundCrew = STTApi.roster.find((crew) => crew.symbol === symbol);
					if (foundCrew) {
						eventCrew.push(foundCrew);
					}
				}
				console.log(eventCrew);
			}
		}

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
}

export class CrewRecommendations extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			showDetails: false
		};
	}

	render() {
		return (
			<div className='tab-panel' data-is-scrollable='true'>
				<GuaranteedSuccess title='Cadet challenges without guaranteed success' cadet={true} />
				<GuaranteedSuccess title='Missions without guaranteed success' cadet={false} />
				<CrewDuplicates title='Crew duplicates' />
				<MinimalComplement title='Minimal crew complement needed for cadet challenges' />
				<VoyageCrew />
			</div>
		);
	}
}

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
