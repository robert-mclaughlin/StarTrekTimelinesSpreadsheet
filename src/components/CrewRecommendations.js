import React, { Component } from 'react';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton';

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
				searchDepth: 6,
				state: 'calculating'
			};
		}

		this._exportVoyageData = this._exportVoyageData.bind(this);
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
			<p><b>NOTE: </b>This algorithm is poor and a work in progress. Please only use these as rough guidelines.</p>
			<p>Best ship(s)</p>
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
				{shipSpans}
			</div>
			{this.renderBestCrew()}
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' }}>
				<SpinButton className='autoWidth' value={this.state.searchDepth} label={ 'Search depth:' } min={ 2 } max={ 30 } step={ 1 }
					onIncrement={(value) => { this.setState({ searchDepth: +value + 1}); }}
					onDecrement={(value) => { this.setState({ searchDepth: +value - 1}); }}
				/>
				<PrimaryButton onClick={this._exportVoyageData} text='Calculate best crew selection' />
			</div>
		</CollapsibleSection>);
	}

	_exportVoyageData() {
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
			shipAM: this.state.bestShips[0].score,
			// These values should be user-configurable to give folks a chance to tune the scoring function and provide feedback
			skillPrimaryMultiplier: 3.5,
			skillSecondaryMultiplier: 2.5,
			skillMatchingMultiplier: 1.1,
			traitScoreBoost: 200,
			includeAwayCrew: false,
			includeFrozenCrew: false
		};

		//require('fs').writeFile('voyageRecommendations.json', JSON.stringify(dataToExport), function (err) {});
		//const NativeExtension = require('electron').remote.require('stt-native');

		function parseResults(result, state) {
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
			return {
				crewSelection: entries,
				estimatedDuration: result.bestCrewTime,
				state: state};
		}

		/*NativeExtension.calculateVoyageRecommendations(JSON.stringify(dataToExport), result => {
			this.setState(parseResults(result, 'done'));
		}, progressResult => {
			this.setState(parseResults(progressResult, 'inprogress'));
		});*/
		this.setState(parseResults(calculateBestVoyage(dataToExport), 'done'));
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
	let regSlotNumbers = [];
	let bonusSlotNumbers = []
	for (let i = 0; i < voyage_crew_slots.length; i++) {
		if (!voyageCrew[i].id && crew[voyage_crew_slots[i].skill].core > 0) {
			regSlotNumbers.push(i);
			if (crew.traits.indexOf(voyage_crew_slots[i].trait > -1)) {
				bonusSlotNumbers.push(i);
			}
		}
	}
	return bonusSlotNumbers.length > 0 ? bonusSlotNumbers : regSlotNumbers;
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
	var hazSkillVariance = 0.15 // overwritten from input
	var hazAmPass = 5
	var hazAmFail = 30
	var activityAmPerHour = activityPerCycle*cyclesPerHour
	var minPerHour = 60
	var psChance = 0.35
	var ssChance = 0.25
	var osChance = 0.1
	var skillChances = [psChance,ssChance,osChance,osChance,osChance,osChance]
	var dilPerMin = 5
	

	const crewTotals = crew.reduce((total, c) => {
		for (let i = 0; i < skillNames.length; i++) {
			total[skillNames[i]] = total[skillNames[i]] + skillScore(c[skillNames[i]]) || skillScore(c[skillNames[i]]);
		}
		return total;
	}, {});
	var ps = crewTotals[voyage_skills.primary_skill] || 0;
	var ss = crewTotals[voyage_skills.secondary_skill] || 0;
	// Remove the primary & secondary skills to add the rest to skills array
	skillNames.splice(skillNames.indexOf(voyage_skills.primary_skill), 1);
	skillNames.splice(skillNames.indexOf(voyage_skills.secondary_skill), 1);
	var skills = [ps,ss]
	for (var i = 0; i < skillNames.length; i++) {
		skills.push(crewTotals[skillNames[i]] || 0);
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
	var endVoySkill = maxSkill*(1+hazSkillVariance)
	

	var tries = 0
	while (1>0) {
		tries++
		if (tries == 100) {
			setWarning(0,"Something went wrong! Check your inputs.")
			break
		}

		//test.text += Math.floor(endVoySkill) + " "
		var am = ship;
		for (i = 0; i < 6; i++) {
			var skill = skills[i]
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
