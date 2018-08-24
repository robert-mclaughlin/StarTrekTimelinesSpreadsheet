import React from 'react';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
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
import { CONFIG, bestVoyageShip, loadVoyage, startVoyage, resolveDilemma, formatCrewStats, bonusCrewForCurrentEvent } from 'sttapi';

import { download } from '../utils/pal';

export class VoyageCrew extends React.Component {
	constructor(props) {
		super(props);

		let bestVoyageShips = bestVoyageShip();
		this.state = {
			bestShips: bestVoyageShips,
			includeFrozen: false,
			includeActive: false,
			shipName: bestVoyageShips[0].ship.name,
			state: undefined,
			searchDepth: 6,
			extendsTarget: 0,
			activeEvent: undefined,
			peopleList: [],
			currentSelectedItems: [],
			preselectedIgnored: [],
			error: undefined
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

		this._exportVoyageData = this._exportVoyageData.bind(this);
		this._calcVoyageData = this._calcVoyageData.bind(this);
		this._generateVoyCrewRank = this._generateVoyCrewRank.bind(this);
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
				{(this.state.state === "inprogress") && (
					<Spinner size={SpinnerSize.small} label='Still calculating...' />
				)}
				<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
					{crewSpans}
				</div>
				<h3>Estimated duration: <b>{this.state.estimatedDuration.toFixed(2)} hours</b></h3>
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
			gridTemplateRows: '1fr 1fr 2fr',
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
				<TextField value={this.state.shipName} onChanged={v => this.setState({ shipName: v })} />
				<PrimaryButton onClick={this._startVoyage} text='Start voyage with recommendations' disabled={this.state.state !== 'done'} />
			</div>

			<br />

			{/* #!if ENV === 'electron' */}
			<DefaultButton onClick={this._generateVoyCrewRank} text='Export CSV with crew Voyage ranking...' disabled={this.state.state === 'inprogress'} />
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

	_exportVoyageData() {
		let dataToExport = {
			search_depth: this.state.searchDepth,
			extends_target: this.state.extendsTarget,
			shipAM: this.state.bestShips[0].score,

			// These values should be user-configurable to give folks a chance to tune the scoring function and provide feedback
			skillPrimaryMultiplier: 3.5,
			skillSecondaryMultiplier: 2.5,
			skillMatchingMultiplier: 1.1,
			traitScoreBoost: 200,

			// These values get filled in the following code
			crew: [],
			voyage_crew_slots: [],
			primary_skill: -1,
			secondary_skill: -1
		};

		let voyage_description = STTApi.playerData.character.voyage_descriptions[0];

		// Find unique traits used in the voyage slots
		let setTraits = new Set();
		voyage_description.crew_slots.forEach(slot => {
			setTraits.add(slot.trait);
		});

		let arrTraits = Array.from(setTraits);
		let skills = Object.keys(CONFIG.SKILLS);

		// Replace traits and skills with their id
		let slotTraitIds = [];
		for (let i = 0; i < voyage_description.crew_slots.length; i++) {
			let slot = voyage_description.crew_slots[i];
			dataToExport.voyage_crew_slots.push({
				id: i,
				skillId: skills.indexOf(slot.skill)
			});

			slotTraitIds[i] = arrTraits.indexOf(slot.trait);
		}

		dataToExport.primary_skill = skills.indexOf(voyage_description.skills.primary_skill);
		dataToExport.secondary_skill = skills.indexOf(voyage_description.skills.secondary_skill);

		STTApi.roster.forEach(crew => {
			// Filter out buy-back crew
			if (crew.buyback) {
				return;
			}

			if (!this.state.includeActive && (crew.active_id > 0)) {
				return;
			}

			if (!this.state.includeFrozen && (crew.frozen > 0)) {
				return;
			}

			// Filter out crew the user has chosen not to include
			if ((this.state.currentSelectedItems.length > 0) && this.state.currentSelectedItems.some(ignored => (ignored.text === crew.name))) {
				return;
			}

			let traitIds = [];
			crew.rawTraits.forEach(trait => {
				if (arrTraits.indexOf(trait) >= 0) {
					traitIds.push(arrTraits.indexOf(trait));
				}
			});

			let traitBitMask = 0;
			for (let nFlag = 0; nFlag < dataToExport.voyage_crew_slots.length; traitBitMask |= (traitIds.indexOf(slotTraitIds[nFlag]) !== -1) << nFlag++);

			// We store traits in the first 12 bits, using the next few for flags
			traitBitMask |= (crew.frozen > 0) << dataToExport.voyage_crew_slots.length;
			traitBitMask |= (crew.active_id && (crew.active_id > 0)) << (dataToExport.voyage_crew_slots.length + 1);
			traitBitMask |= (crew.level == 100 && crew.rarity == crew.max_rarity) << (dataToExport.voyage_crew_slots.length + 2); // ff100

			// Replace skill data with a binary blob
			let buffer = new ArrayBuffer(6 /*number of skills */ * 3 /*values per skill*/ * 2 /*we need 2 bytes per value*/);
			let skillData = new Uint16Array(buffer);
			for(let i = 0; i < skills.length; i++) {
				skillData[i*3] = crew[skills[i]].core;
				skillData[i*3 + 1] = crew[skills[i]].min;
				skillData[i*3 + 2] = crew[skills[i]].max;
			}

			// This won't be necessary once we switch away from Json to pure binary for native invocation
			let newCrew = {
				id: crew.crew_id ? crew.crew_id : crew.id,
				name: crew.name,
				traitBitMask: traitBitMask,
				max_rarity: crew.max_rarity,
				skillData: Array.from(skillData)
			};

			dataToExport.crew.push(newCrew);
		});

		return dataToExport;
	}

	_calcVoyageData() {
		let dataToExport = this._exportVoyageData();

		const parseResults = (result, state) => {
			let entries = [];
			for (let slot of result.selection) {
				let entry = {
					slotId: slot.slotId,
					choice: STTApi.roster.find((crew) => ((crew.crew_id === slot.crewId) || (crew.id === slot.crewId)))
				};

				entries.push(entry);
			}

			this.setState({
				crewSelection: entries,
				estimatedDuration: result.score,
				state: state
			});
		}

// #!if ENV === 'electron'
		const NativeExtension = require('electron').remote.require('stt-native');
		NativeExtension.calculateVoyageRecommendations(JSON.stringify(dataToExport), result => {
			parseResults(JSON.parse(result), 'done');
		}, progressResult => {
			let dv = new DataView(progressResult.buffer);
			let unpacked = {
				score: dv.getFloat32(0, true),
				selection: []
			};

			for (let i = 0; i < 12; i++) {
				unpacked.selection[i] = {
					slotId: dv.getUint8(4 + i),
					crewId: dv.getUint32(4 + 12 + (i*4), true)
				};
			}

			parseResults(unpacked, 'inprogress');
		});
// #!else
		let ComputeWorker = require("worker-loader?name=wasmWorker.js!./wasmWorker");

		const worker = new ComputeWorker();
		worker.addEventListener('message', (message) => {
			if (message.data.progressResult) {
				parseResults(message.data.progressResult, 'inprogress');
			} else if (message.data.result) {
				parseResults(message.data.result, 'done');
			}
		});

		worker.postMessage(dataToExport);
// #!endif
	}

	_generateVoyCrewRank() {
		let dataToExport = this._exportVoyageData();

		const NativeExtension = require('electron').remote.require('stt-native');
		NativeExtension.calculateVoyageCrewRank(JSON.stringify(dataToExport), (rankResult, estimateResult) => {
			this.setState({ state: 'calculating' });

			download('My Voyage Crew.csv', rankResult, 'Export Star Trek Timelines voyage crew ranking', 'Export');
			download('My Voyage Estimates.csv', estimateResult, 'Export Star Trek Timelines voyage estimates', 'Export');
		}, progressResult => {
			console.log("unexpected progress result!"); // not implemented yet..
		});
	}
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

		this.state = {
			showSpinner: true,
			includeFlavor: false
		};

		this.reloadVoyageState();
	}

	reloadVoyageState() {
		let voyage = STTApi.playerData.character.voyage[0];
		if (voyage && voyage.id) {
			loadVoyage(voyage.id, false).then((voyageNarrative) => {

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

				this.setState({
					showSpinner: false,
					ship_name: voyage.ship_name,
					ship_id: voyage.ship_id,
					created_at: voyage.created_at,
					voyage_duration: voyage.voyage_duration,
					seconds_since_last_dilemma: voyage.seconds_since_last_dilemma,
					seconds_between_dilemmas: voyage.seconds_between_dilemmas,
					skill_aggregates: voyage.skill_aggregates,
					crew_slots: voyage.crew_slots,
					voyage: voyage,
					voyageNarrative: voyageNarrative
				});
			});
		}
	}

	renderVoyageState() {
		if (this.state.voyage.state == "recalled") {
			return <p>Voyage has lasted for {Math.floor(this.state.voyage_duration / 60)} minutes and it's currently returning ({Math.floor(this.state.voyage.recall_time_left / 60)} minutes left).</p>;
		} else if (this.state.voyage.state == "failed") {
			return <p>Voyage has run out of antimatter after {Math.floor(this.state.voyage_duration / 60)} minutes and it's waiting to be abandoned or replenished.</p>;
		} else {
			return <p>Voyage has been ongoing for {Math.floor(this.state.voyage_duration / 60)} minutes (new dilemma in {Math.floor((this.state.seconds_between_dilemmas - this.state.seconds_since_last_dilemma) / 60)} minutes).</p>;
		}
	}

	_chooseDilemma(voyageId, dilemmaId, index) {
// #!if ENV === 'electron'
		if (index < 0) {
			// TODO: this should pick a random index out of the unlocked resolutions
			let promises = [];
			for (let i = 0; i < 21; i++) {
				promises.push(resolveDilemma(voyageId, dilemmaId, i % (-1 * index)));
			}

			Promise.all(promises).then(() => {
				// Remove the dilemma that was just resolved
				STTApi.playerData.character.voyage[0].dilemma = null;

				this.reloadVoyageState();
			});

			return;
		}
// #!endif

		resolveDilemma(voyageId, dilemmaId, index).then(() => {
			// Remove the dilemma that was just resolved
			STTApi.playerData.character.voyage[0].dilemma = null;

			this.reloadVoyageState();
		});
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
		if (this.state.showSpinner)
			return <Spinner size={SpinnerSize.large} label='Loading voyage details...' />;

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
			<h3>{'Pending rewards (' + this.state.voyage.pending_rewards.loot.length + ')'}</h3>
			{(this.state.voyage.pending_rewards.loot.length > 0) && this.state.voyage.pending_rewards.loot.map((loot, index) => {
				return (<span key={index} style={{ color: loot.rarity && CONFIG.RARITIES[loot.rarity].color }}>{loot.quantity} {(loot.rarity == null) ? '' : CONFIG.RARITIES[loot.rarity].name} {loot.full_name}</span>);
			}).reduce((prev, curr) => [prev, ', ', curr])}

			<h3>{'Complete Captain\'s Log (' + Object.keys(this.state.voyageNarrative).length + ')'}</h3>
			{Object.keys(this.state.voyageNarrative).map((key) => {
				return <VoyageLogEntry key={key} log={this.state.voyageNarrative[key]} />;
			})}
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

	render() {
		let activeVoyage = STTApi.playerData.character.voyage.length > 0;

		return (
			<div className='tab-panel' data-is-scrollable='true'>
				{activeVoyage && <PrimaryButton onClick={() => this.setState({ showCalcAnyway: !this.state.showCalcAnyway })} text={this.state.showCalcAnyway ? 'Switch to log' : 'Switch to recommendations'} />}
				{(!activeVoyage || this.state.showCalcAnyway) && <VoyageCrew onRefreshNeeded={() => this._onRefreshNeeded()} />}
				{activeVoyage && !this.state.showCalcAnyway && <VoyageLog />}
			</div>
		);
	}
}