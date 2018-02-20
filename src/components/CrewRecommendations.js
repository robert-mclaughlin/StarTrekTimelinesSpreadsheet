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
				iconUrl: crew.iconUrl
			})),
			voyage_skills: STTApi.playerData.character.voyage_descriptions[0].skills,
			voyage_crew_slots: STTApi.playerData.character.voyage_descriptions[0].crew_slots,
			search_depth: this.state.searchDepth,
			shipAM: this.state.bestShips[0].score,
			// These values should be user-configurable to give folks a chance to tune the scoring function and provide feedback
			skillPrimaryMultiplier: 3.5,
			skillSecondaryMultiplier: 2.5,
			skillMatchingMultiplier: 1.1,
			traitScoreBoost: 200
		}

		//require('fs').writeFile('voyageRecommendations.json', JSON.stringify(dataToExport), function (err) {});
		const NativeExtension = require('electron').remote.require('native');

		function parseResults(result, state) {
			let parsedResult = JSON.parse(result);
			let entries = [];
			for (var slotName in parsedResult.selection) {
				let entry = {
					hasTrait: false,
					slotName: slotName,
					score: 0,
					choice: STTApi.roster.find((crew) => (crew.id == parsedResult.selection[slotName]))
				};

				entries.push(entry);
			}
			return {
				crewSelection: entries,
				estimatedDuration: parsedResult.score,
				state: state};
		}

		NativeExtension.calculateVoyageRecommendations(JSON.stringify(dataToExport), result => {
			this.setState(parseResults(result, 'done'));
		}, progressResult => {
			this.setState(parseResults(progressResult, 'inprogress'));
		});
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