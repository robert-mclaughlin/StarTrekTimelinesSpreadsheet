import React from 'react';
import { Image } from 'office-ui-fabric-react/lib/Image';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';

import { CrewList } from './CrewList.js';
import { CollapsibleSection } from './CollapsibleSection.js';
import { ItemDisplay } from './ItemDisplay';

import STTApi from 'sttapi';
import { CONFIG } from 'sttapi';

import { download } from '../utils/pal';

import { parse as json2csv } from 'json2csv';

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
				removableCrew: STTApi.roster.filter((crew) => STTApi.minimalComplement.unneededCrew.includes(crew.id) && (crew.frozen === 0)),
				unfreezeCrew: STTApi.roster.filter((crew) => STTApi.minimalComplement.neededCrew.includes(crew.id) && (crew.frozen > 0))
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

export class NeededEquipment extends React.Component {
	constructor(props) {
		super(props);

		 // filter out `crew.buyback` by default
		const crew = STTApi.roster.filter(({buyback}) => buyback === false);

		this.state = {
			crew: crew,
			neededEquipment: [],
			filters: {
				onlyFavorite: false
			}
		};
	}

	_getFilteredCrew(filters) {
		const { crew } = this.state;

		// ideally we would iterate thru all filters - for now, maunally looking for onlyFavorite
		const filteredCrew = [].concat((! filters.onlyFavorite) ? crew : crew.filter(({favorite}) => favorite === filters.onlyFavorite));

		return filteredCrew;
	}

	_getNeededEquipment(filteredCrew) {
		let unparsedEquipment = [];
		for (let crew of filteredCrew) {

			crew.equipment_slots.forEach((equipment) => {
				if (!equipment.have) {
					unparsedEquipment.push({ archetype: equipment.archetype, need: 1 });
				}
			});
		}

		let mapUnowned = {};
		while (unparsedEquipment.length > 0) {
			let eq = unparsedEquipment.pop();
			let equipment = STTApi.itemArchetypeCache.archetypes.find(e => e.id === eq.archetype);

			if (equipment.recipe && equipment.recipe.demands && (equipment.recipe.demands.length > 0)) {
				// Let's add all children in the recipe, so that we can parse them on the next loop iteration
				equipment.recipe.demands.forEach((item) => unparsedEquipment.push({ archetype: item.archetype_id, need: item.count * eq.need }));
			} else if (equipment.item_sources && (equipment.item_sources.length > 0)) {
				let found = mapUnowned[eq.archetype];
				if (found) {
					found.needed += eq.need;
				} else {
					let have = STTApi.playerData.character.items.find(item => item.archetype_id === eq.archetype);
					mapUnowned[eq.archetype] = { equipment, needed: eq.need, have: have ? have.quantity : 0 };
				}
			} else {
				console.error(`This equipment has no recipe and no sources: '${equipment.name}'`);
			}
		}

		// Sort the map by "needed" descending
		let arr = Object.values(mapUnowned);
		arr.sort((a, b) => b.needed - a.needed);

		return arr;
	}

	_renderNeededEquipment(filters) {
		const filteredCrew = this._getFilteredCrew(filters);
		const neededEquipment = this._getNeededEquipment(filteredCrew);

		return this.setState({
			neededEquipment: neededEquipment
		});
	}

	_toggleOnlyFavorite(isChecked) {
		const newFilters = Object.assign({}, this.state.filters);
		newFilters.onlyFavorite = isChecked;
		this.setState({
			filters: newFilters
		});

		return this._renderNeededEquipment(newFilters);
	}

	componentDidMount() {
		return this._renderNeededEquipment(this.state.filters);
	}

	renderSources(equipment) {
		let disputeMissions = equipment.item_sources.filter(e => e.type === 0);
		let shipBattles = equipment.item_sources.filter(e => e.type === 2);
		let factions = equipment.item_sources.filter(e => e.type === 1);

		let res = [];

		if (disputeMissions.length > 0) {
			res.push(<div key={'disputeMissions'}>
				<b>Missions: </b>
				{disputeMissions.map((entry, idx) =>
					<span key={idx}>{entry.name} <span style={{ display: 'inline-block' }}><Image src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={16} /></span> ({entry.chance_grade}/5, {(entry.energy_quotient * 100).toFixed(2)}%)</span>
				).reduce((prev, curr) => [prev, ', ', curr])}
			</div>)
		}

		if (shipBattles.length > 0) {
			res.push(<div key={'shipBattles'}>
				<b>Ship battles: </b>
				{shipBattles.map((entry, idx) =>
					<span key={idx}>{entry.name} <span style={{ display: 'inline-block' }}><Image src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={16} /></span> ({entry.chance_grade}/5, {(entry.energy_quotient * 100).toFixed(2)}%)</span>
				).reduce((prev, curr) => [prev, ', ', curr])}
			</div>)
		}

		if (factions.length > 0) {
			res.push(<p key={'factions'}>
				<b>Faction missions: </b>
				{factions.map((entry, idx) =>
					`${entry.name} (${entry.chance_grade}/5, ${(entry.energy_quotient * 100).toFixed(2)}%)`
				).join(', ')}
			</p>)
		}

		return <div>{res}</div>;
	}

	render() {
		const spinner = "";
			// (this.state.dataLoaded) ? (<Spinner size={SpinnerSize.large} label='Loading data...' />) : ""; // todo: Loading
		if (this.state.neededEquipment) {
			return (<CollapsibleSection title={this.props.title}>
				<p>Equipment required to fill all open slots for all crew currently in your roster.</p>
				<Checkbox label='Show only crew that are marked as favorite' checked={this.state.filters.onlyFavorite}
					onChange={(e, isChecked) => { this._toggleOnlyFavorite(isChecked); }}
				/><br />
				<PrimaryButton onClick={() => this._exportCSV()} text='Export as CSV...' /><br /><br />
				{spinner}
				{this.state.neededEquipment.map((entry, idx) =>
					<div key={idx} style={{ display: 'grid', gridTemplateColumns: '128px auto', gridTemplateAreas: `'icon name' 'icon details'` }}>
						<div style={{ gridArea: 'icon' }}><ItemDisplay src={entry.equipment.iconUrl} size={128} maxRarity={entry.equipment.rarity} rarity={entry.equipment.rarity} /></div>
						<h4 style={{ gridArea: 'name', alignSelf: 'start', margin: '0' }}>{`${entry.equipment.name} (need ${entry.needed}, have ${entry.have})`}</h4>
						<div style={{ gridArea: 'details', alignSelf: 'start' }}>
							{this.renderSources(entry.equipment)}
						</div>
					</div>
				)}
			</CollapsibleSection>);
		}
		else {
			return <span />;
		}
	}

	_exportCSV() {
		let fields = ['equipment.name', 'equipment.rarity', 'needed', 'have',
			{
				label: 'Missions',
				value: (row) => row.equipment.item_sources.filter(e => e.type === 0).map((mission) => `${mission.name} (${CONFIG.MASTERY_LEVELS[mission.mastery].name} ${mission.chance_grade}/5, ${(mission.energy_quotient * 100).toFixed(2)}%)`).join(', ')
			},
			{
				label: 'Ship battles',
				value: (row) => row.equipment.item_sources.filter(e => e.type === 2).map((mission) => `${mission.name} (${CONFIG.MASTERY_LEVELS[mission.mastery].name} ${mission.chance_grade}/5, ${(mission.energy_quotient * 100).toFixed(2)}%)`).join(', ')
			},
			{
				label: 'Faction missions',
				value: (row) => row.equipment.item_sources.filter(e => e.type === 1).map((mission) => `${mission.name} (${mission.chance_grade}/5, ${(mission.energy_quotient * 100).toFixed(2)}%)`).join(', ')
			}];

		let csv = json2csv(this.state.neededEquipment, { fields });

		let today = new Date();
		download('Equipment-' + (today.getUTCMonth() + 1) + '-' + (today.getUTCDate()) + '.csv', csv, 'Export needed equipment', 'Export');
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
				<NeededEquipment title='Needed equipment' />
			</div>
		);
	}
}