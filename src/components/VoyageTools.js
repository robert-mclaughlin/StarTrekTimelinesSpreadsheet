import '../assets/css/semantic.min.css';

import React from 'react';
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { DefaultButton, PrimaryButton, CompoundButton } from 'office-ui-fabric-react/lib/Button';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { NormalPeoplePicker } from 'office-ui-fabric-react/lib/Pickers';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { TextField } from 'office-ui-fabric-react/lib/TextField';
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar';

import STTApi from 'sttapi';
import { CONFIG, bestVoyageShip, loadVoyage, startVoyage, resolveDilemma, recallVoyage, formatCrewStats, bonusCrewForCurrentEvent, formatTimeSeconds } from 'sttapi';
import { CollapsibleSection } from './CollapsibleSection';
import { RarityStars } from './RarityStars';
import ReactTable from "react-table";

import { download } from '../utils/pal';
import { calculateVoyage, estimateVoyageRemaining, exportVoyageData } from '../utils/voyageCalc';

export class VoyageCrew extends React.Component {
	constructor(props) {
		super(props);

		let bestVoyageShips = bestVoyageShip();
		this.state = {
			bestShips: bestVoyageShips,
			includeFrozen: false,
			includeActive: false,
			shipName: undefined,
			shipNameDefault: bestVoyageShips[0].ship.name,
			state: undefined,
			searchDepth: 6,
			extendsTarget: 0,
			activeEvent: undefined,
			peopleList: [],
			currentSelectedItems: [],
			preselectedIgnored: [],
			error: undefined,
			generatingVoyCrewRank: false
		};

		// See which crew is needed in the event to give the user a chance to remove them from consideration
		let result = bonusCrewForCurrentEvent();
		if (result) {
			this.state.activeEvent = result.eventName;
			this.state.preselectedIgnored = result.crewIds;
		}

		STTApi.roster.forEach(crew => {
			this.state.peopleList.push({
				key: crew.crew_id || crew.id,
				imageUrl: crew.iconUrl,
				text: crew.name,
				secondaryText: crew.short_name
			});
		});

		this.state.currentSelectedItems = this.state.peopleList.filter(p => this.state.preselectedIgnored.indexOf(p.key) != -1);

		this._calcVoyageData = this._calcVoyageData.bind(this);
		this._startVoyage = this._startVoyage.bind(this);
		this._onFilterChanged = this._onFilterChanged.bind(this);
		this._filterPersonasByText = this._filterPersonasByText.bind(this);
		this._onItemsChange = this._onItemsChange.bind(this);
	}

	getIndexBySlotName(slotName) {
		const crewSlots = STTApi.playerData.character.voyage_descriptions[0].crew_slots;
		for (let slotIndex = 0; slotIndex < crewSlots.length; slotIndex++) {
			if (crewSlots[slotIndex].name === slotName) {
				return slotIndex;
			}
		}
	}

	renderBestCrew() {
		if ((this.state.state === "inprogress") || (this.state.state === "done")) {
			let crewSpans = [];
			this.state.crewSelection.forEach(entry => {
				if (entry.choice) {
					let crew = <Persona
						key={entry.choice.crew_id || entry.choice.id}
						imageUrl={entry.choice.iconUrl}
						text={entry.choice.name}
						secondaryText={STTApi.playerData.character.voyage_descriptions[0].crew_slots[entry.slotId].name}
						tertiaryText={formatCrewStats(entry.choice)}
						size={PersonaSize.large}
						presence={(entry.choice.frozen > 0) ? PersonaPresence.dnd : ((entry.choice.active_id > 0) ? PersonaPresence.away : PersonaPresence.online)} />

					crewSpans[entry.slotId] = crew;
				} else {
					console.error(entry);
				}
			});

			return (<div>
				<h3>Best crew</h3>
				{(this.state.state === "inprogress") &&
					<div className="ui medium centered text active inline loader">Still calculating...</div>
				}
				<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
					{crewSpans}
				</div>
				<h3>Estimated duration: <b>{formatTimeSeconds(this.state.estimatedDuration * 60 * 60)}</b></h3>
				<br />
			</div>);
		} else {
			return <span />;
		}
	}

	render() {
		let shipSpans = [];
		this.state.bestShips.forEach(entry => {
			shipSpans.push(<Persona
				key={entry.ship.id}
				imageUrl={entry.ship.iconUrl}
				text={entry.ship.name}
				secondaryText={entry.score.toFixed(0)}
				size={PersonaSize.regular} />);
		});

		let containerStyle = {
			display: 'grid',
			padding: '5px',
			maxWidth: '900px',
			gridGap: '10px',
			gridTemplateColumns: '1fr 1fr 1fr',
			gridTemplateRows: 'auto auto 2fr',
			gridTemplateAreas: `
			"searchDepth extends calcbutton"
			"checkActive checkFrozen calcbutton"
			"crewexclude crewexclude crewexclude"`};

		return (<div>
			{this.state.error && <MessageBar messageBarType={MessageBarType.error}>Error: {this.state.error}</MessageBar>}
			<br />
			{/* #!if ENV !== 'electron' */}
			<h2 style={{ backgroundColor: 'Tomato' }}>NOTE: If the calculation crashes your browser, try reducing the search depth! And let me know by logging a bug.</h2>
			{/* #!endif */}

			<div style={containerStyle}>
				<div style={{ gridArea: 'searchDepth' }}>
					<SpinButton value={this.state.searchDepth} label={'Search depth:'} min={2} max={30} step={1}
						onIncrement={(value) => { this.setState({ searchDepth: +value + 1 }); }}
						onDecrement={(value) => { this.setState({ searchDepth: +value - 1 }); }}
					/>
				</div>

				<div style={{ gridArea: 'extends' }}>
					<SpinButton value={this.state.extendsTarget} label='Extends (target):' min={0} max={10} step={1}
						onIncrement={(value) => { this.setState({ extendsTarget: +value + 1 }); }}
						onDecrement={(value) => { this.setState({ extendsTarget: +value - 1 }); }}
					/>
				</div>

				<div style={{ gridArea: 'checkActive' }}>
					<Checkbox checked={this.state.includeActive} label="Include active (on shuttles) crew"
						onChange={(e, isChecked) => { this.setState({ includeActive: isChecked }); }}
					/>
				</div>
				<div style={{ gridArea: 'checkFrozen' }}>
					<Checkbox checked={this.state.includeFrozen} label="Include frozen (vaulted) crew"
						onChange={(e, isChecked) => { this.setState({ includeFrozen: isChecked }); }}
					/>
				</div>

				<div style={{ gridArea: 'crewexclude' }}>
					<p>Crew you don't want to consider for voyage
						{this.state.activeEvent && <span> (preselected crew which gives bonus in the event <b>{this.state.activeEvent}</b>)</span>}: </p>
					<PrimaryButton onClick={() => { this.setState({ currentSelectedItems: [] }); }} text='Clear' disabled={this.state.currentSelectedItems.length === 0} />
					<NormalPeoplePicker
						onResolveSuggestions={this._onFilterChanged}
						selectedItems={this.state.currentSelectedItems}
						onChange={this._onItemsChange}
					/>
				</div>

				<div style={{ gridArea: 'calcbutton', justifySelf: 'center', alignSelf: 'center' }}>
					<CompoundButton primary={true} onClick={this._calcVoyageData} secondaryText='Calculate best crew selection' disabled={this.state.state === 'inprogress'}>Calculate</CompoundButton>
				</div>
			</div>

			<h3>Best ship(s)</h3>
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
				{shipSpans}
			</div>

			{this.renderBestCrew()}

			<div style={{ display: 'grid', gridGap: '5px', width: 'fit-content', gridTemplateColumns: 'minmax(5em,min-content) max-content max-content' }}>
				<span style={{ justifySelf: 'center', alignSelf: 'center' }}>Ship Name</span>
				<TextField value={this.state.shipName} placeholder={this.state.shipNameDefault} onChanged={v => this.setState({ shipName: v })} />
				<PrimaryButton onClick={this._startVoyage} text='Start voyage with recommendations' disabled={this.state.state !== 'done'} />
			</div>

			<br />

			{/* #!if ENV === 'electron' */}
			<DefaultButton onClick={() => this._generateVoyCrewRank()} text='Export CSV with crew Voyage ranking...' disabled={this.state.state === 'inprogress'} />
			{this.state.generatingVoyCrewRank && <i className="spinner loading icon"></i>}
			{/* #!endif */}
		</div>);
	}

	_listContainsPersona(persona, personas) {
		if (!personas || !personas.length || personas.length === 0) {
			return false;
		}
		return personas.filter(item => item.text === persona.text).length > 0;
	}

	_removeDuplicates(personas, possibleDupes) {
		return personas.filter(persona => !this._listContainsPersona(persona, possibleDupes));
	}

	_filterPersonasByText(filterText) {
		return this.state.peopleList.filter(item => item.text.toLowerCase().indexOf(filterText.toLowerCase()) !== -1);
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
		for (let i = 0; i < STTApi.playerData.character.voyage_descriptions[0].crew_slots.length; i++) {
			let entry = this.state.crewSelection.find(entry => entry.slotId === i);

			if ((!entry.choice.crew_id) || entry.choice.active_id > 0) {
				this.setState({ error: `Cannot start voyage with frozen or active crew '${entry.choice.name}'` });
				return;
			}

			selectedCrewIds.push(entry.choice.crew_id);
		}

		// TODO: At this point we should refresh crew and make sure no-one's status changes (recently dismissed crew will cause weird bugs!)
		startVoyage(STTApi.playerData.character.voyage_descriptions[0].symbol, this.state.bestShips[0].ship.id, this.state.shipName, selectedCrewIds).then(() => {
			this.props.onRefreshNeeded();
		}).catch((err) => {
			this.setState({ error: err.message });
		});
	}

	_packVoyageOptions() {
		let filteredRoster = STTApi.roster.filter(crew => {
			// Filter out buy-back crew
			if (crew.buyback) {
				return false;
			}

			if (!this.state.includeActive && (crew.active_id > 0)) {
				return false;
			}

			if (!this.state.includeFrozen && (crew.frozen > 0)) {
				return false;
			}

			// Filter out crew the user has chosen not to include
			if ((this.state.currentSelectedItems.length > 0) && this.state.currentSelectedItems.some(ignored => (ignored.text === crew.name))) {
				return false;
			}

			return true;
		});

		return {
			searchDepth: this.state.searchDepth,
			extendsTarget: this.state.extendsTarget,
			shipAM: this.state.bestShips[0].score,
			skillPrimaryMultiplier: 3.5,
			skillSecondaryMultiplier: 2.5,
			skillMatchingMultiplier: 1.1,
			traitScoreBoost: 200,
			voyage_description: STTApi.playerData.character.voyage_descriptions[0],
			roster: filteredRoster
		};
	}

	_calcVoyageData() {
		let options = this._packVoyageOptions();

		calculateVoyage(options, (entries, score) => {
			this.setState({
				crewSelection: entries,
				estimatedDuration: score,
				state: 'inprogress'
			});
		},
			(entries, score) => {
				this.setState({
					crewSelection: entries,
					estimatedDuration: score,
					state: 'done'
				});
			});
	}

	// #!if ENV === 'electron'
	_generateVoyCrewRank() {
		this.setState({ generatingVoyCrewRank: true });

		let dataToExport = exportVoyageData(this._packVoyageOptions());

		const NativeExtension = require('electron').remote.require('stt-native');
		NativeExtension.calculateVoyageCrewRank(JSON.stringify(dataToExport), (rankResult, estimateResult) => {
			this.setState({ generatingVoyCrewRank: false });

			download('My Voyage Crew.csv', rankResult, 'Export Star Trek Timelines voyage crew ranking', 'Export');
			download('My Voyage Estimates.csv', estimateResult, 'Export Star Trek Timelines voyage estimates', 'Export');
		}, progressResult => {
			console.log("unexpected progress result!"); // not implemented yet..
		});
	}
	// #!endif
}

export class VoyageLogEntry extends React.Component {
	constructor(props) {
		super(props);

		this.props.log.forEach(entry => {
			// TODO: some log entries have 2 crew
			if (entry.crew) {
				let rc = STTApi.roster.find((rosterCrew) => rosterCrew.symbol == entry.crew[0]);
				if (rc) entry.crewIconUrl = rc.iconUrl;
			}
		});
	}

	render() {
		return (<ul>
			{this.props.log.map((entry, index) =>
				<li key={index}>
					<span className='quest-mastery'>
						{entry.skill_check && (
							<span className='quest-mastery'>
								<Image src={CONFIG.SPRITES['icon_' + entry.skill_check.skill].url} height={18} />
								{(entry.skill_check.passed == true) ? <Icon iconName='Like' /> : <Icon iconName='Dislike' />} &nbsp;
                            </span>
						)}
						{entry.crewIconUrl && (
							<Image src={entry.crewIconUrl} width={32} height={32} imageFit={ImageFit.contain} />
						)}
						<span dangerouslySetInnerHTML={{ __html: entry.text }} />
					</span>
				</li>
			)}
		</ul>);
	}
}

export class VoyageLog extends React.Component {
	constructor(props) {
		super(props);

		let _columns = [
			{
				id: 'icon',
				Header: '',
				minWidth: 30,
				maxWidth: 30,
				resizable: false,
				accessor: (row) => row.full_name,
				Cell: (p) => <Image src={p.original.iconUrl} width={25} height={25} imageFit={ImageFit.contain} shouldStartVisible={true} />
			},
			{
				id: 'quantity',
				Header: 'Quantity',
				minWidth: 50,
				maxWidth: 70,
				resizable: false,
				accessor: (row) => row.quantity
			},
			{
				id: 'name',
				Header: 'Name',
				minWidth: 150,
				maxWidth: 250,
				resizable: true,
				accessor: (row) => row.full_name,
				Cell: (p) => {
					let item = p.original;
					return (<a href={'https://stt.wiki/wiki/' + item.full_name.split(' ').join('_')} target='_blank'>{item.full_name}</a>);
				}
			},
			{
				id: 'rarity',
				Header: 'Rarity',
				accessor: (c) => {
					if (c.type > 2) {
						return -1;
					}
					return c.rarity;
				},
				minWidth: 75,
				maxWidth: 75,
				resizable: false,
				Cell: (p) => {
					let item = p.original;
					// 3 is for honor, credits, crons
					if (item.type > 2) {
						return <span />;
					}

					return <span key={item.id} style={{ color: item.rarity && CONFIG.RARITIES[item.rarity].color }}>
						<RarityStars
							min={1}
							max={item.rarity ? item.rarity : 1}
							value={item.rarity ? item.rarity : null}
						/>
					</span>;
				}
			},
			{
				id: 'type',
				Header: 'Type',
				minWidth: 100,
				resizable: true,
				accessor: (row) => {
					if (row.item_type) {
						return row.type + "." + row.item_type;
					}
					return row.type;
				},
				Cell: (p) => {
					let item = p.original;

					if (item.type === 1) {
						// For crew, check if it's useful or not
						let have = STTApi.roster.filter(crew => crew.symbol === item.symbol);
						if (have.length > 0) {
							if (!have.some(c => c.max_rarity === c.rarity)) {
								return <span style={{ fontWeight: 'bold' }}>NEW STAR FOR CREW!</span>;
							} else {
								return <span>Duplicate of immortalized crew (airlock-able)</span>;
							}
						} else {
							return <span style={{ fontWeight: 'bold' }}>NEW CREW!</span>;
						}
					}

					let typeName = CONFIG.REWARDS_ITEM_TYPE[item.item_type];
					if (typeName) {
						return typeName;
					}
					typeName = CONFIG.REWARDS_TYPE[item.type];
					if (typeName) {
						return typeName;
					}

					// fall-through case for items
					typeName = item.icon.file.replace("/items", "").split("/")[1];
					if (typeName) {
						return typeName;
					}

					// show something so we know to fix these
					if (item.item_type) {
						return item.type + "." + item.item_type;
					}
					return item.type;
				}
			},
		];

		this.state = {
			showSpinner: true,
			includeFlavor: false,
			rewardTableColumns: _columns,
			// By default, sort the voyage rewards table by type and rarity to show crew first
			sorted: [{ id: 'type', desc: false }, { id: 'rarity', desc: true }]
		};

		this.reloadVoyageState();
	}

	componentDidMount() {
		// Every 5 minutes refresh
		// TODO: this should be configurable
		const refreshInterval = 5 * 60;
		this.intervalLogRefresh = setInterval(() => this.reloadVoyageState(), refreshInterval * 1000);
	}

	componentWillUnmount() {
		clearInterval(this.intervalLogRefresh);
	}

	async reloadVoyageState() {
		let voyage = STTApi.playerData.character.voyage[0];
		if (voyage && voyage.id) {
			let voyageNarrative = await loadVoyage(voyage.id, false);

			//<Checkbox checked={this.state.includeFlavor} label="Include flavor entries" onChange={(e, isChecked) => { this.setState({ includeFlavor: isChecked }); }} />
			if (!this.state.includeFlavor) {
				// Remove the "flavor" entries (useless text)
				voyageNarrative = voyageNarrative.filter(e => e.encounter_type !== 'flavor');
			}

			// Group by index
			voyageNarrative = voyageNarrative.reduce(function (r, a) {
				r[a.index] = r[a.index] || [];
				r[a.index].push(a);
				return r;
			}, Object.create(null));

			let voyageRewards = voyage.pending_rewards.loot;
			let iconPromises = [];
			voyageRewards.forEach(reward => {
				reward.iconUrl = '';
				if (reward.icon.atlas_info) {
					// This is not fool-proof, but covers currently known sprites
					reward.iconUrl = CONFIG.SPRITES[reward.icon.file].url;
				} else {
					iconPromises.push(STTApi.imageProvider.getItemImageUrl(reward, reward).then((found) => {
						found.id.iconUrl = found.url;
					}).catch((error) => { /*console.warn(error);*/ }));
				}
			});

			await Promise.all(iconPromises);

			this.setState({
				showSpinner: false,
				ship_name: voyage.ship_name ? voyage.ship_name : (STTApi.ships.find((ship) => ship.id === voyage.ship_id).name),
				ship_id: voyage.ship_id,
				created_at: voyage.created_at,
				voyage_duration: voyage.voyage_duration,
				seconds_since_last_dilemma: voyage.seconds_since_last_dilemma,
				seconds_between_dilemmas: voyage.seconds_between_dilemmas,
				skill_aggregates: voyage.skill_aggregates,
				crew_slots: voyage.crew_slots,
				voyage: voyage,
				voyageNarrative: voyageNarrative,
				estimatedMinutesLeft: voyage.hp / 21,
				nativeEstimate: false,
				voyageRewards: voyageRewards
			});

			this._betterEstimate();
		}
	}

	renderVoyageState() {
		if (this.state.voyage.state === "recalled") {
			return <p>Voyage has lasted for {formatTimeSeconds(this.state.voyage_duration)} and it's currently returning ({formatTimeSeconds(this.state.voyage.recall_time_left)} left).</p>;
		} else if (this.state.voyage.state === "failed") {
			return <p>Voyage has run out of antimatter after {formatTimeSeconds(this.state.voyage_duration)} and it's waiting to be abandoned or replenished.</p>;
		} else {
			let minEstimate = (this.state.estimatedMinutesLeft * 0.75 - 1) * 60;
			let maxEstimate = this.state.estimatedMinutesLeft * 60;

			let chanceDilemma = 100 * ((this.state.seconds_between_dilemmas - this.state.seconds_since_last_dilemma) - minEstimate) / (maxEstimate - minEstimate);
			chanceDilemma = (100 - Math.min(Math.max(chanceDilemma, 0), 100)).toFixed();

			return <div>
				<p>Voyage has been ongoing for {formatTimeSeconds(this.state.voyage_duration)} (new dilemma in {formatTimeSeconds(this.state.seconds_between_dilemmas - this.state.seconds_since_last_dilemma)}).</p>

				<div className="ui blue label">Estimated time left: {formatTimeSeconds(this.state.estimatedMinutesLeft * 60)}
					{!this.state.nativeEstimate && <i className="spinner loading icon"></i>}
				</div>

				<div className="ui blue label">Estimated revival cost: {Math.floor((this.state.voyage.voyage_duration / 60 + this.state.estimatedMinutesLeft) / 5)} dilithium</div>

				<button className="ui mini button" onClick={() => this._recall()}><i className="icon undo"></i>Recall now</button>

				<p>There is an estimated {chanceDilemma}% chance for the voyage to reach next dilemma.</p>
			</div>;
		}
	}

	async _betterEstimate() {
		const assignedCrew = this.state.voyage.crew_slots.map(slot => slot.crew.id);
		const assignedRoster = STTApi.roster.filter(crew => assignedCrew.includes(crew.crew_id));

		let options = {
			// first three not needed for estimate calculation
			searchDepth: 0,
			extendsTarget: 0,
			shipAM: 0,
			skillPrimaryMultiplier: 3.5,
			skillSecondaryMultiplier: 2.5,
			skillMatchingMultiplier: 1.1,
			traitScoreBoost: 200,
			voyage_description: STTApi.playerData.character.voyage_descriptions[0],
			roster: assignedRoster,
			// Estimate-specific parameters
			voyage_duration: this.state.voyage.voyage_duration,
			remainingAntiMatter: this.state.voyage.hp,
			assignedCrew
		};

		estimateVoyageRemaining(options, (estimate) => this.setState({ estimatedMinutesLeft: estimate, nativeEstimate: true }))
	}

	async _recall() {
		await recallVoyage(STTApi.playerData.character.voyage[0].id);
		this.reloadVoyageState();
	}

	async _chooseDilemma(voyageId, dilemmaId, index) {
		// #!if ENV === 'electron'
		if (index < 0) {
			// TODO: this should pick a random index out of the unlocked resolutions
			let promises = [];
			for (let i = 0; i < 21; i++) {
				promises.push(resolveDilemma(voyageId, dilemmaId, i % (-1 * index)));
			}

			await Promise.all(promises).catch((error) => { /*console.warn(error);*/ });
		} else
		// #!endif
		{
			await resolveDilemma(voyageId, dilemmaId, index);
		}

		// Remove the dilemma that was just resolved
		STTApi.playerData.character.voyage[0].dilemma = null;

		this.reloadVoyageState();
	}

	renderDilemma() {
		if (this.state.voyage.dilemma && this.state.voyage.dilemma.id) {
			return <div>
				<h3 key={0} className="ui top attached header">Dilemma - <span dangerouslySetInnerHTML={{ __html: this.state.voyage.dilemma.title }} /></h3>,
            	<div key={1} className="ui center aligned inverted attached segment">
					<div><span dangerouslySetInnerHTML={{ __html: this.state.voyage.dilemma.intro }} /></div>
					<div className="ui middle aligned selection list inverted">
						{this.state.voyage.dilemma.resolutions.map((resolution, index) => {
							if (resolution.locked) {
								return <div className="item" key={index}>
									<div className="content">
										<div className="header">LOCKED - <span dangerouslySetInnerHTML={{ __html: resolution.option }} /></div>
									</div>
								</div>;
							} else {
								return (<div className="item" key={index} onClick={() => this._chooseDilemma(this.state.voyage.id, this.state.voyage.dilemma.id, index)}>
									<Image src={CONFIG.SPRITES['icon_' + resolution.skill].url} height={18} />
									<div className="content">
										<div className="header"><span dangerouslySetInnerHTML={{ __html: resolution.option }} /></div>
									</div>
								</div>);
							}
						})}

						<div className="item" key={-1} onClick={() => this._chooseDilemma(this.state.voyage.id, this.state.voyage.dilemma.id, -1 * this.state.voyage.dilemma.resolutions.length)}>
							<Image src={CONFIG.SPRITES['question_icon'].url} height={18} />
							<div className="content">
								<div className="header">Random choice!</div>
							</div>
						</div>
					</div>
				</div>
			</div>;
		} else {
			return <span />;
		}
	}

	render() {
		if (this.state.showSpinner) {
			return <div className="centeredVerticalAndHorizontal">
				<div className="ui massive centered text active inline loader">Loading voyage details...</div>
			</div>;
		}

		const defaultButton = props => <DefaultButton {...props} text={props.children} style={{ width: '100%' }} />;

		return (<div style={{ userSelect: 'initial' }}>
			<h3>Voyage on the {this.state.ship_name}</h3>
			{this.renderVoyageState()}
			{this.renderDilemma()}
			<p>Antimatter remaining: {this.state.voyage.hp} / {this.state.voyage.max_hp}.</p>
			<table style={{ borderSpacing: '0' }}>
				<tbody>
					<tr>
						<td>
							<section>
								<h4>Full crew complement and skill aggregates</h4>
								<ul>
									{this.state.crew_slots.map((slot) => {
										return (<li key={slot.symbol}><span className='quest-mastery'>
											{slot.name} &nbsp; <Image src={STTApi.roster.find((rosterCrew) => rosterCrew.id == slot.crew.archetype_id).iconUrl} width={20} height={20} imageFit={ImageFit.contain} /> &nbsp; {slot.crew.name}
										</span>
										</li>);
									})}
								</ul>
							</section>
						</td>
						<td>
							<ul>
								{Object.values(this.state.voyage.skill_aggregates).map((skill) => {
									return (<li key={skill.skill}>
										<span className='quest-mastery'>
											<Image src={CONFIG.SPRITES['icon_' + skill.skill].url} height={18} /> &nbsp; {skill.core} ({skill.range_min}-{skill.range_max})
                                        </span>
									</li>);
								})}
							</ul>
						</td>
					</tr>
				</tbody>
			</table>

			<h3>{'Pending rewards (' + this.state.voyageRewards.length + ')'}</h3>
			<div className='voyage-rewards-grid'>
				<ReactTable
					data={this.state.voyageRewards}
					columns={this.state.rewardTableColumns}
					sorted={this.state.sorted}
					onSortedChange={sorted => this.setState({ sorted })}
					className="-striped -highlight"
					defaultPageSize={10}
					pageSize={10}
					showPagination={(this.state.voyageRewards.length > 10)}
					showPageSizeOptions={false}
					NextComponent={defaultButton}
					PreviousComponent={defaultButton}
				/>
			</div>
			<br />
			<CollapsibleSection title={'Complete Captain\'s Log (' + Object.keys(this.state.voyageNarrative).length + ')'}>
				{Object.keys(this.state.voyageNarrative).map((key) => {
					return <VoyageLogEntry key={key} log={this.state.voyageNarrative[key]} />;
				})}
			</CollapsibleSection>
			<br />
		</div>);
	}
}

export class VoyageTools extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			showCalcAnyway: false
		};
	}

	_onRefreshNeeded() {
		this.forceUpdate();
	}

	componentDidMount() {
        this._updateCommandItems();
    }

    _updateCommandItems() {
        if (this.props.onCommandItemsUpdate) {
			const activeVoyage = STTApi.playerData.character.voyage.length > 0;

			if (activeVoyage) {
				this.props.onCommandItemsUpdate([{
					key: 'exportExcel',
					name: this.state.showCalcAnyway ? 'Switch to log' : 'Switch to recommendations',
					iconProps: { iconName: 'Switch' },
					onClick: () => {
						this.setState({ showCalcAnyway: !this.state.showCalcAnyway }, () => { this._updateCommandItems(); });
					}
				}]);
			} else {
				this.props.onCommandItemsUpdate([]);
			}
        }
    }

	render() {
		const activeVoyage = STTApi.playerData.character.voyage.length > 0;

		return (
			<div className='tab-panel' data-is-scrollable='true'>
				{(!activeVoyage || this.state.showCalcAnyway) && <VoyageCrew onRefreshNeeded={() => this._onRefreshNeeded()} />}
				{activeVoyage && !this.state.showCalcAnyway && <VoyageLog />}
			</div>
		);
	}
}