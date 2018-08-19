import React from 'react';
import { Image } from 'office-ui-fabric-react/lib/Image';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';

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

		this.state = {
			duplicates: this._loadDuplicates(),
			selectedIds: undefined
		};

		this._loadDuplicates = this._loadDuplicates.bind(this);
		this._onSelectionChange = this._onSelectionChange.bind(this);
		this._dismissDupes = this._dismissDupes.bind(this);
	}

	_loadDuplicates() {
		let uniq = STTApi.roster.filter((crew) => !crew.buyback)
			.map((crew) => { return { count: 1, crewId: crew.id }; })
			.reduce((a, b) => {
				a[b.crewId] = (a[b.crewId] || 0) + b.count;
				return a;
			}, {});

		let duplicateIds = Object.keys(uniq).filter((a) => uniq[a] > 1);

		return STTApi.roster.filter((crew) => duplicateIds.includes(crew.id.toString()));
	}

	_onSelectionChange(selectedIds) {
		this.setState({selectedIds});
	}

	_dismissDupes() {
		//TODO: add "are you sure" dialog

		let promises = [];
		this.state.selectedIds.forEach(id => {
			promises.push(STTApi.sellCrew(id));
		});

		Promise.all(promises).then(() => STTApi.refreshRoster()).then(() => {
			this.setState({
				duplicates: this._loadDuplicates(),
				selectedIds: undefined
			});
		});
	}

	render() {
		if (this.state.duplicates.length > 0) {
			return (<CollapsibleSection title={this.props.title}>
				{(this.state.selectedIds && (this.state.selectedIds.size > 0)) && <div>
					<PrimaryButton onClick={() => this._dismissDupes()} text={`Dismiss ${this.state.selectedIds.size} dupes`} />
					<p><span style={{ color: 'red', fontWeight: 'bold' }}>NOTE </span>Use extreme care with this dismissal function. There is no confirmation dialog. Make sure you select only crew you want gone!</p>
					</div>}
				<CrewList data={this.state.duplicates} duplicatelist={true} sortColumn='name' selectedIds={this.state.selectedIds} onSelectionChange={this._onSelectionChange} overrideClassName='embedded-crew-grid' />
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

		this.state = {
			neededEquipment: [],
			cadetableItems: undefined,
			filters: {
				onlyFavorite: false,
				onlyNeeded: false,
				onlyFaction: false,
				cadetable: false
			}
		};
	}

	_getFilteredCrew(filters) {
		// filter out `crew.buyback` by default
		const crew = STTApi.roster.filter(({buyback}) => buyback === false);

		// ideally we would iterate thru all filters - for now, maunally looking for onlyFavorite
		const filteredCrew = [].concat((! filters.onlyFavorite) ? crew : crew.filter(({favorite}) => favorite === filters.onlyFavorite));

		return filteredCrew;
	}

	_getCadetableItems(){
		if(this.state.cadetableItems == undefined){
			const cadetableItems = new Map();		
			//Advanced Cadet Challenges offer the same rewards as Standard ones, so filter them to avoid duplicates
			let cadetMissions = STTApi.missions.filter(mission => mission.quests.filter(quest => quest.cadet).length > 0).filter(mission => mission.episode_title.indexOf("Adv") === -1);
			cadetMissions.forEach(cadetMission => {			
				cadetMission.quests.forEach(quest => {
					quest.mastery_levels.forEach(masteryLevel => {
						masteryLevel.rewards.filter(r => r.type === 0).forEach(reward => {
							reward.potential_rewards.forEach(item => {
								let info = {
									name: quest.name + " (" + cadetMission.episode_title + ")",
									mastery: masteryLevel.id
								};
								
								if(cadetableItems.has(item.id)){
									cadetableItems.get(item.id).push(info);
								} else {
									cadetableItems.set(item.id,[info]);
								}
							})					
						})									
					})				
				})
			});	
			this.state.cadetableItems = cadetableItems;	
		}
		return this.state.cadetableItems;
	}

	_getNeededEquipment(filteredCrew, filters) {
		let unparsedEquipment = [];
		let cadetableItems = this._getCadetableItems();
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
			} else if (equipment.item_sources && (equipment.item_sources.length > 0) || cadetableItems.has(equipment.id)) {
				let found = mapUnowned[eq.archetype];
				if (found) {
					found.needed += eq.need;
				} else {					
					let have = STTApi.playerData.character.items.find(item => item.archetype_id === eq.archetype);
					let isDisputeMissionObtainable = equipment.item_sources.filter(e => e.type === 0).length > 0;
					let isShipBattleObtainable = equipment.item_sources.filter(e => e.type === 2).length > 0;
					let isFactionObtainable = equipment.item_sources.filter(e => e.type === 1).length > 0;
					let isCadetable = cadetableItems.has(equipment.id);				
										
					mapUnowned[eq.archetype] = { 
						equipment, 
						needed: eq.need, 
						have: have ? have.quantity : 0, 
						isDisputeMissionObtainable: isDisputeMissionObtainable,  
						isShipBattleObtainable: isShipBattleObtainable,
						isFactionObtainable: isFactionObtainable,
						isCadetable: isCadetable
					};
				}
			} else {
				console.error(`This equipment has no recipe and no sources: '${equipment.name}'`);
			}
		}

		// Sort the map by "needed" descending
		let arr = Object.values(mapUnowned);
		arr.sort((a, b) => b.needed - a.needed);

		if (filters.onlyNeeded) {
			arr = arr.filter((entry) => entry.have < entry.needed);
		}

		if (filters.onlyFaction) {
			arr = arr.filter((entry) => !entry.isDisputeMissionObtainable && !entry.isShipBattleObtainable && entry.isFactionObtainable);
		}

		if (filters.cadetable) {
			arr = arr.filter((entry) => entry.isCadetable);
		}

		return arr;
	}

	_filterNeededEquipment(filters) {
		const filteredCrew = this._getFilteredCrew(filters);
		const neededEquipment = this._getNeededEquipment(filteredCrew, filters);

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

		return this._filterNeededEquipment(newFilters);
	}

	_toggleOnlyNeeded(isChecked) {
		const newFilters = Object.assign({}, this.state.filters);
		newFilters.onlyNeeded = isChecked;
		this.setState({
			filters: newFilters
		});

		return this._filterNeededEquipment(newFilters);
	}

	_toggleOnlyFaction(isChecked) {
		const newFilters = Object.assign({}, this.state.filters);
		newFilters.onlyFaction = isChecked;
		this.setState({
			filters: newFilters
		});

		return this._filterNeededEquipment(newFilters);
	}

	_toggleCadetable(isChecked) {
		const newFilters = Object.assign({}, this.state.filters);
		newFilters.cadetable = isChecked;
		this.setState({
			filters: newFilters
		});

		return this._filterNeededEquipment(newFilters);
	}

	componentDidMount() {
		return this._filterNeededEquipment(this.state.filters);
	}

	renderSources(equipment) {
		let disputeMissions = equipment.item_sources.filter(e => e.type === 0);
		let shipBattles = equipment.item_sources.filter(e => e.type === 2);
		let factions = equipment.item_sources.filter(e => e.type === 1);
		let cadetableItems = this._getCadetableItems();

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

		if(cadetableItems.has(equipment.id)){
			res.push(<div key={'cadet'}>
				<b>Cadet missions: </b>
				{cadetableItems.get(equipment.id).map((entry, idx) =>
					<span key={idx}>{entry.name} <span style={{ display: 'inline-block' }}><Image src={CONFIG.MASTERY_LEVELS[entry.mastery].url()} height={16} /></span></span>
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
		if (this.state.neededEquipment) {
			return (<CollapsibleSection title={this.props.title}>
				<p>Equipment required to fill all open slots for all crew currently in your roster.</p>
				<Checkbox label='Show only for favorite crew' checked={this.state.filters.onlyFavorite}
					onChange={(e, isChecked) => { this._toggleOnlyFavorite(isChecked); }}
				/>
				<Checkbox label='Show only insufficient equipment' checked={this.state.filters.onlyNeeded}
					onChange={(e, isChecked) => { this._toggleOnlyNeeded(isChecked); }}
				/>
				<Checkbox label='Show items obtainable through faction missions only' checked={this.state.filters.onlyFaction}
					onChange={(e, isChecked) => { this._toggleOnlyFaction(isChecked); }}
				/>
				<Checkbox label='Show items obtainable through cadet missions only' checked={this.state.filters.cadetable}
					onChange={(e, isChecked) => { this._toggleCadetable(isChecked); }}
				/>
				<br />
				<PrimaryButton onClick={() => this._exportCSV()} text='Export as CSV...' /><br /><br />
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