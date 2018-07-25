import React from 'react';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { NormalPeoplePicker } from 'office-ui-fabric-react/lib/Pickers';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { TextField } from 'office-ui-fabric-react/lib/TextField';
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar';

import STTApi from 'sttapi';
import { CONFIG, bestVoyageShip, loadVoyage, startVoyage, resolveDilemma, formatCrewStats, bonusCrewForCurrentEvent } from 'sttapi';

import { download } from '../utils/pal';

const VoyageCalculators = {
	js: {
		name: 'Fast (quick & dirty)',
		supportsDepth: false
	},
	// #!if ENV === 'electron'
	cpp: {
		name: 'Thorough (best results)',
		supportsDepth: true
	},
	// #!else
	wasm: {
		name: 'EXPERIMENTAL Thorough (WebAssembly)',
		supportsDepth: true
	},
	// #!endif
};

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
			// #!if ENV === 'electron'
			selectedVoyageMethod: 'cpp',
			// #!else
			selectedVoyageMethod: 'wasm',
			// #!endif
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
		if ((this.state.state === "inprogress") || (this.state.state === "done")) {
			let crewSpans = [];
			this.state.crewSelection.forEach(entry => {
				if (entry.choice) {
					let crew = <Persona
						key={entry.choice.crew_id || entry.choice.id}
						imageUrl={entry.choice.iconUrl}
						text={entry.choice.name}
						secondaryText={entry.slotName}
						tertiaryText={formatCrewStats(entry.choice)}
						size={PersonaSize.large}
						presence={(entry.choice.frozen > 0) ? PersonaPresence.dnd : ((entry.choice.active_id > 0) ? PersonaPresence.away : PersonaPresence.online)} />

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

		let dropdownOptions = Object.keys(VoyageCalculators).map(calc => { return { key: calc, text: VoyageCalculators[calc].name }; });

		let containerStyle = {
			display: 'grid',
			padding: '5px',
			gridGap: '10px',
			gridTemplateColumns: 'repeat(4, 1fr)',
			gridTemplateRows: '1fr 1fr',
			gridTemplateAreas: `
			"dropdown calcbutton shipdrop startbutton"
			"dropdown calcbutton shipdrop startbutton"`};

		return (<div>
			{this.state.error && <MessageBar messageBarType={MessageBarType.error}>Error: {this.state.error}</MessageBar>}
			{/* #!if ENV === 'electron' */}
			<p><b>NOTE: </b>Algorithms are still a work in progress. Please provide feedback on your recommendations and voyage results!</p>
			{/* #!else */}
			<br />
			<h2 style={{ backgroundColor: 'Tomato' }}>NOTE: If the experimental algorithm keeps crashing your browser, try reducing the search depth! And let me know by logging a bug.</h2>
			{/* #!endif */}

			<div style={containerStyle}>
				<div style={{ gridArea: 'dropdown' }}>
					<Dropdown
						label='Algorithm to use:'
						selectedKey={this.state.selectedVoyageMethod}
						onChanged={item => this.setState({ selectedVoyageMethod: item.key })}
						placeHolder='Select an optimization method'
						options={dropdownOptions}
					/>
				</div>

				<div style={{ gridArea: 'calcbutton', justifySelf: 'center', alignSelf: 'center' }}>
					<PrimaryButton onClick={this._exportVoyageData} text='Calculate best crew selection' disabled={this.state.state === 'inprogress'} />
				</div>

				<div style={{ gridArea: 'shipdrop' }}>
					<TextField
						label='Ship Name'
						value={this.state.shipName}
						onChanged={v => this.setState({ shipName: v })}
					/>
				</div>

				<div style={{ gridArea: 'startbutton', justifySelf: 'center', alignSelf: 'center' }}>
					<PrimaryButton onClick={this._startVoyage} text='Start voyage with recommendations' disabled={this.state.state !== 'done'} />
				</div>
			</div>

			<h3>Best ship(s)</h3>
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
				{shipSpans}
			</div>

			{this.renderBestCrew()}

			<div className="ui grid" style={{ maxWidth: '600px' }}>
				<div className="row">
					<div className="column"><h4>Algorithm settings</h4></div>
				</div>

				<div className="two column row" style={{ display: VoyageCalculators[this.state.selectedVoyageMethod].supportsDepth ? 'inline-block' : 'none' }}>
					<div className="column">
						<SpinButton value={this.state.searchDepth} label={'Search depth:'} min={2} max={30} step={1}
							onIncrement={(value) => { this.setState({ searchDepth: +value + 1 }); }}
							onDecrement={(value) => { this.setState({ searchDepth: +value - 1 }); }}
						/>
					</div>
					<div className="column">
						<SpinButton value={this.state.extendsTarget} label='Extends (target):' min={0} max={10} step={1}
							onIncrement={(value) => { this.setState({ extendsTarget: +value + 1 }); }}
							onDecrement={(value) => { this.setState({ extendsTarget: +value - 1 }); }}
						/>
					</div>
				</div>

				<div className="two column row">
					<div className="column">
						<Checkbox checked={this.state.includeActive} label="Include active (on shuttles) crew"
							onChange={(e, isChecked) => { this.setState({ includeActive: isChecked }); }}
						/>
					</div>
					<div className="column">
						<Checkbox checked={this.state.includeFrozen} label="Include frozen (vaulted) crew"
							onChange={(e, isChecked) => { this.setState({ includeFrozen: isChecked }); }}
						/>
					</div>
				</div>

				<div className="row">
					<div className="column">
						<p>Crew you don't want to consider for voyage
                            {this.state.activeEvent && <span> (preselected crew which gives bonus in the event <b>{this.state.activeEvent}</b>)</span>}: </p>
						<PrimaryButton onClick={() => { this.setState({ currentSelectedItems: [] }); }} text='Clear' disabled={this.state.currentSelectedItems.length === 0} />
						<NormalPeoplePicker
							onResolveSuggestions={this._onFilterChanged}
							selectedItems={this.state.currentSelectedItems}
							onChange={this._onItemsChange}
						/>
					</div>
				</div>
			</div>

			<br />

			{/* #!if ENV === 'electron' */}
			<PrimaryButton onClick={this._generateVoyCrewRank} text='Export CSV with crew Voyage ranking...' disabled={this.state.state === 'inprogress'} />
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
		for (let slot of STTApi.playerData.character.voyage_descriptions[0].crew_slots) {
			let entry = this.state.crewSelection.find(entry => entry.slotName == slot.name);

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
			crew: STTApi.roster.map(crew => new Object({
				id: crew.crew_id ? crew.crew_id : crew.id,
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

		// Filter out crew the user has chosen not to include
		if (this.state.currentSelectedItems.length > 0) {
			dataToExport.crew = dataToExport.crew.filter(crew => (this.state.currentSelectedItems.find(ignored => (ignored.text === crew.name)) === undefined));
		}

		// Filter out buy-back crew
		dataToExport.crew = dataToExport.crew.filter(c => !c.buyback);

		function cppEntries(result) {
			let entries = [];
			for (var slotName in result.selection) {
				let entry = {
					hasTrait: false,
					slotName: slotName,
					score: 0,
					choice: STTApi.roster.find((crew) => ((crew.crew_id === result.selection[slotName]) || (crew.id === result.selection[slotName])))
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
				crewSelection: VoyageCalculators[this.state.selectedVoyageMethod].supportsDepth ? cppEntries(result) : jsEntries(result),
				estimatedDuration: result.bestCrewTime || result.score || 0,
				state: state
			};
		}

		if (this.state.selectedVoyageMethod === 'cpp') {
			const NativeExtension = require('electron').remote.require('stt-native');
			NativeExtension.calculateVoyageRecommendations(JSON.stringify(dataToExport), result => {
				this.setState(parseResults(JSON.parse(result), 'done'));
			}, progressResult => {
				this.setState(parseResults(JSON.parse(progressResult), 'inprogress'));
			});
		} else if (this.state.selectedVoyageMethod === 'js') {
			if (this.state.includeActive === false) {
				dataToExport.crew = dataToExport.crew.filter(c => c.active_id === 0);
			}

			if (this.state.includeFrozen === false) {
				dataToExport.crew = dataToExport.crew.filter(c => c.frozen === 0);
			}

			this.setState(parseResults(calculateBestVoyage(dataToExport), 'done'));
		} else if (this.state.selectedVoyageMethod === 'wasm') {
			let ComputeWorker = require("worker-loader?name=wasmWorker.js!./wasmWorker");

			const worker = new ComputeWorker();
			worker.addEventListener('message', (message) => {
				if (message.data.progressResult) {
					this.setState(parseResults(JSON.parse(message.data.progressResult), 'inprogress'));
				} else if (message.data.result) {
					this.setState(parseResults(JSON.parse(message.data.result), 'done'));
				}
			});

			worker.postMessage(dataToExport);
		}
	}

	_generateVoyCrewRank() {
		const NativeExtension = require('electron').remote.require('stt-native');

		let dataToExport = {
			crew: STTApi.roster.map(crew => new Object({
				id: crew.crew_id || crew.id,
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
			includeFrozenCrew: this.state.includeFrozen
		};

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
			return <p>Voyage has lasted for {Math.floor(this.state.voyage_duration / 60)} minutes and it's currently returning.</p>;
		} else if (this.state.voyage.state == "failed") {
			return <p>Voyage has run out of antimatter after {Math.floor(this.state.voyage_duration / 60)} minutes and it's waiting to be abandoned or replenished.</p>;
		} else {
			return <p>Voyage has been ongoing for {Math.floor(this.state.voyage_duration / 60)} minutes (new dilemma in {Math.floor((this.state.seconds_between_dilemmas - this.state.seconds_since_last_dilemma) / 60)} minutes).</p>;
		}
	}

	_chooseDilemma(voyageId, dilemmaId, index) {
		if (index === -1) {
			// TODO: this should pick a random index out of the unlocked resolutions
			let promises = [];
			for (let i = 0; i < 21; i++) {
				promises.push(resolveDilemma(voyageId, dilemmaId, i % 3));
			}

			Promise.all(promises).then(() => {
				// Remove the dilemma that was just resolved
				STTApi.playerData.character.voyage[0].dilemma = null;

				this.reloadVoyageState();
			});
		}
		else {
			resolveDilemma(voyageId, dilemmaId, index).then(() => {
				// Remove the dilemma that was just resolved
				STTApi.playerData.character.voyage[0].dilemma = null;

				this.reloadVoyageState();
			});
		}
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

						<div className="item" key={-1} onClick={() => this._chooseDilemma(this.state.voyage.id, this.state.voyage.dilemma.id, -1)}>
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


// TODO: This stuff should move out into a separate file (it's for the JavaScript-based voyage algorithm)

const calculateBestVoyage = (data) => {
	let crewState = {
		bestCrew: [],
		bestCrewTime: 0,
		// Array to be filled with states where there are multiple options for placing crew
		decisionPoints: []
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
	} while (isEmptySlot(nextState.bestCrew))
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
	var cycleSeconds = ticksPerCycle * secondsPerTick
	var cyclesPerHour = 60 * 60 / cycleSeconds
	var hazPerCycle = 6
	var activityPerCycle = 18
	var dilemmasPerHour = 0.5
	var hazPerHour = hazPerCycle * cyclesPerHour - dilemmasPerHour
	var hazSkillPerHour = 1250
	var hazAmPass = 5
	var hazAmFail = 30
	var activityAmPerHour = activityPerCycle * cyclesPerHour
	var minPerHour = 60
	var psChance = 0.35
	var ssChance = 0.25
	var osChance = 0.1
	var skillChances = [psChance, ssChance, osChance, osChance, osChance, osChance]
	var dilPerMin = 5


	const crewTotalsAndProfs = crew.reduce((total, c) => {
		for (let i = 0; i < skillNames.length; i++) {
			const skillName = skillNames[i];
			total.totalSkills[skillName] = total.totalSkills[skillName] + skillScore(c[skillName]) || skillScore(c[skillName]);
			const profRange = c[skillName] ? Math.max(c[skillName].max, c[skillName].min) - c[skillName].min : 0;
			total.totalProfs[skillName] = total.totalProfs[skillName] + profRange || profRange;
		}
		return total;
	}, { totalSkills: {}, totalProfs: {} }),
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
	var skills = [ps, ss];
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

	var elapsedHazSkill = elapsedHours * hazSkillPerHour

	var maxSkill = Math.max(...skills)
	maxSkill = Math.max(0, maxSkill - elapsedHazSkill)
	var endVoySkill = maxSkill * (1 + hazSkillVariances[0])


	var tries = 0
	while (1 > 0) {
		tries++
		if (tries == 100) {
			setWarning(0, "Something went wrong! Check your inputs.")
			break
		}

		//test.text += Math.floor(endVoySkill) + " "
		var am = ship;
		for (i = 0; i < skills.length; i++) {
			var skill = skills[i];
			const hazSkillVariance = hazSkillVariances[i];
			skill = Math.max(0, skill - elapsedHazSkill)
			var chance = skillChances[i]

			// skill amount for 100% pass
			var passSkill = Math.min(endVoySkill, skill * (1 - hazSkillVariance))

			// skill amount for RNG pass
			// (compute passing proportion of triangular RNG area - integral of x)
			var skillRngRange = skill * hazSkillVariance * 2
			var lostRngProportion = 0
			if (skillRngRange > 0) { // avoid division by 0
				lostRngProportion = Math.max(0, Math.min(1, (skill * (1 + hazSkillVariance) - endVoySkill) / skillRngRange))
			}
			var skillPassRngProportion = 1 - lostRngProportion * lostRngProportion
			passSkill += skillRngRange * skillPassRngProportion / 2

			//passSkill = Math.max(0, passSkill - elapsedHazSkill)

			//test.text += "+" + Math.floor(100*lostRngProportion)/100 + " "

			// am gained for passing hazards
			am += passSkill * chance / hazSkillPerHour * hazPerHour * hazAmPass

			// skill amount for 100% hazard fail
			var failSkill = Math.max(0, endVoySkill - skill * (1 + hazSkillVariance))
			// skill amount for RNG fail
			var skillFailRngProportion = Math.pow(1 - lostRngProportion, 2)
			failSkill += skillRngRange * skillFailRngProportion / 2

			//test.text += "-" + Math.floor(100*skillFailRngProportion)/100 + " "

			// am lost for failing hazards
			am -= failSkill * chance / hazSkillPerHour * hazPerHour * hazAmFail
		}

		//test.text += Math.floor(am) + " "

		var amLeft = am - endVoySkill / hazSkillPerHour * activityAmPerHour
		var timeLeft = amLeft / (hazPerHour * hazAmFail + activityAmPerHour)

		var voyTime = endVoySkill / hazSkillPerHour + timeLeft + elapsedHours

		if (Math.abs(timeLeft) > 0.0001) {
			endVoySkill = (voyTime - elapsedHours) * hazSkillPerHour
			continue
		} else {
			break
		}
	}

	return voyTime;

}
